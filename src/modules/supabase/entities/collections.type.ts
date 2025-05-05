import { MobulaExtendedToken } from 'src/modules/mobula/entities/mobula.entities';

export enum Collection {
  TOKEN_METADATA = 'token_metadata',
  WEEK_OBSERVATIONS = 'week_observations',
  WEEK_ANALYSIS_RESULTS = 'week_analysis_results',
  FAKE_WALLET = 'fake_wallet',
  POSITIONS = 'positions',
  SETTINGS = 'viktor_settings',
  SWAPS = 'swaps',
}

export enum QueryFunctions {
  MATCH_WEEK_OBSERVATIONS = 'match_week_observations',
}

export interface TokenMarketObservationMatchResult extends MobulaExtendedToken {
  id: number;
  similarity: number;
}
