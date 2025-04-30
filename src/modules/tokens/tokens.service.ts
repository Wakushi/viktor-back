import { Injectable, Logger } from '@nestjs/common';
import { Address, zeroAddress } from 'viem';
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
  WRAPPED_NATIVE_ADDRESSES,
} from 'src/shared/utils/constants/chains';
import { STABLECOINS_ID_SET } from '../mobula/entities/stablecoins';
import { SupabaseError, SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections.type';
import { TokenMetadata } from './entities/metadata.type';
import { isValidAddress } from 'src/shared/utils/helpers';
import { SettingsService } from '../settings/settings.service';
import { LogGateway } from 'src/shared/services/log-gateway';

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);
  private whitelistedChains: MobulaChain[] = [];

  constructor(
    private readonly uniswapV3Service: UniswapV3Service,
    private readonly mobulaService: MobulaService,
    private readonly supabaseService: SupabaseService,
    private readonly settingsService: SettingsService,
    private readonly logGateway: LogGateway,
  ) {}

  public async discoverTokens(limit = 500): Promise<MobulaExtendedToken[]> {
    this.log(`Initiating token discovery (max ${limit})`);

    this.whitelistedChains = await this.settingsService.getWhitelistedChains();

    this.log(`Whitelisted chains: ${this.whitelistedChains.join(', ')}`);

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

      this.log(`Fetched raw token list (${rawList.length} entries)`);

      for (const token of rawList) {
        const { id, twitter, website } = token;
        tokenSocials.set(id, { twitter, website });
      }

      const filteredList = this.filterDiscoveredTokens(rawList);

      this.log(`Filtered raw token list to ${filteredList.length} entries`);

      const extendedTokens = await this.mobulaService.getTokenMultiData(
        filteredList.map((t) => t.id),
      );

      this.log(`Extended tokens with more market data, calculating score..`);

      const scoredTokens: MobulaExtendedToken[] = extendedTokens
        .map((extendedToken) => {
          const filteredContracts = extendedToken.contracts.filter((contract) =>
            this.whitelistedChains.includes(contract.blockchain),
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

      this.log(`Filtering tokens without known liquidity pools..`);

      const filteredTokens = await this.filterTokenWithPools(scoredTokens);

      this.log(`Discovery completed with ${filteredTokens.length} tokens !`);

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

      if (!blockchains.some((chain) => this.whitelistedChains.includes(chain)))
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

    const tokenMetadatas = await this.getAllTokenMetadatas();

    for (const token of tokens) {
      if (!token?.contracts?.length) continue;

      const tokenMetadata = tokenMetadatas.find(
        (metadata) => metadata.token_id === token.token_id,
      );

      if (
        tokenMetadata &&
        (isValidAddress(tokenMetadata.weth_pool_address) ||
          isValidAddress(tokenMetadata.usdc_pool_address))
      ) {
        tokenWithPools.push(token);
        continue;
      }

      const [contract] = token.contracts;

      const wethAddress: Address =
        WRAPPED_NATIVE_ADDRESSES[contract.blockchain];

      let wethPoolAddress: Address = zeroAddress;
      let usdcPoolAddress: Address = zeroAddress;

      wethPoolAddress = await this.uniswapV3Service.getPoolAddress({
        chain: contract.blockchain,
        tokenA: contract.address,
        tokenB: wethAddress,
      });

      if (wethPoolAddress === zeroAddress) {
        const usdcAddress: Address = USDC_ADDRESSES[contract.blockchain];

        usdcPoolAddress = await this.uniswapV3Service.getPoolAddress({
          chain: contract.blockchain,
          tokenA: contract.address,
          tokenB: usdcAddress,
        });

        if (usdcPoolAddress === zeroAddress) continue;
      }

      await this.saveTokenMetadata({
        token_id: token.token_id,
        name: token.name,
        chain: contract.blockchain,
        weth_pool_address: wethPoolAddress,
        usdc_pool_address: usdcPoolAddress,
      });

      tokenWithPools.push(token);
    }

    return tokenWithPools;
  }

  public async getMultiTokenByMobulaIds(
    tokenIds: number[],
  ): Promise<MobulaMultiDataToken[]> {
    if (!tokenIds || !tokenIds.length) return [];
    return await this.mobulaService.getTokenMultiData(tokenIds);
  }

  public async getAllTokenMetadatas(): Promise<TokenMetadata[]> {
    const { data, error } = await this.supabaseService.client
      .from(Collection.TOKEN_METADATA)
      .select('*');

    if (error) {
      throw new SupabaseError('Failed to fetch token metadata', error);
    }

    return data;
  }

  public async saveTokenMetadata(tokenMetadata: TokenMetadata): Promise<void> {
    this.log(`Saving token metadata for token ${tokenMetadata.name}`);

    const { error } = await this.supabaseService.client
      .from(Collection.TOKEN_METADATA)
      .insert(tokenMetadata);

    if (error) {
      throw new SupabaseError('Failed to save token metadata', error);
    }
  }

  private log(message: string) {
    this.logger.log(message);
    this.logGateway.sendLog(message);
  }
}
