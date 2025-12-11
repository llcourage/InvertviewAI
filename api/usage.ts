import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple in-memory usage tracking (in production, use a database)
const usageStore = new Map<string, { count: number; lastReset: number }>();

const USAGE_LIMIT = 1000; // requests per day
const RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

function getUsageKey(req: VercelRequest): string {
  // In production, use authenticated user ID
  // For now, use IP address as a simple identifier
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  return Array.isArray(ip) ? ip[0] : ip;
}

function resetIfNeeded(key: string) {
  const usage = usageStore.get(key);
  if (!usage) {
    usageStore.set(key, { count: 0, lastReset: Date.now() });
    return;
  }

  const now = Date.now();
  if (now - usage.lastReset > RESET_INTERVAL) {
    usageStore.set(key, { count: 0, lastReset: now });
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'GET') {
    const key = getUsageKey(req);
    resetIfNeeded(key);

    const usage = usageStore.get(key) || { count: 0, lastReset: Date.now() };
    const remaining = Math.max(0, USAGE_LIMIT - usage.count);

    return res.json({
      limit: USAGE_LIMIT,
      used: usage.count,
      remaining,
      resetAt: new Date(usage.lastReset + RESET_INTERVAL).toISOString(),
    });
  }

  if (req.method === 'POST') {
    const key = getUsageKey(req);
    resetIfNeeded(key);

    const usage = usageStore.get(key) || { count: 0, lastReset: Date.now() };

    if (usage.count >= USAGE_LIMIT) {
      return res.status(429).json({
        error: 'Usage limit exceeded',
        limit: USAGE_LIMIT,
        resetAt: new Date(usage.lastReset + RESET_INTERVAL).toISOString(),
      });
    }

    usage.count++;
    usageStore.set(key, usage);

    return res.json({
      success: true,
      remaining: USAGE_LIMIT - usage.count,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


