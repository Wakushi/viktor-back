import { Address } from 'viem';

export type AerodromePool = {
  address: Address;
  token0: Address;
  token1: Address;
  liquidity0: bigint;
  liquidity1: bigint;
};

export type AerodromeRoute = {
  from: Address;
  to: Address;
  stable: boolean;
  factory: Address;
};
