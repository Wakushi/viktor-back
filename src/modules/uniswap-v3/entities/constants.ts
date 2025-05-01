import { MobulaChain } from 'src/modules/mobula/entities/mobula.entities';

export const UNISWAP_COMMON_FEES = [3000, 10000, 500];

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

export const UNISWAP_QUOTER_V2_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          {
            internalType: 'uint160',
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
          },
        ],
        internalType: 'struct IQuoterV2.QuoteExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceX96After', type: 'uint160' },
      {
        internalType: 'uint32',
        name: 'initializedTicksCrossed',
        type: 'uint32',
      },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

export const UNISWAP_POOL_SLOT_0_ABI = [
  {
    name: 'slot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { internalType: 'uint160', name: 'sqrtPriceX96', type: 'uint160' },
      { internalType: 'int24', name: 'tick', type: 'int24' },
      { internalType: 'uint16', name: 'observationIndex', type: 'uint16' },
      {
        internalType: 'uint16',
        name: 'observationCardinality',
        type: 'uint16',
      },
      {
        internalType: 'uint16',
        name: 'observationCardinalityNext',
        type: 'uint16',
      },
      { internalType: 'uint8', name: 'feeProtocol', type: 'uint8' },
      { internalType: 'bool', name: 'unlocked', type: 'bool' },
    ],
  },
];
