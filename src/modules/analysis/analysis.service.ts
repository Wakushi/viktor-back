import { Injectable, Logger } from '@nestjs/common';
import { CsvService } from 'src/shared/services/csv.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SupabaseError, SupabaseService } from '../supabase/supabase.service';
import { PuppeteerService } from 'src/shared/services/puppeteer.service';
import {
  SimilarWeekObservation,
  WeekObservation,
} from './entities/week-observation.type';
import {
  MobulaExtendedToken,
  MobulaOHLCV,
} from '../mobula/entities/mobula.entities';
import {
  DayAnalysisRecord,
  TokenPerformance,
  TokenWeekAnalysisResult,
  TradersActivity,
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
import { getAddress, isAddress } from 'viem';
import { SUPPORTED_CHAIN_IDS } from '../mobula/constants';
import {
  CoinCodexBaseTokenData,
  DailyOHLCV,
} from '../tokens/entities/coin-codex.type';
import { FakeWalletSnapshot } from './entities/fake-wallet';
import { fetchWithRetry } from './helpers/utils';
import { TokensService } from '../tokens/tokens.service';
import { LogGateway } from 'src/shared/services/log-gateway';
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
    private readonly logGateway: LogGateway,
  ) {}

  public async seekMarketBuyingTargets(limit: number = 10): Promise<any> {
    try {
      this.log('Started token search...');

      const tokens: MobulaExtendedToken[] =
        await this.tokensService.discoverTokens();

      this.log(`Discovered ${tokens.length} tokens ! Starting analysis...`);

      const analysis: TokenWeekAnalysisResult[] =
        await this.analyzeTokens(tokens);

      const buyingTargets = analysis.slice(0, limit);

      this.log(
        `Analysis completed ! ${buyingTargets.length} results available.`,
      );

      return buyingTargets;
    } catch (error) {
      console.error('Error while seeking market buying targets :', error);
      await this.deleteOHLCVDirectory();
      return [];
    }
  }

  private async analyzeTokens(
    tokens: MobulaExtendedToken[],
  ): Promise<TokenWeekAnalysisResult[]> {
    this.log(`Initiating analysis of ${tokens.length} tokens...`);

    await this.initCoinCodexList();

    const analysisResults: TokenWeekAnalysisResult[] = [];

    const MINIMUM_CONFIDENCE = 0.7;

    let batchSize = 10;
    let batchCounter = 1;

    const BATCH_SUCCESS_THRESHOLD = 5;
    const BATCH_FAIL_THRESHOLD = -5;
    const batchRates: Map<number, number> = new Map();

    while (tokens.length) {
      const batch = tokens.splice(0, batchSize);

      this.log(
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
          this.log(`Increasing batch size to ${batchSize}`);
          batchRates.set(batchSize, 1);
        } else {
          batchRates.set(batchSize, newRate);
        }
      } catch (error) {
        this.log(error);

        if (!batchRates.has(batchSize)) {
          batchRates.set(batchSize, 0);
        }

        const newRate = batchRates.get(batchSize) - 1;

        if (newRate <= BATCH_FAIL_THRESHOLD) {
          batchSize--;
          this.log(`Decreasing batch size to ${batchSize}`);
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
          analysis.confidence > MINIMUM_CONFIDENCE &&
          analysis.prediction !== 'bearish',
      )
      .sort((a, b) => b.confidence - a.confidence);
  }

  private async analyzeToken(
    token: MobulaExtendedToken,
  ): Promise<TokenWeekAnalysisResult | null> {
    const SIMILARITY_THRESHOLD = 0.7;
    const MATCH_COUNT = 40;

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

      const { matchingWeekObservations, embeddings } =
        await this.embeddingService.findClosestWeekObservation({
          query: observation,
          matchCount: MATCH_COUNT,
          matchThreshold: SIMILARITY_THRESHOLD,
        });

      if (!matchingWeekObservations.length) return null;

      const outcomeGroups: Record<
        'bullish' | 'bearish',
        SimilarWeekObservation[]
      > = {
        bullish: [],
        bearish: [],
      };

      for (const condition of matchingWeekObservations) {
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
        similarConditions: matchingWeekObservations,
        tokenOHLCV,
        observation,
        embeddings,
      };
    } catch (error) {
      this.log(error);
      throw new Error(`Analysis failed for ${token.name}`);
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
        this.log('Not enough metrics to train on.');
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

      await this.insertManyWeekObservations(weekObservations);
    } catch (error) {
      this.log('Error training analysis: ' + error);
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
        const history = await this.getWeekObservationsByToken(tokenName);

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
        } catch (error) {}
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

  public async evaluatePastAnalysis(date?: Date): Promise<WeekAnalysis | null> {
    try {
      this.log("Fetching yesterday's analysis..");

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const formattedAnalysis = await this.getAnalysisRecordByDate(
        date || yesterday,
        Collection.WEEK_ANALYSIS_RESULTS,
      );

      if (!formattedAnalysis) return;

      const analysis: WeekAnalysis = JSON.parse(formattedAnalysis.analysis);

      this.log('Fetching current prices..');

      const tokenIds = analysis.results
        .map((data) => data.token.token_id)
        .filter(Boolean);

      const currentMarketData =
        await this.tokensService.getMultiTokenByMobulaIds(tokenIds);

      this.log('Computing performances..');

      const performances: TokenPerformance[] = [];
      const weekObservations: Omit<WeekObservation, 'id'>[] = [];

      for (let i = 0; i < analysis.results.length; i++) {
        const { token, tokenOHLCV, observation } = analysis.results[i];
        let embeddings = analysis.results[i].embeddings;

        const current = currentMarketData.find((t) => t.id === token.token_id);

        if (!current) continue;

        const initialPrice = token.price;
        const currentPrice = current.price;

        const priceChange = currentPrice - initialPrice;
        const percentageChange = (priceChange / initialPrice) * 100;

        performances.push({
          token: token.name,
          initialPrice,
          currentPrice,
          priceChange,
          percentageChange,
        });

        if (!embeddings) {
          const [result] = await this.embeddingService.createEmbeddings(
            [observation],
            true,
          );

          embeddings = result.embedding;
        }

        weekObservations.push({
          token_name: token.name,
          start_date: tokenOHLCV[0].Start,
          end_date: tokenOHLCV[6].End,
          observation_text: observation,
          embedding: embeddings,
          raw_ohlcv_window: JSON.stringify(tokenOHLCV),
          next_day_change: percentageChange,
          next_day_close: currentPrice,
          outcome: priceChange > 0 ? 'bullish' : 'bearish',
          created_at: new Date().toISOString(),
        });
      }

      const stringifiedPerformance = JSON.stringify(performances);

      this.log('Saving new week observations..');

      await this.insertManyWeekObservations(weekObservations);

      this.log('Saving performances..');

      this.supabaseService.updateSingle<DayAnalysisRecord>(
        Collection.WEEK_ANALYSIS_RESULTS,
        {
          ...formattedAnalysis,
          performance: stringifiedPerformance,
        },
      );

      return analysis;
    } catch (error) {
      this.log("Failed to evaluate yesterday's analysis");
      this.log(error);
      return null;
    }
  }

  private async initCoinCodexList(): Promise<void> {
    if (this.coinCodexList?.length) return;

    this.coinCodexList = await fetchWithRetry({
      url: 'https://coincodex.com/apps/coincodex/cache/all_coins.json',
    });
  }

  public async compareTradersActivity(
    analysis: TokenWeekAnalysisResult[],
  ): Promise<TradersActivity[]> {
    const traders = await this.mobulaService.getSmartMoney();
    const tradersAddresses = traders.map((t) => getAddress(t.wallet_address));

    const analysisTokens = analysis.map((a) => ({
      name: a.token.name,
      tokenId: a.token.token_id,
      contracts: a.token.contracts,
    }));

    const tokenTradeRatio: Map<number, { bought: number; sold: number }> =
      new Map();

    this.log(
      `Starting trader analysis for ${tradersAddresses.length} traders...`,
    );

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const scanStart = Date.now() - 2 * ONE_DAY_MS;

    await Promise.all(
      tradersAddresses.map(async (trader) => {
        const trades = await this.mobulaService.getWalletTrades({
          wallet: trader,
          limit: 100,
        });

        if (!trades) return;

        for (const trade of trades) {
          try {
            if (!SUPPORTED_CHAIN_IDS.includes(trade.chain_id)) continue;

            const tradeDate = new Date(trade.date);

            if (tradeDate.getTime() < scanStart) continue;

            const token0 = getAddress(trade.token0_address);
            const token1 = getAddress(trade.token1_address);
            const tradeTokens = [token0, token1];

            const tokenMatch = analysisTokens.find((t) =>
              t.contracts.some(
                (c) =>
                  isAddress(c.address) &&
                  tradeTokens.includes(getAddress(c.address)),
              ),
            );

            if (!tokenMatch) continue;

            const contract = tokenMatch.contracts.find((c) => {
              if (!isAddress(c.address)) return false;

              const contractAddress = getAddress(c.address);

              return contractAddress === token0 || contractAddress === token1;
            });

            const tokenAmountTraded =
              getAddress(contract.address) === token0
                ? trade.amount0
                : trade.amount1;

            const hasBought = Number(tokenAmountTraded) > 0;

            const tokenRatio = tokenTradeRatio.get(tokenMatch.tokenId);

            if (!tokenRatio) {
              tokenTradeRatio.set(tokenMatch.tokenId, {
                bought: hasBought ? 1 : 0,
                sold: hasBought ? 0 : 1,
              });
              continue;
            }

            if (hasBought) {
              tokenRatio.bought++;
            } else {
              tokenRatio.sold++;
            }
          } catch (error) {
            this.log(error);
          }
        }
      }),
    );

    return Array.from(tokenTradeRatio).map(([id, stats]) => ({
      id,
      bought: stats.bought,
      sold: stats.sold,
    }));
  }

  private async insertManyWeekObservations(
    weekObservations: Omit<WeekObservation, 'id'>[],
  ): Promise<WeekObservation[]> {
    return this.supabaseService.batchInsert<WeekObservation>(
      Collection.WEEK_OBSERVATIONS,
      weekObservations,
      { progressLabel: 'week observations' },
    );
  }

  public async getWeekObservations(): Promise<WeekObservation[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from(Collection.WEEK_OBSERVATIONS)
        .select(
          `
              id,
              token_name,
              start_date,
              end_date,
              observation_text,
              embedding,
              raw_ohlcv_window,
              next_day_close,
              next_day_change,
              outcome,
              created_at
            `,
        );

      if (error) {
        throw new SupabaseError('Failed to fetch week observations', error);
      }

      return data;
    } catch (error) {
      console.error('Error fetching week observations:', error);
      return null;
    }
  }

  public async getAnalysisRecords(
    limit = 10,
    page = 1,
  ): Promise<DayAnalysisRecord[] | null> {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error } = await this.supabaseService.client
        .from(Collection.WEEK_ANALYSIS_RESULTS)
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        throw new SupabaseError('Failed to fetch analysis results', error);
      }

      return data;
    } catch (error) {
      console.error('Error fetching analysis results:', error);
      return null;
    }
  }

  public async getAnalysisRecordByDate(
    date: Date,
    collection: Collection,
  ): Promise<DayAnalysisRecord> {
    try {
      const startOfDate = new Date(date.setHours(0, 0, 0, 0)).toISOString();
      const endOfDate = new Date(date.setHours(23, 59, 59, 999)).toISOString();

      const { data, error } = await this.supabaseService.client
        .from(collection)
        .select('*')
        .gte('created_at', startOfDate)
        .lte('created_at', endOfDate)
        .or('test.is.null,test.eq.false')
        .limit(1)
        .single();

      if (error) {
        throw new SupabaseError(
          "Failed to fetch yesterday's analysis results",
          error,
        );
      }

      return data;
    } catch (error) {
      console.error("Error fetching yesterday's analysis results:", error);
      return null;
    }
  }

  public async getWeekObservationsByToken(
    tokenName: string,
  ): Promise<WeekObservation[]> {
    const { data, error } = await this.supabaseService.client
      .from(Collection.WEEK_OBSERVATIONS)
      .select(
        `
          id,
          token_name,
          start_date,
          end_date,
          observation_text,
          embedding,
          raw_ohlcv_window,
          next_day_close,
          next_day_change,
          outcome,
          created_at
        `,
      )
      .eq('token_name', tokenName);

    if (error) {
      throw new SupabaseError('Failed to fetch week observations', error);
    }

    return data;
  }

  public async getLatestFakeWalletSnapshot(): Promise<FakeWalletSnapshot | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from(Collection.FAKE_WALLET)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        throw new SupabaseError(
          'Failed to fetch latest fake wallet snapshot',
          error,
        );
      }

      return data;
    } catch (error) {
      console.error('Error fetching latest fake wallet snapshot:', error);
      return null;
    }
  }

  public async insertFakeWalletSnapshot(
    snapshot: Omit<FakeWalletSnapshot, 'id'>,
  ): Promise<any> {
    return this.supabaseService.insertSingle(Collection.FAKE_WALLET, snapshot);
  }

  public async updateFakeWalletSnapshot(
    snapshot: FakeWalletSnapshot,
  ): Promise<any> {
    return this.supabaseService.updateSingle(Collection.FAKE_WALLET, snapshot);
  }

  public async getLastAnalysisRecord(): Promise<DayAnalysisRecord | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from(Collection.WEEK_ANALYSIS_RESULTS)
        .select('*')
        .or('test.is.null,test.eq.false')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        throw new SupabaseError('Failed to fetch last analysis result', error);
      }

      return data;
    } catch (error) {
      console.error('Error fetching last analysis result:', error);
      return null;
    }
  }

  private log(message: string) {
    this.logger.log(message);
    this.logGateway.sendLog(message);
  }
}
