import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  TokenData,
  TokenMarketObservation,
  TokenMetadata,
} from '../tokens/entities/token.type';
import { MarketObservationEmbedding } from '../embedding/entities/embedding.type';
import { EmbeddingService } from '../embedding/embedding.service';
import { TokenAnalysisResult } from '../agent/entities/analysis-result.type';
import { AgentService } from '../agent/agent.service';
import { AnalysisFormatter } from './helpers/analytics-formatter';

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

  private async generateMarketData(
    days: number = 10,
  ): Promise<Omit<MarketObservationEmbedding, 'id'>[]> {
    const scenarios = {
      risingToken: {
        coin_gecko_id: 'rising-token',
        basePrice: 100,
        priceModifier: (day: number) => {
          const trendIncrease = day * 0.01; // Reduce from 3% to 1%
          const noise = (Math.random() - 0.5) * 0.015; // Add some randomness
          return 1 + trendIncrease + noise;
        },
      },
      decliningToken: {
        coin_gecko_id: 'declining-token',
        basePrice: 100,
        priceModifier: (day: number) => {
          const trendDecrease = day * -0.008; // Less aggressive decline
          const noise = (Math.random() - 0.5) * 0.012;
          return 1 + trendDecrease + noise;
        },
      },
      volatileToken: {
        coin_gecko_id: 'volatile-token',
        basePrice: 100,
        priceModifier: (day: number) => {
          const trend = Math.sin(day / 3) * 0.08; // Slower, less extreme cycles
          const noise = (Math.random() - 0.5) * 0.04;
          return 1 + trend + noise;
        },
      },
      stableToken: {
        coin_gecko_id: 'stable-token',
        basePrice: 100,
        priceModifier: (day: number) => {
          const noise = (Math.random() - 0.5) * 0.015;
          return 1 + noise;
        },
      },
      sidewaysToken: {
        coin_gecko_id: 'sideways-token',
        basePrice: 100,
        priceModifier: (day: number) => {
          const range = Math.sin(day / 5) * 0.03; // Slow ranging
          const noise = (Math.random() - 0.5) * 0.01;
          return 1 + range + noise;
        },
      },
      accumulationToken: {
        coin_gecko_id: 'accumulation-token',
        basePrice: 100,
        priceModifier: (day: number) => {
          const compression = Math.max(0.05 - day * 0.002, 0.01); // Decreasing volatility
          return 1 + (Math.random() - 0.5) * compression;
        },
      },
    };
    const observations: Omit<MarketObservationEmbedding, 'id'>[] = [];

    for (const scenario of Object.values(scenarios)) {
      for (let day = 0; day < days; day++) {
        const marketObs = this.generateMarketObservation(
          scenario.coin_gecko_id,
          scenario.basePrice,
          day,
          scenario.priceModifier(day),
        );

        const obsWithEmbedding =
          await this.generateMarketObservationWithEmbedding(marketObs);
        observations.push(obsWithEmbedding);
      }
    }

    return observations;
  }

  private async generateAndInsertTradingDecisions(
    observations: MarketObservationEmbedding[],
  ): Promise<TradingDecision[]> {
    const tokenGroups = new Map<string, MarketObservationEmbedding[]>();

    // Group observations by token
    observations.forEach((obs) => {
      if (!tokenGroups.has(obs.coin_gecko_id)) {
        tokenGroups.set(obs.coin_gecko_id, []);
      }
      tokenGroups.get(obs.coin_gecko_id)!.push(obs);
    });

    const allDecisions: TradingDecision[] = [];

    // Process each token
    for (const [coin_gecko_id, tokenObs] of tokenGroups) {
      const walletAddress = this.formatAddress(1);
      const tokenAddress = this.formatAddress(
        parseInt(coin_gecko_id.split('-')[0], 36),
      );

      let lastDecisionType: 'BUY' | 'SELL' = 'SELL'; // Start with BUY (opposite of last)
      let lastBuyDecision: TradingDecision | null = null;

      // Process each observation sequentially
      for (let i = 0; i < tokenObs.length; i++) {
        const obs = tokenObs[i];
        const nextObs = tokenObs[i + 1] || obs; // Use current if last observation
        const next7dObs = tokenObs[Math.min(i + 7, tokenObs.length - 1)];

        // Calculate price changes
        const priceChange24h =
          ((nextObs.price_usd - obs.price_usd) / obs.price_usd) * 100;
        const priceChange7d =
          ((next7dObs.price_usd - obs.price_usd) / obs.price_usd) * 100;

        // Determine decision type based on previous decision and market conditions
        const decisionType = lastDecisionType === 'BUY' ? 'SELL' : 'BUY';

        // Calculate confidence score based on price movement
        const baseConfidence = 0.5;
        const priceMovementImpact = Math.min(
          Math.abs(priceChange24h) / 10,
          0.3,
        ); // Max 0.3 from price
        const volumeImpact = 0.2; // Could be calculated from volume metrics
        const confidenceScore = Math.min(
          baseConfidence + priceMovementImpact + volumeImpact,
          1,
        );

        const decision: Omit<TradingDecision, 'id'> = {
          observation_id: obs.id.toString(),
          wallet_address: walletAddress,
          token_address: tokenAddress,
          decision_type: decisionType,
          decision_timestamp: obs.timestamp,
          decision_price_usd: obs.price_usd,
          confidence_score: confidenceScore,
          status: 'COMPLETED',
          next_update_due: obs.timestamp + this.DAY_IN_MS,
          execution_successful: true,
          execution_price_usd: obs.price_usd,
          gas_cost_eth: 0.001,
          price_24h_after_usd: nextObs.price_usd,
          price_7d_after_usd: next7dObs.price_usd,
          price_change_24h_pct: priceChange24h,
          price_change_7d_pct: priceChange7d,
          created_at: new Date(obs.timestamp),
          updated_at: new Date(obs.timestamp + this.DAY_IN_MS),
        };

        // Add previous buy reference for SELL decisions
        if (decisionType === 'SELL' && lastBuyDecision) {
          decision.previous_buy_id = lastBuyDecision.id;
          decision.previous_buy_price_usd = lastBuyDecision.decision_price_usd;
        }

        // Insert the decision
        const insertedDecision =
          await this.supabaseService.insertTradingDecision(decision);
        allDecisions.push(insertedDecision);

        // Update tracking variables
        lastDecisionType = decisionType;
        if (decisionType === 'BUY') {
          lastBuyDecision = insertedDecision;
        }
      }
    }

    return allDecisions;
  }

  private formatAddress(num: number): string {
    return '0x' + num.toString(16).padStart(40, '0');
  }

  public async seedDatabase(days: number = 10): Promise<{
    observationsCount: number;
    decisionsCount: number;
  }> {
    try {
      const observations = await this.generateMarketData(days);
      const insertedObservations: MarketObservationEmbedding[] = [];

      for (const observation of observations) {
        const inserted =
          await this.supabaseService.insertMarketObservationEmbedding(
            observation,
          );
        insertedObservations.push(inserted);
      }

      const decisions =
        await this.generateAndInsertTradingDecisions(insertedObservations);

      return {
        observationsCount: insertedObservations.length,
        decisionsCount: decisions.length,
      };
    } catch (error) {
      console.error('Error seeding database:', error);
      throw error;
    }
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

  public async testAgentAnalysis(tokenCount: number): Promise<string> {
    const tokens = this.generateTestTokens(tokenCount);

    const analysisResults = await this.agentService.analyzeTokens(tokens);

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
