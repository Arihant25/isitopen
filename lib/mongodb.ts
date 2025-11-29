import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'isitopen';

// Extend the global type to include our MongoDB cache
declare global {
    // eslint-disable-next-line no-var
    var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!global._mongoClientPromise) {
        const client = new MongoClient(MONGODB_URI, {
            maxPoolSize: 10,
            minPoolSize: 1,
        });
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    // In production mode, it's best to not use a global variable.
    const client = new MongoClient(MONGODB_URI, {
        maxPoolSize: 10,
        minPoolSize: 1,
    });
    clientPromise = client.connect();
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
    const client = await clientPromise;
    const db = client.db(MONGODB_DB);
    return { client, db };
}

export interface Canteen {
    id: string;
    name: string;
    icon: string;
    status: 'open' | 'closed';
    lastUpdated: Date;
    pin: string;
    note?: string;
    noteUpdatedAt?: Date;
}

// Check if a note has expired (12 hours)
export function isNoteExpired(noteUpdatedAt?: Date): boolean {
    if (!noteUpdatedAt) return true;
    const expiryTime = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
    return Date.now() - new Date(noteUpdatedAt).getTime() > expiryTime;
}

export interface AnalyticsEvent {
    eventType: 'page_view' | 'canteen_status_update' | 'owner_login';
    timestamp: Date;
    canteenId?: string;
    canteenName?: string;
    userType?: 'student' | 'owner';
    metadata?: Record<string, unknown>;
    userAgent?: string;
}

// Track an analytics event
export async function trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>): Promise<void> {
    try {
        const { db } = await connectToDatabase();
        const collection = db.collection<AnalyticsEvent>('analytics');

        await collection.insertOne({
            ...event,
            timestamp: new Date(),
        });
    } catch (error) {
        console.error('Failed to track analytics event:', error);
    }
}

// Get analytics summary - page views by day
export async function getAnalyticsSummary(startDate?: Date, endDate?: Date) {
    const { db } = await connectToDatabase();
    const collection = db.collection<AnalyticsEvent>('analytics');

    const dateFilter: Record<string, unknown> = { eventType: 'page_view' };
    if (startDate || endDate) {
        dateFilter.timestamp = {};
        if (startDate) (dateFilter.timestamp as Record<string, Date>).$gte = startDate;
        if (endDate) (dateFilter.timestamp as Record<string, Date>).$lte = endDate;
    }

    const [totalPageViews, pageViewsByDay] = await Promise.all([
        collection.countDocuments(dateFilter),
        collection.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray()
    ]);

    return {
        totalPageViews,
        pageViewsByDay: pageViewsByDay.map(item => ({
            date: item._id,
            count: item.count
        }))
    };
}

// Admin settings interface
export interface AdminSettings {
    _id?: string;
    settingKey: string;
    value: string;
}

// Get or create admin PIN
export async function getAdminPin(): Promise<string> {
    const { db } = await connectToDatabase();
    const collection = db.collection<AdminSettings>('settings');

    const adminSetting = await collection.findOne({ settingKey: 'adminPin' });

    if (adminSetting) {
        return adminSetting.value;
    }

    // Create default admin PIN if not exists
    const defaultPin = '1832';
    await collection.insertOne({ settingKey: 'adminPin', value: defaultPin });
    return defaultPin;
}

// Verify admin PIN
export async function verifyAdminPin(pin: string): Promise<boolean> {
    const adminPin = await getAdminPin();
    return pin === adminPin;
}

// Initial canteen data for seeding
export const INITIAL_CANTEENS: Omit<Canteen, 'lastUpdated'>[] = [
    { id: 'juice-canteen', name: 'Juice Canteen', icon: 'drink', status: 'closed', pin: '7297' },
    { id: 'vindhya-canteen', name: 'Vindhya Canteen', icon: 'coffee', status: 'closed', pin: '8139' },
    { id: 'basketball-canteen', name: 'Basketball Canteen', icon: 'noodles', status: 'closed', pin: '5303' },
    { id: 'vc-juice', name: 'VC (Juice)', icon: 'drink', status: 'closed', pin: '9635' },
    { id: 'tantra', name: 'Tantra', icon: 'rice', status: 'closed', pin: '8726' },
    { id: 'devids', name: "Devid's", icon: 'cake', status: 'closed', pin: '8612' },
    { id: 'chaat-canteen', name: 'Chaat Canteen', icon: 'snack', status: 'closed', pin: '2924' },
    { id: 'waffle-stall', name: 'Waffle Stall', icon: 'waffle', status: 'closed', pin: '2091' },
    { id: 'dammams-milk-canteen', name: "Dammam's Milk Canteen", icon: 'drink', status: 'closed', pin: '4455' },
    { id: 'vindhya-stationery', name: 'Vindhya Stationery Shop', icon: 'store', status: 'closed', pin: '3847' },
];
