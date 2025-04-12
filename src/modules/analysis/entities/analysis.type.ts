import { DailyOHLCV } from 'src/modules/training/entities/coincodex.type';
import { SimilarWeekObservation } from './week-observation.type';
import { MobulaExtendedToken } from 'src/modules/mobula/entities/mobula.entities';
import { FormattedResult } from 'src/modules/agent/entities/analysis-result.type';

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
