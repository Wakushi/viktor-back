import {
  DayAnalysisRecord,
  TokenWeekAnalysisResult,
} from 'src/modules/analysis/entities/analysis.type';

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
