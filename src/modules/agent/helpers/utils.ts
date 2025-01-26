import { TokenAnalysisResult } from '../entities/analysis-result.type';

export function logResults(analysisResults: TokenAnalysisResult[]) {
  console.log('\n[Analysis Results]');
  console.log('='.repeat(50));

  analysisResults.forEach((res) => {
    console.log(
      `\nToken: ${res.token.metadata.name} ($${res.token.market.price_usd})`,
    );
    console.log(
      `Buying Confidence: ${(res.buyingConfidence * 100).toFixed(2)}%`,
    );
    console.log('-'.repeat(50));
  });
}
