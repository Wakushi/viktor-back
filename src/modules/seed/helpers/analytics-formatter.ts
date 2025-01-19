import { TokenAnalysisResult } from 'src/modules/agent/entities/analysis-result.type';
import { TokenMarketObservation } from 'src/modules/tokens/entities/token.type';

export class AnalysisFormatter {
  static formatAnalysisResults(results: TokenAnalysisResult[]): string {
    let output = '\n=== Trading Algorithm Analysis Results ===\n';
    output += `\nAnalyzing ${results.length} tokens at ${new Date().toLocaleString()}\n`;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const token = result.token;

      // Token Header
      output += `\n[Token ${i + 1}] ${token.metadata.name} (${token.metadata.symbol})\n`;
      output += this.formatMarketOverview(token.market);

      // Core Metrics
      output += this.formatCoreMetrics(result);

      // Historical Performance
      output += this.formatHistoricalPerformance(result.decisionTypeRatio);

      // Similar Scenarios Analysis
      output += this.formatSimilarScenarios(result.similarDecisions);

      // Risk Assessment and Recommendation
      output += this.formatRiskAndRecommendation(result);
      output += '----------------------------------------\n';
    }

    return output;
  }

  private static formatMarketOverview(market: TokenMarketObservation): string {
    return (
      `Current Price: $${market.price_usd.toFixed(2)} | 24h Change: ${market.price_change_percentage_24h.toFixed(2)}%\n` +
      `Market Cap: $${this.formatLargeNumber(market.market_cap)} | Rank: #${market.market_cap_rank}\n` +
      `Volume (24h): $${this.formatLargeNumber(market.total_volume)} | Vol/MCap: ${((market.total_volume / market.market_cap) * 100).toFixed(1)}%\n` +
      `ATH Distance: ${market.ath_change_percentage.toFixed(1)}% | ATL Distance: ${market.atl_change_percentage.toFixed(1)}%\n`
    );
  }

  private static formatCoreMetrics(result: TokenAnalysisResult): string {
    return (
      'Core Metrics:\n' +
      `Buying Confidence: ${(result.buyingConfidence * 100).toFixed(1)}% ${this.getConfidenceContext(result.buyingConfidence)}\n` +
      `Market Phase: ${this.determineMarketPhase(result.token.market)}\n`
    );
  }

  private static formatHistoricalPerformance(ratio: {
    buyCount: number;
    sellCount: number;
    profitableBuyCount: number;
    profitableSellCount: number;
  }): string {
    const buyRate =
      ratio.buyCount > 0
        ? ((ratio.profitableBuyCount / ratio.buyCount) * 100).toFixed(1)
        : 'No historical buy data';
    const sellRate =
      ratio.sellCount > 0
        ? ((ratio.profitableSellCount / ratio.sellCount) * 100).toFixed(1)
        : 'No historical sell data';
    const totalDecisions = ratio.buyCount + ratio.sellCount;
    const dataConfidence = this.getDataConfidence(totalDecisions);

    return (
      'Historical Performance:\n' +
      `- Buy Success Rate: ${buyRate}%\n` +
      `- Sell Success Rate: ${sellRate}%\n` +
      `- Data Confidence: ${dataConfidence}.\n`
    );
  }

  private static formatSimilarScenarios(
    similarDecisions: Array<{
      marketCondition: TokenMarketObservation;
      decision: TradingDecision;
      similarity: number;
      profitabilityScore: number;
    }>,
  ): string {
    if (similarDecisions.length === 0) return '';

    let output = 'Most Similar Historical Scenarios:\n';

    for (let i = 0; i < Math.min(3, similarDecisions.length); i++) {
      const similar = similarDecisions[i];
      const date = new Date(similar.marketCondition.timestamp);
      const profitStr = similar.profitabilityScore > 0 ? '+' : '';
      const timeframe = this.getProfitTimeframe(similar.decision);
      const status =
        similar.decision.status !== 'COMPLETED'
          ? ` [${similar.decision.status}]`
          : '';

      output +=
        `${i + 1}. ${date.toLocaleDateString()} | Similarity: ${(similar.similarity * 100).toFixed(1)}% | ` +
        `Decision: ${similar.decision.decision_type} | ${profitStr}${(similar.profitabilityScore * 100).toFixed(1)}% (${timeframe})${status}\n` +
        `   Context: ${this.getMarketContext(similar.marketCondition)}\n`;
    }

    return output;
  }

  private static calculateRiskMetrics(result: TokenAnalysisResult): {
    volatilityRisk: string;
    liquidityRisk: string;
    marketRisk: string;
  } {
    const market = result.token.market;

    // Volatility risk based on price range and recent changes
    const priceRange = (market.high_24h - market.low_24h) / market.price_usd;
    const volatilityRisk = this.categorizeRisk(priceRange * 100);

    // Liquidity risk based on volume to market cap ratio
    const volumeToMcap = market.total_volume / market.market_cap;
    const liquidityRisk = this.categorizeRisk(volumeToMcap * 100, true);

    // Market risk based on ATH distance and market cap rank
    const athDistance = Math.abs(market.ath_change_percentage);
    const marketRisk = this.categorizeRisk(athDistance);

    return {
      volatilityRisk,
      liquidityRisk,
      marketRisk,
    };
  }

  private static formatRiskAndRecommendation(
    result: TokenAnalysisResult,
  ): string {
    const riskMetrics = this.calculateRiskMetrics(result);
    const recommendation = this.generateEnhancedRecommendation(result);

    return (
      'Risk Assessment:\n' +
      `- Volatility Risk: ${riskMetrics.volatilityRisk}\n` +
      `- Liquidity Risk: ${riskMetrics.liquidityRisk}\n` +
      `- Market Risk: ${riskMetrics.marketRisk}\n\n` +
      `RECOMMENDATION: ${recommendation}\n`
    );
  }

  private static getDataConfidence(sampleSize: number): string {
    if (sampleSize > 100) return 'High (>100 samples)';
    if (sampleSize > 30) return 'Moderate (30-100 samples)';
    if (sampleSize > 10) return 'Low (10-30 samples)';
    return 'Very Low (<10 samples)';
  }

  private static getProfitTimeframe(decision: TradingDecision): string {
    if (!decision.decision_timestamp) {
      return 'Unknown duration';
    }

    // If we have 7d data, use that
    if (decision.price_7d_after_usd) {
      return '7d';
    }

    // If we have 24h data, use that
    if (decision.price_24h_after_usd) {
      return '24h';
    }

    // If status is still awaiting results
    if (decision.status === 'AWAITING_24H_RESULT') {
      return 'Pending 24h';
    }

    if (decision.status === 'AWAITING_7D_RESULT') {
      return 'Pending 7d';
    }

    return 'Unknown duration';
  }

  private static getMarketContext(observation: TokenMarketObservation): string {
    const context: string[] = [];

    // Price volatility
    const volatility = Math.abs(observation.price_change_percentage_24h);
    if (volatility > 10) context.push('Extreme Volatility');
    else if (volatility > 5) context.push('High Volatility');

    // Volume analysis
    const volumeToMcap = observation.total_volume / observation.market_cap;
    if (volumeToMcap > 0.25) context.push('Very High Volume');
    else if (volumeToMcap > 0.15) context.push('High Volume');

    // Market extremes
    if (Math.abs(observation.ath_change_percentage) < 10)
      context.push('Near ATH');
    else if (Math.abs(observation.atl_change_percentage) < 10)
      context.push('Near ATL');

    // Market cap movement
    const mcapChange = observation.market_cap_change_percentage_24h;
    if (Math.abs(mcapChange) > 10) {
      context.push(`${mcapChange > 0 ? 'Strong' : 'Weak'} Market Cap Trend`);
    }

    return context.join(', ') || 'Normal Market Conditions';
  }

  private static generateEnhancedRecommendation(
    result: TokenAnalysisResult,
  ): string {
    const confidence = result.buyingConfidence;
    const sampleSize =
      result.decisionTypeRatio.buyCount + result.decisionTypeRatio.sellCount;
    const historicalSuccess =
      result.decisionTypeRatio.buyCount > 0
        ? result.decisionTypeRatio.profitableBuyCount /
          result.decisionTypeRatio.buyCount
        : 0;

    // Check data sufficiency first
    if (sampleSize < 10) {
      return 'INSUFFICIENT DATA - More historical data needed for reliable recommendation';
    }

    // Strong buy conditions
    if (confidence >= 0.7 && historicalSuccess > 0.5 && sampleSize > 30) {
      return 'STRONG BUY - High confidence with good historical success rate';
    }

    // Moderate buy conditions
    if (confidence >= 0.5 && historicalSuccess > 0.4) {
      return 'CONSIDER BUY - Moderate confidence with acceptable historical performance';
    }

    // Weak conditions
    if (confidence < 0.5 || historicalSuccess < 0.4) {
      return 'HOLD/AVOID - Low confidence or poor historical performance';
    }

    return 'NEUTRAL - Mixed signals, monitor for better opportunities';
  }

  private static getConfidenceContext(confidence: number): string {
    if (confidence >= 0.8) return '(Very Strong)';
    if (confidence >= 0.6) return '(Strong)';
    if (confidence >= 0.4) return '(Moderate)';
    return '(Weak)';
  }

  private static categorizeRisk(
    value: number,
    isInverse: boolean = false,
  ): string {
    const thresholds = isInverse
      ? { high: 5, medium: 15 } // For metrics where higher is better (like volume)
      : { high: 15, medium: 5 }; // For metrics where lower is better (like volatility)

    if (isInverse) {
      if (value < thresholds.high) return 'High';
      if (value < thresholds.medium) return 'Medium';
      return 'Low';
    } else {
      if (value > thresholds.high) return 'High';
      if (value > thresholds.medium) return 'Medium';
      return 'Low';
    }
  }

  private static determineMarketPhase(market: TokenMarketObservation): string {
    const volumeToMcap = market.total_volume / market.market_cap;
    const athDistance = Math.abs(market.ath_change_percentage);
    const atlDistance = Math.abs(market.atl_change_percentage);

    // Clear accumulation signals
    if (athDistance > 70 && atlDistance < 25 && volumeToMcap >= 0.15) {
      return 'Accumulation';
    }

    // Distribution phase
    if (athDistance < 10 && atlDistance > 300 && volumeToMcap > 0.25) {
      return 'Distribution';
    }

    // Markup phase
    if (market.price_change_percentage_24h > 4 && volumeToMcap > 0.15) {
      return 'Markup';
    }

    // Markdown phase
    if (market.price_change_percentage_24h < -5 && volumeToMcap > 0.2) {
      return 'Markdown';
    }

    // Consolidation phase
    if (
      Math.abs(market.price_change_percentage_24h) < 2 &&
      volumeToMcap < 0.15
    ) {
      return 'Consolidation';
    }

    return 'Transition';
  }

  private static formatLargeNumber(num: number): string {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  }
}
