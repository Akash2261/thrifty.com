export function daysUntil(target: string | Date, now: Date = new Date()): number {
  const targetDate = typeof target === "string" ? new Date(target) : target;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((targetDate.getTime() - now.getTime()) / msPerDay);
}
