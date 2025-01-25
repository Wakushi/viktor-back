import { Injectable } from '@nestjs/common';
import { CsvService } from 'src/shared/services/csv.service';
import {
  CoinCodexCsvDailyMetrics,
  CoinCodexTokenData,
} from './entities/coincodex.type';
import { SupplyMetrics } from './entities/supply.type';
import { TokenMarketObservation } from '../tokens/entities/token.type';
import { TradingDecision } from '../agent/entities/trading-decision.type';
import { MarketObservationEmbedding } from '../embedding/entities/embedding.type';
import { zeroAddress } from 'viem';
import { EmbeddingService } from '../embedding/embedding.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class TrainingService {
  constructor(
    private readonly csvService: CsvService,
    private readonly embeddingService: EmbeddingService,
    private readonly supabaseService: SupabaseService,
  ) {}

  public async saveHistoricalTokenMetrics(tokenSymbol: string): Promise<{
    tokenMarketObservations: TokenMarketObservation[];
    tradingDecisions: Omit<TradingDecision, 'id'>[];
  }> {
    try {
      const staticSupplyMetrics = await this.fetchSupplyMetrics(tokenSymbol);
      const dailyMetrics = await this.fetchDailyMetrics(tokenSymbol);

      dailyMetrics.sort(
        (a, b) => new Date(a.Start).getTime() - new Date(b.Start).getTime(),
      );

      const tokenMarketObservations = this.buildObservationsFromMetrics({
        tokenSymbol,
        dailyMetrics,
        staticSupplyMetrics,
      });

      tokenMarketObservations.splice(0, 1);

      const marketObservationEmbeddings =
        await this.generateMarketObservationEmbeddings(tokenMarketObservations);

      const insertedObservations = await this.insertMarketObservationEmbeddings(
        marketObservationEmbeddings,
      );

      const tradingDecisions =
        this.createTradingDecisions(insertedObservations);

      await this.insertTradingDecisions(tradingDecisions);

      return { tokenMarketObservations, tradingDecisions };
    } catch (error) {
      console.error('Error processing historical data:', error);
      throw error;
    }
  }

  private async generateMarketObservationEmbeddings(
    tokenMarketObservations: TokenMarketObservation[],
  ): Promise<Omit<MarketObservationEmbedding, 'id'>[]> {
    const marketObservationEmbeddings: Omit<
      MarketObservationEmbedding,
      'id'
    >[] = [];

    for (const tokenMarketObs of tokenMarketObservations) {
      const marketObservationEmbedding =
        await this.generateMarketObservationWithEmbedding(tokenMarketObs);
      marketObservationEmbeddings.push(marketObservationEmbedding);
    }

    return marketObservationEmbeddings;
  }

  private async insertMarketObservationEmbeddings(
    marketObservationEmbeddings: Omit<MarketObservationEmbedding, 'id'>[],
  ): Promise<MarketObservationEmbedding[]> {
    const insertedObservations: MarketObservationEmbedding[] = [];

    for (const observation of marketObservationEmbeddings) {
      const inserted =
        await this.supabaseService.insertMarketObservationEmbedding(
          observation,
        );
      insertedObservations.push(inserted);
    }

    return insertedObservations;
  }

  private createTradingDecisions(
    insertedObservations: MarketObservationEmbedding[],
  ): Omit<TradingDecision, 'id'>[] {
    const tradingDecisions: Omit<TradingDecision, 'id'>[] = insertedObservations
      .slice(0, -1)
      .map((marketObservation, i) => {
        const { id, price_usd } = marketObservation;
        const nextDayObs = insertedObservations[i + 1];

        return this.createSingleTradingDecision(id, price_usd, nextDayObs);
      });

    return tradingDecisions;
  }

  private createSingleTradingDecision(
    observationId: string,
    currentPrice: number,
    nextDayObs?: MarketObservationEmbedding,
  ): Omit<TradingDecision, 'id'> {
    const price24hAfter = nextDayObs?.price_usd;
    const price24hAfterPct = nextDayObs
      ? ((nextDayObs.price_usd - currentPrice) / currentPrice) * 100
      : undefined;

    return {
      observation_id: observationId,
      wallet_address: zeroAddress,
      token_address: zeroAddress,

      decision_type: this.generateDecisionType(),
      decision_timestamp: Date.now(),
      decision_price_usd: currentPrice,

      status: 'COMPLETED',
      execution_successful: true,
      execution_price_usd: currentPrice,

      price_24h_after_usd: price24hAfter,
      price_change_24h_pct: price24hAfterPct,

      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  private generateDecisionType(): 'BUY' | 'SELL' {
    return 'BUY';
  }

  private async insertTradingDecisions(
    tradingDecisions: Omit<TradingDecision, 'id'>[],
  ): Promise<void> {
    for (const tradingDecision of tradingDecisions) {
      await this.supabaseService.insertTradingDecision(tradingDecision);
    }
  }

  private async fetchDailyMetrics(
    tokenSymbol: string,
  ): Promise<CoinCodexCsvDailyMetrics[]> {
    const data = await this.csvService.getHistoricalTokenData(
      `${tokenSymbol}.csv`,
    );

    return data;
  }

  private async fetchSupplyMetrics(
    tokenSymbol: string,
  ): Promise<SupplyMetrics> {
    const response = await fetch(
      `https://coincodex.com/api/coincodex/get_coin/${tokenSymbol}`,
    );

    if (!response.ok) {
      throw new Error(`Coin codex API error: ${response.status}`);
    }

    const data: CoinCodexTokenData = await response.json();

    return this.calculateSupplyMetrics(data);
  }

  private calculateSupplyMetrics(data: CoinCodexTokenData): SupplyMetrics {
    const totalSupply = Number(data.total_supply);
    const circulatingSupply = data.supply;

    return {
      fully_diluted_valuation: totalSupply * data.last_price_usd,
      circulating_supply: circulatingSupply,
      total_supply: totalSupply,
      max_supply: totalSupply,
      supply_ratio: circulatingSupply / totalSupply,
    };
  }

  private buildObservationsFromMetrics({
    tokenSymbol,
    dailyMetrics,
    staticSupplyMetrics,
  }: {
    tokenSymbol: string;
    dailyMetrics: CoinCodexCsvDailyMetrics[];
    staticSupplyMetrics: SupplyMetrics;
  }): TokenMarketObservation[] {
    const round = {
      price: (n: number) => Number(n.toFixed(2)),
      percentage: (n: number) => Number(n.toFixed(5)),
      marketCapPercentage: (n: number) => {
        const rounded = Math.abs(n) < 0.0001 ? 0 : Number(n.toFixed(4));
        return Number(rounded.toString().replace(/\.?0+$/, ''));
      },
      integer: (n: number) => Math.round(n),
    };

    let historicalHigh = dailyMetrics[0].Close;
    let historicalLow = dailyMetrics[0].Close;

    return dailyMetrics.map((dailyMetric, index) => {
      const prevDay = index > 0 ? dailyMetrics[index - 1] : null;
      const timestamp = new Date(dailyMetric.Start).getTime();
      const currentPrice = round.price(dailyMetric.Close);

      const ath = round.price(historicalHigh);
      const atl = round.price(historicalLow);

      const ath_change_percentage = round.percentage(
        ((currentPrice - ath) / ath) * 100,
      );

      const atl_change_percentage = round.percentage(
        ((currentPrice - atl) / atl) * 100,
      );

      const price_change_24h = prevDay
        ? round.price(dailyMetric.Close - prevDay.Close)
        : null;

      const price_change_percentage_24h = prevDay
        ? round.percentage(
            ((dailyMetric.Close - prevDay.Close) / prevDay.Close) * 100,
          )
        : null;

      const market_cap_change_24h = prevDay
        ? round.integer(dailyMetric['Market Cap'] - prevDay['Market Cap'])
        : null;

      const market_cap_change_percentage_24h = prevDay
        ? round.marketCapPercentage(
            ((dailyMetric['Market Cap'] - prevDay['Market Cap']) /
              prevDay['Market Cap']) *
              100,
          )
        : null;

      historicalHigh = Math.max(historicalHigh, dailyMetric.Close);
      historicalLow = Math.min(historicalLow, dailyMetric.Close);

      return {
        coin_gecko_id: tokenSymbol.toLowerCase(),
        timestamp,
        created_at: new Date(timestamp),
        market_cap_rank: 1,
        price_usd: currentPrice,
        high_24h: round.price(dailyMetric.High),
        low_24h: round.price(dailyMetric.Low),
        market_cap: round.integer(dailyMetric['Market Cap']),
        total_volume: round.integer(dailyMetric.Volume),

        ath,
        atl,
        ath_change_percentage,
        atl_change_percentage,

        price_change_24h,
        price_change_percentage_24h,
        market_cap_change_24h,
        market_cap_change_percentage_24h,

        fully_diluted_valuation: round.integer(
          dailyMetric.Close * staticSupplyMetrics.total_supply,
        ),
        circulating_supply: staticSupplyMetrics.circulating_supply,
        total_supply: staticSupplyMetrics.total_supply,
        max_supply: staticSupplyMetrics.max_supply,
        supply_ratio: staticSupplyMetrics.supply_ratio,
      };
    });
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
}
