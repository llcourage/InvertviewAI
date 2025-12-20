import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory usage tracking (in production, use a database)
const usageStore = new Map<string, { count: number; lastReset: number }>();

const USAGE_LIMIT = 1000; // requests per day
const RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

function getUsageKey(request: NextRequest): string {
  // In production, use authenticated user ID
  // For now, use IP address as a simple identifier
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
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

export async function GET(request: NextRequest) {
  const key = getUsageKey(request);
  resetIfNeeded(key);

  const usage = usageStore.get(key) || { count: 0, lastReset: Date.now() };
  const remaining = Math.max(0, USAGE_LIMIT - usage.count);

  return NextResponse.json({
    limit: USAGE_LIMIT,
    used: usage.count,
    remaining,
    resetAt: new Date(usage.lastReset + RESET_INTERVAL).toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const key = getUsageKey(request);
  resetIfNeeded(key);

  const usage = usageStore.get(key) || { count: 0, lastReset: Date.now() };

  if (usage.count >= USAGE_LIMIT) {
    return NextResponse.json(
      {
        error: 'Usage limit exceeded',
        limit: USAGE_LIMIT,
        resetAt: new Date(usage.lastReset + RESET_INTERVAL).toISOString(),
      },
      { status: 429 }
    );
  }

  usage.count++;
  usageStore.set(key, usage);

  return NextResponse.json({
    success: true,
    remaining: USAGE_LIMIT - usage.count,
  });
}


