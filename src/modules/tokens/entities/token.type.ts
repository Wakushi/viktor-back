export type WalletToken = {
  name: string;
  mainAddress: string;
  symbol: string;
};

export type WalletTokenBalance = WalletToken & {
  balance: string;
};
