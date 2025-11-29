import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, verifyAdminPin, Canteen, checkRateLimit, recordLoginAttempt } from '@/lib/mongodb';

// PATCH - Update canteen PIN (admin only)
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { adminPin, canteenId, newPin } = body;

        // Get identifier (Device ID or IP)
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        const deviceId = request.headers.get('x-device-id');
        const identifier = deviceId || ip;

        const rateLimitKey = `admin_canteen_pin_change:${identifier}`;

        // Check rate limit
        const { allowed, remainingTime } = await checkRateLimit(rateLimitKey);
        if (!allowed) {
            const minutes = Math.ceil((remainingTime || 0) / 60000);
            return NextResponse.json(
                { error: `Too many failed attempts. Try again in ${minutes} minutes.` },
                { status: 429 }
            );
        }

        if (!adminPin || !canteenId || !newPin) {
            return NextResponse.json(
                { error: 'Admin PIN, canteen ID, and new PIN are required' },
                { status: 400 }
            );
        }

        // Verify admin PIN
        const isAdmin = await verifyAdminPin(adminPin);

        // Record attempt
        await recordLoginAttempt(rateLimitKey, isAdmin);

        if (!isAdmin) {
            return NextResponse.json({ error: 'Invalid admin PIN' }, { status: 401 });
        }

        // Validate new PIN format (4 digits)
        if (!/^\d{4}$/.test(newPin)) {
            return NextResponse.json(
                { error: 'PIN must be exactly 4 digits' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();
        const collection = db.collection<Canteen>('canteens');

        const result = await collection.findOneAndUpdate(
            { id: canteenId },
            { $set: { pin: newPin } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return NextResponse.json({ error: 'Canteen not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Canteen PIN updated successfully' });
    } catch (error) {
        console.error('Failed to update canteen PIN:', error);
        return NextResponse.json({ error: 'Failed to update canteen PIN' }, { status: 500 });
    }
}

// GET - Get all canteens with their PINs (admin only)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { adminPin } = body;

        // Get identifier (Device ID or IP)
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        const deviceId = request.headers.get('x-device-id');
        const identifier = deviceId || ip;

        const rateLimitKey = `admin_get_canteens:${identifier}`;

        // Check rate limit
        const { allowed, remainingTime } = await checkRateLimit(rateLimitKey);
        if (!allowed) {
            const minutes = Math.ceil((remainingTime || 0) / 60000);
            return NextResponse.json(
                { error: `Too many failed attempts. Try again in ${minutes} minutes.` },
                { status: 429 }
            );
        }

        if (!adminPin) {
            return NextResponse.json({ error: 'Admin PIN is required' }, { status: 400 });
        }

        // Verify admin PIN
        const isAdmin = await verifyAdminPin(adminPin);

        // Record attempt
        await recordLoginAttempt(rateLimitKey, isAdmin);

        if (!isAdmin) {
            return NextResponse.json({ error: 'Invalid admin PIN' }, { status: 401 });
        }

        const { db } = await connectToDatabase();
        const collection = db.collection<Canteen>('canteens');

        const canteens = await collection.find({}).toArray();

        // Return canteens with their PINs for admin
        return NextResponse.json(canteens.map(c => ({
            id: c.id,
            name: c.name,
            pin: c.pin
        })));
    } catch (error) {
        console.error('Failed to fetch canteens:', error);
        return NextResponse.json({ error: 'Failed to fetch canteens' }, { status: 500 });
    }
}
