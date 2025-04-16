export async function fetchWithTimeout({
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
      console.error(`Invalid JSON received: ${parseError.message}`);
      console.error(`Error position: ${parseError.position}`);
      console.error(
        `JSON snippet near error: ${text.substring(Math.max(0, parseError.position - 100), parseError.position + 100)}`,
      );
      throw parseError;
    }
  } finally {
    clearTimeout(id);
  }
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
