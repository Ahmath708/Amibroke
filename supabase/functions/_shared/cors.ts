export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info',
};

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  const headers = { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders };
  return new Response(JSON.stringify(body), { status, headers });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return null;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

export function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

export function errorResponse(error: Error | any, logPrefix = ''): Response {
  console.error(`${logPrefix} Error:`, error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  const stage = error.stage || 'exception';
  const status = error.status || 500;
  const rawResponse = error.rawResponse?.slice(0, 500);
  return jsonResponse({ error: `Analysis failed: ${message}`, stage, rawResponse, detail: error.detail || null }, status);
}
