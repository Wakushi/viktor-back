import { MobulaExtendedToken } from 'src/modules/mobula/entities/mobula.entities';

export type MarketObservationEmbedding = MobulaExtendedToken & {
  id: string;
  embedding: number[];
};
