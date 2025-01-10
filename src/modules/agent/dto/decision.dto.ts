import { Address } from 'viem';

export class MakeDecisionDto {
  uuid: string;
  owner: Address;
  wallet: Address;
}
