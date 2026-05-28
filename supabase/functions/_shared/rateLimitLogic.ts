export function deriveBucketKey(forwardedFor: string | null, endpoint: string): string {
  const ip = forwardedFor?.split(',')[0]?.trim() ?? 'unknown';
  return `${endpoint}:${ip}`;
}

export function isWithinLimit(count: number, max: number): boolean {
  return count <= max;
}

export function shouldBypass(enabledEnv: string | undefined): boolean {
  return enabledEnv === 'false';
}

export function resolveLimits(maxEnv: string | undefined, windowEnv: string | undefined): { max: number; windowSeconds: number } {
  const max = maxEnv ? parseInt(maxEnv, 10) : 30;
  const windowSeconds = windowEnv ? parseInt(windowEnv, 10) : 3600;
  return { max: Number.isFinite(max) ? max : 30, windowSeconds: Number.isFinite(windowSeconds) ? windowSeconds : 3600 };
}
