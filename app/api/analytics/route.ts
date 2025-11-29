import { NextRequest, NextResponse } from 'next/server';
import { trackEvent, getAnalyticsSummary, AnalyticsEvent } from '@/lib/mongodb';

// POST - Track a new analytics event
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const { eventType, canteenId, canteenName, userType, metadata } = body;

        if (!eventType) {
            return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
        }

        const validEventTypes: AnalyticsEvent['eventType'][] = [
            'page_view',
            'canteen_status_update',
            'owner_login'
        ];

        if (!validEventTypes.includes(eventType)) {
            return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
        }

        // Get user agent from request
        const userAgent = request.headers.get('user-agent') || undefined;

        await trackEvent({
            eventType,
            canteenId,
            canteenName,
            userType,
            metadata,
            userAgent,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Analytics tracking error:', error);
        return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
    }
}

// GET - Get analytics summary (could be protected with admin auth in production)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const startDateStr = searchParams.get('startDate');
        const endDateStr = searchParams.get('endDate');

        const startDate = startDateStr ? new Date(startDateStr) : undefined;
        const endDate = endDateStr ? new Date(`${endDateStr}T23:59:59.999Z`) : undefined;

        const summary = await getAnalyticsSummary(startDate, endDate);

        return NextResponse.json(summary);
    } catch (error) {
        console.error('Analytics fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
}
