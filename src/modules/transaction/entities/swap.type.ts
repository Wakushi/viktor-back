import { Hash } from 'viem';

import { MobulaChain, MobulaExtendedToken } from 'src/modules/mobula/entities/mobula.entities';
import { Address } from 'viem/accounts';

export type Swap = {
  chain: MobulaChain;
  token_in: Address;
  token_out: Address;
  amount_in: string;
  amount_out: string;
  transaction_hash: Hash;
  created_at?: Date | string;
};

export type QuotedToken = {
  token: MobulaExtendedToken;
  usdAmount: number;
  tokenAmountToBuy: number;
  minAmountOut?: bigint;
  error?: string;
};