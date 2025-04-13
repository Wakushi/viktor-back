export type WeekObservation = {
  id: string;
  token_name: string;
  start_date: string;
  end_date: string;
  observation_text: string;
  embedding?: number[];
  raw_ohlcv_window: string; // JSON.stringify(DailyOHLCV[])
  next_day_close: number;
  next_day_change: number;
  outcome: 'bullish' | 'bearish' | 'neutral' | null;
  created_at: string;
};

export type SimilarWeekObservation = WeekObservation & {
  similarity: number;
};
