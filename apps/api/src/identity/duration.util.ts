/** Parses a short duration string ("15m", "7d", "30s", "1h") to milliseconds. */
export function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 } as const;
  return value * unitMs[match[2] as keyof typeof unitMs];
}
