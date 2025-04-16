import { Inject, Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Collection } from './entities/collections.type';

@Injectable()
export class SupabaseService {
  private _client: SupabaseClient<any, 'public', any>;

  private readonly BATCH_SIZE = 100;

  constructor(
    @Inject('SUPABASE_CONFIG')
    private readonly config: {
      privateKey: string;
      url: string;
    },
  ) {
    const { privateKey, url } = config;

    if (!privateKey) throw new Error(`Expected env var SUPABASE_API_KEY`);
    if (!url) throw new Error(`Expected env var SUPABASE_URL`);

    this._client = createClient(url, privateKey);
  }

  public get client(): SupabaseClient<any, 'public', any> {
    return this._client;
  }

  public async batchInsert<T extends object>(
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

  public async updateSingle<T extends { id: number | string }>(
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
