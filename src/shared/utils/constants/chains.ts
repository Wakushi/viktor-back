import { MobulaChain } from 'src/modules/mobula/entities/mobula.entities';
import { Address } from 'viem';

export const WETH_ADDRESSES: Record<string, Address> = {
  [MobulaChain.ETHEREUM]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  [MobulaChain.BASE]: '0x4200000000000000000000000000000000000006',
};

export const USDC_ADDRESSES: Record<string, Address> = {
  [MobulaChain.ETHEREUM]: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  [MobulaChain.BASE]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};
