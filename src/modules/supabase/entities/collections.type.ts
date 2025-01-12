export enum Collection {
  DOCUMENT_EMBEDDINGS = 'document_embeddings',
}

export enum QueryFunctions {
  MATCH_DOCUMENT_EMBEDDINGS = 'match_document_embeddings',
}

export type MatchResult = {
  content: any;
  id: number;
  similarity: number;
};
