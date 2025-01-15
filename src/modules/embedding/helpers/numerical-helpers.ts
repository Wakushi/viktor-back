function normalizeInRange(value: number, min: number, max: number): number {
  if (min === max) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function normalizePercentage(percentage: number): number {
  const TYPICAL_RANGE = 20;
  return Math.tanh(percentage / TYPICAL_RANGE);
}

export { normalizeInRange, normalizePercentage };
