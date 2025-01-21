import { MarketObservationEmbedding } from 'src/modules/embedding/entities/embedding.type';

interface GenerateDecisionOptions {
  marketObs: MarketObservationEmbedding;
  previousDecisions?: Array<Omit<TradingDecision, 'id'> & { tempId: number }>;
}

function generateMockTradingDecision({
  marketObs,
  previousDecisions = [],
}: GenerateDecisionOptions): Omit<TradingDecision, 'id'> & {
  tempId: number;
  previousBuyTempId?: number;
} {
  let tempIdCounter = 0;
  const tempId = ++tempIdCounter;

  // Mock wallet and token addresses
  const wallet = '0x' + '1'.repeat(40);
  const token = '0x' + '2'.repeat(40);

  const lastBuyDecision = previousDecisions
    .filter((d) => d.decision_type === 'BUY')
    .sort((a, b) => b.decision_timestamp - a.decision_timestamp)[0];

  // Analyze market conditions to make appropriate decision
  const { decision_type, confidence_score } =
    determineDecisionFromMarketConditions(marketObs, lastBuyDecision);

  // Set base timestamp slightly after market observation
  const baseTimestamp = marketObs.timestamp + 300000; // 5 minutes after observation

  // For completed decisions, simulate price changes based on market phase
  const priceChanges = simulatePriceChanges(marketObs, decision_type);

  // Simulate execution with slight price deviation
  const executionPriceDeviation = Math.random() * 0.01 - 0.005; // ±0.5%
  const executionPrice = marketObs.price_usd * (1 + executionPriceDeviation);

  return {
    tempId,
    previousBuyTempId:
      decision_type === 'SELL' ? lastBuyDecision?.tempId : undefined,
    observation_id: marketObs.id,
    wallet_address: wallet,
    token_address: token,
    decision_type,
    decision_timestamp: baseTimestamp,
    decision_price_usd: marketObs.price_usd,
    confidence_score,
    previous_buy_id: undefined, // Will be populated after DB insertion
    previous_buy_price_usd:
      decision_type === 'SELL'
        ? lastBuyDecision?.decision_price_usd
        : undefined,

    status: 'COMPLETED',
    next_update_due: baseTimestamp + 8 * 24 * 60 * 60 * 1000, // 8 days after decision
    execution_successful: true,
    execution_price_usd: executionPrice,
    gas_cost_eth: 0.005 + Math.random() * 0.003, // Random gas cost between 0.005-0.008 ETH
    price_24h_after_usd: priceChanges.price_24h,
    price_change_24h_pct: priceChanges.change_24h_pct,
    created_at: new Date(baseTimestamp),
    updated_at: new Date(baseTimestamp + 8 * 24 * 60 * 60 * 1000),
  };
}

function determineDecisionFromMarketConditions(
  marketObs: MarketObservationEmbedding,
  lastBuyDecision?: Omit<TradingDecision, 'id'>,
): { decision_type: 'BUY' | 'SELL'; confidence_score: number } {
  // Calculate key metrics
  const nearATH = Math.abs(marketObs.ath_change_percentage) < 10;
  const nearATL = Math.abs(marketObs.atl_change_percentage) < 20;
  const highVolume = marketObs.total_volume / marketObs.market_cap > 0.2;
  const strongUptrend = marketObs.price_change_percentage_24h > 3;
  const strongDowntrend = marketObs.price_change_percentage_24h < -3;

  if (nearATL && !lastBuyDecision) {
    return {
      decision_type: 'BUY',
      confidence_score: 0.8 + Math.random() * 0.1,
    };
  }

  // Accumulation phase detection
  if (nearATL && highVolume && !strongDowntrend) {
    return {
      decision_type: 'BUY',
      confidence_score: 0.8 + Math.random() * 0.1, // 0.8-0.9
    };
  }

  // Distribution phase detection
  if (nearATH && highVolume) {
    return {
      decision_type: 'SELL',
      confidence_score: 0.85 + Math.random() * 0.1, // 0.85-0.95
    };
  }

  // Strong uptrend
  if (strongUptrend && highVolume && !nearATH) {
    return {
      decision_type: 'BUY',
      confidence_score: 0.75 + Math.random() * 0.1, // 0.75-0.85
    };
  }

  // Strong downtrend
  if (strongDowntrend && lastBuyDecision) {
    return {
      decision_type: 'SELL',
      confidence_score: 0.7 + Math.random() * 0.1, // 0.7-0.8
    };
  }

  // Default to lower confidence buy in stable conditions
  return {
    decision_type: lastBuyDecision ? 'SELL' : 'BUY',
    confidence_score: 0.6 + Math.random() * 0.1, // 0.6-0.7
  };
}

function simulatePriceChanges(
  marketObs: MarketObservationEmbedding,
  decisionType: 'BUY' | 'SELL',
): {
  price_24h: number;
  change_24h_pct: number;
} {
  // Base volatility on market conditions
  const volatility = Math.abs(marketObs.price_change_percentage_24h) / 100;

  // Generate random changes based on market phase and decision type
  const nearATH = Math.abs(marketObs.ath_change_percentage) < 10;
  const nearATL = Math.abs(marketObs.atl_change_percentage) < 20;

  let expectedReturn24h = 0;

  if (decisionType === 'BUY') {
    if (nearATL) {
      // Higher probability of positive returns near ATL
      expectedReturn24h = 0.05 + volatility * 2;
    } else if (nearATH) {
      // Higher probability of negative returns near ATH
      expectedReturn24h = -0.03 - volatility * 2;
    } else {
      // Moderate returns in normal conditions
      expectedReturn24h = 0.02 + volatility;
    }
  } else {
    // SELL
    if (nearATH) {
      // Good timing for sells near ATH
      expectedReturn24h = -0.05 - volatility * 2;
    } else if (nearATL) {
      // Poor timing for sells near ATL
      expectedReturn24h = 0.03 + volatility * 2;
    } else {
      // Moderate returns in normal conditions
      expectedReturn24h = -0.02 - volatility;
    }
  }

  // Add random noise to expected returns
  const noise24h = (Math.random() - 0.5) * volatility * 2;

  const change24h = expectedReturn24h + noise24h;

  return {
    price_24h: marketObs.price_usd * (1 + change24h),
    change_24h_pct: change24h * 100,
  };
}

async function generateDecisionsForObservations(
  observations: MarketObservationEmbedding[],
): Promise<
  Array<
    Omit<TradingDecision, 'id'> & { tempId: number; previousBuyTempId?: number }
  >
> {
  const decisions: Array<
    Omit<TradingDecision, 'id'> & { tempId: number; previousBuyTempId?: number }
  > = [];

  // Sort observations by timestamp to maintain chronological order
  const sortedObservations = [...observations].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  // Track the last buy decision for sell references
  let lastBuyDecision:
    | (Omit<TradingDecision, 'id'> & { tempId: number })
    | null = null;

  for (const obs of sortedObservations) {
    // Get previous decisions within 30 days
    const previousDecisions = decisions.filter(
      (d) =>
        Math.abs(d.decision_timestamp - obs.timestamp) <
        30 * 24 * 60 * 60 * 1000,
    );

    // Generate one decision per observation
    const decision = generateMockTradingDecision({
      marketObs: obs,
      previousDecisions,
    });

    // Update the previousBuyTempId if this is a sell and we have a previous buy
    if (decision.decision_type === 'SELL' && lastBuyDecision) {
      decision.previousBuyTempId = lastBuyDecision.tempId;
      decision.previous_buy_id = undefined; // Will be set after DB insertion
      decision.previous_buy_price_usd = lastBuyDecision.decision_price_usd;
    }

    // Update lastBuyDecision tracker
    if (decision.decision_type === 'BUY') {
      lastBuyDecision = decision;
    }

    decisions.push(decision);
  }

  return decisions;
}

export { generateDecisionsForObservations };
