export function formatConfidence(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return "0%";
  }
  // Decimal fraction like 0.6 -> 60%
  // Integer / percentage like 60 -> 60%
  const percentage = val <= 1 && val > 0 ? val * 100 : val;
  return `${Math.round(percentage)}%`;
}
