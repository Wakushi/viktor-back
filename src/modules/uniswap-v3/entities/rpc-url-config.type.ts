import { MobulaChain } from 'src/modules/mobula/entities/mobula.entities';

export type RpcUrlConfig = {
  mainnet: {
    [MobulaChain.ETHEREUM]: string;
    [MobulaChain.BASE]: string;
  };
  testnet: {
    [MobulaChain.ETHEREUM]: string;
    [MobulaChain.BASE]: string;
  };
};