import { Injectable } from '@nestjs/common';
import { Address, parseEther } from 'viem';
import { ethers } from 'ethers';
import { Decision } from './entities/decision.entity';
import { generateRequestId } from 'src/shared/utils/helpers';
import { ContractService } from '../contract/contract.service';
import { TokenDataService } from 'src/shared/services/token-data/token-data.service';
import { UniswapV3Service } from '../uniswap-v3/uniswap-v3.service';
import { TokenMarketData } from 'src/shared/services/token-data/entities/token.type';
import { FeeAmount } from '@uniswap/v3-sdk';
import { WETH } from 'mocks/tokens';

@Injectable()
export class AgentService {
  constructor(
    private readonly contractService: ContractService,
    private readonly tokenDataService: TokenDataService,
    private readonly uniswapV3Service: UniswapV3Service,
  ) {}

  public async analyzeAndMakeDecision(
    walletAddress: Address,
  ): Promise<TokenMarketData[]> {
    try {
      return await this.analyseMarket(walletAddress);
    } catch (error) {
      this.handleAnalysisError(error);
      return null;
    }
  }

  private async analyseMarket(
    walletAddress: Address,
  ): Promise<TokenMarketData[]> {
    // const walletTokens =
    //   await this.tokenDataService.getWalletBalances(walletAddress);

    const tokenResults = await this.tokenDataService.discoverTokens();

    const tokenWithPools: TokenMarketData[] = [];

    for (let discoveredToken of tokenResults) {
      let hasPool = false;

      hasPool = await this.uniswapV3Service.doesPoolExists({
        tokenA: discoveredToken,
        tokenB: WETH,
      });

      if (hasPool) {
        tokenWithPools.push(discoveredToken);
      }
    }

    return tokenWithPools;

    // return {
    //   action: 'BUY',
    //   token: ethers.getAddress('0x33A3303eE744f2Fd85994CAe5E625050b32db453'),
    //   amount: parseEther('10').toString(),
    // };
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
