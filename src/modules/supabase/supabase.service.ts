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

@Injectable()
export class SupabaseService {
  private _client: SupabaseClient<any, 'public', any>;

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
    try {
      const { data, error } = await this.client
        .from(Collection.MARKET_OBSERVATIONS)
        .insert(marketObservationEmbedding)
        .select()
        .single();

      if (error) {
        throw new Error(`Supabase insert error: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to save market observation embedding:', error);
      throw new Error(
        'Failed to save market observation embedding in vector collection',
      );
    }
  }

  public async insertTradingDecision(
    decision: Omit<TradingDecision, 'id'>,
  ): Promise<TradingDecision> {
    try {
      const { data, error } = await this.client
        .from(Collection.TRADING_DECISIONS)
        .insert(decision)
        .select()
        .single();

      if (error) {
        throw new SupabaseError(
          `Failed to insert trading decision: ${error.message}`,
          error,
        );
      }

      return data;
    } catch (error) {
      console.error('Error inserting trading decision:', error);
      throw error;
    }
  }

  public async insertManyTradingDecisions(
    decisions: Omit<TradingDecision, 'id'>[],
  ): Promise<TradingDecision[]> {
    try {
      const { data, error } = await this.client
        .from(Collection.TRADING_DECISIONS)
        .insert(decisions)
        .select();

      if (error) {
        throw new SupabaseError(
          `Failed to insert trading decisions: ${error.message}`,
          error,
        );
      }

      return data;
    } catch (error) {
      console.error('Error inserting trading decisions:', error);
      throw error;
    }
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

  public async wipeTestTables(): Promise<void> {
    try {
      const { error: sellDecisionsError } = await this.client
        .from(Collection.TRADING_DECISIONS)
        .delete()
        .not('previous_buy_id', 'is', null);

      if (sellDecisionsError) {
        throw new SupabaseError(
          `Failed to wipe sell decisions: ${sellDecisionsError.message}`,
          sellDecisionsError,
        );
      }

      const { error: remainingDecisionsError } = await this.client
        .from(Collection.TRADING_DECISIONS)
        .delete()
        .gte('id', 0);

      if (remainingDecisionsError) {
        throw new SupabaseError(
          `Failed to wipe remaining decisions: ${remainingDecisionsError.message}`,
          remainingDecisionsError,
        );
      }

      const { error: observationsError } = await this.client
        .from(Collection.MARKET_OBSERVATIONS)
        .delete()
        .gte('id', 0);

      if (observationsError) {
        throw new SupabaseError(
          `Failed to wipe market observations: ${observationsError.message}`,
          observationsError,
        );
      }

      console.log('Successfully wiped test tables');
    } catch (error) {
      console.error('Error wiping test tables:', error);
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
