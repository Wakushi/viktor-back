import { MobulaExtendedToken } from 'src/modules/mobula/entities/mobula.entities';

export type Balance = {
  balance: number;
  price: number;
  value: number;
  allocation: number;
  token: MobulaExtendedToken;
};
