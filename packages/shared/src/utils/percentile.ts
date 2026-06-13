/**
 * Computes the p-th percentile of a sorted numeric array (nearest-rank method).
 * Array must be pre-sorted ascending.
 */
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (p <= 0) return sortedValues[0] ?? 0;
  if (p >= 100) return sortedValues[sortedValues.length - 1] ?? 0;
  const rank = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[rank] ?? 0;
}

export function p50(values: number[]): number {
  return percentile([...values].sort((a, b) => a - b), 50);
}

export function p85(values: number[]): number {
  return percentile([...values].sort((a, b) => a - b), 85);
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
