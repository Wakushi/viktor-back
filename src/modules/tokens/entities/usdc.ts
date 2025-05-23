import {
  MobulaChain,
  MobulaExtendedToken,
} from 'src/modules/mobula/entities/mobula.entities';

export const USDC: MobulaExtendedToken = {
  id: 100012309,
  token_id: 100012309,
  key: '100012309',
  name: 'USDC',
  symbol: 'USDC',
  decimals: 6,
  logo: 'https://coin-images.coingecko.com/coins/images/6319/large/usdc.png?1696506694',
  rank: 83,
  price: 1.003088031038005,
  market_cap: 61099299345.4582,
  market_cap_diluted: 66338098.4586635,
  volume: 4760908520.692144,
  volume_change_24h: 139.997314453125,
  volume_7d: 1411962624,
  liquidity: 9120894619297.6,
  ath: 1.141071081127836,
  atl: 0.9312482894146569,
  off_chain_volume: 9671755613,
  is_listed: true,
  price_change_1h: 0.03615464895765062,
  price_change_24h: 0.04103994256604145,
  price_change_7d: 0.05053078847358262,
  price_change_1m: 0.09280833010334896,
  price_change_1y: 0.0746242754946076,
  total_supply: 66133875,
  circulating_supply: 60911203658,
  contracts: [
    {
      address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      blockchainId: '8453',
      blockchain: MobulaChain.BASE,
      decimals: 6,
    },
    {
      address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      blockchainId: '42161',
      blockchain: MobulaChain.ARBITRUM,
      decimals: 6,
    },
    {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      blockchainId: '1',
      blockchain: MobulaChain.ETHEREUM,
      decimals: 6,
    },
    {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      blockchainId: 'solana',
      blockchain: MobulaChain.SOLANA,
      decimals: 6,
    },
  ],
};
