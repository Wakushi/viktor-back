import { Inject, Injectable } from '@nestjs/common';
import {
  VoyageClient,
  VoyageConfig,
  VoyageEmbeddingData,
  VoyageEmbeddingResponse,
} from 'src/modules/embedding/entities/voyage.type';
import { SupabaseService } from '../supabase/supabase.service';

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
    };
  }

  public async createEmbeddings(
    documents: string[],
  ): Promise<VoyageEmbeddingData[]> {
    try {
      this.verifyEmbeddingPayload(documents);

      const requestBody = {
        input: documents,
        model: 'voyage-3',
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

      return voyageResponse.data;
    } catch (error) {
      this.handleCreateEmbeddingError(error);
    }
  }

  // public async findNearestMatch(query: string): Promise<any> {
  //   try {
  //     if (!query || typeof query !== 'string') {
  //       throw new ValidationError('Query must be a non-empty string');
  //     }

  //     if (query.trim().length === 0) {
  //       throw new ValidationError('Query cannot be empty or only whitespace');
  //     }

  //     const embeddings = await this.createEmbeddings([query]);

  //     if (!embeddings || embeddings.length === 0) {
  //       throw new ValidationError('No embeddings generated for query');
  //     }

  //     const { data, error } = await supabase().rpc('match_documents', {
  //       query_embedding: embeddings[0].embedding,
  //       match_threshold: 0.5,
  //       match_count: 1,
  //     });

  //     if (error) {
  //       throw new SupabaseError('Failed to match documents', error);
  //     }

  //     if (!data || !Array.isArray(data)) {
  //       throw new ValidationError('Invalid response from match_documents');
  //     }

  //     if (data.length === 0) {
  //       return null;
  //     }

  //     return data[0] as CosineResult;
  //   } catch (error) {
  //     console.error('Error in findNearestMatch:', error);

  //     if (
  //       error instanceof ValidationError ||
  //       error instanceof VoyageAPIError ||
  //       error instanceof SupabaseError
  //     ) {
  //       throw error;
  //     }

  //     throw new Error(
  //       `Unexpected error in findNearestMatch: ${
  //         error instanceof Error ? error.message : 'Unknown error'
  //       }`,
  //     );
  //   }
  // }

  public async saveEmbeddings(): Promise<void> {}

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

export class SupabaseError extends Error {
  constructor(
    message: string,
    public readonly errorData?: any,
  ) {
    super(message);
    this.name = 'SupabaseError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
