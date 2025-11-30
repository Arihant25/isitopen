'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft,
    Shield,
    Eye,
    EyeOff,
    TrendingUp,
    BarChart3,
    RefreshCw,
    Calendar,
    Key,
    Lock,
    Check,
    X,
    AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AnalyticsSummary {
    totalPageViews: number;
    pageViewsByDay: { date: string; count: number }[];
}

interface CanteenPin {
    id: string;
    name: string;
    pin: string;
}

interface RateLimitedIP {
    ip: string;
    page: string;
    canteenId?: string;
    canteenName?: string;
    attempts: number;
    lastAttempt: string;
    lockoutUntil: string | null;
    isCurrentlyLocked: boolean;
}

const LOCKOUT_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_ATTEMPTS = 3;
const ATTEMPT_RESET_DURATION = 60 * 60 * 1000; // Reset failed attempts after 1 hour of no failures

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [adminPin, setAdminPin] = useState(''); // Store admin PIN for API calls
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
    const [remainingTime, setRemainingTime] = useState<string>('');
    const [lastFailedAttempt, setLastFailedAttempt] = useState<number | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // PIN Management State
    const [canteens, setCanteens] = useState<CanteenPin[]>([]);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [selectedCanteen, setSelectedCanteen] = useState<CanteenPin | null>(null);
    const [newCanteenPin, setNewCanteenPin] = useState('');
    const [showCanteenPins, setShowCanteenPins] = useState<Record<string, boolean>>({});
    const [pinUpdateStatus, setPinUpdateStatus] = useState<{ id: string; success: boolean; message: string } | null>(null);

    // Admin PIN Change State
    const [showAdminPinChange, setShowAdminPinChange] = useState(false);
    const [newAdminPin, setNewAdminPin] = useState('');
    const [confirmAdminPin, setConfirmAdminPin] = useState('');
    const [adminPinError, setAdminPinError] = useState('');
    const [adminPinSuccess, setAdminPinSuccess] = useState(false);

    // Rate Limited IPs State
    const [rateLimitedIPs, setRateLimitedIPs] = useState<RateLimitedIP[]>([]);

    // Load lockout state from localStorage on mount
    useEffect(() => {
        const storedLockout = localStorage.getItem('adminLockoutUntil');
        const storedAttempts = localStorage.getItem('adminFailedAttempts');
        const storedLastFailed = localStorage.getItem('adminLastFailedAttempt');

        if (storedLockout) {
            const lockoutTime = parseInt(storedLockout, 10);
            if (lockoutTime > Date.now()) {
                setLockoutUntil(lockoutTime);
            } else {
                localStorage.removeItem('adminLockoutUntil');
                localStorage.removeItem('adminFailedAttempts');
                localStorage.removeItem('adminLastFailedAttempt');
            }
        }

        if (storedAttempts && storedLastFailed) {
            const lastFailedTime = parseInt(storedLastFailed, 10);
            // Reset failed attempts if the last failure was more than ATTEMPT_RESET_DURATION ago
            if (Date.now() - lastFailedTime > ATTEMPT_RESET_DURATION) {
                localStorage.removeItem('adminFailedAttempts');
                localStorage.removeItem('adminLastFailedAttempt');
            } else {
                setFailedAttempts(parseInt(storedAttempts, 10));
                setLastFailedAttempt(lastFailedTime);
            }
        }
    }, []);

    // Countdown timer for lockout
    useEffect(() => {
        if (!lockoutUntil) {
            setRemainingTime('');
            return;
        }

        const updateRemainingTime = () => {
            const now = Date.now();
            if (now >= lockoutUntil) {
                setLockoutUntil(null);
                setFailedAttempts(0);
                localStorage.removeItem('adminLockoutUntil');
                localStorage.removeItem('adminFailedAttempts');
                setRemainingTime('');
                return;
            }

            const diff = lockoutUntil - now;
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setRemainingTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        };

        updateRemainingTime();
        const interval = setInterval(updateRemainingTime, 1000);
        return () => clearInterval(interval);
    }, [lockoutUntil]);

    const verifyPin = async () => {
        // Check if currently locked out
        if (lockoutUntil && Date.now() < lockoutUntil) {
            setError(`Too many failed attempts. Please try again in ${remainingTime}.`);
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pin: pinInput }),
            });

            const slowDown = response.headers.get('x-slow-down') === 'true';

            if (response.ok) {
                setIsAuthenticated(true);
                setAdminPin(pinInput); // Store the admin PIN for future API calls
                // Clear failed attempts on successful login
                setFailedAttempts(0);
                setLastFailedAttempt(null);
                localStorage.removeItem('adminFailedAttempts');
                localStorage.removeItem('adminLockoutUntil');
                localStorage.removeItem('adminLastFailedAttempt');
                if (slowDown) {
                    setError('Too many attempts. Please slow down.');
                }
            } else {
                // Try to parse error from server
                let serverError = '';
                try {
                    const data = await response.json();
                    serverError = data.error;
                } catch (e) { }

                if (response.status === 429) {
                    setError(serverError || 'Too many failed attempts. Please try again later.');
                    // Update local state to reflect lockout
                    const lockoutTime = Date.now() + LOCKOUT_DURATION;
                    setLockoutUntil(lockoutTime);
                    localStorage.setItem('adminLockoutUntil', lockoutTime.toString());
                    setPinInput('');
                    return;
                }

                if (slowDown) {
                    setError('Too many attempts. Please slow down.');
                }

                // Check if last failed attempt was more than ATTEMPT_RESET_DURATION ago, reset counter if so
                const now = Date.now();
                let currentAttempts = failedAttempts;
                if (lastFailedAttempt && now - lastFailedAttempt > ATTEMPT_RESET_DURATION) {
                    currentAttempts = 0;
                }

                const newAttempts = currentAttempts + 1;
                setFailedAttempts(newAttempts);
                setLastFailedAttempt(now);
                localStorage.setItem('adminFailedAttempts', newAttempts.toString());
                localStorage.setItem('adminLastFailedAttempt', now.toString());

                if (newAttempts >= MAX_ATTEMPTS) {
                    const lockoutTime = Date.now() + LOCKOUT_DURATION;
                    setLockoutUntil(lockoutTime);
                    localStorage.setItem('adminLockoutUntil', lockoutTime.toString());
                    setError('Too many failed attempts. You are locked out for 1 hour.');
                } else {
                    const attemptsLeft = MAX_ATTEMPTS - newAttempts;
                    setError(serverError || `Invalid PIN. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`);
                }
                setPinInput('');
            }
        } catch {
            setError('Failed to verify PIN.');
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalytics = useCallback(async () => {
        setRefreshing(true);
        try {
            const params = new URLSearchParams();
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);
            const response = await fetch(`/api/analytics?${params.toString()}`);
            if (response.ok) {
                const data = await response.json();
                setAnalytics(data);
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setRefreshing(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchAnalytics();
        }
    }, [isAuthenticated, fetchAnalytics]);

    useEffect(() => {
        if (isAuthenticated) {
            const interval = setInterval(fetchAnalytics, 30000);
            return () => clearInterval(interval);
        }
    }, [isAuthenticated, fetchAnalytics]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Fetch canteens with PINs
    const fetchCanteens = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/canteen-pin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ adminPin }),
            });
            if (response.ok) {
                const data = await response.json();
                setCanteens(data);
            }
        } catch (error) {
            console.error('Failed to fetch canteens:', error);
        }
    }, [adminPin]);

    // Fetch rate-limited IPs
    const fetchRateLimitedIPs = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/rate-limits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ adminPin }),
            });
            if (response.ok) {
                const data = await response.json();
                setRateLimitedIPs(data);
            }
        } catch (error) {
            console.error('Failed to fetch rate-limited IPs:', error);
        }
    }, [adminPin]);

    useEffect(() => {
        if (isAuthenticated && adminPin) {
            fetchCanteens();
            fetchRateLimitedIPs();
        }
    }, [isAuthenticated, adminPin, fetchCanteens, fetchRateLimitedIPs]);

    // Update canteen PIN
    const updateCanteenPin = async () => {
        if (!selectedCanteen) return;
        if (!/^\d{4}$/.test(newCanteenPin)) {
            setPinUpdateStatus({ id: selectedCanteen.id, success: false, message: 'PIN must be 4 digits' });
            return;
        }

        try {
            const response = await fetch('/api/admin/canteen-pin', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ adminPin, canteenId: selectedCanteen.id, newPin: newCanteenPin }),
            });

            if (response.ok) {
                setPinUpdateStatus({ id: selectedCanteen.id, success: true, message: 'PIN updated!' });
                setCanteens(prev => prev.map(c => c.id === selectedCanteen.id ? { ...c, pin: newCanteenPin } : c));
                setTimeout(() => {
                    setPinUpdateStatus(null);
                    setShowEditDialog(false);
                    setSelectedCanteen(null);
                    setNewCanteenPin('');
                }, 1500);
            } else {
                const data = await response.json();
                setPinUpdateStatus({ id: selectedCanteen.id, success: false, message: data.error || 'Failed to update' });
            }
        } catch {
            setPinUpdateStatus({ id: selectedCanteen.id, success: false, message: 'Network error' });
        }
    };

    // Update admin PIN
    const updateAdminPin = async () => {
        setAdminPinError('');

        if (!/^\d{4}$/.test(newAdminPin)) {
            setAdminPinError('New PIN must be exactly 4 digits');
            return;
        }

        if (newAdminPin !== confirmAdminPin) {
            setAdminPinError('PINs do not match');
            return;
        }

        try {
            const response = await fetch('/api/admin/pin', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ currentPin: adminPin, newPin: newAdminPin }),
            });

            if (response.ok) {
                setAdminPinSuccess(true);
                setAdminPin(newAdminPin);
                setNewAdminPin('');
                setConfirmAdminPin('');
                setShowAdminPinChange(false);
                setTimeout(() => setAdminPinSuccess(false), 3000);
            } else {
                const data = await response.json();
                setAdminPinError(data.error || 'Failed to update admin PIN');
            }
        } catch {
            setAdminPinError('Network error');
        }
    };

    const toggleShowPin = (canteenId: string) => {
        setShowCanteenPins(prev => ({ ...prev, [canteenId]: !prev[canteenId] }));
    };

    // PIN Entry Screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
                <div className="bg-slate-800 rounded-3xl p-8 w-full max-w-md border border-slate-700 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="bg-blue-500/20 p-4 rounded-full w-fit mx-auto mb-4">
                            <Shield className="w-12 h-12 text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">Admin Access</h1>
                        <p className="text-slate-400">Enter your admin PIN to continue</p>
                    </div>

                    <div className="space-y-6">
                        {/* Lockout Warning */}
                        {lockoutUntil && Date.now() < lockoutUntil && (
                            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-center">
                                <p className="text-red-400 font-medium">Account Locked</p>
                                <p className="text-red-300 text-sm mt-1">Try again in {remainingTime}</p>
                            </div>
                        )}

                        {/* PIN Display Dots */}
                        <div className="flex justify-center gap-3 mb-6">
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className={`w-4 h-4 rounded-full transition-all duration-200 ${pinInput.length > i
                                        ? 'bg-blue-500 scale-110'
                                        : 'bg-slate-600'
                                        }`}
                                />
                            ))}
                        </div>

                        {/* Number Pad */}
                        <div className="grid grid-cols-3 gap-3">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button
                                    key={num}
                                    onClick={() => setPinInput((p) => (p.length < 4 ? p + num : p))}
                                    disabled={!!(lockoutUntil && Date.now() < lockoutUntil)}
                                    className="h-16 rounded-2xl bg-slate-700 text-2xl font-bold text-white hover:bg-slate-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-700"
                                >
                                    {num}
                                </button>
                            ))}
                            <Link
                                href="/"
                                className="h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-all border border-slate-700"
                            >
                                <ArrowLeft size={24} />
                            </Link>
                            <button
                                onClick={() => setPinInput((p) => (p.length < 4 ? p + '0' : p))}
                                disabled={!!(lockoutUntil && Date.now() < lockoutUntil)}
                                className="h-16 rounded-2xl bg-slate-700 text-2xl font-bold text-white hover:bg-slate-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-700"
                            >
                                0
                            </button>
                            <button
                                onClick={() => setPinInput('')}
                                disabled={!!(lockoutUntil && Date.now() < lockoutUntil)}
                                className="h-16 rounded-2xl bg-red-500/20 text-red-400 font-bold hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Clear
                            </button>
                        </div>

                        {error && (
                            <p className="text-red-400 text-center text-sm animate-pulse">{error}</p>
                        )}

                        <button
                            onClick={verifyPin}
                            disabled={pinInput.length !== 4 || loading || !!(lockoutUntil && Date.now() < lockoutUntil)}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 transition-all active:scale-98"
                        >
                            {loading ? 'Verifying...' : (lockoutUntil && Date.now() < lockoutUntil) ? 'Locked' : 'Enter'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Analytics Dashboard
    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-slate-800/90 backdrop-blur-xl border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="p-2 rounded-xl bg-slate-700 text-white hover:bg-slate-600 transition-all"
                        >
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white flex items-center gap-2">
                                <BarChart3 className="text-blue-400" />
                                Admin Dashboard
                            </h1>
                        </div>
                    </div>
                    <button
                        onClick={fetchAnalytics}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </header>



            <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
                {/* Date Range Controls */}
                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Calendar className="text-blue-400" />
                        Date Range
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                        <div className="grid grid-cols-2 sm:flex gap-4 sm:gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-400 text-sm">From</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-400 text-sm">To</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setStartDate('');
                                setEndDate(new Date().toISOString().split('T')[0]);
                            }}
                            className="w-full sm:w-auto px-4 py-2 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all"
                        >
                            Reset to All Time
                        </button>
                    </div>
                </div>

                {/* Page Views Line Chart */}
                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <TrendingUp className="text-green-400" />
                        Page Views by Day
                    </h3>
                    <div className="h-80">
                        {analytics?.pageViewsByDay && analytics.pageViewsByDay.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={analytics.pageViewsByDay}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatDate}
                                        stroke="#9ca3af"
                                        fontSize={12}
                                    />
                                    <YAxis stroke="#9ca3af" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1f2937',
                                            border: '1px solid #374151',
                                            borderRadius: '0.5rem',
                                            color: '#f3f4f6'
                                        }}
                                        labelFormatter={(value) => `Date: ${formatDate(value)}`}
                                        formatter={(value) => [value, 'Views']}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="count"
                                        stroke="#22c55e"
                                        strokeWidth={2}
                                        dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                                        activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-slate-400">No page view data available for the selected range</p>
                            </div>
                        )}
                    </div>
                </div>                {/* Shop PIN Management */}
                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Key className="text-yellow-400" />
                        Shop PIN Management
                    </h3>
                    <div className="space-y-3">
                        {canteens.map((canteen) => (
                            <div
                                key={canteen.id}
                                className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl border border-slate-600"
                            >
                                <div className="flex-1">
                                    <span className="text-white font-medium">{canteen.name}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-slate-400 text-sm">PIN:</span>
                                        <span className="text-slate-300 font-mono">
                                            {showCanteenPins[canteen.id] ? canteen.pin : '••••'}
                                        </span>
                                        <button
                                            onClick={() => toggleShowPin(canteen.id)}
                                            className="p-1 text-slate-400 hover:text-white transition-colors"
                                        >
                                            {showCanteenPins[canteen.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setSelectedCanteen(canteen);
                                        setNewCanteenPin('');
                                        setPinUpdateStatus(null);
                                        setShowEditDialog(true);
                                    }}
                                    className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all text-sm font-medium"
                                >
                                    Change PIN
                                </button>
                            </div>
                        ))}
                        {canteens.length === 0 && (
                            <p className="text-slate-400 text-center py-4">Loading shops...</p>
                        )}
                    </div>
                </div>

                {/* Admin PIN Change */}
                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Lock className="text-red-400" />
                        Admin PIN
                    </h3>

                    {adminPinSuccess && (
                        <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 text-sm">
                            Admin PIN updated successfully!
                        </div>
                    )}

                    {!showAdminPinChange ? (
                        <button
                            onClick={() => setShowAdminPinChange(true)}
                            className="px-6 py-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-all font-medium"
                        >
                            Change Admin PIN
                        </button>
                    ) : (
                        <div className="space-y-4 max-w-sm">
                            <div>
                                <label className="text-slate-400 text-sm block mb-2">New Admin PIN</label>
                                <input
                                    type="password"
                                    maxLength={4}
                                    value={newAdminPin}
                                    onChange={(e) => setNewAdminPin(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Enter 4-digit PIN"
                                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:border-blue-500 font-mono text-center text-lg tracking-widest"
                                />
                            </div>
                            <div>
                                <label className="text-slate-400 text-sm block mb-2">Confirm New PIN</label>
                                <input
                                    type="password"
                                    maxLength={4}
                                    value={confirmAdminPin}
                                    onChange={(e) => setConfirmAdminPin(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Confirm PIN"
                                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:border-blue-500 font-mono text-center text-lg tracking-widest"
                                />
                            </div>

                            {adminPinError && (
                                <p className="text-red-400 text-sm">{adminPinError}</p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={updateAdminPin}
                                    disabled={newAdminPin.length !== 4 || confirmAdminPin.length !== 4}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500 transition-all"
                                >
                                    Update Admin PIN
                                </button>
                                <button
                                    onClick={() => {
                                        setShowAdminPinChange(false);
                                        setNewAdminPin('');
                                        setConfirmAdminPin('');
                                        setAdminPinError('');
                                    }}
                                    className="px-6 py-3 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Rate Limited IPs Section */}
                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <AlertTriangle className="text-orange-400" />
                            Rate Limited IP Addresses
                        </h3>
                        <button
                            onClick={fetchRateLimitedIPs}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-all text-sm"
                        >
                            <RefreshCw size={14} />
                            Refresh
                        </button>
                    </div>

                    {rateLimitedIPs.length === 0 ? (
                        <div className="text-center py-8">
                            <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400">No rate-limited IPs found</p>
                            <p className="text-slate-500 text-sm mt-1">IPs will appear here when they exceed login attempt limits</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">IP Address</th>
                                        <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Page</th>
                                        <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Attempts</th>
                                        <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Last Attempt</th>
                                        <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Status</th>
                                        <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Lockout Expires</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rateLimitedIPs.map((entry, index) => (
                                        <tr
                                            key={`${entry.ip}-${entry.page}-${index}`}
                                            className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                                        >
                                            <td className="py-3 px-4">
                                                <span className="text-white font-mono text-sm">{entry.ip}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-slate-300 text-sm">{entry.page}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-slate-300 text-sm">{entry.attempts}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-slate-400 text-sm">
                                                    {new Date(entry.lastAttempt).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                {entry.isCurrentlyLocked ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium">
                                                        <Lock size={12} />
                                                        Locked
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium">
                                                        <Check size={12} />
                                                        Expired
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-slate-400 text-sm">
                                                    {entry.lockoutUntil
                                                        ? new Date(entry.lockoutUntil).toLocaleString()
                                                        : '-'
                                                    }
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Edit PIN Dialog */}
            {showEditDialog && selectedCanteen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Change PIN for {selectedCanteen.name}</h3>
                            <button
                                onClick={() => setShowEditDialog(false)}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-slate-400 text-sm block mb-2">New PIN</label>
                                <input
                                    type="text"
                                    maxLength={4}
                                    value={newCanteenPin}
                                    onChange={(e) => setNewCanteenPin(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Enter 4-digit PIN"
                                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:border-blue-500 font-mono text-center text-lg"
                                />
                            </div>

                            {pinUpdateStatus && pinUpdateStatus.id === selectedCanteen.id && (
                                <p className={`text-sm ${pinUpdateStatus.success ? 'text-green-400' : 'text-red-400'}`}>
                                    {pinUpdateStatus.message}
                                </p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={updateCanteenPin}
                                    disabled={newCanteenPin.length !== 4}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 transition-all"
                                >
                                    Update PIN
                                </button>
                                <button
                                    onClick={() => {
                                        setShowEditDialog(false);
                                        setSelectedCanteen(null);
                                        setNewCanteenPin('');
                                        setPinUpdateStatus(null);
                                    }}
                                    className="px-6 py-3 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
