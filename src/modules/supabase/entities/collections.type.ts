import { TokenMarketObservation } from 'src/modules/tokens/entities/token.type';

export enum Collection {
  TOKEN_METADATA = 'token_metadata',
  MARKET_OBSERVATIONS = 'market_observations',
  TRADING_DECISIONS = 'trading_decisions',
}

export enum QueryFunctions {
  MATCH_MARKET_OBSERVATIONS = 'match_market_observations',
}

export interface TokenMarketObservationMatchResult
  extends TokenMarketObservation {
  id: number;
  similarity: number;
}
