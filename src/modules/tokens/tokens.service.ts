import { Injectable, Logger } from '@nestjs/common';
import { TokenMetadataResponse } from 'alchemy-sdk';
import { AlchemyService } from 'src/modules/alchemy/alchemy.service';
import { Address, zeroAddress } from 'viem';
import { WalletTokenBalance } from './entities/token.type';
import { UniswapV3Service } from 'src/modules/uniswap-v3/uniswap-v3.service';
import { MobulaService } from '../mobula/mobula.service';
import {
  MobulaChain,
  MobulaExtendedToken,
  MobulaMultiDataToken,
  MobulaMultipleTokens,
  MobulaTokenSocials,
} from '../mobula/entities/mobula.entities';
import {
  USDC_ADDRESSES,
  WETH_ADDRESSES,
} from 'src/shared/utils/constants/chains';

const WHITELISTED_CHAINS = Array.from(Object.values(MobulaChain));

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(
    private readonly alchemyService: AlchemyService,
    private readonly uniswapV3Service: UniswapV3Service,
    private readonly mobulaService: MobulaService,
  ) {}

  public async getWalletBalances(
    wallet: Address,
  ): Promise<WalletTokenBalance[]> {
    const client = this.alchemyService.client;

    try {
      const balances = await client.core.getTokenBalances(wallet);

      const nonZeroBalances = balances.tokenBalances.filter((token) => {
        return token.tokenBalance !== '0';
      });

      const tokens: WalletTokenBalance[] = [];

      for (let token of nonZeroBalances) {
        const tokenAddress = token.contractAddress as Address;

        const metadata = await this.getTokenMetadataByContract(tokenAddress);

        tokens.push({
          name: metadata.name,
          symbol: metadata.symbol,
          mainAddress: token.contractAddress,
          balance: (
            +token.tokenBalance / Math.pow(10, metadata.decimals)
          ).toString(),
        });
      }

      return tokens;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  public async discoverTokens(limit = 200): Promise<MobulaExtendedToken[]> {
    this.logger.log(`Initiating token discovery (max ${limit})`);

    const tokenSocials: Map<number, MobulaTokenSocials> = new Map();

    try {
      const rawList = await this.mobulaService.getAllTokens([
        'blockchains',
        'contracts',
        'liquidity',
        'market_cap',
        'website',
        'twitter',
      ]);

      this.logger.log(`Fetched raw token list (${rawList.length} entries)`);

      for (const token of rawList) {
        const { id, twitter, website } = token;
        tokenSocials.set(id, { twitter, website });
      }

      const filteredList = this.filterDiscoveredTokens(rawList);

      this.logger.log(
        `Filtered raw token list to ${filteredList.length} entries`,
      );

      const extendedTokens = await this.mobulaService.getTokenMultiData(
        filteredList.map((t) => t.id),
      );

      this.logger.log(
        `Extended tokens with more market data, calculating score..`,
      );

      const scoredTokens: MobulaExtendedToken[] = extendedTokens
        .map((extendedToken) => {
          const filteredContracts = extendedToken.contracts.filter((contract) =>
            WHITELISTED_CHAINS.includes(contract.blockchain),
          );

          const { id, ...token } = extendedToken;

          return {
            ...token,
            token_id: id,
            timestamp: Date.now(),
            extra: tokenSocials.get(extendedToken.id),
            contracts: filteredContracts,
            score: this.computeTokenScore(extendedToken),
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ score, ...token }) => token);

      this.logger.log(`Filtering tokens without known liquidity pools..`);

      const filteredTokens = await this.filterTokenWithPools(scoredTokens);

      this.logger.log(
        `Discovery completed with ${filteredTokens.length} tokens !`,
      );

      return filteredTokens;
    } catch (error) {
      console.error('Error discovering tokens:', error);
      throw error;
    }
  }

  private filterDiscoveredTokens(
    tokens: MobulaMultipleTokens[],
  ): MobulaMultipleTokens[] {
    const isStableCoin = (identifier: string): boolean => {
      return identifier?.toLowerCase().includes('usd');
    };

    return tokens.filter((token) => {
      const { blockchains, contracts, liquidity, market_cap, symbol, name } =
        token;

      if (!blockchains?.length || !contracts?.length || !liquidity)
        return false;

      if (isStableCoin(symbol) || isStableCoin(name)) return false;

      if (!blockchains.some((chain) => WHITELISTED_CHAINS.includes(chain)))
        return false;

      return market_cap > 1_000_000;
    });
  }

  private computeTokenScore(token: any): number {
    const volatility = (() => {
      const change = token.price_change_24h ?? 0;
      const clamped = Math.min(Math.abs(change), 1000); // Max 1000%
      return clamped / 100;
    })();

    const volume = (() => {
      const v = token.volume ?? 0;
      return v > 0 ? Math.min(v / 1_000_000, 1) : 0;
    })();

    const liquidity = (() => {
      const l = token.liquidity ?? 0;
      if (l < 1000) return 0;
      return Math.min(l / 500_000, 1);
    })();

    const marketCap = (() => {
      const cap = token.market_cap ?? 0;
      if (cap <= 10_000) return 0;
      if (cap <= 250_000) return 0.25;
      if (cap <= 2_000_000) return 0.5;
      if (cap <= 25_000_000) return 0.75;
      if (cap <= 100_000_000) return 1;
      return 0.5;
    })();

    return volatility * 2 + volume * 1.5 + liquidity * 2 + marketCap * 1;
  }

  private async filterTokenWithPools(
    tokens: MobulaExtendedToken[],
  ): Promise<MobulaExtendedToken[]> {
    const tokenWithPools: MobulaExtendedToken[] = [];

    for (let token of tokens) {
      if (!token?.contracts?.length) continue;

      const [contract] = token.contracts;
      const wethAddress: Address = WETH_ADDRESSES[contract.blockchain];

      const wethPoolAddress = await this.uniswapV3Service.getPoolAddress({
        chain: contract.blockchain,
        tokenA: contract.address,
        tokenB: wethAddress,
      });

      if (wethPoolAddress === zeroAddress) {
        const usdcAddress: Address = USDC_ADDRESSES[contract.blockchain];

        const usdcPoolAddress = await this.uniswapV3Service.getPoolAddress({
          chain: contract.blockchain,
          tokenA: contract.address,
          tokenB: usdcAddress,
        });

        if (usdcPoolAddress === zeroAddress) continue;
      }

      tokenWithPools.push(token);
    }

    return tokenWithPools;
  }

  private async getTokenMetadataByContract(
    tokenAddress: Address,
  ): Promise<TokenMetadataResponse> {
    const metadata =
      await this.alchemyService.client.core.getTokenMetadata(tokenAddress);

    return metadata;
  }

  public async getTokenByMobulaId(
    token_id: number,
  ): Promise<MobulaMultiDataToken> {
    return await this.mobulaService.getTokenMarketDataById(token_id);
  }

  public async getMultiTokenByMobulaIds(
    tokenIds: number[],
  ): Promise<MobulaMultiDataToken[]> {
    if (!tokenIds || !tokenIds.length) return [];
    return await this.mobulaService.getTokenMultiData(tokenIds);
  }
}
