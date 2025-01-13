import { Injectable } from '@nestjs/common';
import { Address, parseEther } from 'viem';
import { ethers } from 'ethers';
import { Decision } from './entities/decision.entity';
import { generateRequestId } from 'src/shared/utils/helpers';
import { ContractService } from '../contract/contract.service';
import { TokenDataService } from 'src/shared/services/token-data/token-data.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly contractService: ContractService,
    private readonly tokenDataService: TokenDataService,
  ) {}

  public async analyzeAndMakeDecision(
    walletAddress: Address,
  ): Promise<Decision | null> {
    try {
      return await this.analyseMarket(walletAddress);
    } catch (error) {
      this.handleAnalysisError(error);
      return null;
    }
  }

  private async analyseMarket(walletAddress: Address): Promise<Decision> {
    const walletTokens =
      await this.tokenDataService.getWalletBalances(walletAddress);

    // Perform token discovery
    const discoveredTokens = await this.tokenDataService.discoverTokens();

    // Filter token based on requirements

    // Generate market observation for each token

    return {
      action: 'BUY',
      token: ethers.getAddress('0x33A3303eE744f2Fd85994CAe5E625050b32db453'),
      amount: parseEther('10').toString(),
    };
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

  private handleAnalysisError(error: unknown): void {
    console.error('Error in handleAnalysis:', error);
  }

  private getActionId(action: string): number {
    const actionMap = {
      BUY: 1,
      SELL: 2,
    };
    return actionMap[action] || 0;
  }
}
