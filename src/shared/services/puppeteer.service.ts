import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { formatDateToDDMMYYYY } from '../utils/helpers';

@Injectable()
export class PuppeteerService {
  private readonly logger = new Logger(PuppeteerService.name);

  public async getFearAndGreed(): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();

      const url = 'https://coinmarketcap.com/charts/fear-and-greed-index/';
      const FEAR_AND_GREED_SPAN_SELECTOR = '.sc-65e7f566-0.dMVtcS.base-text';

      await page.goto(url);
      await page.waitForSelector(FEAR_AND_GREED_SPAN_SELECTOR, {
        timeout: 5000,
      });

      const fearAndGreedText = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : '';
      }, FEAR_AND_GREED_SPAN_SELECTOR);

      return fearAndGreedText;
    } catch (error) {
      this.logger.error(`Error reading fear and greed index: ${error.message}`);
      return '';
    } finally {
      await browser.close();
    }
  }

  public async downloadCoinCodexCsv({
    tokenName,
    fromTimestamp,
    directory = 'downloads',
  }: {
    tokenName: string;
    fromTimestamp: number;
    directory?: string;
  }): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const downloadPath = path.join(process.cwd(), directory);
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

      const url = `https://coincodex.com/crypto/${tokenName}/historical-data`;
      const altUrl = `https://coincodex.com/crypto/${tokenName}-token/historical-data`;

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

      const formattedStartDate = fromTimestamp
        ? formatDateToDDMMYYYY(new Date(fromTimestamp))
        : '01011970';

      await firstInput.type(formattedStartDate);

      await page.waitForSelector('.select button.button.button-primary', {
        timeout: 5000,
      });

      const selectButton = await page.waitForSelector(
        '.select button.button.button-primary',
        {
          timeout: 5000,
          visible: true,
        },
      );

      if (!selectButton) {
        throw new Error('Select button not found');
      }

      await selectButton.click();

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
          const newFile = `${tokenName}${fileExtension}`;
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

  private async saveScreenshot(
    page: puppeteer.Page,
    name = 'screenshot',
  ): Promise<void> {
    try {
      const filePath = path.resolve(process.cwd(), `${name}-${Date.now()}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      this.logger.log(`📸 Screenshot saved to ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to take screenshot: ${error.message}`);
    }
  }
}
