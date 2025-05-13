import { Inject, Injectable } from '@nestjs/common';
import { RpcUrlConfig } from '../uniswap-v3/entities/rpc-url-config.type';
import { AnalysisService } from '../analysis/analysis.service';
import { TokenWeekAnalysisResult } from '../analysis/entities/analysis.type';
import {
  MobulaChain,
  MobulaExtendedToken,
} from '../mobula/entities/mobula.entities';
import { TokensService } from '../tokens/tokens.service';
import { formatUnits, getAddress } from 'viem';
import { VIKTOR_ASW_CONTRACT_ADDRESSES } from '../transaction/contracts/constants';
import { USDC } from '../tokens/entities/usdc';
import { Balance } from './entities/wallet.entities';

@Injectable()
export class WalletService {
  constructor(
    @Inject('WALLET_CONFIG')
    private readonly config: {
      rpcUrls: RpcUrlConfig;
    },
    private readonly analysisService: AnalysisService,
    private readonly tokenService: TokensService,
  ) {
    const { rpcUrls } = config;

    if (!rpcUrls) {
      throw new Error('Expected RPC URLs');
    }
  }

  public async getWalletPortfolio(chain: MobulaChain): Promise<Balance[]> {
    const lastAnalysis = await this.analysisService.getLastAnalysisRecord();

    if (!lastAnalysis) return;

    const record = JSON.parse(lastAnalysis.analysis);
    const analysisResults: TokenWeekAnalysisResult[] = record.results;

    const tokens: MobulaExtendedToken[] = analysisResults.map(
      (result) => result.token,
    );

    tokens.push(USDC);

    const rawBalances = await Promise.all(
      tokens.map(async (token) => {
        try {
          const contract = token.contracts.find((c) => c.blockchain === chain);
          const tokenAddress = getAddress(contract.address);

          const balance = await this.tokenService.getTokenBalance({
            chain,
            token: tokenAddress,
            account: VIKTOR_ASW_CONTRACT_ADDRESSES[chain],
          });

          const price =
            token.name === 'USDC'
              ? 1
              : await this.tokenService.getTokenPrice(chain, tokenAddress);

          const formattedBalance = Number(
            formatUnits(balance, contract.decimals),
          );

          return {
            token,
            balance: formattedBalance,
            price,
            value: price * formattedBalance,
          };
        } catch {}
      }),
    );

    const activeBalances = rawBalances.filter((b) => b && b.balance);

    const totalUsdValue = activeBalances.reduce(
      (prev, curr) => prev + curr.value,
      0,
    );

    const balances: Balance[] = activeBalances.map((b) => ({
      ...b,
      allocation: (b.value / totalUsdValue) * 100,
    }));

    return balances;
  }
}
