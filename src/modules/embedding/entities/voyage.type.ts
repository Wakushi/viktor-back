export type VoyageClient = {
  baseUrl: string;
  apiKey: string;
};

export interface VoyageEmbeddingData {
  embedding: number[];
  index: number;
}

export interface VoyageEmbeddingResponse {
  object: string; // "list"
  data: VoyageEmbeddingData[];
  model: string;
  usage: {
    total_tokens: number;
  };
}

export interface VoyageEmbeddingOptions {
  model:
    | 'voyage-3-large'
    | 'voyage-3'
    | 'voyage-3-lite'
    | 'voyage-code-3'
    | 'voyage-finance-2'
    | 'voyage-law-2';
  input_type?: 'query' | 'document';
  truncation?: boolean;
  output_dimension?: 256 | 512 | 1024 | 2048;
  output_dtype?: 'float' | 'int8' | 'uint8' | 'binary' | 'ubinary';
  encoding_format?: 'base64' | null;
}

export type VoyageConfig = {
  baseUrl: string;
  apiKey: string;
};

export interface CosineResult {
  id: number;
  content: string;
  similarity: number;
}

// Example
//   {
//     id: 2,
//     content: 'Jazz under stars (55 min): Experience a captivating night in New Orleans, where jazz melodies echo under the moonlit sky.',
//     similarity: 0.653442463073585
//   }
