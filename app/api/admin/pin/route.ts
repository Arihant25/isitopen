import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, verifyAdminPin, AdminSettings } from '@/lib/mongodb';

// PATCH - Update admin PIN
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { currentPin, newPin } = body;

        if (!currentPin || !newPin) {
            return NextResponse.json(
                { error: 'Current PIN and new PIN are required' },
                { status: 400 }
            );
        }

        // Verify current admin PIN
        const isAdmin = await verifyAdminPin(currentPin);
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
