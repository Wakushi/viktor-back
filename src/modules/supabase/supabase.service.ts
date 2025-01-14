import { Inject, Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DocumentEmbedding } from '../embedding/entities/embedding.type';
import {
  Collection,
  MatchResult,
  QueryFunctions,
} from './entities/collections.type';

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

  public async saveDocumentsEmbeddings(
    documents: DocumentEmbedding[],
  ): Promise<void> {
    try {
      const { error } = await this.client
        .from(Collection.DOCUMENT_EMBEDDINGS)
        .insert(documents);

      if (error) {
        throw new Error(`Supabase insert error: ${error.message}`);
      }

      console.log(`Successfully inserted ${documents.length} documents`);
    } catch (error) {
      console.error('Failed to save embedded documents:', error);
      throw new Error('Failed to save embedded documents in vector collection');
    }
  }

  public async matchDocuments({
    queryEmbedding,
    matchThreshold,
    matchCount,
  }: {
    queryEmbedding: any;
    matchThreshold: number;
    matchCount: number;
  }): Promise<MatchResult[]> {
    const { data, error } = await this.client.rpc(
      QueryFunctions.MATCH_DOCUMENT_EMBEDDINGS,
      {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
      },
    );

    if (error) {
      throw new SupabaseError('Failed to match documents', error);
    }

    return data ? (data as MatchResult[]) : [];
  }

  public async clearEmbeddingsTable() {
    const { error } = await this.client
      .from(Collection.DOCUMENT_EMBEDDINGS)
      .delete()
      .neq('id', 0);

    if (error) {
      throw new SupabaseError(
        'Error clearing embeddings table: ' + error.message,
      );
    }
  }

  // TO-DO add proper types
  async getTokenMetadataById(id: string): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('token_metadata')
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

  // TO-DO add proper types
  async insertTokenMetadata(metadata: any): Promise<void> {
    const { error } = await this.client.from('token_metadata').upsert(metadata);

    if (error) {
      throw error;
    }

    console.log(`Inserted ${metadata.id} metadata row`);
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
