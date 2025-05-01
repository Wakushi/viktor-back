import { MobulaChain } from 'src/modules/mobula/entities/mobula.entities';
import { Address } from 'viem';

export const USDC_DECIMALS = 6;
export const USDT_DECIMALS = 6;
export const WETH_DECIMALS = 18;

export const WRAPPED_NATIVE_ADDRESSES: Record<string, Address> = {
  [MobulaChain.ETHEREUM]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  [MobulaChain.BASE]: '0x4200000000000000000000000000000000000006',
  [MobulaChain.ARBITRUM]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  [MobulaChain.BNB]: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
};

export const USDC_ADDRESSES: Record<string, Address> = {
  [MobulaChain.ETHEREUM]: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  [MobulaChain.BASE]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [MobulaChain.ARBITRUM]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  [MobulaChain.BNB]: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
};

export const USDT_ADDRESSES: Record<string, Address> = {
  [MobulaChain.ETHEREUM]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  [MobulaChain.BASE]: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2',
  [MobulaChain.ARBITRUM]: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  [MobulaChain.BNB]: '0x524bc91dc82d6b90ef29f76a3ecaabafffd490bc',
};

export const BLOCK_EXPLORER_TX_URL: Record<string, string> = {
  [MobulaChain.ETHEREUM]: 'https://etherscan.io/tx',
  [MobulaChain.BASE]: 'https://basescan.org/tx',
  [MobulaChain.ARBITRUM]: 'https://arbiscan.io/tx',
};

export const QUOTER_CONTRACT_ADDRESSES: Record<string, Address> = {
  [MobulaChain.ETHEREUM]: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  [MobulaChain.BASE]: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
  [MobulaChain.ARBITRUM]: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
};
