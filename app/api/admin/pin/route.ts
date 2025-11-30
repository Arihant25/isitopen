import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, verifyAdminPin, AdminSettings, checkRateLimit, recordLoginAttempt } from '@/lib/mongodb';

// PATCH - Update admin PIN
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { currentPin, newPin } = body;

        // Get IP address for rate limiting
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            'unknown';

        const rateLimitKey = `admin_pin_change:${ip}`;

        // Check rate limit
        const { allowed, remainingTime } = await checkRateLimit(rateLimitKey);
        if (!allowed) {
            const minutes = Math.ceil((remainingTime || 0) / 60000);
            return NextResponse.json(
                { error: `Too many failed attempts. Try again in ${minutes} minutes.` },
                { status: 429 }
            );
        }

        if (!currentPin || !newPin) {
            return NextResponse.json(
                { error: 'Current PIN and new PIN are required' },
                { status: 400 }
            );
        }

        // Verify current admin PIN
        const isAdmin = await verifyAdminPin(currentPin);

        // Record attempt
        await recordLoginAttempt(rateLimitKey, isAdmin);

        if (!isAdmin) {
            return NextResponse.json({ error: 'Invalid current PIN' }, { status: 401 });
        }

        // Validate new PIN format (4 digits)
        if (!/^\d{4}$/.test(newPin)) {
            return NextResponse.json(
                { error: 'PIN must be exactly 4 digits' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();
        const collection = db.collection<AdminSettings>('settings');

        await collection.updateOne(
            { settingKey: 'adminPin' },
            { $set: { value: newPin } },
            { upsert: true }
        );

        return NextResponse.json({ success: true, message: 'Admin PIN updated successfully' });
    } catch (error) {
        console.error('Failed to update admin PIN:', error);
        return NextResponse.json({ error: 'Failed to update admin PIN' }, { status: 500 });
    }
}
