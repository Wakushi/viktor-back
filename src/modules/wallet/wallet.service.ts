import { Inject, Injectable } from '@nestjs/common';
import { RpcUrlConfig } from '../../shared/entities/rpc-url-config.type';
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
import {
  Balance,
  WalletSnapshot,
  WalletSnapshotInsert,
  WalletSnapshotState,
} from './entities/wallet.entities';
import { SupabaseError, SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections.type';

@Injectable()
export class WalletService {
  constructor(
    @Inject('WALLET_CONFIG')
    private readonly config: {
      rpcUrls: RpcUrlConfig;
    },
    private readonly analysisService: AnalysisService,
    private readonly tokenService: TokensService,
    private readonly supabaseService: SupabaseService,
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
              : await this.tokenService.getTokenPriceUniswap(chain, tokenAddress);

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

  public async saveWalletSnapshot(
    chain: MobulaChain,
    state: WalletSnapshotState,
  ): Promise<void> {
    const portfolio = await this.getWalletPortfolio(chain);

    const snapshot: Omit<WalletSnapshotInsert, 'id'> = {
      state,
      balances: JSON.stringify(portfolio),
      created_at: new Date(),
    };

    const { error } = await this.supabaseService.client
      .from(Collection.WALLET_SNAPSHOT)
      .insert(snapshot);

    if (error) {
      throw new SupabaseError('Failed to save wallet snapshot', error);
    }
  }

  public async getWalletSnapshots(): Promise<WalletSnapshot[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from(Collection.WALLET_SNAPSHOT)
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        throw new SupabaseError('Failed to fetch wallet snapshots', error);
      }

      return data.map((d) => ({ ...d, balances: JSON.parse(d.balances) }));
    } catch (error) {
      console.error('Error fetching wallet snapshots:', error);
      return null;
    }
  }
}
