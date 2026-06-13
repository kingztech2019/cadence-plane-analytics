/** Returns hours between two ISO timestamp strings. */
export function hoursBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
}

/** Returns an ISO date string 'YYYY-MM-DD' for a given Date. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Generates an array of 'YYYY-MM-DD' strings from startDate to endDate inclusive. */
export function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(toIsoDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}
