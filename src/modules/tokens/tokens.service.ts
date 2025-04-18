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
import { STABLECOINS_ID_SET } from '../mobula/entities/stablecoins';

const WHITELISTED_CHAINS = [MobulaChain.BASE, MobulaChain.ETHEREUM];

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

  public async discoverTokens(limit = 500): Promise<MobulaExtendedToken[]> {
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
    const MIN_MARKET_CAP = 1000000;
    const MIN_LIQUIDITY = 300000;

    return tokens.filter((token) => {
      const { blockchains, contracts, liquidity, market_cap, symbol, name } =
        token;

      if (!blockchains?.length || !contracts?.length || !liquidity)
        return false;

      if (
        STABLECOINS_ID_SET.has(token.id) ||
        name.toLowerCase().includes('usd') ||
        symbol.toLowerCase().includes('usd')
      )
        return false;

      if (!blockchains.some((chain) => WHITELISTED_CHAINS.includes(chain)))
        return false;

      return market_cap > MIN_MARKET_CAP && liquidity > MIN_LIQUIDITY;
    });
  }

  private computeTokenScore(token: MobulaExtendedToken): number {
    const priceChange24h = token.price_change_24h ?? 0;
    const volumeUSD = token.volume ?? 0;
    const liquidityUSD = token.liquidity ?? 0;
    const marketCapUSD = token.market_cap ?? 0;

    const volatility = Math.min(Math.abs(priceChange24h), 200) / 100;

    const volumeScore = Math.min(volumeUSD / 1_000_000, 1);

    const liquidityScore =
      liquidityUSD < 10_000 ? 0 : Math.min(liquidityUSD / 500_000, 1);

    const marketCapScore = (() => {
      if (marketCapUSD < 100_000) return 0;
      if (marketCapUSD < 1_000_000) return 0.4;
      if (marketCapUSD < 10_000_000) return 0.8;
      if (marketCapUSD < 100_000_000) return 1;
      if (marketCapUSD < 500_000_000) return 0.8;
      return 0.6;
    })();

    const hasTwitter = token.extra?.twitter ? 0.25 : 0;
    const hasWebsite =
      token.extra?.website && token.extra.website.includes('.') ? 0.25 : 0;
    const socialScore = hasTwitter + hasWebsite;

    const rugPenalty =
      Math.abs(priceChange24h) > 90 && marketCapUSD < 1_000_000 ? 0.7 : 1;

    const score =
      (volatility * 1.5 +
        volumeScore * 2 +
        liquidityScore * 2 +
        marketCapScore * 2 +
        socialScore) *
      rugPenalty;

    return score;
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
