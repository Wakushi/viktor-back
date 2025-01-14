export type SimplifiedChain = {
  name: string;
  chainId: number;
};

export const WHITELISTED_CHAINS: SimplifiedChain[] = [
  { name: 'arbitrum-one', chainId: 42161 },
  { name: 'ethereum', chainId: 1 },
  { name: 'avalanche', chainId: 43114 },
  { name: 'polygon-pos', chainId: 137 },
  { name: 'base', chainId: 8453 },
];

export const WETH_ADDRESSES = {
  'base-sepolia': '0x4200000000000000000000000000000000000006',
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'arbitrum-one': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  avalanche: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  'polygon-pos': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  base: '0x4200000000000000000000000000000000000006',
};
