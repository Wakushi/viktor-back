import { DailyOHLCV } from 'src/modules/tokens/entities/coin-codex.type';
import { SimilarWeekObservation } from './week-observation.type';
import { MobulaExtendedToken } from 'src/modules/mobula/entities/mobula.entities';

export type ForecastDistribution = {
  bullish: number;
  bearish: number;
};

export type TokenWeekAnalysisResult = {
  token: MobulaExtendedToken;
  prediction: 'bullish' | 'bearish';
  confidence: number;
  forecastDistribution: ForecastDistribution;
  expectedNextDayChange: number;
  similarConditions: SimilarWeekObservation[];
  tokenOHLCV: DailyOHLCV[];
  observation: string;
};

export type WeekAnalysis = {
  formattedResults: FormattedResult[];
  results: TokenWeekAnalysisResult[];
};

export type TokenPerformance = {
  token: string;
  initialPrice: number;
  currentPrice: number;
  priceChange: number;
  percentageChange: number;
};

export type FormattedResult = {
  token: string;
  price: string;
  buyingConfidence: string;
};

export type DayAnalysisRecord = {
  id: string;
  analysis: string;
  created_at: Date | string;
  performance?: string;
  fear_and_greed_index?: string;
};

export type TradersActivity = {
  id: number;
  bought: number;
  sold: number;
};
