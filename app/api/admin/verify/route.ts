import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPin, checkRateLimit, recordLoginAttempt } from '@/lib/mongodb';
import { recordAttempt, getClientIp, clearEnumerationForIp } from '@/lib/guardrails';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pin } = body;

        // Get identifier (Device ID or IP)
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        const deviceId = request.headers.get('x-device-id');
        const identifier = deviceId || ip;

        const rateLimitKey = `admin_login:${identifier}`;

        // Guardrails: detect velocity/pattern and escalate
        const gate = recordAttempt('/api/admin/verify', request, pin);
        if (gate.status === 'hard-block') {
            return NextResponse.json(
                { error: 'Too many rapid attempts. You are temporarily blocked. If this is a mistake, contact admin at aryanil.panja@research.iiit.ac.in.' },
                { status: 429 }
            );
        }

        // Check rate limit
        const { allowed, remainingTime } = await checkRateLimit(rateLimitKey);
        if (!allowed) {
            const minutes = Math.ceil((remainingTime || 0) / 60000);
            return NextResponse.json(
                { error: `Too many failed attempts. Try again in ${minutes} minutes.` },
                { status: 429 }
            );
        }

        if (!pin) {
            return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
        }

        const isValid = await verifyAdminPin(pin);

        // Record attempt
        await recordLoginAttempt(rateLimitKey, isValid);

        if (isValid) {
            // clear enumeration counters for IP on success
            clearEnumerationForIp(getClientIp(request));
            const res = NextResponse.json({ success: true });
            // If soft-warn previously detected in this request, signal client to slow down
            if (gate.status === 'soft-warn') {
                res.headers.set('x-slow-down', 'true');
            }
            return res;
        } else {
            const res = NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
            if (gate.status === 'soft-warn') {
                res.headers.set('x-slow-down', 'true');
            }
            return res;
        }
    } catch (error) {
        console.error('Admin verification error:', error);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}
