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
import { MobulaService } from '../mobula/mobula.service';
import { MobulaChain } from '../mobula/entities/mobula.entities';
import { UniswapV3Service } from '../uniswap-v3/uniswap-v3.service';
import { getAddress } from 'viem';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly puppeteerService: PuppeteerService,
    private readonly analysisService: AnalysisService,
    private readonly logGateway: LogGateway,
    private readonly transactionService: TransactionService,
    private readonly mobulaService: MobulaService,
    private readonly uniswapV3Service: UniswapV3Service,
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

        const pastAnalysisRecord =
          await this.analysisService.evaluatePastAnalysis();

        if (pastAnalysisRecord && pastAnalysisRecord?.results.length) {
          await this.transactionService.sellPastAnalysisTokens(
            pastAnalysisRecord.results,
          );
        }

        this.log(
          'Evaluated past analysis performances. Starting week-based analysis task...',
        );
      }

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

  @Cron(CronExpression.EVERY_5_MINUTES)
  private async watchPrices() {
    const chain = MobulaChain.BASE;
    const MIN_PRICE_CHANGE_FOR_PROFIT = 5;

    const lastAnalysis = await this.analysisService.getLastAnalysisRecord();

    if (!lastAnalysis) return;

    const record = JSON.parse(lastAnalysis.analysis);
    const analysisResults: TokenWeekAnalysisResult[] = record.results;

    for (const result of analysisResults) {
      const { token, expectedNextDayChange } = result;

      const tokenMarketData = await this.mobulaService.getTokenMarketDataById(
        token.token_id,
      );

      const contract = token.contracts.find((c) => c.blockchain === chain);
      const tokenAddress = getAddress(contract.address);

      if (!tokenMarketData || !tokenAddress) {
        this.log(`Unable to find recent market data for token ${token.name}`);
        continue;
      }

      const buyingPrice = token.price;
      const currentPrice = tokenMarketData.price;

      const priceChange = ((currentPrice - buyingPrice) / buyingPrice) * 100;

      const expectedPriceChange = Math.max(
        expectedNextDayChange,
        MIN_PRICE_CHANGE_FOR_PROFIT,
      );

      if (priceChange < -5 || priceChange > expectedPriceChange) {
        this.log(
          `Selling ${token.name} -> ${priceChange.toFixed(2)}% (expected: ${expectedPriceChange.toFixed(2)}%)`,
        );

        await this.transactionService.sellToken({
          chain,
          tokenAddress,
          token: token,
        });
      }
    }
  }

  private log(message: string) {
    this.logger.log(message);
    this.logGateway.sendLog(message);
  }

  public async test() {
    await this.watchPrices();
  }
}
