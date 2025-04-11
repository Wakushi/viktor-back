import { Injectable, Logger } from '@nestjs/common';
import { CsvService } from 'src/shared/services/csv.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SupabaseService } from '../supabase/supabase.service';
import { PuppeteerService } from 'src/shared/services/puppeteer.service';
import {
  CoinCodexBaseTokenData,
  CoinCodexTokenData,
  DailyOHLCV,
} from '../training/entities/coincodex.type';
import { SupplyMetrics } from '../training/entities/supply.type';
import { WeekObservation } from './entities/week-observation.type';

const ONE_WEEK_MS = 8 * 24 * 60 * 60 * 1000;

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly csvService: CsvService,
    private readonly embeddingService: EmbeddingService,
    private readonly supabaseService: SupabaseService,
    private readonly puppeteerService: PuppeteerService,
  ) {}

  async analyzeToken(tokenName: string): Promise<any> {
    this.logger.log(`Starting token ${tokenName} analysis..`);

    const SIMILARITY_THRESHOLD = 0.7;
    const MATCH_COUNT = 20;

    try {
      const fromTimestamp = Date.now() - ONE_WEEK_MS;

      const metrics = await this.getTokenOHLCV({ tokenName, fromTimestamp });

      const observation = this.getTextObservation(metrics);

      const similarConditions =
        await this.embeddingService.findClosestWeekObservation({
          query: observation,
          matchCount: MATCH_COUNT,
          matchThreshold: SIMILARITY_THRESHOLD,
        });

      return { similarConditions, metrics, observation };
    } catch (error) {
      this.logger.error(error);
    }
  }

  public async trainAnalysis(tokenName: string): Promise<void> {
    try {
      const metrics = await this.getTokenOHLCV({
        tokenName,
        fromLastTraining: true,
      });

      if (metrics.length < 7) {
        this.logger.error('Not enough metrics to train on.');
        return;
      }

      const observations: string[] = [];
      const windows: DailyOHLCV[][] = [];

      for (let i = 6; i < metrics.length - 1; i++) {
        const window = metrics.slice(i - 6, i + 1);
        const observationText = this.getTextObservation(window);

        if (!observationText) {
          throw new Error('Error while generating text observation!');
        }

        observations.push(observationText);
        windows.push(window);
      }

      if (!observations.length) return;

      const embeddings = await this.embeddingService.createEmbeddings([
        ...observations,
      ]);

      const weekObservations: Omit<WeekObservation, 'id'>[] = [];

      for (let i = 0; i < windows.length; i++) {
        const window = windows[i];
        const embedding = embeddings[i].embedding;
        const text = observations[i];

        const startDate = window[0].Start;
        const endDate = window[6].End;
        const closeLastDay = window[6].Close;
        const nextDayClose = metrics[i + 7].Close;

        const nextDayChange =
          ((nextDayClose - closeLastDay) / closeLastDay) * 100;

        const outcome: 'bullish' | 'bearish' | 'neutral' =
          nextDayChange > 5
            ? 'bullish'
            : nextDayChange < -5
              ? 'bearish'
              : 'neutral';

        const weekObservation: Omit<WeekObservation, 'id'> = {
          token_name: tokenName,
          start_date: startDate,
          end_date: endDate,
          observation_text: text,
          embedding: embedding,
          raw_ohlcv_window: JSON.stringify(window),
          next_day_change: nextDayChange,
          next_day_close: nextDayClose,
          outcome,
          created_at: new Date().toISOString(),
        };

        weekObservations.push(weekObservation);
      }

      await this.supabaseService.insertManyWeekObservations(weekObservations);
    } catch (error) {
      this.logger.error('Error training analysis: ' + error);
    }
  }

  private async getTokenOHLCV({
    tokenName,
    fromTimestamp = 0,
    fromLastTraining = false,
  }: {
    tokenName: string;
    fromTimestamp?: number;
    fromLastTraining?: boolean;
  }): Promise<DailyOHLCV[]> {
    const tokenSymbol = await this.getCoinCodexIdentifier(tokenName);

    if (fromLastTraining) {
      const history =
        await this.supabaseService.getWeekObservationsByToken(tokenName);

      if (history?.length) {
        history?.sort(
          (a, b) =>
            new Date(b.end_date).getTime() - new Date(a.end_date).getTime(),
        );

        fromTimestamp = new Date(history[0].end_date).getTime();
      }
    }

    await this.downloadTokenOHLCV(tokenName, fromTimestamp);

    const staticSupplyMetrics = await this.fetchSupplyMetrics(tokenSymbol);

    let dailyMetrics: DailyOHLCV[] = [];

    try {
      dailyMetrics = await this.readTokenOHLCV(staticSupplyMetrics.name);
    } catch (error) {
      dailyMetrics = await this.readTokenOHLCV(tokenSymbol.toLowerCase());
    }

    if (!dailyMetrics.length)
      throw new Error(
        `No daily metrics found for token ${staticSupplyMetrics.name} ${tokenSymbol.toLowerCase()}`,
      );

    dailyMetrics.sort(
      (a, b) => new Date(a.Start).getTime() - new Date(b.Start).getTime(),
    );

    this.logger.log(`Fetched ${dailyMetrics.length} days of historical data !`);

    return dailyMetrics;
  }

  private async downloadTokenOHLCV(
    tokenName: string,
    fromTimestamp = 0,
  ): Promise<void> {
    this.logger.log('Downloading OHLCV for ' + tokenName);

    await this.puppeteerService.downloadCoinCodexCsv({
      tokenName,
      fromTimestamp,
      directory: 'ohlcv',
    });
  }

  private async readTokenOHLCV(tokenSymbol: string): Promise<DailyOHLCV[]> {
    const data = await this.csvService.getHistoricalTokenData(
      `${tokenSymbol}.csv`,
      'ohlcv',
    );

    return data;
  }

  private async getCoinCodexIdentifier(tokenName: string): Promise<string> {
    this.logger.log(`Searching token symbol for ${tokenName}...`);

    const url = 'https://coincodex.com/apps/coincodex/cache/all_coins.json';

    const data: CoinCodexBaseTokenData[] = await this.fetchWithTimeout({ url });

    // TODO : Improve this search for better reliability
    const matchings = data.filter(
      (t) =>
        (t.symbol && t.symbol.toLowerCase() === tokenName.toLowerCase()) ||
        (t.shortname && t.shortname.toLowerCase() === tokenName.toLowerCase()),
    );

    if (!matchings.length) {
      throw new Error('No token found for name ' + tokenName);
    }

    const token = matchings[0];

    console.log('Identified token :', token);

    return token.symbol;
  }

  private async fetchWithTimeout({
    url,
    options = {},
    timeout = 60000,
  }: {
    url: string;
    options?: any;
    timeout?: number;
  }): Promise<any> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const text = await response.text();

      try {
        return JSON.parse(text);
      } catch (parseError) {
        this.logger.error(`Invalid JSON received: ${parseError.message}`);
        this.logger.error(`Error position: ${parseError.position}`);
        this.logger.error(
          `JSON snippet near error: ${text.substring(Math.max(0, parseError.position - 100), parseError.position + 100)}`,
        );
        throw parseError;
      }
    } finally {
      clearTimeout(id);
    }
  }

  private async fetchSupplyMetrics(
    tokenSymbol: string,
  ): Promise<SupplyMetrics> {
    this.logger.log(`Fetching supply metrics for ${tokenSymbol}...`);

    const response = await fetch(
      `https://coincodex.com/api/coincodex/get_coin/${tokenSymbol}`,
    );

    if (!response.ok) {
      throw new Error(`Coin codex API error: ${response.status}`);
    }

    const data: CoinCodexTokenData = await response.json();

    const totalSupply = Number(data.total_supply);
    const circulatingSupply = data.supply;

    return {
      name: data.slug.toLowerCase(),
      fully_diluted_valuation: totalSupply * data.last_price_usd,
      circulating_supply: circulatingSupply,
      total_supply: totalSupply,
      max_supply: totalSupply,
      supply_ratio: circulatingSupply / totalSupply,
    };
  }

  private getTextObservation(metrics: DailyOHLCV[]): string {
    if (metrics.length > 7) {
      metrics.splice(0, metrics.length - 7);
    }

    if (!metrics || metrics.length !== 7) return '';

    const closes = metrics.map((d) => d.Close);
    const highs = metrics.map((d) => d.High);
    const lows = metrics.map((d) => d.Low);
    const volumes = metrics.map((d) => d.Volume);

    const firstClose = closes[0];
    const lastClose = closes.at(-1);
    const prevClose = closes.at(-2);

    if (!firstClose || !lastClose || !prevClose) return '';

    const priceChange = ((lastClose - firstClose) / firstClose) * 100;
    const upDays = metrics.filter((d) => d.Close > d.Open).length;
    const downDays = 7 - upDays;

    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const volatility = ((maxHigh - minLow) / minLow) * 100;

    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const lastVolume = volumes.at(-1)!;

    const largestDropIndex = closes.findIndex(
      (c, i) => i > 0 && (closes[i - 1] - c) / closes[i - 1] > 0.1,
    );
    const strongRebound = lastClose > prevClose * 1.05;

    const trendLabel =
      priceChange > 10
        ? 'strong uptrend'
        : priceChange > 3
          ? 'moderate uptrend'
          : priceChange < -10
            ? 'strong downtrend'
            : priceChange < -3
              ? 'moderate downtrend'
              : 'sideways action';

    const volatilityLabel =
      volatility > 20
        ? 'high volatility'
        : volatility > 10
          ? 'moderate volatility'
          : 'low volatility';

    const volumeBehavior =
      lastVolume > avgVolume * 1.4
        ? 'volume surge on latest candle'
        : lastVolume < avgVolume * 0.6
          ? 'volume drying up'
          : 'volume stable throughout the week';

    const pattern =
      largestDropIndex !== -1 && strongRebound
        ? 'sharp mid-week selloff followed by strong recovery'
        : priceChange > 0 && closes[3] < closes[0]
          ? 'early dip followed by climb'
          : priceChange < 0 && closes[3] > closes[0]
            ? 'early rally followed by weakness'
            : 'no distinct pattern';

    return [
      `Price changed ${priceChange.toFixed(2)}% over the last 7 days with ${upDays} up days and ${downDays} down days.`,
      `The market showed ${volatilityLabel} with price fluctuations relative to weekly range.`,
      `Observed ${volumeBehavior}.`,
      `Pattern detected: ${pattern}.`,
      `Overall trend classified as ${trendLabel}.`,
    ].join(' ');
  }
}
