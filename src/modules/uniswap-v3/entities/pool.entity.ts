import { FeeAmount } from '@uniswap/v3-sdk';
import { Address } from 'viem';

export type Pool = {
  address: Address;
  fee: FeeAmount;
  liquidityOut: bigint;
  liquidityIn: bigint;
};
