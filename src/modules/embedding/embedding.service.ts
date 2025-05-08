import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  VoyageClient,
  VoyageConfig,
  VoyageEmbeddingData,
  VoyageEmbeddingResponse,
} from 'src/modules/embedding/entities/voyage.type';
import { SupabaseError, SupabaseService } from '../supabase/supabase.service';
import { SimilarWeekObservation } from '../analysis/entities/week-observation.type';
import { QueryFunctions } from '../supabase/entities/collections.type';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  private voyageClient: VoyageClient;

  constructor(
    @Inject('VOYAGE_CONFIG')
    private readonly config: VoyageConfig,
    private readonly supabaseService: SupabaseService,
  ) {
    this.voyageClient = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
    };
  }

  public async createEmbeddings(
    documents: string[],
    log = false,
  ): Promise<VoyageEmbeddingData[]> {
    try {
      this.verifyEmbeddingPayload(documents);

      const MAX_BATCH_SIZE = 128;
      const batches: string[][] = [];

      while (documents.length) {
        const batch = documents.splice(0, MAX_BATCH_SIZE);
        batches.push(batch);
      }

      const embeddingResults: VoyageEmbeddingData[] = [];

      let batchCounter = 1;

      for (const batch of batches) {
        if (log) {
          this.logger.log(`Embedding batch ${batchCounter}/${batches.length}`);
        }

        const requestBody = {
          input: batch,
          model: this.voyageClient.model || 'voyage-3',
          input_type: 'document',
          truncation: true,
        };

        const response = await fetch(
          `${this.voyageClient.baseUrl}/embeddings`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.voyageClient.apiKey}`,
            },
            body: JSON.stringify(requestBody),
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);

          throw new VoyageAPIError(
            `Voyage API error: ${response.status} ${response.statusText}`,
            errorData,
          );
        }

        const voyageResponse: VoyageEmbeddingResponse = await response.json();

        if (!voyageResponse?.data || !Array.isArray(voyageResponse.data)) {
          throw new Error('Invalid response format from Voyage API');
        }

        embeddingResults.push(...voyageResponse.data);
        batchCounter++;
      }

      return embeddingResults;
    } catch (error) {
      this.handleCreateEmbeddingError(error);
    }
  }

  public async findClosestWeekObservation({
    query,
    matchThreshold,
    matchCount,
  }: {
    query: any;
    matchThreshold: number;
    matchCount: number;
  }): Promise<{
    embeddings: number[];
    matchingWeekObservations: SimilarWeekObservation[];
  }> {
    try {
      this.verifyQuery(query);

      const embeddings = await this.createEmbeddings([query]);

      if (!embeddings || embeddings.length === 0) {
        throw new ValidationError('No embeddings generated for query');
      }

      const observationEmbeddings = embeddings[0].embedding;

      const matchingWeekObservations = await this.matchWeekObservations({
        queryEmbedding: observationEmbeddings,
        matchThreshold,
        matchCount,
      });

      return { embeddings: observationEmbeddings, matchingWeekObservations };
    } catch (error) {
      console.error('Error in findClosestWeekObservation:', error);

      if (
        error instanceof ValidationError ||
        error instanceof VoyageAPIError ||
        error instanceof SupabaseError
      ) {
        throw error;
      }

      throw new Error(
        `Unexpected error in findClosestWeekObservation: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private verifyEmbeddingPayload(documents: string[]) {
    if (!Array.isArray(documents)) {
      throw new Error('Texts must be an array');
    }

    if (documents.length === 0) {
      throw new Error('Texts array cannot be empty');
    }

    documents.forEach((text, index) => {
      if (typeof text !== 'string') {
        throw new Error(`Invalid text at index ${index}: must be a string`);
      }
      if (text.trim().length === 0) {
        throw new Error(`Empty text at index ${index}`);
      }
    });
  }

  private handleCreateEmbeddingError(error: any): void {
    console.error('Error in generateEmbeddings:', error);

    if (error instanceof Error || error instanceof VoyageAPIError) {
      throw error;
    }

    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new VoyageAPIError('Network error while connecting to Voyage API');
    }

    throw new Error(
      `Unexpected error in generateEmbeddings: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }

  private verifyQuery(query: string): void {
    if (!query || typeof query !== 'string') {
      throw new ValidationError('Query must be a non-empty string');
    }

    if (query.trim().length === 0) {
      throw new ValidationError('Query cannot be empty or only whitespace');
    }
  }

  private async matchWeekObservations({
    queryEmbedding,
    matchThreshold,
    matchCount,
  }: {
    queryEmbedding: any;
    matchThreshold: number;
    matchCount: number;
  }): Promise<SimilarWeekObservation[]> {
    const { data, error } = await this.supabaseService.client.rpc(
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
}

export class VoyageAPIError extends Error {
  constructor(
    message: string,
    public readonly errorData?: any,
  ) {
    super(message);
    this.name = 'VoyageAPIError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
