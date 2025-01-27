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
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildObservationsFromMetrics,
  createTradingDecisions,
} from './helpers';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    private readonly csvService: CsvService,
    private readonly embeddingService: EmbeddingService,
    private readonly supabaseService: SupabaseService,
  ) {}

  public async processTokensHistoricalData(
    tokenNames: string[],
  ): Promise<void> {
    for (const tokenName of tokenNames) {
      try {
        this.logger.log('Processing token ' + tokenName);

        const tokenSymbol = await this.getCoinCodexIdentifier(tokenName);

        if (!tokenSymbol) {
          this.logger.log('No token found for symbol ' + tokenSymbol);
          continue;
        }

        this.logger.log('Found token symbol ' + tokenSymbol);

        this.logger.log('Downloading historical data...');

        await this.downloadCoinCodexCsv(tokenName);

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

  private async downloadCoinCodexCsv(tokenSymbol: string): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const downloadPath = path.join(process.cwd(), 'downloads');
      const downloadFolder = path.resolve(downloadPath);
      await fs.promises.mkdir(downloadFolder, { recursive: true });

      const page = await browser.newPage();

      await page.setRequestInterception(true);
      const cdpSession = await page.target().createCDPSession();
      await cdpSession.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadFolder,
      });

      page.on('request', (request) => {
        try {
          request.continue();
        } catch (error) {
          this.logger.error(`Request interception error: ${error.message}`);
          request.abort('failed');
        }
      });

      const url = `https://coincodex.com/crypto/${tokenSymbol}/historical-data`;
      const altUrl = `https://coincodex.com/crypto/${tokenSymbol}-token/historical-data`;

      const EXPORT_BUTTON_SELECTOR = '.export';
      const DATE_SELECT_BUTTON_SELECTOR = '.date-select';

      await page.goto(url);

      try {
        await page.waitForSelector(DATE_SELECT_BUTTON_SELECTOR, {
          timeout: 5000,
        });
      } catch (error) {
        this.logger.log(
          `Wrong page at url ${url}, trying with '-token' suffix...`,
        );

        await page.goto(altUrl);

        await page.waitForSelector(DATE_SELECT_BUTTON_SELECTOR, {
          timeout: 5000,
        });
      }

      await page.click(DATE_SELECT_BUTTON_SELECTOR);

      await page.waitForSelector('.calendars', {
        timeout: 5000,
      });

      const firstInput = await page.waitForSelector(
        '.calendars input[type="date"]:first-of-type',
        {
          timeout: 5000,
        },
      );

      await firstInput.type('01011970');

      await page.waitForSelector('.select button.button.button-primary', {
        timeout: 5000,
      });

      const buttonText = await page.evaluate(() => {
        const button = document.querySelector(
          '.select button.button.button-primary',
        );
        return button ? button.textContent.trim() : null;
      });

      if (buttonText === 'Select') {
        await page.click('.select button.button.button-primary');
      } else {
        throw new Error(
          `Expected to find "Select" button but found "${buttonText}" instead`,
        );
      }

      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 3000)),
      );

      await page.waitForSelector(EXPORT_BUTTON_SELECTOR, {
        timeout: 5000,
        visible: true,
      });

      await page.evaluate((selector) => {
        const button = document.querySelector(selector) as HTMLButtonElement;
        if (button) button.click();
      }, EXPORT_BUTTON_SELECTOR);

      const downloadTimeout = 30000;
      const checkInterval = 1000;
      let elapsed = 0;

      const existingFiles = new Set(await fs.promises.readdir(downloadFolder));

      while (elapsed < downloadTimeout) {
        const currentFiles = await fs.promises.readdir(downloadFolder);

        const newCompletedFiles = currentFiles.filter(
          (file) => !file.endsWith('.crdownload') && !existingFiles.has(file),
        );

        if (newCompletedFiles.length > 0) {
          const downloadedFile = newCompletedFiles[0];

          this.logger.log('Downloaded file ' + downloadedFile);

          const oldPath = path.join(downloadFolder, downloadedFile);
          const fileExtension = path.extname(downloadedFile);
          const newFile = `${tokenSymbol}${fileExtension}`;
          const newPath = path.join(downloadFolder, newFile);

          await fs.promises.rename(oldPath, newPath);
          return newPath;
        }

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        elapsed += checkInterval;
      }

      throw new Error('Download timeout exceeded');
    } catch (error) {
      this.logger.error(`Download failed: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
    }
  }

  private async getCoinCodexIdentifier(tokenSymbol: string): Promise<string> {
    const url = 'https://coincodex.com/apps/coincodex/cache/all_coins.json';

    const response = await fetch(url);
    const data: CoinCodexBaseTokenData[] = await response.json();

    const matchings = data.filter(
      (t) =>
        t.shortname && t.shortname.toLowerCase() === tokenSymbol.toLowerCase(),
    );

    const token = matchings[0];

    console.log('Identified token :', token);

    return token ? token.symbol : '';
  }
}
