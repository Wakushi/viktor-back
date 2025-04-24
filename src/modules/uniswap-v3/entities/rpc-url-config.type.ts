import { MobulaChain } from 'src/modules/mobula/entities/mobula.entities';

export type RpcUrlConfig = {
  [MobulaChain.ETHEREUM]: string;
  [MobulaChain.BASE]: string;
  [MobulaChain.ARBITRUM]: string;
  [MobulaChain.BNB]: string;
};
