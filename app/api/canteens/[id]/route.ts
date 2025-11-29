import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Canteen } from '@/lib/mongodb';

// GET single canteen
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { db } = await connectToDatabase();
        const collection = db.collection<Canteen>('canteens');

        const canteen = await collection.findOne({ id });

        if (!canteen) {
            return NextResponse.json({ error: 'Canteen not found' }, { status: 404 });
        }

        // Return canteen without exposing the PIN
        const { pin, ...canteenWithoutPin } = canteen;
        return NextResponse.json(canteenWithoutPin);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to fetch canteen' }, { status: 500 });
    }
}

// PATCH - Toggle canteen status
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { status, pin } = body;

        const { db } = await connectToDatabase();
        const collection = db.collection<Canteen>('canteens');

        // Get the canteen to verify its PIN
        const canteen = await collection.findOne({ id });
        if (!canteen) {
            return NextResponse.json({ error: 'Canteen not found' }, { status: 404 });
        }

        // Verify PIN against the canteen's own PIN from database
        if (pin !== canteen.pin) {
            return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
        }

        // Validate status value
        if (status !== 'open' && status !== 'closed') {
            return NextResponse.json({ error: 'Invalid status. Must be "open" or "closed"' }, { status: 400 });
        }

        const result = await collection.findOneAndUpdate(
            { id },
            {
                $set: {
                    status: status,
                    lastUpdated: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return NextResponse.json({ error: 'Canteen not found' }, { status: 404 });
        }

        // Return without exposing the PIN
        const { pin: _, ...resultWithoutPin } = result;
        return NextResponse.json(resultWithoutPin);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to update canteen' }, { status: 500 });
    }
}
