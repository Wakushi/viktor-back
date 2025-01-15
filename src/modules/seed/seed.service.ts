import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  TokenData,
  TokenMarketObservation,
  TokenMetadata,
} from '../tokens/entities/token.type';
import { MarketObservationEmbedding } from '../embedding/entities/embedding.type';
import { EmbeddingService } from '../embedding/embedding.service';
import { AgentService } from '../agent/agent.service';
import { AnalysisFormatter } from './helpers/analytics-formatter';
import { generateDecisionsForObservations } from './helpers/generate-mock-decision';

@Injectable()
export class SeedService {
  private readonly DAY_IN_MS = 86400000;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly agentService: AgentService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  private generateMarketObservation(
    coin_gecko_id: string,
    basePrice: number,
    day: number,
    priceModifier: number,
  ): TokenMarketObservation {
    const timestamp = 1705248000000 + day * this.DAY_IN_MS;
    const currentPrice = basePrice * priceModifier;

    // Generate realistic market data that correlates with the price movement
    const dailyVolatility = Math.random() * 0.05; // 5% max volatility
    const high24h = currentPrice * (1 + dailyVolatility);
    const low24h = currentPrice * (1 - dailyVolatility);

    // Calculate day-over-day changes
    const previousPrice = basePrice * (day > 0 ? 1 + (day - 1) * 0.03 : 1);
    const priceChange24h = currentPrice - previousPrice;
    const priceChangePercentage24h = (priceChange24h / previousPrice) * 100;

    // Generate correlated market cap (assume circulating supply affects it)
    const circulatingSupply = 1_000_000 + day * 1000; // Growing supply
    const marketCap = currentPrice * circulatingSupply;
    const previousMarketCap = previousPrice * (circulatingSupply - 1000);
    const marketCapChange24h = marketCap - previousMarketCap;
    const marketCapChangePercentage24h =
      (marketCapChange24h / previousMarketCap) * 100;

    return {
      coin_gecko_id,
      timestamp,
      created_at: new Date(timestamp),
      market_cap_rank: Math.floor(Math.random() * 100) + 1,
      price_usd: currentPrice,
      high_24h: high24h,
      low_24h: low24h,
      ath: basePrice * 1.5, // Assuming ATH is 50% above base price
      ath_change_percentage: (currentPrice / (basePrice * 1.5) - 1) * 100,
      atl: basePrice * 0.5, // Assuming ATL is 50% below base price
      atl_change_percentage: (currentPrice / (basePrice * 0.5) - 1) * 100,
      market_cap: marketCap,
      fully_diluted_valuation: marketCap * 1.2, // 20% more tokens yet to be circulated
      circulating_supply: circulatingSupply,
      total_supply: 1_200_000, // Fixed total supply
      total_volume: currentPrice * (circulatingSupply * 0.1), // 10% of supply traded
      max_supply: 1_500_000,
      supply_ratio: circulatingSupply / 1_500_000,
      price_change_24h: priceChange24h,
      price_change_percentage_24h: priceChangePercentage24h,
      market_cap_change_24h: marketCapChange24h,
      market_cap_change_percentage_24h: marketCapChangePercentage24h,
    };
  }

  private async generateMarketObservationWithEmbedding(
    observation: TokenMarketObservation,
  ): Promise<Omit<MarketObservationEmbedding, 'id'>> {
    const embeddingText =
      this.embeddingService.getEmbeddingTextFromObservation(observation);

    const embeddings = await this.embeddingService.createEmbeddings([
      embeddingText,
    ]);

    const marketObservationEmbedding: Omit<MarketObservationEmbedding, 'id'> = {
      ...observation,
      embedding: embeddings[0].embedding,
    };

    return marketObservationEmbedding;
  }

  private formatAddress(num: number): string {
    return '0x' + num.toString(16).padStart(40, '0');
  }

  public async seedDatabase(tokens: TokenData[]): Promise<any> {
    const marketObservationEmbeddings: Omit<
      MarketObservationEmbedding,
      'id'
    >[] = [];

    for (let token of tokens) {
      const marketObservationEmbedding =
        await this.generateMarketObservationWithEmbedding(token.market);
      marketObservationEmbeddings.push(marketObservationEmbedding);
    }

    const insertedObservations: MarketObservationEmbedding[] = [];
    for (const observation of marketObservationEmbeddings) {
      const inserted =
        await this.supabaseService.insertMarketObservationEmbedding(
          observation,
        );
      insertedObservations.push(inserted);
    }

    const generatedDecisions =
      await generateDecisionsForObservations(insertedObservations);

    const tempIdToRealId = new Map<number, string>();
    const insertedDecisions: TradingDecision[] = [];

    for (const decision of generatedDecisions) {
      const { tempId, previousBuyTempId, ...decisionData } = decision;

      const inserted = await this.supabaseService.insertTradingDecision({
        ...decisionData,
        previous_buy_id: previousBuyTempId
          ? tempIdToRealId.get(previousBuyTempId)
          : undefined,
      });

      tempIdToRealId.set(tempId, inserted.id);
      insertedDecisions.push(inserted);
    }

    return {
      observations: insertedObservations,
      decisions: insertedDecisions,
    };
  }

  public generateTestTokens(count: number): TokenData[] {
    const tokens: TokenData[] = [];

    const scenarios = [
      { trend: 'rising', change: 5 }, // Strong uptrend
      { trend: 'rising', change: 2 }, // Weak uptrend
      { trend: 'declining', change: -5 }, // Strong downtrend
      { trend: 'declining', change: -2 }, // Weak downtrend
      { trend: 'stable', change: 0.5 }, // Slightly positive stable
      { trend: 'stable', change: -0.5 }, // Slightly negative stable
      { trend: 'volatile', change: 8 }, // High volatility
      { trend: 'volatile', change: 3 }, // Low volatility
    ];

    for (let i = 0; i < count; i++) {
      const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

      const basePrice = 50 + Math.random() * 450;

      const marketObs = this.generateMarketObservation(
        `test-token-${i}`,
        basePrice,
        0,
        1 + scenario.change / 100,
      );

      const metadata: TokenMetadata = {
        id: `test-token-${i}`,
        symbol: `TST${i}`,
        name: `Test Token ${i}`,
        contract_addresses: {
          ethereum: {
            decimal_place: 18,
            contract_address: this.formatAddress(i + 1000),
          },
        },
        market_cap_rank: marketObs.market_cap_rank,
        genesis_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        categories: ['test', scenario.trend],
        links: {
          website: ['https://example.com'],
          twitter: 'https://twitter.com/test',
          telegram: 'https://t.me/test',
          github: ['https://github.com/test'],
        },
        platforms: {
          ethereum: this.formatAddress(i + 1000),
        },
        last_updated: new Date(),
        created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      };

      tokens.push({
        market: marketObs,
        metadata: metadata,
      });
    }

    return tokens;
  }

  public async testAgentAnalysis(token: TokenData): Promise<string> {
    const analysisResults = await this.agentService.analyzeTokens([token]);

    return AnalysisFormatter.formatAnalysisResults(analysisResults);
  }

  public async wipeTestData(): Promise<void> {
    try {
      await this.supabaseService.wipeTestTables();
    } catch (error) {
      console.error('Error wiping test data:', error);
      throw new Error(`Failed to wipe test data: ${error.message}`);
    }
  }
}
