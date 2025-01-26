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
    safePercentageChange: (current: number, previous: number): number => {
      if (
        typeof current !== 'number' ||
        typeof previous !== 'number' ||
        isNaN(current) ||
        isNaN(previous) ||
        previous === 0
      ) {
        return 0;
      }
      return (
        Math.round(((current - previous) / Math.abs(previous)) * 100 * 10000) /
        10000
      );
    },
  };

  let historicalHigh = dailyMetrics[0].Close;
  let historicalLow = dailyMetrics[0].Close;

  return dailyMetrics.map((dailyMetric, index) => {
    const prevDay = index > 0 ? dailyMetrics[index - 1] : null;
    const timestamp = new Date(dailyMetric.Start).getTime();
    const currentPrice = format.price(dailyMetric.Close);

    const currentMarketCap = format.bigNumber(dailyMetric['Market Cap']);
    const prevMarketCap = prevDay
      ? format.bigNumber(prevDay['Market Cap'])
      : currentMarketCap;

    historicalHigh = Math.max(historicalHigh, dailyMetric.Close);
    historicalLow = Math.min(historicalLow, dailyMetric.Close);

    const ath = format.price(historicalHigh);
    const atl = format.price(historicalLow);

    const ath_change_percentage = format.safePercentageChange(
      currentPrice,
      ath,
    );
    const atl_change_percentage = format.safePercentageChange(
      currentPrice,
      atl,
    );

    const price_change_24h = prevDay
      ? format.price(dailyMetric.Close - prevDay.Close)
      : 0;

    const price_change_percentage_24h = prevDay
      ? format.safePercentageChange(dailyMetric.Close, prevDay.Close)
      : 0;

    const market_cap_change_24h = format.bigNumber(
      currentMarketCap - prevMarketCap,
    );

    const market_cap_change_percentage_24h = format.safePercentageChange(
      currentMarketCap,
      prevMarketCap,
    );

    return {
      coin_gecko_id: tokenSymbol.toLowerCase(),
      timestamp,
      created_at: new Date(dailyMetric.Start),
      market_cap_rank: 1,
      price_usd: currentPrice,
      high_24h: format.price(dailyMetric.High),
      low_24h: format.price(dailyMetric.Low),
      market_cap: currentMarketCap,
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
