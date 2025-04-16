export async function fetchWithRetry({
  url,
  options = {},
  retries = 10,
  backoff = 1000,
}: {
  url: string;
  options?: any;
  retries?: number;
  backoff?: number;
}): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const text = await response.text();

      try {
        return JSON.parse(text);
      } catch (parseError: any) {
        throw new Error(`Invalid JSON received: ${parseError.message}`);
      }
    } catch (error) {
      if (attempt < retries) {
        const delay = backoff * 2 ** attempt;
        console.warn(
          `Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`,
          error,
        );
        await new Promise((res) => setTimeout(res, delay));
      } else {
        console.error(`All ${retries + 1} attempts failed.`);
        throw error;
      }
    }
  }

  throw new Error('Unexpected error in fetchWithRetry');
}

export function getAllocationRatio(
  avgConfidence: number,
  fearAndGreed: number,
) {
  const MIN_RATIO = 0.3;
  const MAX_RATIO = 1.0;
  const allocationRatio = Math.max(
    MIN_RATIO,
    Math.min(MAX_RATIO, avgConfidence),
  );

  const normalizedSentiment = fearAndGreed / 100;
  const adjustedRatio = allocationRatio * (0.5 + normalizedSentiment / 2);
  return Math.min(1.0, Math.max(0.1, adjustedRatio));
}
