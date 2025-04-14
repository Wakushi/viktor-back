import { Inject, Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MarketObservationEmbedding } from '../embedding/entities/embedding.type';
import {
  Collection,
  QueryFunctions,
  TokenMarketObservationMatchResult,
} from './entities/collections.type';
import { TradingDecision } from '../agent/entities/trading-decision.type';
import {
  FormattedAnalysisResult,
  TokenAnalysisResult,
} from '../agent/entities/analysis-result.type';
import {
  formatAnalysisResults,
  formatWeekAnalysisResults,
} from 'src/shared/utils/helpers';
import { MobulaExtendedToken } from '../mobula/entities/mobula.entities';
import {
  SimilarWeekObservation,
  WeekObservation,
} from '../analysis/entities/week-observation.type';
import { TokenWeekAnalysisResult } from '../analysis/entities/analysis.type';

@Injectable()
export class SupabaseService {
  private _client: SupabaseClient<any, 'public', any>;
  private _cloudClient: SupabaseClient<any, 'public', any>;

  private readonly BATCH_SIZE = 100;

  constructor(
    @Inject('SUPABASE_CONFIG')
    private readonly config: {
      privateKey: string;
      url: string;
      cloudPrivateKey: string;
      cloudUrl: string;
    },
  ) {
    const { privateKey, url, cloudPrivateKey, cloudUrl } = config;

    if (!privateKey) throw new Error(`Expected env var SUPABASE_API_KEY`);
    if (!url) throw new Error(`Expected env var SUPABASE_URL`);

    this._client = createClient(url, privateKey);
    this._cloudClient = createClient(cloudUrl, cloudPrivateKey);
  }

  private get client(): SupabaseClient<any, 'public', any> {
    return this._client;
  }

  public async insertManyWeekObservations(
    weekObservations: Omit<WeekObservation, 'id'>[],
  ): Promise<WeekObservation[]> {
    return this.batchInsert<WeekObservation>(
      Collection.WEEK_OBSERVATIONS,
      weekObservations,
      { progressLabel: 'week observations' },
    );
  }

  public async insertManyMarketObservationEmbedding(
    marketObservationEmbedding: Omit<MarketObservationEmbedding, 'id'>[],
  ): Promise<MarketObservationEmbedding[]> {
    return this.batchInsert<MarketObservationEmbedding>(
      Collection.MARKET_OBSERVATIONS,
      marketObservationEmbedding,
      { progressLabel: 'market observations' },
    );
  }

  public async insertManyTradingDecisions(
    decisions: Omit<TradingDecision, 'id'>[],
  ): Promise<TradingDecision[]> {
    return this.batchInsert<TradingDecision>(
      Collection.TRADING_DECISIONS,
      decisions,
      { progressLabel: 'trading decisions' },
    );
  }

  public async matchMarketObservations({
    queryEmbedding,
    matchThreshold,
    matchCount,
  }: {
    queryEmbedding: any;
    matchThreshold: number;
    matchCount: number;
  }): Promise<TokenMarketObservationMatchResult[]> {
    const { data, error } = await this.client.rpc(
      QueryFunctions.MATCH_MARKET_OBSERVATIONS,
      {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
      },
    );

    if (error) {
      throw new SupabaseError('Failed to match market observations', error);
    }

    return data ? (data as TokenMarketObservationMatchResult[]) : [];
  }

  public async matchWeekObservations({
    queryEmbedding,
    matchThreshold,
    matchCount,
  }: {
    queryEmbedding: any;
    matchThreshold: number;
    matchCount: number;
  }): Promise<SimilarWeekObservation[]> {
    const { data, error } = await this.client.rpc(
      QueryFunctions.WEEK_OBSERVATIONS,
      {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
      },
    );

    if (error) {
      throw new SupabaseError('Failed to match week observations', error);
    }

    return data ? (data as SimilarWeekObservation[]) : [];
  }

  public async getTokensMetadata() {
    try {
      const { data, error } = await this.client
        .from(Collection.TOKEN_METADATA)
        .select('*');

      if (error) {
        throw new SupabaseError('Failed to fetch tokens metadata', error);
      }

      return data;
    } catch (error) {
      console.error('Error fetching tokens metadata:', error);
      return null;
    }
  }

  public async getWeekObservations(): Promise<WeekObservation[]> {
    try {
      const { data, error } = await this.client
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

  public async getDecisionByMarketObservationId(
    marketObservationId: number,
  ): Promise<TradingDecision | null> {
    const { data, error } = await this.client
      .from(Collection.TRADING_DECISIONS)
      .select('*')
      .eq('observation_id', marketObservationId)
      .maybeSingle();

    if (error) {
      throw new SupabaseError('Failed to fetch trading decision', error);
    }

    return data;
  }

  public async insertAnalysisResult(
    analysisResult: Omit<FormattedAnalysisResult, 'id'>,
    collection: Collection,
  ): Promise<void> {
    this.insertSingle<FormattedAnalysisResult>(collection, analysisResult);
  }

  public async getAnalysisResults(
    collection: Collection,
    fromCloud = false,
  ): Promise<FormattedAnalysisResult[] | null> {
    const client = fromCloud ? this._cloudClient : this.client;

    try {
      const { data, error } = await client.from(collection).select('*');

      if (error) {
        throw new SupabaseError('Failed to fetch analysis results', error);
      }

      return data;
    } catch (error) {
      console.error('Error fetching analysis results:', error);
      return null;
    }
  }

  public async getAnalysisResultsByDate(
    date: Date,
    collection: Collection,
  ): Promise<FormattedAnalysisResult> {
    try {
      const startOfDate = new Date(date.setHours(0, 0, 0, 0)).toISOString();
      const endOfDate = new Date(date.setHours(23, 59, 59, 999)).toISOString();

      const { data, error } = await this.client
        .from(collection)
        .select('*')
        .gte('created_at', startOfDate)
        .lte('created_at', endOfDate)
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

  public async updateAnalysisResults(
    analysis: FormattedAnalysisResult,
    collection: Collection,
  ) {
    this.updateSingle<FormattedAnalysisResult>(collection, analysis);
  }

  public async saveAnalysisResults(
    results: TokenAnalysisResult[],
    fearAndGreedIndex: string,
  ): Promise<void> {
    if (!results.length) return;

    const formattedResults = formatAnalysisResults(results, fearAndGreedIndex);
    await this.insertAnalysisResult(
      formattedResults,
      Collection.ANALYSIS_RESULTS,
    );
  }

  public async saveWeekAnalysisResults(
    results: TokenWeekAnalysisResult[],
    fearAndGreedIndex: string,
  ): Promise<void> {
    if (!results.length) return;

    const formattedResults = formatWeekAnalysisResults(
      results,
      fearAndGreedIndex,
    );

    await this.insertAnalysisResult(
      formattedResults,
      Collection.WEEK_ANALYSIS_RESULTS,
    );
  }

  public async getMarketObservationsByToken(
    symbol: string,
  ): Promise<MobulaExtendedToken[]> {
    const { data, error } = await this.client
      .from(Collection.MARKET_OBSERVATIONS)
      .select(
        `
    id,
    key,
    timestamp,
    name,
    symbol,
    decimals,
    logo,
    rank,
    price,
    market_cap,
    market_cap_diluted,
    volume,
    volume_change_24h,
    volume_7d,
    liquidity,
    ath,
    atl,
    off_chain_volume,
    is_listed,
    price_change_1h,
    price_change_24h,
    price_change_7d,
    price_change_1m,
    price_change_1y,
    total_supply,
    circulating_supply,
    extra,
    contracts,
    created_at,
    token_id
  `,
      )
      .eq('name', symbol);

    if (error) {
      throw new SupabaseError('Failed to fetch trading decision', error);
    }

    return data;
  }

  public async getWeekObservationsByToken(
    tokenName: string,
  ): Promise<WeekObservation[]> {
    const { data, error } = await this.client
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

  private async batchInsert<T extends object>(
    collection: Collection,
    items: Omit<T, 'id'>[],
    options: {
      batchSize?: number;
      progressLabel?: string;
    } = {},
  ): Promise<T[]> {
    const { batchSize = this.BATCH_SIZE, progressLabel = 'items' } = options;
    const allInsertedData: T[] = [];

    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const currentBatch = i / batchSize + 1;
        const totalBatches = Math.ceil(items.length / batchSize);

        console.log(
          `Processing ${progressLabel} batch ${currentBatch} of ${totalBatches}`,
        );

        const { data, error } = await this.client
          .from(collection)
          .insert(batch)
          .select();

        if (error) {
          throw new SupabaseError(
            `Failed to insert batch in ${collection}: ${error.message}`,
            error,
          );
        }

        allInsertedData.push(...data);
      }

      return allInsertedData;
    } catch (error) {
      console.error(`Error in batch insert for ${collection}:`, error);
      throw error;
    }
  }

  private async insertSingle<T extends object>(
    collection: Collection,
    item: Omit<T, 'id'>,
  ): Promise<T> {
    try {
      const { data, error } = await this.client
        .from(collection)
        .insert(item)
        .select()
        .single();

      if (error) {
        throw new SupabaseError(
          `Failed to insert item in ${collection}: ${error.message}`,
          error,
        );
      }

      return data;
    } catch (error) {
      console.error(`Error inserting single item in ${collection}:`, error);
      throw error;
    }
  }

  private async updateSingle<T extends { id: number | string }>(
    collection: Collection,
    item: T,
  ): Promise<T> {
    try {
      const { data, error } = await this.client
        .from(collection)
        .update(item)
        .eq('id', item.id)
        .select()
        .single();

      if (error) {
        throw new SupabaseError(
          `Failed to update item in ${collection}: ${error.message}`,
          error,
        );
      }

      return data;
    } catch (error) {
      console.error(`Error updating single item in ${collection}:`, error);
      throw error;
    }
  }
}

export class SupabaseError extends Error {
  constructor(
    message: string,
    public readonly errorData?: any,
  ) {
    super(message);
    this.name = 'SupabaseError';
  }
}
