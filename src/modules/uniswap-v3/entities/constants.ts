import { MobulaChain } from 'src/modules/mobula/entities/mobula.entities';

export const UNISWAP_V3_FACTORY = {
  [MobulaChain.ETHEREUM]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  [MobulaChain.BASE]: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
  [MobulaChain.ARBITRUM]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  [MobulaChain.BNB]: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
};

export const UNISWAP_V3_FACTORY_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'tokenA',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'tokenB',
        type: 'address',
      },
      {
        internalType: 'uint24',
        name: 'fee',
        type: 'uint24',
      },
    ],
    name: 'getPool',
    outputs: [
      {
        internalType: 'address',
        name: 'pool',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];
