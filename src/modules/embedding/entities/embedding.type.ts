import { TokenMarketObservation } from '../helpers/market-data-formatting';

export type MarketObservationEmbedding = TokenMarketObservation & {
  id: string;
  embedding: number[];
};
