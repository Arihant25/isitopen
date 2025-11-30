import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Canteen, checkRateLimit, recordLoginAttempt } from '@/lib/mongodb';

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

// PATCH - Toggle canteen status or update note
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { status, pin, note } = body;

        // Get IP address for rate limiting
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            'unknown';

        const rateLimitKey = `canteen_login:${id}:${ip}`;

        // Check rate limit
        const { allowed, remainingTime } = await checkRateLimit(rateLimitKey);
        if (!allowed) {
            const minutes = Math.ceil((remainingTime || 0) / 60000);
            return NextResponse.json(
                { error: `Too many failed attempts. Try again in ${minutes} minutes.` },
                { status: 429 }
            );
        }

        const { db } = await connectToDatabase();
        const collection = db.collection<Canteen>('canteens');

        // Get the canteen to verify its PIN
        const canteen = await collection.findOne({ id });
        if (!canteen) {
            return NextResponse.json({ error: 'Canteen not found' }, { status: 404 });
        }

        // Verify PIN against the canteen's own PIN from database
        const isValid = pin === canteen.pin;

        // Record attempt
        await recordLoginAttempt(rateLimitKey, isValid);

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
        }

        // Build update object
        const updateFields: Record<string, unknown> = {
            lastUpdated: new Date()
        };

        // Handle status update
        if (status !== undefined) {
            // Validate status value
            if (status !== 'open' && status !== 'closed') {
                return NextResponse.json({ error: 'Invalid status. Must be "open" or "closed"' }, { status: 400 });
            }
            updateFields.status = status;
        }

        // Handle note update (can be set to empty string to clear)
        if (note !== undefined) {
            // Validate note length (max 240 characters)
            if (typeof note === 'string' && note.length > 240) {
                return NextResponse.json({ error: 'Note must be 240 characters or less' }, { status: 400 });
            }
            updateFields.note = note;
            updateFields.noteUpdatedAt = new Date();
        }

        const result = await collection.findOneAndUpdate(
            { id },
            { $set: updateFields },
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
