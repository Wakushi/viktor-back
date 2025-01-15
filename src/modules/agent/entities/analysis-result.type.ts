import {
  TokenData,
  TokenMarketObservation,
} from 'src/modules/tokens/entities/token.type';

export interface TokenAnalysisResult {
  token: TokenData;
  buyingConfidence: number;
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
}
