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
