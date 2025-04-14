import { Injectable, Logger } from '@nestjs/common';
import { CsvService } from 'src/shared/services/csv.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SupabaseService } from '../supabase/supabase.service';
import { PuppeteerService } from 'src/shared/services/puppeteer.service';
import {
  CoinCodexBaseTokenData,
  DailyOHLCV,
} from '../training/entities/coincodex.type';
import {
  SimilarWeekObservation,
  WeekObservation,
} from './entities/week-observation.type';
import {
  MobulaExtendedToken,
  MobulaOHLCV,
} from '../mobula/entities/mobula.entities';
import { TokensService } from '../tokens/tokens.service';
import {
  TokenWeekAnalysisResult,
  WeekAnalysis,
} from './entities/analysis.type';
import { findClosestInt } from 'src/shared/utils/helpers';
import * as fs from 'fs';
import * as path from 'path';
import { MobulaService } from '../mobula/mobula.service';
import {
  getTextObservation,
  MINIMUM_METRICS_DAYS,
  ELEVEN_DAYS_MS,
} from './helpers/text-generation';
import { Collection } from '../supabase/entities/collections.type';
import { TokenPerformance } from '../agent/entities/analysis-result.type';
import { fetchWithTimeout } from './helpers/utils';
const Fuse = require('fuse.js');

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  private coinCodexList: CoinCodexBaseTokenData[] = [];

  constructor(
    private readonly csvService: CsvService,
    private readonly embeddingService: EmbeddingService,
    private readonly supabaseService: SupabaseService,
    private readonly puppeteerService: PuppeteerService,
    private readonly tokensService: TokensService,
    private readonly mobulaService: MobulaService,
  ) {}

  public async seekMarketBuyingTargets(): Promise<any> {
    try {
      this.logger.log('Started token search...');

      const tokens: MobulaExtendedToken[] =
        await this.tokensService.discoverTokens();

      this.logger.log(
        `Discovered ${tokens.length} tokens ! Starting analysis...`,
      );

      const analysis: TokenWeekAnalysisResult[] =
        await this.analyzeTokens(tokens);

      this.logger.log(
        `Analysis completed ! ${analysis.length} results available.`,
      );

      return analysis;
    } catch (error) {
      console.error('Error while seeking market buying targets :', error);
      return [];
    }
  }

  private async analyzeTokens(
    tokens: MobulaExtendedToken[],
  ): Promise<TokenWeekAnalysisResult[]> {
    this.logger.log(`Initiating analysis of ${tokens.length} tokens...`);

    await this.initCoinCodexList();

    const analysisResults: TokenWeekAnalysisResult[] = [];

    const MINIMUM_CONFIDENCE = 0.7;

    let batchSize = 5;
    let batchCounter = 1;

    const BATCH_SUCCESS_THRESHOLD = 5;
    const BATCH_FAIL_THRESHOLD = -5;
    const batchRates: Map<number, number> = new Map();

    while (tokens.length) {
      const batch = tokens.splice(0, batchSize);

      this.logger.log(
        `Analyzing token batch ${batchCounter} (${tokens.length} tokens remaining)`,
      );

      try {
        const results: TokenWeekAnalysisResult[] = await Promise.all(
          batch.map(async (token) => {
            return await this.analyzeToken(token);
          }),
        );

        analysisResults.push(...results);
        batchCounter++;

        if (!batchRates.has(batchSize)) {
          batchRates.set(batchSize, 0);
        }

        const newRate = batchRates.get(batchSize) + 1;

        if (newRate >= BATCH_SUCCESS_THRESHOLD) {
          batchSize++;
          this.logger.log(`Increasing batch size to ${batchSize}`);
          batchRates.set(batchSize, 1);
        } else {
          batchRates.set(batchSize, newRate);
        }
      } catch (error) {
        this.logger.error(error);

        if (!batchRates.has(batchSize)) {
          batchRates.set(batchSize, 0);
        }

        const newRate = batchRates.get(batchSize) - 1;

        if (newRate <= BATCH_FAIL_THRESHOLD) {
          batchSize--;
          this.logger.log(`Decreasing batch size to ${batchSize}`);
          batchRates.set(batchSize, 0);
        } else {
          batchRates.set(batchSize, newRate);
        }

        this.logger.warn(`Adding back ${batch.length} tokens to pool..`);
        tokens.push(...batch);
      }
    }

    await this.deleteOHLCVDirectory();

    return analysisResults
      .filter(
        (analysis) =>
          analysis &&
          analysis.prediction !== 'bearish' &&
          analysis.confidence > MINIMUM_CONFIDENCE,
      )
      .sort((a, b) => b.confidence - a.confidence);
  }

  private async analyzeToken(
    token: MobulaExtendedToken,
  ): Promise<TokenWeekAnalysisResult | null> {
    const SIMILARITY_THRESHOLD = 0.5;
    const MATCH_COUNT = 20;

    try {
      const fromTimestamp = Date.now() - ELEVEN_DAYS_MS;

      const tokenOHLCV = await this.getTokenOHLCV({
        tokenName: token.name,
        tokenRef: token,
        fromTimestamp,
      });

      if (!tokenOHLCV) return null;

      const observation = getTextObservation(tokenOHLCV);

      if (!observation) return null;

      const similarConditions =
        await this.embeddingService.findClosestWeekObservation({
          query: observation,
          matchCount: MATCH_COUNT,
          matchThreshold: SIMILARITY_THRESHOLD,
        });

      if (!similarConditions.length) return null;

      const outcomeGroups: Record<
        'bullish' | 'bearish',
        SimilarWeekObservation[]
      > = {
        bullish: [],
        bearish: [],
      };

      for (const condition of similarConditions) {
        if (condition.outcome) {
          outcomeGroups[condition.outcome].push(condition);
        }
      }

      const weightedSums: Record<'bullish' | 'bearish', number> = {
        bullish: 0,
        bearish: 0,
      };

      const weightedReturns: Record<'bullish' | 'bearish', number> = {
        bullish: 0,
        bearish: 0,
      };

      for (const outcome of ['bullish', 'bearish'] as const) {
        const group = outcomeGroups[outcome];
        if (group.length > 0) {
          const totalSim = group.reduce((sum, ob) => sum + ob.similarity, 0);
          weightedSums[outcome] = totalSim;
          weightedReturns[outcome] =
            group.reduce(
              (sum, ob) => sum + ob.similarity * ob.next_day_change,
              0,
            ) / totalSim;
        }
      }

      const totalSimilarity = weightedSums.bullish + weightedSums.bearish;
      if (totalSimilarity === 0) return null;

      const forecastDistribution = {
        bullish: +(weightedSums.bullish / totalSimilarity).toFixed(3),
        bearish: +(weightedSums.bearish / totalSimilarity).toFixed(3),
      };

      const [predictedOutcome, confidence] = Object.entries(
        forecastDistribution,
      ).sort((a, b) => b[1] - a[1])[0] as ['bullish' | 'bearish', number];

      return {
        token,
        prediction: predictedOutcome,
        confidence,
        forecastDistribution,
        expectedNextDayChange: +(
          weightedReturns[predictedOutcome] ?? 0
        ).toFixed(3),
        similarConditions,
        tokenOHLCV,
        observation,
      };
    } catch (error) {
      this.logger.error(error);
      throw new Error('Analysis failed');
    }
  }

  public async trainAnalysis(tokenName: string): Promise<void> {
    try {
      await this.initCoinCodexList();

      const metrics = await this.getTokenOHLCV({
        tokenName,
        fromLastTraining: true,
      });

      if (!metrics || metrics.length < MINIMUM_METRICS_DAYS) {
        this.logger.error('Not enough metrics to train on.');
        return;
      }

      const observations: string[] = [];
      const windows: DailyOHLCV[][] = [];

      for (let i = MINIMUM_METRICS_DAYS - 1; i < metrics.length - 1; i++) {
        const window = metrics.slice(i - (MINIMUM_METRICS_DAYS - 1), i + 1);
        const observationText = getTextObservation(window);

        if (!observationText) {
          throw new Error('Error while generating text observation!');
        }

        observations.push(observationText);
        windows.push(window);
      }

      if (!observations.length) return;

      const embeddings = await this.embeddingService.createEmbeddings(
        [...observations],
        true,
      );

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

        const outcome: 'bullish' | 'bearish' =
          nextDayChange > 0 ? 'bullish' : 'bearish';

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
    tokenRef = null,
    fromTimestamp = 0,
    fromLastTraining = false,
  }: {
    tokenName: string;
    tokenRef?: MobulaExtendedToken | null;
    fromTimestamp?: number;
    fromLastTraining?: boolean;
  }): Promise<DailyOHLCV[] | null> {
    try {
      await this.initCoinCodexList();

      const coinCodexToken = await this.getCoinCodexIdentifier(
        tokenName,
        tokenRef,
      );

      if (!coinCodexToken) {
        throw new Error('Coin codex token not found');
      }

      const { name, shortname, ccu_slug, symbol } = coinCodexToken;

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

      await this.downloadTokenOHLCV(coinCodexToken, fromTimestamp);

      const possibleIdentifiers = [
        name.toLowerCase(),
        shortname?.toLowerCase(),
        symbol?.toLowerCase(),
        ccu_slug,
      ].filter(Boolean);

      let dailyMetrics: DailyOHLCV[] = [];

      for (const identifier of possibleIdentifiers) {
        try {
          dailyMetrics = await this.csvService.getHistoricalTokenData(
            `${identifier}.csv`,
            'ohlcv',
          );
          break;
        } catch (e) {}
      }

      if (!dailyMetrics.length) {
        throw new Error(
          `No daily metrics found for token ${name.toLowerCase()}`,
        );
      }

      dailyMetrics.sort(
        (a, b) => new Date(a.Start).getTime() - new Date(b.Start).getTime(),
      );

      return dailyMetrics;
    } catch (error) {
      if (tokenRef) {
        return await this.fallbackOHLCV(tokenRef, fromTimestamp);
      }

      return null;
    }
  }

  private async downloadTokenOHLCV(
    coinCodexToken: CoinCodexBaseTokenData,
    fromTimestamp = 0,
  ): Promise<void> {
    await this.puppeteerService.downloadCoinCodexCsv({
      coinCodexToken,
      fromTimestamp,
      directory: 'ohlcv',
    });
  }

  private async getCoinCodexIdentifier(
    tokenName: string,
    tokenRef: MobulaExtendedToken | null = null,
  ): Promise<CoinCodexBaseTokenData> {
    const normalizedName = tokenName.toLowerCase();

    const candidates = this.coinCodexList.filter((t) => {
      return (
        normalizedName.includes(t.shortname.toLowerCase()) ||
        normalizedName.includes(t.name.toLowerCase()) ||
        t.symbol?.toLowerCase() === normalizedName ||
        t.shortname?.toLowerCase() === normalizedName ||
        t.display_symbol?.toLowerCase() === normalizedName ||
        t.name?.toLowerCase() === normalizedName ||
        t.aliases
          ?.toLowerCase()
          .split(',')
          .map((s) => s.trim())
          .includes(normalizedName)
      );
    });

    if (!candidates.length) {
      throw new Error(`No CoinCodex token found matching name: ${tokenName}`);
    }

    if (candidates.length === 1) {
      const match = candidates[0];

      if (tokenRef?.price && isFinite(match.last_price_usd)) {
        const priceDifference = Math.abs(match.last_price_usd - tokenRef.price);
        const percentDiff = priceDifference / tokenRef.price;

        if (percentDiff > 0.5) {
          throw new Error(
            `Price mismatch on CoinCodex candidate for ${tokenName}`,
          );
        }
      }

      return match;
    }

    candidates.sort((a, b) => b.volume_rank - a.volume_rank);

    if (!tokenRef) {
      try {
        const fuse = new Fuse(candidates, {
          keys: ['name', 'shortname', 'symbol', 'ccu_slug'],
          includeScore: true,
          threshold: 0.4,
          findAllMatches: true,
        });

        const results = fuse.search(tokenName);

        return results[0].item;
      } catch (error) {
        return candidates[0];
      }
    }

    const priceMap = new Map<number, CoinCodexBaseTokenData>();
    const priceList: number[] = [];

    for (const candidate of candidates) {
      const price = candidate.last_price_usd;
      if (price && isFinite(price)) {
        priceMap.set(price, candidate);
        priceList.push(price);
      }
    }

    if (!priceList.length) {
      return candidates[0];
    }

    const closestPrice = findClosestInt(priceList, tokenRef.price);
    const bestMatch = priceMap.get(closestPrice);

    return bestMatch ?? candidates[0];
  }

  private async deleteOHLCVDirectory(): Promise<void> {
    const ohlcvPath = path.join(process.cwd(), 'ohlcv');

    try {
      const exists = fs.existsSync(ohlcvPath);

      if (!exists) {
        console.log('No ohlcv directory found to delete.');
        return;
      }

      await fs.promises.rm(ohlcvPath, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to delete ohlcv directory:', error);
      throw error;
    }
  }

  private async fallbackOHLCV(
    token: MobulaExtendedToken,
    from: number,
  ): Promise<DailyOHLCV[] | null> {
    const metrics: MobulaOHLCV[] = await this.mobulaService.getOHLCV({
      token,
      from,
    });

    if (!metrics) return null;

    return metrics.map((entry) => {
      const date = new Date(entry.time);
      const isoDate = date.toISOString().split('T')[0];

      return {
        Start: isoDate,
        End: isoDate,
        Open: entry.open,
        High: entry.high,
        Low: entry.low,
        Close: entry.close,
        Volume: entry.volume,
        'Market Cap': 0,
      };
    });
  }

  public async evaluatePastAnalysis(date?: Date) {
    try {
      this.logger.log("Fetching yesterday's analysis..");

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const formattedAnalysis =
        await this.supabaseService.getAnalysisResultsByDate(
          date || yesterday,
          Collection.WEEK_ANALYSIS_RESULTS,
        );

      if (!formattedAnalysis) return;

      const analysis: WeekAnalysis = JSON.parse(formattedAnalysis.analysis);

      this.logger.log('Fetching current prices..');

      const tokenIds = analysis.results
        .map((data) => data.token.token_id)
        .filter(Boolean);

      const currentMarketData =
        await this.tokensService.getMultiTokenByMobulaIds(tokenIds);

      this.logger.log('Computing performances..');

      const performances: TokenPerformance[] = [];

      for (let i = 0; i < analysis.results.length; i++) {
        const result = analysis.results[i];
        const current = currentMarketData.find(
          (t) => t.id === result.token.token_id,
        );

        if (!current) continue;

        const initialPrice = result.token.price;
        const currentPrice = current.price;

        let priceChange = currentPrice - initialPrice;
        let percentageChange = (priceChange / initialPrice) * 100;

        performances.push({
          token: result.token.name,
          initialPrice,
          currentPrice,
          priceChange,
          percentageChange,
        });
      }

      const stringifiedPerformance = JSON.stringify(performances);

      this.logger.log('Saving performances..');

      this.supabaseService.updateAnalysisResults(
        {
          ...formattedAnalysis,
          performance: stringifiedPerformance,
        },
        Collection.WEEK_ANALYSIS_RESULTS,
      );
    } catch (error) {
      this.logger.error("Failed to evaluate yesterday's analysis");
      this.logger.error(error);
    }
  }

  private async initCoinCodexList(): Promise<void> {
    if (this.coinCodexList?.length) return;

    this.coinCodexList = await fetchWithTimeout({
      url: 'https://coincodex.com/apps/coincodex/cache/all_coins.json',
    });
  }
}
