import { DailyOHLCV } from 'src/modules/tokens/entities/coin-codex.type';

export const MINIMUM_METRICS_DAYS = 10;
export const ELEVEN_DAYS_MS = 11 * 24 * 60 * 60 * 1000;

export function getTextObservation(metrics: DailyOHLCV[]): string {
  if (metrics.length < 10) return '';
  if (metrics.length > 10) metrics = metrics.slice(-10);

  const closes = metrics.map((d) => d.Close);
  const highs = metrics.map((d) => d.High);
  const lows = metrics.map((d) => d.Low);
  const volumes = metrics.map((d) => d.Volume);

  const firstClose = closes[0];
  const lastClose = closes[closes.length - 1];
  const netChange = ((lastClose - firstClose) / firstClose) * 100;

  const upDays = metrics.filter((d) => d.Close > d.Open).length;
  const downDays = metrics.filter((d) => d.Close < d.Open).length;
  const flatDays = metrics.length - upDays - downDays;

  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const rangePct = minLow > 0 ? ((maxHigh - minLow) / minLow) * 100 : 0;

  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const volStd = Math.sqrt(
    volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) /
      volumes.length,
  );
  const latestVolume = volumes[volumes.length - 1];
  const volZScore = volStd > 0 ? (latestVolume - avgVolume) / volStd : 0;

  const gapUps = metrics.filter(
    (d, i) => i > 0 && d.Open > metrics[i - 1].Close,
  ).length;
  const gapDowns = metrics.filter(
    (d, i) => i > 0 && d.Open < metrics[i - 1].Close,
  ).length;

  let totalBody = 0;
  let largeBodyCount = 0;
  let opensNearLow = 0;
  let opensNearHigh = 0;

  for (let i = 0; i < metrics.length; i++) {
    const { Open, Close, High, Low } = metrics[i];
    const body = Math.abs(Close - Open);
    const range = High - Low;

    totalBody += body;
    if (range > 0 && body / range > 0.5) largeBodyCount++;

    if (range > 0) {
      if ((Open - Low) / range < 0.2) opensNearLow++;
      if ((High - Open) / range < 0.2) opensNearHigh++;
    }
  }

  const avgBody = totalBody / metrics.length;
  const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
  const avgBodyPct = avgClose > 0 ? (avgBody / avgClose) * 100 : 0;
  const largeBodyPct = (largeBodyCount / metrics.length) * 100;
  const openBias =
    opensNearHigh > opensNearLow
      ? 'bullish'
      : opensNearLow > opensNearHigh
        ? 'bearish'
        : 'neutral';

  const reversalCandles = metrics.filter((d) => {
    const body = Math.abs(d.Close - d.Open);
    const range = d.High - d.Low;
    return range > 0 && body / range < 0.3;
  }).length;

  let largestDropIdx = -1;
  let largestDropPct = 0;
  for (let i = 1; i < metrics.length; i++) {
    const drop = ((closes[i - 1] - closes[i]) / closes[i - 1]) * 100;
    if (drop > largestDropPct) {
      largestDropPct = drop;
      largestDropIdx = i;
    }
  }

  const recoveryStartIdx = largestDropIdx + 1;
  const recovery =
    recoveryStartIdx < metrics.length
      ? ((closes[closes.length - 1] - closes[recoveryStartIdx]) /
          closes[recoveryStartIdx]) *
        100
      : 0;

  const early = closes[0];
  const mid = closes[Math.floor(metrics.length / 2)];
  const end = closes[closes.length - 1];

  const pattern =
    largestDropPct > 10 && recovery > 5
      ? 'capitulation followed by recovery'
      : early > mid && mid > end
        ? 'early strength fading into weakness'
        : early < mid && mid < end
          ? 'early weakness followed by strength'
          : 'no distinct pattern';

  const trendLabel =
    end > early * 1.1
      ? 'strong uptrend'
      : end > early * 1.03
        ? 'moderate uptrend'
        : end < early * 0.9
          ? 'strong downtrend'
          : end < early * 0.97
            ? 'moderate downtrend'
            : 'sideways trend';

  const volumeLabel = volumes.every((v) => v === 0)
    ? 'no trading activity'
    : latestVolume > avgVolume + volStd * 1.5
      ? 'volume surge on latest candle'
      : latestVolume < avgVolume - volStd * 1.5
        ? 'volume drop-off'
        : 'volume consistent';

  const volatilityLabel =
    rangePct > 20
      ? 'high volatility'
      : rangePct > 10
        ? 'moderate volatility'
        : 'low volatility';

  const narrative = [
    `Price changed ${netChange.toFixed(2)}% over ${metrics.length} days with ${upDays} up days, ${downDays} down days, and ${flatDays} flat days.`,
    `The market showed ${volatilityLabel} with a range of ~${rangePct.toFixed(1)}%.`,
    `Observed ${volumeLabel}.`,
    `Gap ups: ${gapUps}, Gap downs: ${gapDowns}.`,
    `Reversal-type candles: ${reversalCandles}.`,
    `Open bias: ${openBias} sentiment.`,
    `Pattern detected: ${pattern}.`,
    `Overall trend classified as ${trendLabel}.`,
  ];

  const signalBlock = [
    `price=(${netChange.toFixed(2)}%)`,
    `range=(${rangePct.toFixed(1)}%)`,
    `drop=${largestDropPct.toFixed(2)}%`,
    `recovery=${recovery.toFixed(2)}%`,
    `vol_std=${volStd.toFixed(2)}`,
    `vol_last_z=${volZScore.toFixed(2)}`,
    `gap_up=${gapUps}`,
    `gap_down=${gapDowns}`,
    `reversals=${reversalCandles}`,
    `body_avg_pct=${avgBodyPct.toFixed(2)}%`,
    `large_bodies=${largeBodyPct.toFixed(1)}%`,
    `open_bias=${openBias}`,
  ];

  return `${narrative.join(' ')} [SIGNALS] ${signalBlock.join(' ')}`;
}
