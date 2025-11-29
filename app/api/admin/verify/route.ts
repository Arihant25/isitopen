import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPin } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pin } = body;

        if (!pin) {
            return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
        }

        const isValid = await verifyAdminPin(pin);

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
