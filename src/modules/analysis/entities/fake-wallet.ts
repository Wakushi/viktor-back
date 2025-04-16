export interface FakeWalletSnapshot {
  id: number;
  tokens: Record<number, number>; // Mobula token id -> amount { 102479749: 0.8, 102479743: 1500 }
  total_value_usd: number | null;
  daily_return_percent: number | null;
  created_at: Date | string;
}
