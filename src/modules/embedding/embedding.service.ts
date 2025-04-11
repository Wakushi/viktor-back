import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  VoyageClient,
  VoyageConfig,
  VoyageEmbeddingData,
  VoyageEmbeddingResponse,
} from 'src/modules/embedding/entities/voyage.type';
import { SupabaseError, SupabaseService } from '../supabase/supabase.service';
import { MarketObservationEmbedding } from './entities/embedding.type';
import {
  calculateNormalizedMetrics,
  combineNarratives,
  generateEnhancedSignalDescription,
  generateMarketNarratives,
} from './helpers/market-data-formatting';
import { TokenMarketObservationMatchResult } from '../supabase/entities/collections.type';
import { MobulaExtendedToken } from '../mobula/entities/mobula.entities';
import { SimilarWeekObservation } from '../analysis/entities/week-observation.type';

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

  public async generateMarketObservationEmbeddings(
    tokens: MobulaExtendedToken[],
  ): Promise<Omit<MarketObservationEmbedding, 'id'>[]> {
    const observationsText: string[] = tokens.map((token) =>
      this.getEmbeddingTextFromObservation(token),
    );

    const observationsEmbeddings =
      await this.createEmbeddings(observationsText);

    const marketObservationEmbeddings: Omit<
      MarketObservationEmbedding,
      'id'
    >[] = [];

    observationsEmbeddings.forEach((observationEmbedding, i) => {
      marketObservationEmbeddings.push({
        ...tokens[i],
        embedding: observationEmbedding.embedding,
      });
    });

    return marketObservationEmbeddings;
  }

  public async createEmbeddings(
    documents: string[],
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
        this.logger.log(`Embedding batch ${batchCounter}/${batches.length}`);

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

  public getEmbeddingTextFromObservation(token: MobulaExtendedToken): string {
    const normalized = calculateNormalizedMetrics(token);

    const narratives = generateMarketNarratives(token, normalized);
    const narrativeText = combineNarratives(narratives, token);

    const signalText = generateEnhancedSignalDescription(token, normalized);

    return `${narrativeText} [SIGNALS] ${signalText}`;
  }

  public async findNearestMatch({
    query,
    matchThreshold,
    matchCount,
  }: {
    query: any;
    matchThreshold: number;
    matchCount: number;
  }): Promise<TokenMarketObservationMatchResult[]> {
    try {
      this.verifyQuery(query);

      const embeddings = await this.createEmbeddings([query]);

      if (!embeddings || embeddings.length === 0) {
        throw new ValidationError('No embeddings generated for query');
      }

      const matchingMarketObservations =
        await this.supabaseService.matchMarketObservations({
          queryEmbedding: embeddings[0].embedding,
          matchThreshold,
          matchCount,
        });

      return matchingMarketObservations;
    } catch (error) {
      console.error('Error in findNearestMatch:', error);

      if (
        error instanceof ValidationError ||
        error instanceof VoyageAPIError ||
        error instanceof SupabaseError
      ) {
        throw error;
      }

      throw new Error(
        `Unexpected error in findNearestMatch: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
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
  }): Promise<SimilarWeekObservation[]> {
    try {
      this.verifyQuery(query);

      const embeddings = await this.createEmbeddings([query]);

      if (!embeddings || embeddings.length === 0) {
        throw new ValidationError('No embeddings generated for query');
      }

      const matchingWeekObservations =
        await this.supabaseService.matchWeekObservations({
          queryEmbedding: embeddings[0].embedding,
          matchThreshold,
          matchCount,
        });

      return matchingWeekObservations;
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
