import { TokenData } from 'src/modules/tokens/entities/token.type';

export const MINIMUM_CONFIDENCE_TO_BUY = 0.85;
export const MINIMUM_SAMPLE_CONFIDENCE = 0.2;

export const MIN_SAMPLE_SIZE = 5;
export const OPTIMAL_SAMPLE_SIZE = 15;

export const BASE_WEIGHT = 0.85;
export const VOLATILITY_WEIGHT = 0.15;

export const TIME_DECAY_DAYS = 30;

export type BuyingConfidenceResult = {
  score: number;
  sampleSizeConfidence: number;
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
  similarDecisionsAmount: number;
  decisionTypeRatio: {
    buyCount: number;
    sellCount: number;
    profitableBuyCount: number;
    profitableSellCount: number;
  };
};

export type FormattedAnalysisResult = {
  id: string;
  analysis: string;
  created_at: Date | string;
  performance?: string;
};

export type BuyingConfidenceMetrics = {
  decisionTypeScore: number;
  similarityScore: number;
  profitabilityScore: number;
  volatilityAdjustment: number;
  sampleSizeConfidence: number;
};

export type BuyingConfidence = {
  score: number;
  sampleSizeConfidence: number;
  metrics: BuyingConfidenceMetrics;
};

export type DecisionTypeRatio = {
  buyCount: number;
  sellCount: number;
  profitableBuyCount: number;
  profitableSellCount: number;
  averageProfitPercent: number;
};

export type TokenAnalysis = {
  token: TokenData;
  buyingConfidence: BuyingConfidence;
  similarDecisionsAmount: number;
  decisionTypeRatio: DecisionTypeRatio;
};

export type FormattedResult = {
  token: string;
  price: string;
  buyingConfidence: string;
};

export type Analysis = {
  formattedResults: FormattedResult[];
  analysis: TokenAnalysis[];
};
