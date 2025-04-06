import { zeroAddress } from 'viem';
import { TradingDecision } from '../agent/entities/trading-decision.type';
import { MarketObservationEmbedding } from '../embedding/entities/embedding.type';
import { CoinCodexCsvDailyMetrics } from './entities/coincodex.type';
import { SupplyMetrics } from './entities/supply.type';
import { MobulaExtendedToken } from '../mobula/entities/mobula.entities';

const SIGNIFICANT_PRICE_CHANGE_THRESHOLD = 5;

function createTradingDecisions(
  insertedObservations: MarketObservationEmbedding[],
): Omit<TradingDecision, 'id'>[] {
  const tradingDecisions: Omit<TradingDecision, 'id'>[] = [];

  insertedObservations.slice(0, -1).forEach((marketObservation, i) => {
    const { id, price } = marketObservation;
    const nextDayObs = insertedObservations[i + 1];

    const priceChange24hPct = ((nextDayObs.price - price) / price) * 100;

    if (Math.abs(priceChange24hPct) >= SIGNIFICANT_PRICE_CHANGE_THRESHOLD) {
      const decision = createSingleTradingDecision(
        id,
        price,
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

    price_24h_after_usd: nextDayObs.price,
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
}): MobulaExtendedToken[] {
  const format = {
    price: (n: number) => (typeof n !== 'number' || isNaN(n) ? 0 : n),
    percentage: (n: number) =>
      typeof n !== 'number' || isNaN(n) ? 0 : Math.round(n * 10000) / 10000,
    bigNumber: (n: number) =>
      typeof n !== 'number' || isNaN(n) ? 0 : Math.round(n),
    safeChange: (current: number, previous: number): number => {
      if (!current || !previous || previous === 0) return 0;
      return current - previous;
    },
  };

  let historicalHigh = dailyMetrics[0].Close;
  let historicalLow = dailyMetrics[0].Close;

  return dailyMetrics.map((daily, index) => {
    const prev = index > 0 ? dailyMetrics[index - 1] : null;

    const price = format.price(daily.Close);
    const volume = format.bigNumber(daily.Volume);
    const marketCap = format.bigNumber(daily['Market Cap']);

    historicalHigh = Math.max(historicalHigh, daily.Close);
    historicalLow = Math.min(historicalLow, daily.Close);

    const ath = format.price(historicalHigh);
    const atl = format.price(historicalLow);

    return {
      key: `${tokenSymbol}-${index}`,
      token_id: index,
      name: tokenSymbol,
      symbol: tokenSymbol.toUpperCase(),
      decimals: 18,
      logo: '',
      rank: 0,
      price,
      market_cap: marketCap,
      market_cap_diluted: staticSupplyMetrics.fully_diluted_valuation,
      volume,
      volume_change_24h: 0,
      volume_7d: 0,
      liquidity: 0,
      timestamp: new Date(daily.Start).getTime(),
      ath,
      atl,
      off_chain_volume: 0,
      is_listed: true,
      price_change_1h: 0,
      price_change_24h: prev
        ? format.percentage(((price - prev.Close) / prev.Close) * 100)
        : 0,
      price_change_7d: 0,
      price_change_1m: 0,
      price_change_1y: 0,
      total_supply: staticSupplyMetrics.total_supply,
      circulating_supply: staticSupplyMetrics.circulating_supply,
      contracts: [],
      extra: {},
    };
  });
}

export { createTradingDecisions, buildObservationsFromMetrics };
