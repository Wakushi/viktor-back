import {
  DayAnalysisRecord,
  TokenWeekAnalysisResult,
} from 'src/modules/analysis/entities/analysis.type';
import { Address, zeroAddress, encodePacked } from 'viem';

export function findClosestInt(arr: number[], target: number): number {
  return arr.reduce((prev, curr) =>
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev,
  );
}

export function formatWeekAnalysisResults(
  results: TokenWeekAnalysisResult[],
  fearAndGreedIndex: string,
): Omit<DayAnalysisRecord, 'id'> {
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

export function isValidAddress(address: Address | string | null): boolean {
  return address && address !== zeroAddress;
}

export function applySlippage(value: bigint, slippagePercent: number): bigint {
  const slippageBps = Math.floor(slippagePercent * 10_000);
  return value - (value * BigInt(slippageBps)) / 10_000n;
}

export function encodePath(tokens: Address[], fees: number[]): `0x${string}` {
  const encodedParts: `0x${string}`[] = [];

  for (let i = 0; i < fees.length; i++) {
    const segment = encodePacked(['address', 'uint24'], [tokens[i], fees[i]]);
    encodedParts.push(segment);
  }

  encodedParts.push(encodePacked(['address'], [tokens[tokens.length - 1]]));

  return `0x${encodedParts.map((p) => p.slice(2)).join('')}` as `0x${string}`;
}
