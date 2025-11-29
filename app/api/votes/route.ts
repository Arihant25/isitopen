import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export interface CommunityVote {
    canteenId: string;
    voteType: 'correct' | 'incorrect';
    timestamp: Date;
    periodStart: Date; // Start of the 12-hour period
}

export interface VoteSummary {
    canteenId: string;
    correctVotes: number;
    incorrectVotes: number;
    periodStart: Date;
}

// Get the start of the current 12-hour period
function getCurrentPeriodStart(): Date {
    const now = new Date();
    const hours = now.getUTCHours();
    const periodHour = hours >= 12 ? 12 : 0;
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
                    correctVotes: {
                        $sum: { $cond: [{ $eq: ['$voteType', 'correct'] }, 1, 0] }
                    },
                    incorrectVotes: {
                        $sum: { $cond: [{ $eq: ['$voteType', 'incorrect'] }, 1, 0] }
                    }
                }
            }
        ]).toArray();

        // Transform to a map for easier frontend consumption
        const votesMap: Record<string, { correctVotes: number; incorrectVotes: number }> = {};
        voteSummary.forEach(item => {
            votesMap[item._id] = {
                correctVotes: item.correctVotes,
                incorrectVotes: item.incorrectVotes
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

        if (voteType !== 'correct' && voteType !== 'incorrect') {
            return NextResponse.json({ error: 'voteType must be "correct" or "incorrect"' }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        const collection = db.collection<CommunityVote>('communityVotes');

        const periodStart = getCurrentPeriodStart();

        // Insert the vote
        await collection.insertOne({
            canteenId,
            voteType,
            timestamp: new Date(),
            periodStart
        });

        // Return updated vote count for this canteen
        const voteSummary = await collection.aggregate([
            {
                $match: {
                    canteenId,
                    periodStart: { $gte: periodStart }
                }
            },
            {
                $group: {
                    _id: '$canteenId',
                    correctVotes: {
                        $sum: { $cond: [{ $eq: ['$voteType', 'correct'] }, 1, 0] }
                    },
                    incorrectVotes: {
                        $sum: { $cond: [{ $eq: ['$voteType', 'incorrect'] }, 1, 0] }
                    }
                }
            }
        ]).toArray();

        const summary = voteSummary[0] || { correctVotes: 0, incorrectVotes: 0 };

        return NextResponse.json({
            success: true,
            canteenId,
            correctVotes: summary.correctVotes,
            incorrectVotes: summary.incorrectVotes
        });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
    }
}
