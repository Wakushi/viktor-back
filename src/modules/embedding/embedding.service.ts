import { Inject, Injectable } from '@nestjs/common';
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
import { TokenMarketObservation } from '../tokens/entities/token.type';
import { TokenMarketObservationMatchResult } from '../supabase/entities/collections.type';

@Injectable()
export class EmbeddingService {
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

  public async createSaveEmbedding(
    marketObservation: TokenMarketObservation,
  ): Promise<Omit<MarketObservationEmbedding, 'id'> | null> {
    try {
      const embeddingText =
        this.getEmbeddingTextFromObservation(marketObservation);

      const embeddings = await this.createEmbeddings([embeddingText]);

      const marketObservationEmbedding: Omit<MarketObservationEmbedding, 'id'> =
        {
          ...marketObservation,
          embedding: embeddings[0].embedding,
        };

      await this.supabaseService.insertMarketObservationEmbedding(
        marketObservationEmbedding,
      );

      return marketObservationEmbedding;
    } catch (error: any) {
      console.error(error);
      return null;
    }
  }

  public async createEmbeddings(
    documents: string[],
  ): Promise<VoyageEmbeddingData[]> {
    try {
      this.verifyEmbeddingPayload(documents);

      const MODEL = this.voyageClient.model || 'voyage-3';

      const requestBody = {
        input: documents,
        model: MODEL,
        input_type: 'document',
        truncation: true,
      };

      const response = await fetch(`${this.voyageClient.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.voyageClient.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

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

      console.log(
        `[EMBEDDING SERVICE] Generated embeddings for ${documents.length} documents.`,
      );

      return voyageResponse.data;
    } catch (error) {
      this.handleCreateEmbeddingError(error);
    }
  }

  public getEmbeddingTextFromObservation(
    observation: TokenMarketObservation,
  ): string {
    const normalized = calculateNormalizedMetrics(observation);

    const narratives = generateMarketNarratives(observation, normalized);
    const narrativeText = combineNarratives(narratives, observation);

    const signalText = generateEnhancedSignalDescription(
      observation,
      normalized,
    );

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

  private verifyEmbeddingPayload(documents: string[]) {
    if (!Array.isArray(documents)) {
      throw new Error('Texts must be an array');
    }

    if (documents.length === 0) {
      throw new Error('Texts array cannot be empty');
    }

    if (documents.length > 128) {
      throw new Error('Maximum number of documents exceeded (limit: 128)');
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
