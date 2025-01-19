import { TokenData } from 'src/modules/tokens/entities/token.type';

const testToken: TokenData = {
  market: {
    coin_gecko_id: 'test_token',
    timestamp: Date.now(),
    market_cap_rank: 90,
    price_usd: 110,
    high_24h: 112,
    low_24h: 108,
    ath: 400, // -72.5% from ATH
    ath_change_percentage: -72.5,
    atl: 90, // +22% from ATL
    atl_change_percentage: 22,
    market_cap: 110000000,
    fully_diluted_valuation: 165000000,
    circulating_supply: 1000000,
    total_supply: 1500000,
    total_volume: 22000000, // Volume/mcap ratio of 0.20
    max_supply: 2000000,
    supply_ratio: 0.66,
    price_change_24h: 2,
    price_change_percentage_24h: 1.85,
    market_cap_change_24h: 2000000,
    market_cap_change_percentage_24h: 1.85,
  },
  metadata: {
    id: 'test_token',
    symbol: 'TEST',
    name: 'Test Token',
    contract_addresses: null,
    market_cap_rank: 90,
    genesis_date: '2023-01-01',
    categories: ['Cryptocurrency'],
    links: {
      website: ['https://example.com'],
      twitter: null,
      telegram: null,
      github: [],
    },
    platforms: null,
    last_updated: new Date().toISOString(),
    created_at: '2023-01-01',
  },
};

const oppositeToken = {
  market: {
    coin_gecko_id: 'opposite_test_token',
    timestamp: Date.now(),
    market_cap_rank: 15, // Much higher rank (vs #90)
    price_usd: 380, // High price point
    high_24h: 420,
    low_24h: 370,
    ath: 400, // Very close to ATH (-5%)
    ath_change_percentage: -5,
    atl: 90, // Very far from ATL (+322%)
    atl_change_percentage: 322,
    market_cap: 380000000, // Higher market cap
    fully_diluted_valuation: 570000000,
    circulating_supply: 1000000,
    total_supply: 1500000,
    total_volume: 152000000, // Extremely high volume/mcap ratio of 0.40 (vs 0.20)
    max_supply: 2000000,
    supply_ratio: 0.66,
    price_change_24h: -40, // Strong negative movement (vs +1.85%)
    price_change_percentage_24h: -9.52,
    market_cap_change_24h: -40000000,
    market_cap_change_percentage_24h: -9.52,
  },
  metadata: {
    id: 'opposite_test_token',
    symbol: 'OPPO',
    name: 'Opposite Test Token',
    contract_addresses: null,
    market_cap_rank: 15,
    genesis_date: '2023-01-01',
    categories: ['Cryptocurrency'],
    links: {
      website: ['https://example.com'],
      twitter: null,
      telegram: null,
      github: [],
    },
    platforms: null,
    last_updated: new Date().toISOString(),
    created_at: '2023-01-01',
  },
};

const historicalMarketData: TokenData[] = [
  {
    // Classic Accumulation Phase
    // - Price near historical bottom
    // - High volume showing accumulation
    // - Low volatility
    market: {
      coin_gecko_id: 'accumulation_token',
      timestamp: Date.now() - 86400000 * 180, // 180 days ago
      market_cap_rank: 85,
      price_usd: 100,
      high_24h: 102,
      low_24h: 98,
      ath: 400, // -75% from ATH
      ath_change_percentage: -75,
      atl: 90, // +11% from ATL
      atl_change_percentage: 11,
      market_cap: 100000000,
      fully_diluted_valuation: 150000000,
      circulating_supply: 1000000,
      total_supply: 1500000,
      total_volume: 25000000, // High volume/mcap ratio of 0.25
      max_supply: 2000000,
      supply_ratio: 0.66, // Showing steady emission
      price_change_24h: 1,
      price_change_percentage_24h: 1,
      market_cap_change_24h: 1000000,
      market_cap_change_percentage_24h: 1,
    },
    metadata: {
      id: 'accumulation_token',
      symbol: 'ACCUM',
      name: 'Accumulation Token',
      contract_addresses: null,
      market_cap_rank: 85,
      genesis_date: '2023-01-01',
      categories: ['Cryptocurrency'],
      links: {
        website: ['https://example.com'],
        twitter: null,
        telegram: null,
        github: [],
      },
      platforms: null,
      last_updated: new Date().toISOString(),
      created_at: '2023-01-01',
    },
  },
  {
    // Mark Up Phase / Early Bull
    // - Strong upward momentum
    // - Increasing volume
    // - Higher volatility but mainly upward
    market: {
      coin_gecko_id: 'markup_token',
      timestamp: Date.now() - 86400000 * 90, // 90 days ago
      market_cap_rank: 45,
      price_usd: 200,
      high_24h: 210,
      low_24h: 190,
      ath: 400, // -50% from ATH
      ath_change_percentage: -50,
      atl: 90, // +122% from ATL
      atl_change_percentage: 122,
      market_cap: 200000000,
      fully_diluted_valuation: 300000000,
      circulating_supply: 1000000,
      total_supply: 1500000,
      total_volume: 40000000, // High volume/mcap ratio of 0.20
      max_supply: 2000000,
      supply_ratio: 0.66,
      price_change_24h: 10,
      price_change_percentage_24h: 5,
      market_cap_change_24h: 10000000,
      market_cap_change_percentage_24h: 5,
    },
    metadata: {
      id: 'markup_token',
      symbol: 'MARKUP',
      name: 'Markup Token',
      contract_addresses: null,
      market_cap_rank: 45,
      genesis_date: '2023-01-01',
      categories: ['Cryptocurrency'],
      links: {
        website: ['https://example.com'],
        twitter: null,
        telegram: null,
        github: [],
      },
      platforms: null,
      last_updated: new Date().toISOString(),
      created_at: '2023-01-01',
    },
  },
  {
    // Distribution Phase / Market Top
    // - Price near all-time high
    // - Very high volume
    // - High volatility
    market: {
      coin_gecko_id: 'distribution_token',
      timestamp: Date.now() - 86400000 * 30, // 30 days ago
      market_cap_rank: 20,
      price_usd: 390,
      high_24h: 400,
      low_24h: 380,
      ath: 400, // -2.5% from ATH
      ath_change_percentage: -2.5,
      atl: 90, // +333% from ATL
      atl_change_percentage: 333,
      market_cap: 390000000,
      fully_diluted_valuation: 585000000,
      circulating_supply: 1000000,
      total_supply: 1500000,
      total_volume: 117000000, // Extremely high volume/mcap ratio of 0.30
      max_supply: 2000000,
      supply_ratio: 0.66,
      price_change_24h: -5,
      price_change_percentage_24h: -1.28,
      market_cap_change_24h: -5000000,
      market_cap_change_percentage_24h: -1.28,
    },
    metadata: {
      id: 'distribution_token',
      symbol: 'DIST',
      name: 'Distribution Token',
      contract_addresses: null,
      market_cap_rank: 20,
      genesis_date: '2023-01-01',
      categories: ['Cryptocurrency'],
      links: {
        website: ['https://example.com'],
        twitter: null,
        telegram: null,
        github: [],
      },
      platforms: null,
      last_updated: new Date().toISOString(),
      created_at: '2023-01-01',
    },
  },
  {
    // Mark Down Phase / Early Bear
    // - Strong downward momentum
    // - High volume
    // - High volatility
    market: {
      coin_gecko_id: 'markdown_token',
      timestamp: Date.now() - 86400000 * 15, // 15 days ago
      market_cap_rank: 35,
      price_usd: 300,
      high_24h: 320,
      low_24h: 280,
      ath: 400, // -25% from ATH
      ath_change_percentage: -25,
      atl: 90, // +233% from ATL
      atl_change_percentage: 233,
      market_cap: 300000000,
      fully_diluted_valuation: 450000000,
      circulating_supply: 1000000,
      total_supply: 1500000,
      total_volume: 75000000, // High volume/mcap ratio of 0.25
      max_supply: 2000000,
      supply_ratio: 0.66,
      price_change_24h: -20,
      price_change_percentage_24h: -6.25,
      market_cap_change_24h: -20000000,
      market_cap_change_percentage_24h: -6.25,
    },
    metadata: {
      id: 'markdown_token',
      symbol: 'MARK',
      name: 'Markdown Token',
      contract_addresses: null,
      market_cap_rank: 35,
      genesis_date: '2023-01-01',
      categories: ['Cryptocurrency'],
      links: {
        website: ['https://example.com'],
        twitter: null,
        telegram: null,
        github: [],
      },
      platforms: null,
      last_updated: new Date().toISOString(),
      created_at: '2023-01-01',
    },
  },
  {
    // Consolidation / Sideways Phase
    // - Low volatility
    // - Lower volume
    // - Sideways price action
    market: {
      coin_gecko_id: 'consolidation_token',
      timestamp: Date.now() - 86400000 * 7, // 7 days ago
      market_cap_rank: 55,
      price_usd: 250,
      high_24h: 255,
      low_24h: 245,
      ath: 400, // -37.5% from ATH
      ath_change_percentage: -37.5,
      atl: 90, // +177% from ATL
      atl_change_percentage: 177,
      market_cap: 250000000,
      fully_diluted_valuation: 375000000,
      circulating_supply: 1000000,
      total_supply: 1500000,
      total_volume: 25000000, // Lower volume/mcap ratio of 0.10
      max_supply: 2000000,
      supply_ratio: 0.66,
      price_change_24h: 1,
      price_change_percentage_24h: 0.4,
      market_cap_change_24h: 1000000,
      market_cap_change_percentage_24h: 0.4,
    },
    metadata: {
      id: 'consolidation_token',
      symbol: 'CONS',
      name: 'Consolidation Token',
      contract_addresses: null,
      market_cap_rank: 55,
      genesis_date: '2023-01-01',
      categories: ['Cryptocurrency'],
      links: {
        website: ['https://example.com'],
        twitter: null,
        telegram: null,
        github: [],
      },
      platforms: null,
      last_updated: new Date().toISOString(),
      created_at: '2023-01-01',
    },
  },
];

const additionalMarketData: TokenData[] = [
  // Starting with accumulation phase variations
  {
    market: {
      ...historicalMarketData[0].market,
      timestamp: Date.now() - 86400000 * 175, // 175 days ago
      price_usd: 98,
      high_24h: 100,
      low_24h: 96,
      ath_change_percentage: -75.5,
      atl_change_percentage: 8.9,
      total_volume: 24000000,
      price_change_24h: 0.8,
      price_change_percentage_24h: 0.82,
      market_cap_change_24h: 800000,
      market_cap_change_percentage_24h: 0.82,
    },
    metadata: {
      ...historicalMarketData[0].metadata,
      id: 'accumulation_token_var1',
    },
  },
  {
    market: {
      ...historicalMarketData[0].market,
      timestamp: Date.now() - 86400000 * 170, // 170 days ago
      price_usd: 103,
      high_24h: 105,
      low_24h: 101,
      ath_change_percentage: -74.25,
      atl_change_percentage: 14.4,
      total_volume: 26000000,
      price_change_24h: 1.2,
      price_change_percentage_24h: 1.18,
      market_cap_change_24h: 1200000,
      market_cap_change_percentage_24h: 1.18,
    },
    metadata: {
      ...historicalMarketData[0].metadata,
      id: 'accumulation_token_var2',
    },
  },

  // Markup phase variations
  {
    market: {
      ...historicalMarketData[1].market,
      timestamp: Date.now() - 86400000 * 85, // 85 days ago
      price_usd: 205,
      high_24h: 215,
      low_24h: 195,
      ath_change_percentage: -48.75,
      atl_change_percentage: 127.8,
      total_volume: 42000000,
      price_change_24h: 11,
      price_change_percentage_24h: 5.37,
      market_cap_change_24h: 11000000,
      market_cap_change_percentage_24h: 5.37,
    },
    metadata: {
      ...historicalMarketData[1].metadata,
      id: 'markup_token_var1',
    },
  },
  {
    market: {
      ...historicalMarketData[1].market,
      timestamp: Date.now() - 86400000 * 80, // 80 days ago
      price_usd: 195,
      high_24h: 205,
      low_24h: 185,
      ath_change_percentage: -51.25,
      atl_change_percentage: 116.7,
      total_volume: 38000000,
      price_change_24h: 9,
      price_change_percentage_24h: 4.62,
      market_cap_change_24h: 9000000,
      market_cap_change_percentage_24h: 4.62,
    },
    metadata: {
      ...historicalMarketData[1].metadata,
      id: 'markup_token_var2',
    },
  },

  // Distribution phase variations
  {
    market: {
      ...historicalMarketData[2].market,
      timestamp: Date.now() - 86400000 * 25, // 25 days ago
      price_usd: 395,
      high_24h: 398,
      low_24h: 385,
      ath_change_percentage: -1.25,
      atl_change_percentage: 338.9,
      total_volume: 120000000,
      price_change_24h: -3,
      price_change_percentage_24h: -0.76,
      market_cap_change_24h: -3000000,
      market_cap_change_percentage_24h: -0.76,
    },
    metadata: {
      ...historicalMarketData[2].metadata,
      id: 'distribution_token_var1',
    },
  },
  {
    market: {
      ...historicalMarketData[2].market,
      timestamp: Date.now() - 86400000 * 20, // 20 days ago
      price_usd: 385,
      high_24h: 395,
      low_24h: 375,
      ath_change_percentage: -3.75,
      atl_change_percentage: 327.8,
      total_volume: 115000000,
      price_change_24h: -7,
      price_change_percentage_24h: -1.82,
      market_cap_change_24h: -7000000,
      market_cap_change_percentage_24h: -1.82,
    },
    metadata: {
      ...historicalMarketData[2].metadata,
      id: 'distribution_token_var2',
    },
  },

  // Markdown phase variations
  {
    market: {
      ...historicalMarketData[3].market,
      timestamp: Date.now() - 86400000 * 12, // 12 days ago
      price_usd: 290,
      high_24h: 310,
      low_24h: 270,
      ath_change_percentage: -27.5,
      atl_change_percentage: 222.2,
      total_volume: 73000000,
      price_change_24h: -22,
      price_change_percentage_24h: -7.07,
      market_cap_change_24h: -22000000,
      market_cap_change_percentage_24h: -7.07,
    },
    metadata: {
      ...historicalMarketData[3].metadata,
      id: 'markdown_token_var1',
    },
  },
  {
    market: {
      ...historicalMarketData[3].market,
      timestamp: Date.now() - 86400000 * 10, // 10 days ago
      price_usd: 280,
      high_24h: 300,
      low_24h: 260,
      ath_change_percentage: -30,
      atl_change_percentage: 211.1,
      total_volume: 70000000,
      price_change_24h: -18,
      price_change_percentage_24h: -6.04,
      market_cap_change_24h: -18000000,
      market_cap_change_percentage_24h: -6.04,
    },
    metadata: {
      ...historicalMarketData[3].metadata,
      id: 'markdown_token_var2',
    },
  },

  // Consolidation phase variations
  {
    market: {
      ...historicalMarketData[4].market,
      timestamp: Date.now() - 86400000 * 5, // 5 days ago
      price_usd: 252,
      high_24h: 257,
      low_24h: 247,
      ath_change_percentage: -37,
      atl_change_percentage: 180,
      total_volume: 24500000,
      price_change_24h: 0.8,
      price_change_percentage_24h: 0.32,
      market_cap_change_24h: 800000,
      market_cap_change_percentage_24h: 0.32,
    },
    metadata: {
      ...historicalMarketData[4].metadata,
      id: 'consolidation_token_var1',
    },
  },
  {
    market: {
      ...historicalMarketData[4].market,
      timestamp: Date.now() - 86400000 * 3, // 3 days ago
      price_usd: 248,
      high_24h: 253,
      low_24h: 243,
      ath_change_percentage: -38,
      atl_change_percentage: 175.6,
      total_volume: 25500000,
      price_change_24h: -0.5,
      price_change_percentage_24h: -0.2,
      market_cap_change_24h: -500000,
      market_cap_change_percentage_24h: -0.2,
    },
    metadata: {
      ...historicalMarketData[4].metadata,
      id: 'consolidation_token_var2',
    },
  },
];

const MOCK_MARKET_DATA = [
  ...historicalMarketData,
  ...additionalMarketData,
  oppositeToken,
];

export { MOCK_MARKET_DATA, testToken };
