export type TokenMetadata = {
  token_id: number;
  name: string;
  weth_pool_address?: string | null;
  usdc_pool_address?: string | null;
  usdt_pool_address?: string | null;
  chain: string;
};
