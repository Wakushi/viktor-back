import { zeroAddress } from 'viem';
import { TradingDecision } from '../agent/entities/trading-decision.type';
import { MarketObservationEmbedding } from '../embedding/entities/embedding.type';
import { CoinCodexCsvDailyMetrics } from './entities/coincodex.type';
import { SupplyMetrics } from './entities/supply.type';
import { TokenMarketObservation } from '../tokens/entities/token.type';

const SIGNIFICANT_PRICE_CHANGE_THRESHOLD = 5;

function createTradingDecisions(
  insertedObservations: MarketObservationEmbedding[],
): Omit<TradingDecision, 'id'>[] {
  const tradingDecisions: Omit<TradingDecision, 'id'>[] = [];

  insertedObservations.slice(0, -1).forEach((marketObservation, i) => {
    const { id, price_usd } = marketObservation;
    const nextDayObs = insertedObservations[i + 1];

    const priceChange24hPct =
      ((nextDayObs.price_usd - price_usd) / price_usd) * 100;

    if (Math.abs(priceChange24hPct) >= SIGNIFICANT_PRICE_CHANGE_THRESHOLD) {
      const decision = createSingleTradingDecision(
        id,
        price_usd,
        nextDayObs,
        priceChange24hPct,
      );
      tradingDecisions.push(decision);
    }
  });

  return tradingDecisions;
}

function generateDecisionType(priceChange24hPct: number): 'BUY' | 'SELL' {
  return priceChange24hPct >= 0 ? 'BUY' : 'SELL';
}

function createSingleTradingDecision(
  observationId: string,
  currentPrice: number,
  nextDayObs: MarketObservationEmbedding,
  priceChange24hPct: number,
): Omit<TradingDecision, 'id'> {
  return {
    observation_id: observationId,
    wallet_address: zeroAddress,
    token_address: zeroAddress,

    decision_type: generateDecisionType(priceChange24hPct),
    decision_timestamp: nextDayObs.timestamp,
    decision_price_usd: currentPrice,

    status: 'COMPLETED',
    execution_successful: true,
    execution_price_usd: currentPrice,

    price_24h_after_usd: nextDayObs.price_usd,
    price_change_24h_pct: priceChange24hPct,

    created_at: new Date(nextDayObs.timestamp),
    updated_at: new Date(nextDayObs.timestamp),
  };
}

function buildObservationsFromMetrics({
  tokenSymbol,
  dailyMetrics,
  staticSupplyMetrics,
}: {
  tokenSymbol: string;
  dailyMetrics: CoinCodexCsvDailyMetrics[];
  staticSupplyMetrics: SupplyMetrics;
}): TokenMarketObservation[] {
  const format = {
    price: (n: number) => {
      if (typeof n !== 'number' || isNaN(n)) return 0;
      return n;
    },
    percentage: (n: number) => {
      if (typeof n !== 'number' || isNaN(n)) return 0;
      return Math.round(n * 10000) / 10000;
    },
    bigNumber: (n: number) => {
      if (typeof n !== 'number' || isNaN(n)) return 0;
      return Math.round(n);
    },
  };

  let historicalHigh = dailyMetrics[0].Close;
  let historicalLow = dailyMetrics[0].Close;

  return dailyMetrics.map((dailyMetric, index) => {
    const prevDay = index > 0 ? dailyMetrics[index - 1] : null;
    const timestamp = new Date(dailyMetric.Start).getTime();
    const currentPrice = format.price(dailyMetric.Close);

    historicalHigh = Math.max(historicalHigh, dailyMetric.Close);
    historicalLow = Math.min(historicalLow, dailyMetric.Close);

    const ath = format.price(historicalHigh);
    const atl = format.price(historicalLow);

    const ath_change_percentage = format.percentage(
      ((currentPrice - ath) / ath) * 100,
    );

    const atl_change_percentage = format.percentage(
      ((currentPrice - atl) / atl) * 100,
    );

    const price_change_24h = prevDay
      ? format.price(dailyMetric.Close - prevDay.Close)
      : null;

    const price_change_percentage_24h = prevDay
      ? format.percentage(
          ((dailyMetric.Close - prevDay.Close) / prevDay.Close) * 100,
        )
      : null;

    const market_cap_change_24h = prevDay
      ? format.bigNumber(dailyMetric['Market Cap'] - prevDay['Market Cap'])
      : null;

    const market_cap_change_percentage_24h = prevDay
      ? format.percentage(
          ((dailyMetric['Market Cap'] - prevDay['Market Cap']) /
            prevDay['Market Cap']) *
            100,
        )
      : null;

    return {
      coin_gecko_id: tokenSymbol.toLowerCase(),
      timestamp,
      created_at: new Date(dailyMetric.Start),
      market_cap_rank: 1,
      price_usd: currentPrice,
      high_24h: format.price(dailyMetric.High),
      low_24h: format.price(dailyMetric.Low),
      market_cap: format.bigNumber(dailyMetric['Market Cap']),
      total_volume: format.bigNumber(dailyMetric.Volume),

      ath,
      atl,
      ath_change_percentage,
      atl_change_percentage,

      price_change_24h,
      price_change_percentage_24h,
      market_cap_change_24h,
      market_cap_change_percentage_24h,

      fully_diluted_valuation: format.bigNumber(
        dailyMetric.Close * staticSupplyMetrics.total_supply,
      ),
      circulating_supply: staticSupplyMetrics.circulating_supply,
      total_supply: staticSupplyMetrics.total_supply,
      max_supply: staticSupplyMetrics.max_supply,
      supply_ratio: format.percentage(staticSupplyMetrics.supply_ratio),
    };
  });
}

export { createTradingDecisions, buildObservationsFromMetrics };
