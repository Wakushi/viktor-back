import { MobulaExtendedToken } from 'src/modules/mobula/entities/mobula.entities';

export type WalletSnapshotState = 'before_sell' | 'after_sell';

export type Balance = {
  balance: number;
  price: number;
  value: number;
  allocation: number;
  token: MobulaExtendedToken;
};

export type WalletSnapshot = {
  id: number;
  state: WalletSnapshotState;
  balances: string; // JSON.parse(balances) => Balance[]
  created_at: Date | string;
};
