import { Injectable } from '@nestjs/common';
import { TokenMetadataResponse } from 'alchemy-sdk';
import { AlchemyService } from 'src/modules/alchemy/alchemy.service';
import { Address } from 'viem';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from 'config/env.validation';
import { SupabaseService } from 'src/modules/supabase/supabase.service';
import {
  WalletTokenBalance,
  TokenDiscoveryParams,
  TokenMarketObservation,
  TokenData,
  TokenMetadata,
} from './entities/token.type';
import { extractTokenChains } from 'src/shared/utils/helpers';
import {
  SimplifiedChain,
  WHITELISTED_CHAINS,
} from 'src/shared/utils/constants/chains';
import { UniswapV3Service } from 'src/modules/uniswap-v3/uniswap-v3.service';
import { CoinGeckoSimpleToken } from './entities/coin-gecko.type';
import { calculateQualityScores } from './helpers/token-quality';
import { WETH } from './mocks/WETH.mock';

@Injectable()
export class TokensService {
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';

  constructor(
    private readonly alchemyService: AlchemyService,
    private readonly supabaseService: SupabaseService,
    private readonly uniswapV3Service: UniswapV3Service,
    private readonly config: ConfigService<EnvConfig, true>,
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

  public async discoverTokens(
    params: TokenDiscoveryParams = {},
  ): Promise<TokenData[]> {
    try {
      const tokensMarketObservations: TokenMarketObservation[] =
        await this.fetchInitialTokenList(200);

      const filteredTokens: TokenMarketObservation[] =
        await this.applyBaselineFilters(tokensMarketObservations, params);

      const completeTokens: TokenData[] =
        await this.populateTokensMetadata(filteredTokens);

      const evmChainsTokens: TokenData[] = this.filterByChain(
        completeTokens,
        WHITELISTED_CHAINS,
      );

      const tokenWithPools: TokenData[] =
        await this.filterTokenWithPools(evmChainsTokens);

      const rankedTokens = this.rankTokensByQuality(tokenWithPools);

      return rankedTokens;
    } catch (error) {
      console.error('Error in token discovery:', error);
      return [];
    }
  }

  private async fetchInitialTokenList(
    maxAmount: number = 250,
  ): Promise<TokenMarketObservation[]> {
    try {
      const params = new URLSearchParams({
        vs_currency: 'usd',
        order: 'volume_desc',
        per_page: maxAmount.toString(),
        page: '1',
        sparkline: 'false',
      });

      const response = await fetch(
        `${this.COINGECKO_API}/coins/markets?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as CoinGeckoSimpleToken[];

      return data.map((rawToken) => ({
        coin_gecko_id: rawToken.id,
        timestamp: Date.now(),
        created_at: new Date(),
        market_cap_rank: rawToken.market_cap_rank,
        price_usd: rawToken.current_price,
        high_24h: rawToken.high_24h,
        low_24h: rawToken.low_24h,
        ath: rawToken.ath,
        ath_change_percentage: rawToken.ath_change_percentage,
        atl: rawToken.atl,
        total_volume: rawToken.total_volume,
        atl_change_percentage: rawToken.atl_change_percentage,
        market_cap: rawToken.market_cap,
        fully_diluted_valuation: rawToken.fully_diluted_valuation ?? 0,
        circulating_supply: rawToken.circulating_supply,
        total_supply: rawToken.total_supply ?? 0,
        max_supply: rawToken.max_supply,
        supply_ratio: rawToken.total_supply
          ? rawToken.circulating_supply / rawToken.total_supply
          : 0,
        price_change_24h: rawToken.price_change_24h,
        price_change_percentage_24h: rawToken.price_change_percentage_24h,
        market_cap_change_24h: rawToken.market_cap_change_24h,
        market_cap_change_percentage_24h:
          rawToken.market_cap_change_percentage_24h,
      }));
    } catch (error) {
      console.error('Error fetching initial token list:', error);
      return [];
    }
  }

  private async populateTokensMetadata(
    tokens: TokenMarketObservation[],
  ): Promise<TokenData[]> {
    const completeTokens: TokenData[] = [];

    for (let token of tokens) {
      const metadata = await this.getTokenMetadataById(token.coin_gecko_id);

      const isStablecoin =
        metadata?.categories &&
        metadata.categories.some(
          (category) => category.toLowerCase() === 'stablecoins',
        );

      if (isStablecoin) {
        console.log('Filtering out stablecoin :', metadata.name);
      }

      if (metadata && !isStablecoin) {
        completeTokens.push({
          market: token,
          metadata,
        });
      }
    }

    return completeTokens;
  }

  private async getTokenMetadataById(
    coingeckoId: string,
  ): Promise<TokenMetadata | null> {
    try {
      const cachedData =
        await this.supabaseService.getTokenMetadataById(coingeckoId);

      if (cachedData) return cachedData;

      const metadata: TokenMetadata | null =
        await this.getCoinGeckoMetadataById(coingeckoId);

      if (!metadata) return null;

      await this.supabaseService.insertTokenMetadata(metadata);

      return metadata;
    } catch (error) {
      console.error(`Error fetching metadata for ${coingeckoId}`);
      return null;
    }
  }

  private async getCoinGeckoMetadataById(
    coingeckoId: string,
  ): Promise<TokenMetadata | null> {
    try {
      const response = await fetch(
        `${this.COINGECKO_API}/coins/${coingeckoId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      const metadata: TokenMetadata = {
        id: data.id,
        symbol: data.symbol.toLowerCase(),
        name: data.name,
        contract_addresses: data.detail_platforms || {},
        market_cap_rank: data.market_cap_rank,
        genesis_date: data.genesis_date ? new Date(data.genesis_date) : null,
        categories: data.categories || [],
        links: {
          website: data.links.homepage.filter(Boolean),
          twitter: data.links.twitter_screen_name,
          telegram: data.links.telegram_channel_identifier,
          github: data.links.repos_url.github || [],
        },
        platforms: data.platforms,
        last_updated: new Date(),
        created_at: new Date(),
      };

      return metadata;
    } catch (error) {
      return null;
    }
  }

  private async applyBaselineFilters(
    tokens: TokenMarketObservation[],
    params: TokenDiscoveryParams,
  ): Promise<TokenMarketObservation[]> {
    const {
      minLiquidity = 100000, // $100k minimum liquidity
      minVolume = 50000, // $50k minimum daily volume
    } = params;

    return tokens.filter(
      (token) =>
        token.total_volume * 0.1 >= minLiquidity &&
        token.total_volume >= minVolume,
    );
  }

  private async filterTokenWithPools(
    tokens: TokenData[],
  ): Promise<TokenData[]> {
    const tokenWithPools: TokenData[] = [];

    for (let token of tokens) {
      const hasPool = await this.uniswapV3Service.doesPoolExists({
        tokenA: token,
        tokenB: WETH,
      });

      if (!hasPool) continue;

      tokenWithPools.push(token);
    }

    return tokenWithPools;
  }

  private filterByChain(
    tokens: TokenData[],
    targetChains: SimplifiedChain[],
  ): TokenData[] {
    const filteredTokens: TokenData[] = tokens.filter((token) => {
      if (!token.metadata || !token.metadata.contract_addresses) return false;

      const tokenChains = extractTokenChains(token);

      return tokenChains.some((tokenChain) =>
        targetChains.some(
          (targetChain) => targetChain.name === tokenChain.name,
        ),
      );
    });

    return filteredTokens;
  }

  private rankTokensByQuality(tokens: TokenData[]): TokenData[] {
    const scoredTokens = tokens.map((token) => ({
      token,
      scores: calculateQualityScores(token),
    }));

    return scoredTokens
      .sort((a, b) => b.scores.total - a.scores.total)
      .map((item) => item.token);
  }

  private async getTokenMetadataByContract(
    tokenAddress: Address,
  ): Promise<TokenMetadataResponse> {
    const metadata =
      await this.alchemyService.client.core.getTokenMetadata(tokenAddress);

    return metadata;
  }
}
