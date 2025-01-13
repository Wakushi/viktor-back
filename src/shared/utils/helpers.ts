import { ethers } from 'ethers';
import { TokenMarketData } from '../services/token-data/entities/token.type';
import { Chain } from '../services/token-data/entities/chain.type';
import { WHITELISTED_CHAINS } from './constants/chains';

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

export function getChainId(name: string): number | null {
  const chain = WHITELISTED_CHAINS.find((c) => c.name === name);
  return chain ? chain.chainId : null;
}

export function extractTokenChains(token: TokenMarketData): Chain[] {
  if (!token?.metadata?.contract_addresses) return [];

  return Object.keys(token.metadata.contract_addresses).map((chain) => ({
    name: chain,
    chainId: getChainId(chain),
  }));
}

export function findSimilarChain(
  tokenA: TokenMarketData,
  tokenB: TokenMarketData,
): Chain | null {
  const tokenAChains = extractTokenChains(tokenA);
  const tokenBChains = extractTokenChains(tokenB);

  let similarChain: Chain | null = null;

  tokenAChains.forEach((tokenAChain) => {
    if (
      tokenBChains.some(
        (tokenBChain) => tokenBChain.chainId === tokenAChain.chainId,
      )
    ) {
      similarChain = tokenAChain;
    }
  });

  return similarChain;
}

export function isWethToken(token: TokenMarketData): boolean {
  return (
    token.symbol.toLowerCase() === 'eth' ||
    token.symbol.toLowerCase() === 'weth'
  );
}
