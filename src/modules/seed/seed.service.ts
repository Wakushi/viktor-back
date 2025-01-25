import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  TokenData,
  TokenMarketObservation,
  TokenMetadata,
} from '../tokens/entities/token.type';
import { MarketObservationEmbedding } from '../embedding/entities/embedding.type';
import { EmbeddingService } from '../embedding/embedding.service';
import { AgentService } from '../agent/agent.service';
import { AnalysisFormatter } from './helpers/analytics-formatter';

@Injectable()
export class SeedService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly agentService: AgentService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  public async seedDatabase(tokens: TokenData[]): Promise<any> {
    // const marketObservationEmbeddings: Omit<
    //   MarketObservationEmbedding,
    //   'id'
    // >[] = [];
    // for (let token of tokens) {
    //   const marketObservationEmbedding =
    //     await this.generateMarketObservationWithEmbedding(token.market);
    //   marketObservationEmbeddings.push(marketObservationEmbedding);
    // }
    // const insertedObservations: MarketObservationEmbedding[] = [];
    // for (const observation of marketObservationEmbeddings) {
    //   const inserted =
    //     await this.supabaseService.insertMarketObservationEmbedding(
    //       observation,
    //     );
    //   insertedObservations.push(inserted);
    // }
    // const generatedDecisions =
    //   await generateDecisionsForObservations(insertedObservations);
    // const tempIdToRealId = new Map<number, string>();
    // const insertedDecisions: TradingDecision[] = [];
    // for (const decision of generatedDecisions) {
    //   const { tempId, previousBuyTempId, ...decisionData } = decision;
    //   const inserted = await this.supabaseService.insertTradingDecision({
    //     ...decisionData,
    //     previous_buy_id: previousBuyTempId
    //       ? tempIdToRealId.get(previousBuyTempId)
    //       : undefined,
    //   });
    //   tempIdToRealId.set(tempId, inserted.id);
    //   insertedDecisions.push(inserted);
    // }
    // return {
    //   observations: insertedObservations,
    //   decisions: insertedDecisions,
    // };
  }

  public async testAgentAnalysis(token: TokenData): Promise<string> {
    const analysisResults = await this.agentService.analyzeTokens([token]);

    return AnalysisFormatter.formatAnalysisResults(analysisResults);
  }

  public async wipeTestData(): Promise<void> {
    try {
      await this.supabaseService.wipeTestTables();
    } catch (error) {
      console.error('Error wiping test data:', error);
      throw new Error(`Failed to wipe test data: ${error.message}`);
    }
  }

  private async generateMarketObservationWithEmbedding(
    observation: TokenMarketObservation,
  ): Promise<Omit<MarketObservationEmbedding, 'id'>> {
    const embeddingText =
      this.embeddingService.getEmbeddingTextFromObservation(observation);

    const embeddings = await this.embeddingService.createEmbeddings([
      embeddingText,
    ]);

    const marketObservationEmbedding: Omit<MarketObservationEmbedding, 'id'> = {
      ...observation,
      embedding: embeddings[0].embedding,
    };

    return marketObservationEmbedding;
  }
}
