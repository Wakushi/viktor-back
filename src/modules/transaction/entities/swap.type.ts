import { Hash, Hex } from 'viem';

import {
  MobulaChain,
  MobulaExtendedToken,
} from 'src/modules/mobula/entities/mobula.entities';
import { Address } from 'viem/accounts';

export type Swap = {
  chain: MobulaChain;
  token_in: Address;
  token_out: Address;
  amount_in: string;
  amount_out: string;
  path: Hex;
  transaction_hash: Hash;
  created_at?: Date | string;
};

export type QuotedToken = {
  token: MobulaExtendedToken;
  usdAmountAllocated: number;
  tokenAmountToBuy: number;
  minAmountOut?: bigint;
  path: `0x${string}`;
  error?: string;
};
