import { Injectable } from '@nestjs/common';
import { Address } from 'viem';
import {
  calculateBuyingConfidence,
  calculateDecisionTypeStats,
  calculateProfitabilityScore,
} from './helpers/decision-computation';
import { Decision } from './entities/decision.type';
import { generateRequestId } from 'src/shared/utils/helpers';
import { ContractService } from '../contract/contract.service';
import { TokenData } from 'src/modules/tokens/entities/token.type';
import { TokensService } from '../tokens/tokens.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SupabaseService } from '../supabase/supabase.service';
import { TokenAnalysisResult } from './entities/analysis-result.type';

@Injectable()
export class AgentService {
  constructor(
    private readonly contractService: ContractService,
    private readonly tokensService: TokensService,
    private readonly embeddingService: EmbeddingService,
    private readonly supabaseService: SupabaseService,
  ) {}

  public async seekMarketBuyingTargets(): Promise<TokenAnalysisResult[]> {
    try {
      const tokens: TokenData[] = await this.tokensService.discoverTokens();

      const analysis: TokenAnalysisResult[] = await this.analyzeTokens(tokens);

      return analysis;
    } catch (error) {
      console.error('Error while seeking market buying targets :', error);
      return [];
    }
  }

  public async analyzeTokens(
    tokens: TokenData[],
  ): Promise<TokenAnalysisResult[]> {
    const analysisResults: TokenAnalysisResult[] = [];

    const SIMILARITY_THRESHOLD = 0.7;
    const MATCH_COUNT = 12;
    const MINIMUM_CONFIDENCE_TO_BUY = 0.7;
    const PROFITABLE_THRESHOLD = 0.65;

    const WEIGHTS = {
      decisionTypeRatio: 0.3,
      similarity: 0.35,
      profitability: 0.25,
      confidence: 0.1,
    };

    for (const token of tokens) {
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
          similarDecisions: decisions,
          decisionTypeRatio: decisionStats,
        });
      } catch (error) {
        console.error(`Error analyzing token ${token.metadata.symbol}:`, error);
      }
    }

    return analysisResults
      .filter((result) => result.buyingConfidence >= MINIMUM_CONFIDENCE_TO_BUY)
      .sort((a, b) => b.buyingConfidence - a.buyingConfidence);
  }

  private async submitDecision({
    uuid,
    decision,
    walletAddress,
  }: {
    uuid: string;
    decision: Decision;
    walletAddress: Address;
  }) {
    try {
      const requestId = generateRequestId(uuid);

      const actionId = this.getActionId(decision.action);

      const contract = this.contractService.agentContract(walletAddress);

      console.log(`[submitDecision] Submitting transaction with params:`, {
        requestId,
        actionId,
        token: decision.token,
        amount: decision.amount.toString(),
      });

      const tx = await contract.submitDecision(
        requestId,
        actionId,
        decision.token,
        decision.amount,
      );

      console.log(`[submitDecision] Transaction submitted. Hash: ${tx.hash}`);

      await tx.wait();

      console.log(`[submitDecision] Transaction confirmed!`);
    } catch (error: any) {
      console.error('Error submitting to contract :', error);
    }
  }

  private getActionId(action: string): number {
    const actionMap = {
      BUY: 1,
      SELL: 2,
    };
    return actionMap[action] || 0;
  }
}
