import { ethers } from 'ethers';
import {
  FormattedAnalysisResult,
  TokenAnalysisResult,
} from 'src/modules/agent/entities/analysis-result.type';
import { TokenWeekAnalysisResult } from 'src/modules/analysis/entities/analysis.type';

export function generateRequestId(uuid: string): string {
  return ethers.keccak256(ethers.solidityPacked(['string'], [uuid]));
}

interface BatchConfig {
  batchSize: number;
  delayBetweenBatches: number;
}

export async function processBatchWithRateLimit<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  config: BatchConfig = { batchSize: 4, delayBetweenBatches: 2000 },
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += config.batchSize) {
    console.log(`Processing batch n°${i} (size: ${config.batchSize})`);
    const batch = items.slice(i, i + config.batchSize);

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          return await processFn(item);
        } catch (error) {
          console.error('Error processing item:', error);
          return null;
        }
      }),
    );

    results.push(...batchResults);

    if (i + config.batchSize < items.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, config.delayBetweenBatches),
      );
    }
  }

  return results;
}

export function findClosestInt(arr: number[], target: number): number {
  return arr.reduce((prev, curr) =>
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev,
  );
}

export function formatAnalysisResults(
  results: TokenAnalysisResult[],
  fearAndGreedIndex: string,
): Omit<FormattedAnalysisResult, 'id'> {
  const formattedResults: any[] = [];

  results.forEach((res) => {
    formattedResults.push({
      token: res.token.name,
      price: `$${res.token.price}`,
      buyingConfidence: `${(res.buyingConfidence.score * 100).toFixed(2)}%`,
    });
  });

  return {
    analysis: JSON.stringify(
      {
        formattedResults,
        analysis: results,
      },
      null,
      2,
    ),
    created_at: new Date(),
    fear_and_greed_index: fearAndGreedIndex,
  };
}

export function formatWeekAnalysisResults(
  results: TokenWeekAnalysisResult[],
  fearAndGreedIndex: string,
): Omit<FormattedAnalysisResult, 'id'> {
  const formattedResults: any[] = [];

  results.forEach((res) => {
    formattedResults.push({
      token: res.token.name,
      price: `$${res.token.price}`,
      buyingConfidence: `${(res.confidence * 100).toFixed(2)}%`,
    });
  });

  return {
    analysis: JSON.stringify(
      {
        formattedResults,
        results,
      },
      null,
      2,
    ),
    created_at: new Date(),
    fear_and_greed_index: fearAndGreedIndex,
  };
}

export function formatDateToDDMMYYYY(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();

  return `${day}${month}${year}`;
}
