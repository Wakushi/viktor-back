import { MobulaExtendedToken } from 'src/modules/mobula/entities/mobula.entities';

export type WalletSnapshotState = 'before_sell' | 'after_sell';

export type Balance = {
  balance: number;
  price: number;
  value: number;
  allocation: number;
  token: MobulaExtendedToken;
};

export type WalletSnapshotInsert = {
  id: number;
  state: WalletSnapshotState;
  balances: string;
  created_at: Date | string;
};

export type WalletSnapshot = {
  id: number;
  state: WalletSnapshotState;
  balances: Balance[];
  created_at: Date | string;
};
