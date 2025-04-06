import { ethers } from 'ethers';

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
