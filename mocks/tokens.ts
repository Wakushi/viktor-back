import { TokenMarketData } from 'src/shared/services/token-data/entities/token.type';

export const WETH: TokenMarketData = {
  coinGeckoId: 'weth',
  symbol: 'WETH',
  name: 'WETH',
  liquidity_usd: NaN,
  volume_24h: undefined,
  holder_count: 0,
  created_at: '',
  price_change_24h: undefined,
  market_cap: undefined,
  price_usd: undefined,
  metadata: {
    id: 'weth',
    symbol: 'weth',
    name: 'WETH',
    contract_addresses: {
      tron: {
        decimal_place: 18,
        contract_address: 'THb4CqiFdwNHsWsQCs4JhzwjMWys4aqCbF',
      },
      ethereum: {
        decimal_place: 18,
        contract_address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      },
    },
    market_cap_rank: 21,
    genesis_date: '2016-06-17T00:00:00+00:00',
    categories: [
      'Crypto-Backed Tokens',
      'Wrapped-Tokens',
      'Ethereum Ecosystem',
      'FTX Holdings',
      'Tron Ecosystem',
      'Index Coop Defi Index',
      'Index Coop Index',
    ],
    links: {
      github: [],
      twitter: '',
      website: ['https://weth.io/'],
      telegram: '',
    },
    platforms: {
      tron: 'THb4CqiFdwNHsWsQCs4JhzwjMWys4aqCbF',
      ethereum: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    },
    last_updated: '2025-01-13T20:52:59.899+00:00',
    created_at: '2025-01-13T20:52:59.899+00:00',
  },
};

export const MOCKED_TOKENS: TokenMarketData[] = [
  {
    coinGeckoId: 'game-by-virtuals',
    symbol: 'GAME',
    name: 'GAME by Virtuals',
    liquidity_usd: 4923403.9,
    volume_24h: 49234039,
    holder_count: 0,
    created_at: '2024-11-20T05:19:05.168Z',
    price_change_24h: -20.31932,
    market_cap: 141585886,
    price_usd: 0.141586,
    metadata: {
      id: 'game-by-virtuals',
      symbol: 'game',
      name: 'GAME by Virtuals',
      contract_addresses: {
        base: {
          decimal_place: 18,
          contract_address: '0x1c4cca7c5db003824208adda61bd749e55f463a3',
        },
      },
      market_cap_rank: 448,
      genesis_date: null,
      categories: [
        'Base Ecosystem',
        'AI Agents',
        'Virtuals Protocol Ecosystem',
        'AI Framework',
      ],
      links: {
        github: [],
        twitter: 'GAME_Virtuals',
        website: ['https://app.virtuals.io/virtuals/273'],
        telegram: '',
      },
      platforms: {
        base: '0x1c4cca7c5db003824208adda61bd749e55f463a3',
      },
      last_updated: '2025-01-13T15:19:47.433+00:00',
      created_at: '2025-01-13T15:19:47.433+00:00',
    },
  },
  {
    coinGeckoId: 'aixbt',
    symbol: 'AIXBT',
    name: 'aixbt by Virtuals',
    liquidity_usd: 15503703.100000001,
    volume_24h: 155037031,
    holder_count: 0,
    created_at: '2024-11-19T08:44:57.425Z',
    price_change_24h: -18.52619,
    market_cap: 324030014,
    price_usd: 0.379647,
    metadata: {
      id: 'aixbt',
      symbol: 'aixbt',
      name: 'aixbt by Virtuals',
      contract_addresses: {
        base: {
          decimal_place: 18,
          contract_address: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
        },
        solana: {
          decimal_place: 8,
          contract_address: '14zP2ToQ79XWvc7FQpm4bRnp9d6Mp1rFfsUW3gpLcRX',
        },
      },
      market_cap_rank: 243,
      genesis_date: null,
      categories: [
        'Solana Ecosystem',
        'Meme',
        'Base Ecosystem',
        'AI Meme',
        'AI Agents',
        'Virtuals Protocol Ecosystem',
        'Binance Alpha Spotlight',
      ],
      links: {
        github: [],
        twitter: 'aixbt_agent',
        website: [
          'https://app.virtuals.io/virtuals/1199',
          'https://x.com/aixbt_agent',
        ],
        telegram: 'aixbtportal',
      },
      platforms: {
        base: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
        solana: '14zP2ToQ79XWvc7FQpm4bRnp9d6Mp1rFfsUW3gpLcRX',
      },
      last_updated: '2025-01-13T15:06:39.185+00:00',
      created_at: '2025-01-13T15:06:39.185+00:00',
    },
  },
  {
    coinGeckoId: 'layerzero',
    symbol: 'ZRO',
    name: 'LayerZero',
    liquidity_usd: 12309442.4,
    volume_24h: 123094424,
    holder_count: 0,
    created_at: '2024-06-27T07:51:29.088Z',
    price_change_24h: -11.55453,
    market_cap: 453277002,
    price_usd: 4.08,
    metadata: {
      id: 'layerzero',
      symbol: 'zro',
      name: 'LayerZero',
      contract_addresses: {
        base: {
          decimal_place: 18,
          contract_address: '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        },
        ethereum: {
          decimal_place: 18,
          contract_address: '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        },
        avalanche: {
          decimal_place: 18,
          contract_address: '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        },
        'polygon-pos': {
          decimal_place: 18,
          contract_address: '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        },
        'arbitrum-one': {
          decimal_place: 18,
          contract_address: '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        },
        'binance-smart-chain': {
          decimal_place: 18,
          contract_address: '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        },
        'optimistic-ethereum': {
          decimal_place: 18,
          contract_address: '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        },
      },
      market_cap_rank: 197,
      genesis_date: null,
      categories: [
        'Smart Contract Platform',
        'BNB Chain Ecosystem',
        'Avalanche Ecosystem',
        'Polygon Ecosystem',
        'Arbitrum Ecosystem',
        'Ethereum Ecosystem',
        'Optimism Ecosystem',
        'Base Ecosystem',
        'Multicoin Capital Portfolio',
        'Layer 0 (L0)',
        'Cross-chain Communication',
        'Circle Ventures Portfolio',
        'Sequoia Capital Portfolio',
        'OKX Ventures Portfolio',
      ],
      links: {
        github: [],
        twitter: 'LayerZero_Core',
        website: ['https://layerzero.network/'],
        telegram: '',
      },
      platforms: {
        base: '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        ethereum: '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        avalanche: '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        'polygon-pos': '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        'arbitrum-one': '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        'binance-smart-chain': '0x6985884c4392d348587b19cb9eaaf157f13271cd',
        'optimistic-ethereum': '0x6985884c4392d348587b19cb9eaaf157f13271cd',
      },
      last_updated: '2025-01-13T13:49:02.826+00:00',
      created_at: '2025-01-13T13:49:02.826+00:00',
    },
  },
];
