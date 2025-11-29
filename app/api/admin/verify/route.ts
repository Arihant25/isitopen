import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPin, checkRateLimit, recordLoginAttempt } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pin } = body;

        // Get identifier (Device ID or IP)
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        const deviceId = request.headers.get('x-device-id');
        const identifier = deviceId || ip;

        const rateLimitKey = `admin_login:${identifier}`;

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
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
        }
    } catch (error) {
        console.error('Admin verification error:', error);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}
