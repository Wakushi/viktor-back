import { Inject, Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Collection, QueryFunctions } from './entities/collections.type';
import { formatWeekAnalysisResults } from 'src/shared/utils/helpers';
import {
  SimilarWeekObservation,
  WeekObservation,
} from '../analysis/entities/week-observation.type';
import {
  DayAnalysisRecord,
  TokenWeekAnalysisResult,
} from '../analysis/entities/analysis.type';
import { FakeWalletSnapshot } from '../analysis/entities/fake-wallet';

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
      QueryFunctions.MATCH_WEEK_OBSERVATIONS,
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

  public async insertAnalysisRecord(
    analysisResult: Omit<DayAnalysisRecord, 'id'>,
  ): Promise<void> {
    this.insertSingle<DayAnalysisRecord>(
      Collection.WEEK_ANALYSIS_RESULTS,
      analysisResult,
    );
  }

  public async getAnalysisRecords(
    collection: Collection,
  ): Promise<DayAnalysisRecord[] | null> {
    try {
      const { data, error } = await this._cloudClient
        .from(collection)
        .select('*');

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

  public async updateAnalysisRecord(
    analysis: DayAnalysisRecord,
    collection: Collection,
  ) {
    this.updateSingle<DayAnalysisRecord>(collection, analysis);
  }

  public async saveWeekAnalysisRecords(
    results: TokenWeekAnalysisResult[],
    fearAndGreedIndex: string,
  ): Promise<void> {
    if (!results.length) return;

    const formattedResults = formatWeekAnalysisResults(
      results,
      fearAndGreedIndex,
    );

    await this.insertAnalysisRecord(formattedResults);
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

  public async getLatestFakeWalletSnapshot(): Promise<FakeWalletSnapshot | null> {
    try {
      const { data, error } = await this.client
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
    return this.insertSingle(Collection.FAKE_WALLET, snapshot);
  }

  public async updateFakeWalletSnapshot(
    snapshot: FakeWalletSnapshot,
  ): Promise<any> {
    return this.updateSingle(Collection.FAKE_WALLET, snapshot);
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

  public async insertSingle<T extends object>(
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
