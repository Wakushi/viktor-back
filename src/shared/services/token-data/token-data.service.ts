import { Injectable } from '@nestjs/common';
import { TokenMetadataResponse } from 'alchemy-sdk';
import { AlchemyService } from 'src/modules/alchemy/alchemy.service';
import { Address } from 'viem';
import {
  CoinGeckoTokenMetadata,
  CoinGeckoTokenResponse,
} from './entities/coin-gecko.type';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from 'config/env.validation';
import { SupabaseService } from 'src/modules/supabase/supabase.service';
import {
  TokenBalance,
  TokenDiscoveryParams,
  TokenMarketData,
} from './entities/token.type';
import { extractTokenChains } from 'src/shared/utils/helpers';
import { WHITELISTED_CHAINS } from 'src/shared/utils/constants/chains';
import { Chain } from './entities/chain.type';

@Injectable()
export class TokenDataService {
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';

  constructor(
    private readonly alchemyService: AlchemyService,
    private readonly supabaseService: SupabaseService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  public async getWalletBalances(wallet: Address): Promise<TokenBalance[]> {
    const client = this.alchemyService.client;

    try {
      const balances = await client.core.getTokenBalances(wallet);

      const nonZeroBalances = balances.tokenBalances.filter((token) => {
        return token.tokenBalance !== '0';
      });

      const tokens: TokenBalance[] = [];

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
  ): Promise<TokenMarketData[]> {
    try {
      const rawTokens = await this.fetchInitialTokenList();

      const filteredTokens = await this.applyBaselineFilters(rawTokens, params);

      const enrichedTokens = await this.enrichTokenData(filteredTokens);

      const evmChainsTokens = this.filterByChain(
        enrichedTokens,
        WHITELISTED_CHAINS,
      );

      const rankedTokens = this.rankTokensByQuality(evmChainsTokens);

      return rankedTokens;
    } catch (error) {
      console.error('Error in token discovery:', error);
      return [];
    }
  }

  private async fetchInitialTokenList(): Promise<TokenMarketData[]> {
    try {
      const params = new URLSearchParams({
        vs_currency: 'usd',
        order: 'volume_desc',
        per_page: '250',
        page: '1',
        sparkline: 'false',
      });

      const response = await fetch(
        `${this.COINGECKO_API}/coins/markets?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return (data as CoinGeckoTokenResponse[]).map((token) => ({
        coinGeckoId: token.id,
        symbol: token.symbol.toUpperCase(),
        name: token.name,
        liquidity_usd: token.total_volume * 0.1, // Estimate liquidity as 10% of volume as a baseline
        volume_24h: token.total_volume,
        holder_count: 0, // To be enriched later
        created_at: new Date(token.atl_date), // Use ATL date as approximate creation date
        price_change_24h: token.price_change_percentage_24h,
        market_cap: token.market_cap,
        price_usd: token.current_price,
      }));
    } catch (error) {
      console.error('Error fetching initial token list:', error);
      return [];
    }
  }

  private async applyBaselineFilters(
    tokens: TokenMarketData[],
    params: TokenDiscoveryParams,
  ): Promise<TokenMarketData[]> {
    const {
      minLiquidity = 100000, // $100k minimum liquidity
      minVolume = 50000, // $50k minimum daily volume
      maxAge = 365, // Maximum 1 year old
    } = params;

    const minDate = new Date();
    minDate.setDate(minDate.getDate() - maxAge);

    return tokens.filter(
      (token) =>
        token.liquidity_usd >= minLiquidity &&
        token.volume_24h >= minVolume &&
        token.created_at >= minDate,
    );
  }

  private async enrichTokenData(
    tokens: TokenMarketData[],
  ): Promise<TokenMarketData[]> {
    for (let token of tokens) {
      try {
        const metadata = await this.getTokenMetadataById(token.coinGeckoId);

        if (metadata) {
          token.metadata = metadata;
        }
      } catch (error) {
        console.log(`Failed to fetch metadata for token ${token.coinGeckoId}`);
      }
    }

    return tokens.filter((t) => !!t.metadata);
  }

  private async getTokenMetadataById(
    coingeckoId: string,
  ): Promise<CoinGeckoTokenMetadata | null> {
    try {
      const cachedData =
        await this.supabaseService.getTokenMetadataById(coingeckoId);

      if (cachedData) return cachedData;

      const metadata = await this.getCoinGeckoMetadata(coingeckoId);

      await this.supabaseService.insertTokenMetadata(metadata);

      return metadata;
    } catch (error) {
      console.error(`Error fetching metadata for ${coingeckoId}`);
      return null;
    }
  }

  private async getCoinGeckoMetadata(
    coingeckoId: string,
  ): Promise<CoinGeckoTokenMetadata> {
    const response = await fetch(
      `${this.COINGECKO_API}/coins/${coingeckoId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    const metadata: CoinGeckoTokenMetadata = {
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
  }

  private rankTokensByQuality(tokens: TokenMarketData[]): TokenMarketData[] {
    return tokens
      .map((token) => {
        // Calculate a simple quality score based on various metrics
        const volumeToLiqRatio = token.volume_24h / token.liquidity_usd;
        const holderScore = Math.min(token.holder_count / 1000, 1); // Cap at 1000 holders
        const priceChangeScore = Math.abs(token.price_change_24h) / 100; // Normalize price change

        // Combine scores (you can adjust weights as needed)
        const qualityScore =
          volumeToLiqRatio * 0.4 + holderScore * 0.4 + priceChangeScore * 0.2;

        return {
          ...token,
          qualityScore,
        };
      })
      .sort((a, b) => b.qualityScore - a.qualityScore);
  }

  private async getTokenMetadataByContract(
    tokenAddress: Address,
  ): Promise<TokenMetadataResponse> {
    const metadata =
      await this.alchemyService.client.core.getTokenMetadata(tokenAddress);

    return metadata;
  }

  private filterByChain(
    tokens: TokenMarketData[],
    targetChains: Chain[],
  ): TokenMarketData[] {
    const filteredTokens: TokenMarketData[] = tokens.filter((token) => {
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

  public async fetchTokenByCoinGeckoId(
    coinGeckoId: string,
  ): Promise<TokenMarketData | null> {
    const response = await fetch(`${this.COINGECKO_API}/coins/${coinGeckoId}`);

    if (!response.ok) {
      throw new Error(
        `[fetchTokenByCoinGeckoId] HTTP error! status: ${response.status}`,
      );
    }

    const data: CoinGeckoTokenResponse = await response.json();

    const token: TokenMarketData = {
      coinGeckoId: data.id,
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      liquidity_usd: data.total_volume * 0.1,
      volume_24h: data.total_volume,
      holder_count: 0,
      created_at: new Date(data.atl_date),
      price_change_24h: data.price_change_percentage_24h,
      market_cap: data.market_cap,
      price_usd: data.current_price,
    };

    const metadata = await this.getTokenMetadataById(coinGeckoId);

    if (metadata) {
      token.metadata = metadata;
    }

    return token;
  }
}
