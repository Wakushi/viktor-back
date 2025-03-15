import { Injectable, Logger } from '@nestjs/common';
import {
  calculateBuyingConfidence,
  calculateDecisionTypeStats,
  calculateProfitabilityScore,
} from './helpers/decision-computation';

import { TokenData } from 'src/modules/tokens/entities/token.type';
import { TokensService } from '../tokens/tokens.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  Analysis,
  MINIMUM_SAMPLE_CONFIDENCE,
  TokenAnalysisResult,
  TokenPerformance,
} from './entities/analysis-result.type';
import { CoinCodexBaseTokenData } from '../training/entities/coincodex.type';
import { findClosestInt } from 'src/shared/utils/helpers';
import { PuppeteerService } from 'src/shared/services/puppeteer.service';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly tokensService: TokensService,
    private readonly embeddingService: EmbeddingService,
    private readonly supabaseService: SupabaseService,
    private readonly puppeteerService: PuppeteerService,
  ) {}

  public async seekMarketBuyingTargets(): Promise<TokenAnalysisResult[]> {
    try {
      this.logger.log('Started token search...');

      const tokens: TokenData[] = await this.tokensService.discoverTokens();

      this.logger.log(
        `Discovered ${tokens.length} tokens ! Starting analysis...`,
      );

      const analysis: TokenAnalysisResult[] = await this.analyzeTokens(tokens);

      this.logger.log(
        `Analysis completed ! ${analysis.length} results available.`,
      );

      return analysis;
    } catch (error) {
      console.error('Error while seeking market buying targets :', error);
      return [];
    }
  }

  private async analyzeTokens(
    tokens: TokenData[],
  ): Promise<TokenAnalysisResult[]> {
    const analysisResults: TokenAnalysisResult[] = [];

    const SIMILARITY_THRESHOLD = 0.7;
    const MATCH_COUNT = 40;
    const MINIMUM_CONFIDENCE_TO_BUY = 0.7;
    const PROFITABLE_THRESHOLD = 0.65;

    const WEIGHTS = {
      decisionTypeRatio: 0.3,
      similarity: 0.35,
      profitability: 0.25,
      confidence: 0.1,
    };

    for (const token of tokens) {
      this.logger.log(`Analysing token ${token.metadata.name}...`);

      try {
        const embeddingText =
          this.embeddingService.getEmbeddingTextFromObservation(token.market);

        const similarConditions = await this.embeddingService.findNearestMatch({
          query: embeddingText,
          matchThreshold: SIMILARITY_THRESHOLD,
          matchCount: MATCH_COUNT,
        });

        const allDecisions = await Promise.all(
          similarConditions.map(async (condition) => {
            const decision =
              await this.supabaseService.getDecisionByMarketObservationId(
                condition.id,
              );

            if (!decision) return;

            return {
              marketCondition: condition,
              decision,
              similarity: condition.similarity,
              profitabilityScore: calculateProfitabilityScore(decision),
            };
          }),
        );

        const decisions = allDecisions.filter((d) => d);

        if (decisions.length === 0) continue;

        const decisionStats = calculateDecisionTypeStats(
          decisions,
          PROFITABLE_THRESHOLD,
        );

        const buyingConfidence = calculateBuyingConfidence(
          decisions,
          decisionStats,
          WEIGHTS,
        );

        analysisResults.push({
          token,
          buyingConfidence,
          similarDecisionsAmount: decisions.length,
          decisionTypeRatio: decisionStats,
        });
      } catch (error) {
        console.error(`Error analyzing token ${token.metadata.symbol}:`, error);
      }
    }

    return analysisResults
      .filter((result) => {
        return (
          result.buyingConfidence.score >= MINIMUM_CONFIDENCE_TO_BUY &&
          result.buyingConfidence.sampleSizeConfidence >=
            MINIMUM_SAMPLE_CONFIDENCE
        );
      })
      .sort((a, b) => b.buyingConfidence.score - a.buyingConfidence.score);
  }

  public async evaluatePastAnalysis(date?: Date) {
    try {
      this.logger.log("Fetching yesterday's analysis..");

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const formattedAnalysis =
        await this.supabaseService.getAnalysisResultsByDate(date || yesterday);

      const analysis: Analysis = JSON.parse(formattedAnalysis.analysis);

      const coinCodexData: CoinCodexBaseTokenData[] =
        await this.fetchWithTimeout({
          url: 'https://coincodex.com/apps/coincodex/cache/all_coins.json',
        });

      this.logger.log('Fetching current prices..');

      const analysisTokens = analysis.analysis.map((t) => ({
        name: t.token.metadata.name,
        id: t.token.metadata.id,
      }));

      const currentPrices: Map<number, number[]> = new Map();

      for (const token of coinCodexData) {
        if (currentPrices.size === analysisTokens.length) break;

        const matchingToken = analysisTokens.find((tokenId) => {
          const lowercasedName = tokenId.name.toLowerCase();
          const lowercasedNameVariant = lowercasedName.replaceAll(' ', '-');
          const lowercasedId = tokenId.id.toLowerCase();
          const lowercasedIdVariant = lowercasedId.replaceAll(' ', '-');

          const possibleMatches = [
            token.ccu_slug?.toLowerCase(),
            token.name?.toLowerCase(),
            token.shortname?.toLowerCase(),
            token.symbol?.toLowerCase(),
            token.display_symbol?.toLowerCase(),
            token.aliases?.toLowerCase(),
          ];

          return (
            possibleMatches.includes(lowercasedId) ||
            possibleMatches.includes(lowercasedIdVariant) ||
            possibleMatches.includes(lowercasedName) ||
            possibleMatches.includes(lowercasedNameVariant) ||
            token.shortname.toLowerCase().includes(lowercasedName)
          );
        });

        if (matchingToken) {
          const index = analysisTokens.indexOf(matchingToken);

          if (currentPrices.has(index)) {
            currentPrices.set(index, [
              ...currentPrices.get(index),
              token.last_price_usd,
            ]);
          } else {
            currentPrices.set(analysisTokens.indexOf(matchingToken), [
              token.last_price_usd,
            ]);
          }
        }
      }

      this.logger.log('Computing performances..');

      const performances: TokenPerformance[] = [];

      for (let i = 0; i < analysis.analysis.length; i++) {
        const result = analysis.analysis[i];

        const initialPrice = result.token.market.price_usd;

        const currentPricesFound = currentPrices.get(i) || [];

        let currentPrice = findClosestInt(currentPricesFound, initialPrice);
        let priceChange = currentPrice - initialPrice;
        let percentageChange = (priceChange / initialPrice) * 100;

        if (!currentPrice || Math.abs(percentageChange) > 90) {
          this.logger.log(
            `Found abnormal price for ${result.token.metadata.name}, refetching price...`,
          );

          currentPrice = await this.tokensService.getTokenPriceByCoinGeckoId(
            result.token.market.coin_gecko_id,
          );
          priceChange = currentPrice - initialPrice;
          percentageChange = (priceChange / initialPrice) * 100;
        }

        performances.push({
          token: result.token.metadata.name,
          initialPrice,
          currentPrice,
          priceChange,
          percentageChange,
        });
      }

      const stringifiedPerformance = JSON.stringify(performances);

      this.logger.log('Saving performances..');

      this.supabaseService.updateAnalysisResults({
        ...formattedAnalysis,
        performance: stringifiedPerformance,
      });
    } catch (error) {
      this.logger.error("Failed to evaluate yesterday's analysis");
      this.logger.error(error);
    }
  }

  private async fetchWithTimeout({
    url,
    options = {},
    timeout = 60000,
  }: {
    url: string;
    options?: any;
    timeout?: number;
  }): Promise<any> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const text = await response.text();

      try {
        return JSON.parse(text);
      } catch (parseError) {
        this.logger.error(`Invalid JSON received: ${parseError.message}`);
        this.logger.error(`Error position: ${parseError.position}`);
        this.logger.error(
          `JSON snippet near error: ${text.substring(Math.max(0, parseError.position - 100), parseError.position + 100)}`,
        );
        throw parseError;
      }
    } finally {
      clearTimeout(id);
    }
  }

  public async getFearAndGreed(): Promise<string> {
    return await this.puppeteerService.getFearAndGreed();
  }
}
