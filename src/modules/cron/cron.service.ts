import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { AnalysisService } from '../analysis/analysis.service';
import {
  DayAnalysisRecord,
  TokenWeekAnalysisResult,
} from '../analysis/entities/analysis.type';
import { PuppeteerService } from 'src/shared/services/puppeteer.service';
import { formatWeekAnalysisResults } from 'src/shared/utils/helpers';
import { Collection } from '../supabase/entities/collections.type';
import { LogGateway } from 'src/shared/services/log-gateway';
import { TransactionService } from '../transaction/transaction.service';
import {
  MobulaChain,
  MobulaExtendedToken,
} from '../mobula/entities/mobula.entities';
import { Address, getAddress } from 'viem';
import { TokensService } from '../tokens/tokens.service';
import { VIKTOR_ASW_CONTRACT_ADDRESSES } from '../transaction/contracts/constants';
import { WalletService } from '../wallet/wallet.service';
import { MobulaService } from '../mobula/mobula.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  private peakPrices = new Map<number, number>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly puppeteerService: PuppeteerService,
    private readonly analysisService: AnalysisService,
    private readonly logGateway: LogGateway,
    private readonly transactionService: TransactionService,
    private readonly tokenService: TokensService,
    private readonly walletService: WalletService,
    private readonly mobulaService: MobulaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleWeekBasedAnalysisJob(
    mode: 'test' | 'live' = 'live',
    skipPastAnalysis = false,
  ) {
    if (mode === 'test') {
      this.log('Running complete analysis in test mode');
    }

    try {
      const start = Date.now();

      const onAnalysisEnd = () => {
        const duration = Date.now() - start;
        this.log(`Analysis task completed in ${duration}ms`);
      };

      if (mode === 'live' && !skipPastAnalysis) {
        this.log('Evaluating past week-based analysis...');
        await this.walletService.saveWalletSnapshot(
          MobulaChain.BASE,
          'before_sell',
        );

        const pastAnalysisRecord =
          await this.analysisService.evaluatePastAnalysis();

        if (pastAnalysisRecord && pastAnalysisRecord?.results.length) {
          await this.transactionService.sellPastAnalysisTokens(
            pastAnalysisRecord.results,
          );
        }

        await this.walletService.saveWalletSnapshot(
          MobulaChain.BASE,
          'after_sell',
        );

        this.log(
          'Evaluated past analysis performances. Starting week-based analysis task...',
        );
      }

      this.peakPrices.clear();

      let analysisResults: TokenWeekAnalysisResult[] =
        await this.analysisService.seekMarketBuyingTargets();

      if (!analysisResults.length) {
        this.log('Analysis produced no results !');
        onAnalysisEnd();
        return;
      }

      this.log('Fetching fear and greed index..');

      const fearAndGreedIndex = await this.puppeteerService.getFearAndGreed();

      if (mode === 'live') {
        analysisResults = await this.transactionService.buyTokens(
          analysisResults,
          Number(fearAndGreedIndex),
        );
      }

      this.log('Saving results..');

      this.saveWeekAnalysisRecords({
        analysisResults,
        fearAndGreedIndex,
        test: mode === 'test',
      });

      onAnalysisEnd();
    } catch (error) {
      this.log(`Error during week analysis CRON Job: ` + JSON.stringify(error));
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  private async watchPrices() {
    const chain = MobulaChain.BASE;
    const STOP_LOSS = -10;
    const TRAILING_DISTANCE = 5;
    const MIN_PROFIT_TO_START_TRAILING = 5;
    const MINIMUM_PROFIT_FLOOR = 3;

    const lastAnalysis = await this.analysisService.getLastAnalysisRecord();

    if (!lastAnalysis) return;

    const record = JSON.parse(lastAnalysis.analysis);
    const analysisResults: TokenWeekAnalysisResult[] = record.results;

    for (const result of analysisResults) {
      const { token } = result;

      try {
        const { priceChange, tokenAddress, peakPriceChange } =
          await this.getPriceChange({ chain, token });

        if (priceChange < STOP_LOSS) {
          this.log(`Stop loss: ${token.name} at ${priceChange.toFixed(2)}%`);

          await this.transactionService.sellToken({
            chain,
            tokenAddress,
            token,
          });

          continue;
        }

        if (peakPriceChange >= MIN_PROFIT_TO_START_TRAILING) {
          const dropFromPeak = peakPriceChange - priceChange;

          this.log(
            `[Trailing TP]: ${token.name} -> Current: ${priceChange.toFixed(2)}%, Peak: ${peakPriceChange.toFixed(2)}%, Drop: ${dropFromPeak}%`,
          );

          if (
            dropFromPeak >= TRAILING_DISTANCE &&
            priceChange >= MINIMUM_PROFIT_FLOOR
          ) {
            await this.transactionService.sellToken({
              chain,
              tokenAddress,
              token,
            });
          }
        }
      } catch (error) {
        this.log(error);
      }
    }
  }

  private async getPriceChange({
    chain,
    token,
  }: {
    chain: MobulaChain;
    token: MobulaExtendedToken;
  }): Promise<{
    priceChange: number;
    tokenAddress: Address;
    peakPriceChange: number;
  }> {
    const contract = token.contracts.find((c) => c.blockchain === chain);
    const tokenAddress = getAddress(contract.address);

    if (!tokenAddress) {
      throw new Error(
        `Unable to find recent market data for token ${token.name}`,
      );
    }

    const balance = await this.tokenService.getTokenBalance({
      chain,
      token: tokenAddress,
      account: VIKTOR_ASW_CONTRACT_ADDRESSES[chain],
    });

    if (!balance || balance === BigInt(0)) {
      throw new Error(`No token balance for ${token.name}`);
    }

    const buyingPrice = token.price;

    let currentPrice = await this.tokenService.getTokenPrice(
      MobulaChain.BASE,
      tokenAddress,
    );

    if (!currentPrice || currentPrice < 0 || currentPrice > 100000000) {
      const marketData = await this.mobulaService.getTokenMarketDataById(
        token.token_id,
      );

      if (!marketData || !marketData.price) {
        throw new Error(
          `Something went wrong with current price calculation (found ${currentPrice} for ${token.name})`,
        );
      }

      currentPrice = marketData.price;
    }

    const priceChange = ((currentPrice - buyingPrice) / buyingPrice) * 100;

    const peakPriceChange = this.updatePeakPriceChange(
      token.token_id,
      priceChange,
    );

    this.log(
      `${token.name}: ${priceChange.toFixed(2)}% (peak: ${peakPriceChange.toFixed(2)}%)`,
    );

    return { priceChange, tokenAddress, peakPriceChange };
  }

  private updatePeakPriceChange(
    tokenId: number,
    currentPriceChange: number,
  ): number {
    const currentPeak = this.peakPrices.get(tokenId) || currentPriceChange;
    const newPeak = Math.max(currentPeak, currentPriceChange);
    this.peakPrices.set(tokenId, newPeak);
    return newPeak;
  }

  private async saveWeekAnalysisRecords({
    analysisResults,
    fearAndGreedIndex,
    test,
  }: {
    analysisResults: TokenWeekAnalysisResult[];
    fearAndGreedIndex: string;
    test: boolean;
  }): Promise<void> {
    if (!analysisResults.length) return;

    const formattedResults = formatWeekAnalysisResults(
      analysisResults,
      fearAndGreedIndex,
    );

    if (test) {
      formattedResults.test = true;
    }

    await this.supabaseService.insertSingle<DayAnalysisRecord>(
      Collection.WEEK_ANALYSIS_RESULTS,
      formattedResults,
    );
  }

  private log(message: string) {
    this.logger.log(message);
    this.logGateway.sendLog(message);
  }

  public async test() {}
}
