import { MobulaChain } from 'src/modules/mobula/entities/mobula.entities';

export interface ViktorSettings {
  id: number;
  whitelisted_chains: MobulaChain[];
  created_at: string;
}
