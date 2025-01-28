import { Inject, Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MarketObservationEmbedding } from '../embedding/entities/embedding.type';
import {
  Collection,
  QueryFunctions,
  TokenMarketObservationMatchResult,
} from './entities/collections.type';
import { TokenMetadata } from '../tokens/entities/token.type';
import { TradingDecision } from '../agent/entities/trading-decision.type';
import { FormattedAnalysisResult } from '../agent/entities/analysis-result.type';

@Injectable()
export class SupabaseService {
  private _client: SupabaseClient<any, 'public', any>;

  private readonly BATCH_SIZE = 100;

  constructor(
    @Inject('SUPABASE_CONFIG')
    private readonly config: { privateKey: string; url: string },
  ) {
    const { privateKey, url } = config;

    if (!privateKey) throw new Error(`Expected env var SUPABASE_API_KEY`);
    if (!url) throw new Error(`Expected env var SUPABASE_URL`);

    this._client = createClient(url, privateKey);
  }

  private get client(): SupabaseClient<any, 'public', any> {
    return this._client;
  }

  public async insertMarketObservationEmbedding(
    marketObservationEmbedding: Omit<MarketObservationEmbedding, 'id'>,
  ): Promise<MarketObservationEmbedding> {
    return this.insertSingle<MarketObservationEmbedding>(
      Collection.MARKET_OBSERVATIONS,
      marketObservationEmbedding,
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

  public async insertTradingDecision(
    decision: Omit<TradingDecision, 'id'>,
  ): Promise<TradingDecision> {
    return this.insertSingle<TradingDecision>(
      Collection.TRADING_DECISIONS,
      decision,
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

  public async getTokenMetadataById(id: string): Promise<TokenMetadata | null> {
    try {
      const { data, error } = await this.client
        .from(Collection.TOKEN_METADATA)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      return null;
    }
  }

  public async insertTokenMetadata(metadata: TokenMetadata): Promise<void> {
    const { error } = await this.client
      .from(Collection.TOKEN_METADATA)
      .upsert(metadata);

    if (error) {
      throw error;
    }

    console.log(`Inserted ${metadata.id} metadata row`);
  }

  public async getDecisionByMarketObservationId(
    marketObservationId: number,
  ): Promise<TradingDecision | null> {
    try {
      const { data, error } = await this.client
        .from(Collection.TRADING_DECISIONS)
        .select('*')
        .eq('observation_id', marketObservationId)
        .maybeSingle();

      if (error) {
        throw new SupabaseError('Failed to fetch trading decision', error);
      }

      return data;
    } catch (error) {
      console.error('Error fetching trading decision:', error);
      return null;
    }
  }

  public async insertAnalysisResult(
    analysisResult: Omit<FormattedAnalysisResult, 'id'>,
  ): Promise<void> {
    this.insertSingle<FormattedAnalysisResult>(
      Collection.ANALYSIS_RESULTS,
      analysisResult,
    );
  }

  public async getAnalysisResults() {
    try {
      const { data, error } = await this.client
        .from(Collection.ANALYSIS_RESULTS)
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
