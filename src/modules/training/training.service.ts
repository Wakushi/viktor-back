import { Injectable, Logger } from '@nestjs/common';
import { CsvService } from 'src/shared/services/csv.service';
import {
  CoinCodexBaseTokenData,
  CoinCodexCsvDailyMetrics,
  CoinCodexTokenData,
} from './entities/coincodex.type';
import { SupplyMetrics } from './entities/supply.type';
import { MarketObservationEmbedding } from '../embedding/entities/embedding.type';
import { EmbeddingService } from '../embedding/embedding.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  buildObservationsFromMetrics,
  createTradingDecisions,
} from './helpers';
import { PuppeteerService } from 'src/shared/services/puppeteer.service';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    private readonly csvService: CsvService,
    private readonly embeddingService: EmbeddingService,
    private readonly supabaseService: SupabaseService,
    private readonly puppeteerService: PuppeteerService,
  ) {}

  public async processTokensHistoricalData(
    tokenNames: string[],
  ): Promise<void> {
    for (const tokenName of tokenNames) {
      try {
        this.logger.log('Processing token ' + tokenName);

        const tokenSymbol = await this.getCoinCodexIdentifier(tokenName);

        if (!tokenSymbol) {
          this.logger.log('No token found for name ' + tokenName);
          continue;
        }

        this.logger.log('Found token symbol ' + tokenSymbol);

        let fromTimestamp = 0;

        const history =
          await this.supabaseService.getMarketObservationsByToken(tokenSymbol);

        if (history?.length) {
          const trainingData = history.filter(
            (token) => token.logo === 'training',
          );

          trainingData?.sort((a, b) => b.timestamp - a.timestamp);

          fromTimestamp = trainingData[0].timestamp;
        }

        this.logger.log('Downloading historical data...');

        await this.puppeteerService.downloadCoinCodexCsv(
          tokenName,
          fromTimestamp,
        );

        this.logger.log('Saving metrics..');

        await this.saveHistoricalTokenMetrics(tokenSymbol);

        this.logger.log(`Processed token ${tokenName} successfully !`);
      } catch (error) {
        this.logger.error(error);
        continue;
      }
    }
  }

  private async saveHistoricalTokenMetrics(tokenSymbol: string): Promise<any> {
    try {
      this.logger.log('Fetching supply metrics for ', tokenSymbol);

      const staticSupplyMetrics = await this.fetchSupplyMetrics(tokenSymbol);

      this.logger.log('Fetching daily metrics for ', staticSupplyMetrics.name);

      let dailyMetrics: CoinCodexCsvDailyMetrics[] = [];

      try {
        dailyMetrics = await this.fetchDailyMetrics(staticSupplyMetrics.name);
      } catch (error) {
        dailyMetrics = await this.fetchDailyMetrics(tokenSymbol.toLowerCase());
      }

      if (!dailyMetrics.length)
        throw new Error(
          `No daily metrics found for token ${staticSupplyMetrics.name} ${tokenSymbol.toLowerCase()}`,
        );

      dailyMetrics.sort(
        (a, b) => new Date(a.Start).getTime() - new Date(b.Start).getTime(),
      );

      this.logger.log(
        `Fetched ${dailyMetrics.length} days of historical data !`,
      );

      this.logger.log('Building market observations...');

      const tokenMarketObservations = buildObservationsFromMetrics({
        tokenSymbol,
        dailyMetrics,
        staticSupplyMetrics,
      });

      tokenMarketObservations.splice(0, 1);

      this.logger.log('Generating embeddings...');

      const marketObservationEmbeddings =
        await this.embeddingService.generateMarketObservationEmbeddings(
          tokenMarketObservations,
        );

      this.logger.log('Inserting embeddings...');

      const insertedObservations: MarketObservationEmbedding[] =
        await this.supabaseService.insertManyMarketObservationEmbedding(
          marketObservationEmbeddings,
        );

      this.logger.log('Generating decisions...');

      const tradingDecisions = createTradingDecisions(insertedObservations);

      this.logger.log('Inserting decisions...');

      await this.supabaseService.insertManyTradingDecisions(tradingDecisions);
    } catch (error) {
      this.logger.error('Error processing historical data:', error);
      throw error;
    }
  }

  private async fetchDailyMetrics(
    tokenSymbol: string,
  ): Promise<CoinCodexCsvDailyMetrics[]> {
    const data = await this.csvService.getHistoricalTokenData(
      `${tokenSymbol}.csv`,
    );

    return data;
  }

  private async fetchSupplyMetrics(
    tokenSymbol: string,
  ): Promise<SupplyMetrics> {
    const response = await fetch(
      `https://coincodex.com/api/coincodex/get_coin/${tokenSymbol}`,
    );

    if (!response.ok) {
      throw new Error(`Coin codex API error: ${response.status}`);
    }

    const data: CoinCodexTokenData = await response.json();

    const totalSupply = Number(data.total_supply);
    const circulatingSupply = data.supply;

    return {
      name: data.slug.toLowerCase(),
      fully_diluted_valuation: totalSupply * data.last_price_usd,
      circulating_supply: circulatingSupply,
      total_supply: totalSupply,
      max_supply: totalSupply,
      supply_ratio: circulatingSupply / totalSupply,
    };
  }

  private async getCoinCodexIdentifier(tokenSymbol: string): Promise<string> {
    const url = 'https://coincodex.com/apps/coincodex/cache/all_coins.json';

    const data: CoinCodexBaseTokenData[] = await this.fetchWithTimeout({ url });

    const matchings = data.filter(
      (t) =>
        (t.symbol && t.symbol.toLowerCase() === tokenSymbol.toLowerCase()) ||
        (t.shortname &&
          t.shortname.toLowerCase() === tokenSymbol.toLowerCase()),
    );

    const token = matchings[0];

    console.log('Identified token :', token);

    return token ? token.symbol : '';
  }

  private async fetchWithTimeout({
    url,
    options = {},
    timeout = 60000,
  }: {
    url: string;
    options?: any;
    timeout?: number;
  }): Promise<any> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const text = await response.text();

      try {
        return JSON.parse(text);
      } catch (parseError) {
        this.logger.error(`Invalid JSON received: ${parseError.message}`);
        this.logger.error(`Error position: ${parseError.position}`);
        this.logger.error(
          `JSON snippet near error: ${text.substring(Math.max(0, parseError.position - 100), parseError.position + 100)}`,
        );
        throw parseError;
      }
    } finally {
      clearTimeout(id);
    }
  }
}
