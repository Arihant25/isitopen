type EventType = 'page_view' | 'canteen_status_update' | 'owner_login';

interface TrackEventParams {
    eventType: EventType;
    canteenId?: string;
    canteenName?: string;
    userType?: 'student' | 'owner';
    metadata?: Record<string, unknown>;
}

export async function trackAnalytics(params: TrackEventParams): Promise<void> {
    try {
        await fetch('/api/analytics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });
    } catch (error) {
        // Silently fail - analytics should not break the app
        console.error('Failed to track analytics:', error);
    }
}

// Convenience functions for common events
export const Analytics = {
    pageView: (userType?: 'student' | 'owner') =>
        trackAnalytics({ eventType: 'page_view', userType }),

    canteenStatusUpdate: (canteenId: string, canteenName: string, newStatus: 'open' | 'closed') =>
        trackAnalytics({
            eventType: 'canteen_status_update',
            canteenId,
            canteenName,
            userType: 'owner',
            metadata: { newStatus }
        }),

    ownerLogin: (canteenId: string, canteenName: string) =>
        trackAnalytics({
            eventType: 'owner_login',
            canteenId,
            canteenName,
            userType: 'owner'
        }),
};
