import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, verifyAdminPin, RateLimitEntry } from '@/lib/mongodb';

export interface RateLimitedIP {
    ip: string;
    page: string;
    canteenId?: string;
    canteenName?: string;
    attempts: number;
    lastAttempt: Date;
    lockoutUntil: Date | null;
    isCurrentlyLocked: boolean;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { adminPin } = body;

        if (!adminPin) {
            return NextResponse.json({ error: 'Admin PIN required' }, { status: 400 });
        }

        const isAdmin = await verifyAdminPin(adminPin);
        if (!isAdmin) {
            return NextResponse.json({ error: 'Invalid admin PIN' }, { status: 401 });
        }

        const { db } = await connectToDatabase();
        const rateLimitsCollection = db.collection<RateLimitEntry>('rate_limits');
        const canteensCollection = db.collection('canteens');

        // Get all rate limit entries that have lockoutUntil set
        const rateLimitEntries = await rateLimitsCollection.find({
            lockoutUntil: { $ne: null }
        }).toArray();

        const now = new Date();

        // Get all canteens for name lookup
        const canteens = await canteensCollection.find({}).toArray();
        const canteenMap = new Map(canteens.map(c => [c.id, c.name]));

        // Transform entries to a more readable format
        const rateLimitedIPs: RateLimitedIP[] = rateLimitEntries.map(entry => {
            // Parse the key format: action_type:resource_id:ip or action_type:ip
            if (!entry.key) {
                return {
                    ip: 'Unknown',
                    page: 'Unknown',
                    attempts: entry.attempts,
                    lastAttempt: new Date(entry.lastAttempt),
                    lockoutUntil: entry.lockoutUntil ? new Date(entry.lockoutUntil) : null,
                    isCurrentlyLocked: entry.lockoutUntil ? new Date(entry.lockoutUntil) > now : false
                };
            }

            const parts = entry.key.split(':');
            let page = 'Unknown';
            let ip = 'Unknown';
            let canteenId: string | undefined;
            let canteenName: string | undefined;

            if (parts.length >= 2 && parts[0] === 'admin_login') {
                page = 'Admin Login';
                ip = parts.slice(1).join(':'); // Handle IPv6 addresses
            } else if (parts.length >= 3 && parts[0] === 'canteen_login') {
                canteenId = parts[1];
                canteenName = canteenMap.get(canteenId) || canteenId;
                page = `${canteenName}`;
                ip = parts.slice(2).join(':'); // Handle IPv6 addresses
            }

            const lockoutUntil = entry.lockoutUntil ? new Date(entry.lockoutUntil) : null;
            const isCurrentlyLocked = lockoutUntil ? lockoutUntil > now : false;

            return {
                ip,
                page,
                canteenId,
                canteenName,
                attempts: entry.attempts,
                lastAttempt: new Date(entry.lastAttempt),
                lockoutUntil,
                isCurrentlyLocked
            };
        });

        // Sort by currently locked first, then by last attempt time
        rateLimitedIPs.sort((a, b) => {
            if (a.isCurrentlyLocked !== b.isCurrentlyLocked) {
                return a.isCurrentlyLocked ? -1 : 1;
            }
            return new Date(b.lastAttempt).getTime() - new Date(a.lastAttempt).getTime();
        });

        return NextResponse.json(rateLimitedIPs);
    } catch (error) {
        console.error('Error fetching rate limits:', error);
        return NextResponse.json({ error: 'Failed to fetch rate limits' }, { status: 500 });
    }
}
