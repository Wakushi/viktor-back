import {
  TokenData,
  TokenMarketObservation,
} from 'src/modules/tokens/entities/token.type';
import { TradingDecision } from './trading-decision.type';

export const MINIMUM_CONFIDENCE_TO_BUY = 0.85;
export const MINIMUM_SAMPLE_CONFIDENCE = 0.3;

export const MIN_SAMPLE_SIZE = 5;
export const OPTIMAL_SAMPLE_SIZE = 15;

export const BASE_WEIGHT = 0.85;
export const VOLATILITY_WEIGHT = 0.15;

export const TIME_DECAY_DAYS = 30;

export type BuyingConfidenceResult = {
  score: number;
  confidence: number;
  metrics: {
    decisionTypeScore: number;
    similarityScore: number;
    profitabilityScore: number;
    volatilityAdjustment: number;
    sampleSizeConfidence: number;
  };
};

export type TokenAnalysisResult = {
  token: TokenData;
  buyingConfidence: BuyingConfidenceResult;
  similarDecisions: Array<{
    marketCondition: TokenMarketObservation;
    decision: TradingDecision;
    similarity: number;
    profitabilityScore: number;
  }>;
  decisionTypeRatio: {
    buyCount: number;
    sellCount: number;
    profitableBuyCount: number;
    profitableSellCount: number;
  };
};
