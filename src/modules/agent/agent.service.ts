import { Injectable } from '@nestjs/common';
import { Address } from 'viem';
import { Decision } from './entities/decision.entity';
import { generateRequestId } from 'src/shared/utils/helpers';
import { ContractService } from '../contract/contract.service';
import { TokenData } from 'src/modules/tokens/entities/token.type';
import { TokensService } from '../tokens/tokens.service';
import { EmbeddingService } from '../embedding/embedding.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly contractService: ContractService,
    private readonly tokensService: TokensService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  public async analyzeAndMakeDecision(
    walletAddress: Address,
  ): Promise<TokenData[]> {
    try {
      const tokens: TokenData[] = await this.tokensService.discoverTokens();

      for (let token of tokens) {
        // Produce a text embedding from each token.market data
        const embeddingText =
          this.embeddingService.getEmbeddingTextFromObservation(token.market);

        // Perform a cosine query on each embedding generated

        // Map the results to each token
      }

      return tokens;
    } catch (error) {
      console.error('Error in handleAnalysis:', error);
      return null;
    }
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
