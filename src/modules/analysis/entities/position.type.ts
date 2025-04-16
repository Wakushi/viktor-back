export interface Position {
  id: number;
  token_id: number;
  amount: number;
  bought_at_price: number;
  bought_at_timestamp: string;
  created_at: Date | string;
}
