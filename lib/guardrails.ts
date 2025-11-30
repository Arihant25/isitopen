// Simple in-memory guardrails. Replace with Redis for multi-instance.

export type Attempt = { ts: number; pin?: string };

const WINDOW_MS = 60_000; // 1 minute window
const HARD_BLOCK_MS = 60 * 60_000; // 1 hour
const SOFT_LIMIT = 5; // warn threshold per window
const HARD_LIMIT = 10; // block threshold per window
const ENUMERATION_MINUTES = 3; // sustained window for escalation

const attemptsByKey = new Map<string, Attempt[]>();
const hardBlockUntil = new Map<string, number>();
const sustainedByIp = new Map<string, { startTs: number; lastTs: number; count: number }>();

export function getClientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  return realIp || 'unknown';
}

function key(ip: string, deviceId: string | null, endpoint: string) {
  return `${endpoint}|ip:${ip}|dev:${deviceId ?? 'none'}`;
}

export function recordAttempt(endpoint: string, req: Request, pin?: string): { status: 'ok' | 'soft-warn' | 'hard-block'; remainingMs: number } {
  const ip = getClientIp(req);
  const deviceId = req.headers.get('x-device-id');
  const k = key(ip, deviceId, endpoint);
  const now = Date.now();

  const hb = hardBlockUntil.get(k);
  if (hb && now < hb) {
    return { status: 'hard-block', remainingMs: hb - now };
  }

  const pruned = (attemptsByKey.get(k) ?? []).filter(a => now - a.ts <= WINDOW_MS);
  pruned.push({ ts: now, pin });
  attemptsByKey.set(k, pruned);

  const velocity = pruned.length;

  // Detect simple sequential pattern in last 3 attempts
  const recentPins = pruned.map(a => a.pin).filter(Boolean) as string[];
  let sequential = false;
  if (recentPins.length >= 3) {
    const nums = recentPins.slice(-3).map(p => parseInt(p, 10));
    if (nums.every(n => !Number.isNaN(n))) {
      sequential = nums[1] === nums[0] + 1 && nums[2] === nums[1] + 1;
    }
  }

  // Sustained enumeration across device IDs on same IP
  const sustain = sustainedByIp.get(ip) ?? { startTs: now, lastTs: now, count: 0 };
  sustain.lastTs = now;
  sustain.count += 1;
  sustainedByIp.set(ip, sustain);
  const sustainedForMs = sustain.lastTs - sustain.startTs;
  const sustainedEnumeration = sustainedForMs >= ENUMERATION_MINUTES * 60_000 && sustain.count >= SOFT_LIMIT * ENUMERATION_MINUTES;

  if (velocity >= HARD_LIMIT || sequential || sustainedEnumeration) {
    hardBlockUntil.set(k, now + HARD_BLOCK_MS);
    return { status: 'hard-block', remainingMs: HARD_BLOCK_MS };
  }

  if (velocity >= SOFT_LIMIT) {
    return { status: 'soft-warn', remainingMs: 0 };
  }

  return { status: 'ok', remainingMs: 0 };
}

export function clearEnumerationForIp(ip: string) {
  for (const k of attemptsByKey.keys()) {
    if (k.includes(`ip:${ip}|`)) attemptsByKey.delete(k);
  }
}
