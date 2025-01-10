import { Injectable } from '@nestjs/common';
import { Address, parseEther } from 'viem';
import { ethers } from 'ethers';
import { Decision } from './entities/decision.entity';
import { generateRequestId } from 'src/shared/utils/helpers';
import { ContractService } from '../../shared/services/contract.service';

@Injectable()
export class AgentService {
  constructor(private readonly contractService: ContractService) {}

  async makeDecision(uuid: string, owner: Address, walletAddress: Address) {
    try {
      console.log(
        `Initiating analysis for UUID ${uuid} (Wallet: ${walletAddress} | Owner: ${owner}).`,
      );

      const decision = await this.analyzeAndMakeDecision();

      await this.submitDecision({
        uuid,
        decision,
        walletAddress,
      });
    } catch (error) {
      this.handleAnalysisError(error);
    }
  }

  private async analyzeAndMakeDecision(): Promise<Decision> {
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
    const requestId = generateRequestId(uuid);

    const actionId = this.getActionId(decision.action);

    const contract = this.contractService.agentContract(walletAddress);

    // const tx = await contract.submitDecision(
    //   requestId,
    //   actionId,
    //   decision.token,
    //   decision.amount,
    // );

    // await tx.wait();
  }

  private handleAnalysisError(error: unknown): void {
    console.error('Error in handleAnalysis:', error);
    // Here you might want to implement retry logic
    // or store failed attempts for manual review
  }

  private getActionId(action: string): number {
    const actionMap = {
      BUY: 1,
      SELL: 2,
    };
    return actionMap[action] || 0;
  }
}
