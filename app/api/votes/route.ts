import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export interface CommunityVote {
    canteenId: string;
    voteType: 'open' | 'closed';
    timestamp: Date;
    periodStart: Date; // Start of the 3-hour period
}

export interface VoteSummary {
    canteenId: string;
    openVotes: number;
    closedVotes: number;
    periodStart: Date;
}

// Get the start of the current 3-hour period
function getCurrentPeriodStart(): Date {
    const now = new Date();
    const hours = now.getUTCHours();
    const periodHour = Math.floor(hours / 3) * 3; // 0, 3, 6, 9, 12, 15, 18, 21
    const periodStart = new Date(now);
    periodStart.setUTCHours(periodHour, 0, 0, 0);
    return periodStart;
}

// GET - Get vote summary for all canteens or a specific canteen
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const canteenId = searchParams.get('canteenId');

        const { db } = await connectToDatabase();
        const collection = db.collection<CommunityVote>('communityVotes');

        const periodStart = getCurrentPeriodStart();

        // Build query for current period
        const query: Record<string, unknown> = {
            periodStart: { $gte: periodStart }
        };

        if (canteenId) {
            query.canteenId = canteenId;
        }

        // Aggregate votes by canteen
        const voteSummary = await collection.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$canteenId',
                    openVotes: {
                        $sum: { $cond: [{ $eq: ['$voteType', 'open'] }, 1, 0] }
                    },
                    closedVotes: {
                        $sum: { $cond: [{ $eq: ['$voteType', 'closed'] }, 1, 0] }
                    },
                    lastOpenVote: {
                        $max: { $cond: [{ $eq: ['$voteType', 'open'] }, '$timestamp', null] }
                    },
                    lastClosedVote: {
                        $max: { $cond: [{ $eq: ['$voteType', 'closed'] }, '$timestamp', null] }
                    }
                }
            }
        ]).toArray();

        // Transform to a map for easier frontend consumption
        const votesMap: Record<string, { openVotes: number; closedVotes: number; lastOpenVote?: string; lastClosedVote?: string }> = {};
        voteSummary.forEach(item => {
            votesMap[item._id] = {
                openVotes: item.openVotes,
                closedVotes: item.closedVotes,
                lastOpenVote: item.lastOpenVote ? new Date(item.lastOpenVote).toISOString() : undefined,
                lastClosedVote: item.lastClosedVote ? new Date(item.lastClosedVote).toISOString() : undefined
            };
        });

        return NextResponse.json({
            periodStart: periodStart.toISOString(),
            votes: votesMap
        });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 });
    }
}

// POST - Submit a vote
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { canteenId, voteType } = body;

        // Validate input
        if (!canteenId || typeof canteenId !== 'string') {
            return NextResponse.json({ error: 'canteenId is required' }, { status: 400 });
        }

        if (voteType !== 'open' && voteType !== 'closed') {
            return NextResponse.json({ error: 'voteType must be "open" or "closed"' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        // Delete votes older than 6 hours
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const votesCollection = db.collection<CommunityVote>('communityVotes');
        await votesCollection.deleteMany({ timestamp: { $lt: sixHoursAgo } });

        // Check if canteen exists
        const canteensCollection = db.collection('canteens');
        const canteenExists = await canteensCollection.findOne({ id: canteenId });

        if (!canteenExists) {
            return NextResponse.json({ error: 'Canteen not found' }, { status: 404 });
        }

        const periodStart = getCurrentPeriodStart();

        // Insert the vote
        await votesCollection.insertOne({
            canteenId,
            voteType,
            timestamp: new Date(),
            periodStart
        });

        // Return updated vote count for this canteen
        const voteSummary = await votesCollection.aggregate([
            {
                $match: {
                    canteenId,
                    periodStart: { $gte: periodStart }
                }
            },
            {
                $group: {
                    _id: '$canteenId',
                    openVotes: {
                        $sum: { $cond: [{ $eq: ['$voteType', 'open'] }, 1, 0] }
                    },
                    closedVotes: {
                        $sum: { $cond: [{ $eq: ['$voteType', 'closed'] }, 1, 0] }
                    },
                    lastOpenVote: {
                        $max: { $cond: [{ $eq: ['$voteType', 'open'] }, '$timestamp', null] }
                    },
                    lastClosedVote: {
                        $max: { $cond: [{ $eq: ['$voteType', 'closed'] }, '$timestamp', null] }
                    }
                }
            }
        ]).toArray();

        const summary = voteSummary[0] || { openVotes: 0, closedVotes: 0, lastOpenVote: null, lastClosedVote: null };

        return NextResponse.json({
            success: true,
            canteenId,
            openVotes: summary.openVotes,
            closedVotes: summary.closedVotes,
            lastOpenVote: summary.lastOpenVote ? new Date(summary.lastOpenVote).toISOString() : undefined,
            lastClosedVote: summary.lastClosedVote ? new Date(summary.lastClosedVote).toISOString() : undefined
        });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
    }
}
