import { QualityScore } from '../entities/token-quality-score.type';
import {
  TokenData,
  TokenMarketObservation,
  TokenMetadata,
} from '../entities/token.type';

export function calculateQualityScores(token: TokenData): QualityScore {
  const { market, metadata } = token;

  // Market-based scores (50% of total)
  const volume24hScore = normalizeScore(market.total_volume, 0, 1e9) * 15;
  const marketCapScore = normalizeScore(market.market_cap, 0, 1e10) * 15;

  // Price stability score (10%)
  const priceStabilityScore = calculatePriceStabilityScore(market) * 10;

  // Supply metrics score (10%)
  const supplyScore = calculateSupplyScore(market) * 10;

  // Metadata quality score (15%)
  const documentationScore = calculateDocumentationScore(metadata) * 15;

  // Calculate category scores
  const marketScore =
    volume24hScore + marketCapScore + priceStabilityScore + supplyScore;
  const metadataScore = documentationScore;

  // Calculate total (normalized to 100)
  const total = marketScore + metadataScore;

  return {
    total,
    marketScore,
    metadataScore,
    volume24hScore,
    marketCapScore,
    priceStabilityScore,
    supplyScore,
    documentationScore,
  };
}

function normalizeScore(value: number, min: number, max: number): number {
  if (value <= min) return 0;
  if (value >= max) return 1;
  return (value - min) / (max - min);
}

function calculatePriceStabilityScore(market: TokenMarketObservation): number {
  // Lower volatility = higher score
  const volatilityMetrics = [
    Math.abs(market.price_change_percentage_24h) / 100,
    Math.abs(market.market_cap_change_percentage_24h) / 100,
    Math.abs(market.ath_change_percentage) / 100,
    Math.abs(market.atl_change_percentage) / 100,
  ];

  // Average volatility (inverse for score)
  const avgVolatility =
    volatilityMetrics.reduce((sum, val) => sum + val, 0) /
    volatilityMetrics.length;
  return Math.max(0, 1 - avgVolatility);
}

function calculateSupplyScore(market: TokenMarketObservation): number {
  let score = 0;

  // Reward higher supply ratio (circulating/total)
  if (market.supply_ratio > 0) {
    score += market.supply_ratio * 0.5; // 50% weight
  }

  // Reward tokens with max supply defined
  if (market.max_supply !== null) {
    score += 0.3; // 30% weight
  }

  // Reward reasonable total supply
  const totalSupplyScore = normalizeScore(market.total_supply, 1e6, 1e12);
  score += totalSupplyScore * 0.2; // 20% weight

  return Math.min(1, score);
}

function calculateDocumentationScore(metadata: TokenMetadata): number {
  let score = 0;
  const maxScore = 5; // Total possible points

  // Website presence (1 point)
  if (metadata.links.website && metadata.links.website.length > 0) {
    score += 1;
  }

  // Social media presence (1 point)
  if (metadata.links.twitter || metadata.links.telegram) {
    score += 1;
  }

  // GitHub presence (1 point)
  if (metadata.links.github && metadata.links.github.length > 0) {
    score += 1;
  }

  // Categories defined (1 point)
  if (metadata.categories && metadata.categories.length > 0) {
    score += 1;
  }

  // Contract addresses documented (1 point)
  if (
    metadata.contract_addresses &&
    Object.keys(metadata.contract_addresses).length > 0
  ) {
    score += 1;
  }

  return score / maxScore;
}
