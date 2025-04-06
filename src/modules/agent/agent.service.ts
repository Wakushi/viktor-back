import { Injectable, Logger } from '@nestjs/common';
import {
  calculateBuyingConfidence,
  calculateDecisionTypeStats,
  calculateProfitabilityScore,
} from './helpers/decision-computation';
import { TokensService } from '../tokens/tokens.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  Analysis,
  MINIMUM_SAMPLE_CONFIDENCE,
  TokenAnalysisResult,
  TokenPerformance,
} from './entities/analysis-result.type';

import { PuppeteerService } from 'src/shared/services/puppeteer.service';
import { MobulaExtendedToken } from '../mobula/entities/mobula.entities';

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

      const tokens: MobulaExtendedToken[] =
        await this.tokensService.discoverTokens();

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
    tokens: MobulaExtendedToken[],
  ): Promise<TokenAnalysisResult[]> {
    this.logger.log(`Initiating analysis of ${tokens.length} tokens...`);

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

    const analysisResults: TokenAnalysisResult[] = [];

    let batchSize = 14;
    let batchCounter = 1;

    const BATCH_SUCCESS_THRESHOLD = 5;
    const BATCH_FAIL_THRESHOLD = -5;
    const batchRates: Map<number, number> = new Map();

    while (tokens.length) {
      const batch = tokens.splice(0, batchSize);

      this.logger.log(
        `Analyzing token batch ${batchCounter} (${tokens.length} tokens remaining)`,
      );

      try {
        const results: TokenAnalysisResult[] = await Promise.all(
          batch.map(async (token) => {
            const embeddingText =
              this.embeddingService.getEmbeddingTextFromObservation(token);

            const similarConditions =
              await this.embeddingService.findNearestMatch({
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

            if (decisions.length === 0) return;

            const decisionStats = calculateDecisionTypeStats(
              decisions,
              PROFITABLE_THRESHOLD,
            );

            const buyingConfidence = calculateBuyingConfidence(
              decisions,
              decisionStats,
              WEIGHTS,
            );

            return {
              token,
              textObservation: embeddingText,
              buyingConfidence,
              similarDecisionsAmount: decisions.length,
              decisionTypeRatio: decisionStats,
            };
          }),
        );

        analysisResults.push(...results);
        batchCounter++;

        if (!batchRates.has(batchSize)) {
          batchRates.set(batchSize, 0);
        }

        const newRate = batchRates.get(batchSize) + 1;

        if (newRate >= BATCH_SUCCESS_THRESHOLD) {
          batchSize++;
          this.logger.log(`Increasing batch size to ${batchSize}`);
          batchRates.set(batchSize, 1);
        } else {
          batchRates.set(batchSize, newRate);
        }
      } catch (error) {
        this.logger.error(error);

        if (!batchRates.has(batchSize)) {
          batchRates.set(batchSize, 0);
        }

        const newRate = batchRates.get(batchSize) - 1;

        if (newRate <= BATCH_FAIL_THRESHOLD) {
          batchSize--;
          this.logger.log(`Decreasing batch size to ${batchSize}`);
          batchRates.set(batchSize, 0);
        } else {
          batchRates.set(batchSize, newRate);
        }

        tokens.push(...batch);
      }
    }

    return analysisResults
      .filter((result) => {
        return (
          result &&
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

      this.logger.log('Fetching current prices..');

      const currentMarketData =
        await this.tokensService.getMultiTokenByMobulaIds(
          analysis.analysis.map((data) => data.token.id),
        );

      this.logger.log('Computing performances..');

      const performances: TokenPerformance[] = [];

      for (let i = 0; i < analysis.analysis.length; i++) {
        const result = analysis.analysis[i];
        const current = currentMarketData.find((t) => t.id === result.token.id);

        if (!current) continue;

        const initialPrice = result.token.price;
        const currentPrice = current.price;

        let priceChange = currentPrice - initialPrice;
        let percentageChange = (priceChange / initialPrice) * 100;

        performances.push({
          token: result.token.name,
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

  public async getFearAndGreed(): Promise<string> {
    return await this.puppeteerService.getFearAndGreed();
  }
}
