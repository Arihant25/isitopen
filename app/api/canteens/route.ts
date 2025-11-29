import { NextResponse } from 'next/server';
import { connectToDatabase, INITIAL_CANTEENS, Canteen, isNoteExpired } from '@/lib/mongodb';

// GET all canteens
export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const collection = db.collection<Canteen>('canteens');

        // Check if collection is empty and seed if needed
        const count = await collection.countDocuments();
        if (count === 0) {
            const canteensWithTimestamp = INITIAL_CANTEENS.map(c => ({
                ...c,
                lastUpdated: new Date()
            }));
            await collection.insertMany(canteensWithTimestamp);
        } else {
            // Check for any new canteens in the seed that aren't in the DB
            const existingCanteens = await collection.find({}, { projection: { id: 1 } }).toArray();
            const existingIds = new Set(existingCanteens.map(c => c.id));

            const newCanteens = INITIAL_CANTEENS.filter(c => !existingIds.has(c.id));

            if (newCanteens.length > 0) {
                const newCanteensWithTimestamp = newCanteens.map(c => ({
                    ...c,
                    lastUpdated: new Date()
                }));
                await collection.insertMany(newCanteensWithTimestamp);
            }
        }

        const canteens = await collection.find({}).toArray();

        // Sort by name for consistent ordering
        canteens.sort((a, b) => a.name.localeCompare(b.name));

        // Return canteens without exposing the PIN and filter out expired notes
        const canteensWithoutPin = canteens.map(({ pin, note, noteUpdatedAt, ...rest }) => {
            // Only include note if it hasn't expired
            if (note && noteUpdatedAt && !isNoteExpired(noteUpdatedAt)) {
                return { ...rest, note, noteUpdatedAt };
            }
            return rest;
        });

        return NextResponse.json(canteensWithoutPin);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to fetch canteens' }, { status: 500 });
    }
}
