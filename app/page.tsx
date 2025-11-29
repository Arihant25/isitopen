'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Utensils,
  ChefHat,
  Store,
  Lock,
  Unlock,
  Clock,
  ArrowLeft,
  Coffee,
  Pizza,
  Soup,
  CakeSlice,
  Sandwich,
  CupSoda,
  Cookie,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Analytics } from '@/lib/analytics';

// --- Types ---
interface Canteen {
  id: string;
  name: string;
  icon: string;
  status: 'open' | 'closed';
  lastUpdated?: string;
}

type View = 'landing' | 'student' | 'owner-select' | 'owner-pin' | 'owner-dashboard';

// --- Components ---

// Loading Screen
const Loading = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-slate-400">
    <div className="loader mb-6"></div>
    <p>Cooking...</p>
  </div>
);

// Icon Helper
const CanteenIcon = ({ type, size = 24, className }: { type: string; size?: number; className?: string }) => {
  if (type === 'rice' || type === 'meat') return <Utensils size={size} className={className} />;
  if (type === 'coffee') return <Coffee size={size} className={className} />;
  if (type === 'pizza') return <Pizza size={size} className={className} />;
  if (type === 'drink') return <CupSoda size={size} className={className} />;
  if (type === 'noodles') return <Soup size={size} className={className} />;
  if (type === 'cake') return <CakeSlice size={size} className={className} />;
  if (type === 'snack') return <Sandwich size={size} className={className} />;
  if (type === 'waffle') return <Cookie size={size} className={className} />;
  return <Store size={size} className={className} />;
};

// Visitor Counter Component
const VisitorCounter = () => {
  const [count, setCount] = useState(0);
  const [targetCount, setTargetCount] = useState(0);

  useEffect(() => {
    fetch('/api/analytics')
      .then(res => res.json())
      .then(data => {
        if (data.totalPageViews) setTargetCount(data.totalPageViews);
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (count < targetCount) {
      const duration = 1000; // 1 second animation
      const steps = 60;
      const increment = targetCount / steps;

      const timer = setInterval(() => {
        setCount(prev => {
          const next = prev + increment;
          if (next >= targetCount) {
            clearInterval(timer);
            return targetCount;
          }
          return next;
        });
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [targetCount]);

  if (targetCount === 0) return null;

  return (
    <div className="absolute bottom-6 text-slate-500 text-sm font-medium flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
      <span>Visitor #{Math.floor(count).toLocaleString()}</span>
    </div>
  );
};

// Main App Component
export default function Home() {
  const [view, setView] = useState<View>('landing');
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [selectedCanteenId, setSelectedCanteenId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifiedPin, setVerifiedPin] = useState<string | null>(null);

  // Pull to refresh state
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const PULL_THRESHOLD = 120;

  // Fetch canteens from API
  const fetchCanteens = useCallback(async () => {
    try {
      const response = await fetch('/api/canteens');
      if (response.ok) {
        const data = await response.json();
        setCanteens(data);
      }
    } catch (error) {
      console.error('Failed to fetch canteens:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling for real-time updates
  useEffect(() => {
    fetchCanteens();
    Analytics.pageView(); // Track page view on load

    // Poll every 5 seconds for updates
    const interval = setInterval(fetchCanteens, 5000);

    return () => clearInterval(interval);
  }, [fetchCanteens]);

  // --- Handlers ---
  const handleCanteenSelect = (id: string) => {
    setSelectedCanteenId(id);
    setPinInput('');
    setPinError('');
    setView('owner-pin');
  };

  const handlePinSubmit = async () => {
    if (!selectedCanteenId || pinInput.length !== 4) return;

    // Try to verify the PIN by making a test request to update status
    // We'll verify by attempting a status update - if PIN is wrong, it will fail
    const canteen = canteens.find(c => c.id === selectedCanteenId);
    if (!canteen) return;

    try {
      const response = await fetch(`/api/canteens/${selectedCanteenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: canteen.status, // Keep same status, just verify PIN
          pin: pinInput,
        }),
      });

      if (response.ok) {
        setVerifiedPin(pinInput);
        setView('owner-dashboard');
        Analytics.ownerLogin(canteen.id, canteen.name);
      } else {
        setPinError('Wrong PIN. Please try again.');
        setPinInput('');
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      setPinError('Failed to verify PIN.');
      setPinInput('');
    }
  };

  const toggleStatus = async (currentStatus: 'open' | 'closed') => {
    if (!selectedCanteenId || !verifiedPin) return;

    const newStatus = currentStatus === 'open' ? 'closed' : 'open';
    const canteen = canteens.find(c => c.id === selectedCanteenId);

    try {
      const response = await fetch(`/api/canteens/${selectedCanteenId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          pin: verifiedPin,
        }),
      });

      if (response.ok) {
        const updatedCanteen = await response.json();
        setCanteens(prev =>
          prev.map(c => c.id === selectedCanteenId ? updatedCanteen : c)
        );
        // Track status update
        if (canteen) {
          Analytics.canteenStatusUpdate(canteen.id, canteen.name, newStatus);
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update status');
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert('Failed to update status');
    }
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCanteens();
    setIsRefreshing(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && view === 'student') {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY > 0 && window.scrollY === 0 && view === 'student') {
      const touchY = e.touches[0].clientY;
      const diff = touchY - pullStartY;
      if (diff > 0) {
        setPullDistance(diff);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (view === 'student' && pullDistance > PULL_THRESHOLD) {
      await handleRefresh();
    }
    setPullStartY(0);
    setPullDistance(0);
  };

  // --- Render Views ---
  if (loading) return <Loading />;

  // VIEW: LANDING
  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 space-y-8">
        <div className="text-center space-y-2">
          <img src="/osdg_logo.webp" alt="OSDG Logo" className="max-w-48 h-auto mx-auto mb-4" />
          <h1 className="text-4xl font-bold tracking-tight text-blue-400">Is it Open?</h1>
          <p className="text-slate-400">Check if your favourite canteen is open.</p>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <button
            onClick={() => {
              setView('student');
              Analytics.pageView('student');
            }}
            className="w-full group relative flex flex-col items-center p-6 bg-white rounded-2xl text-slate-900 shadow-xl hover:bg-blue-50 transition-all active:scale-95"
          >
            <div className="bg-blue-100 p-4 rounded-full mb-3 group-hover:bg-blue-200">
              <Utensils className="w-8 h-8 text-blue-600" />
            </div>
            <span className="text-xl font-bold">I want to Eat</span>
            <span className="text-sm text-slate-500">Check status list</span>
          </button>

          <button
            onClick={() => {
              setView('owner-select');
              Analytics.pageView('owner');
            }}
            className="w-full group relative flex flex-col items-center p-6 bg-slate-800 rounded-2xl border border-slate-700 hover:border-slate-600 transition-all active:scale-95"
          >
            <div className="bg-slate-700 p-4 rounded-full mb-3">
              <ChefHat className="w-8 h-8 text-slate-300" />
            </div>
            <span className="text-xl font-bold">I am a Canteen</span>
            <span className="text-sm text-slate-500">Update my status</span>
          </button>
        </div>

        <VisitorCounter />
      </div>
    );
  }

  // VIEW: STUDENT LIST
  if (view === 'student') {
    const sortedCanteens = [...canteens].sort((a, b) => {
      const aOpen = a.status === 'open' ? 1 : 0;
      const bOpen = b.status === 'open' ? 1 : 0;
      return bOpen - aOpen;
    });

    return (
      <div
        className="min-h-screen bg-slate-900 flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sticky top-0 z-10 bg-slate-800/90 backdrop-blur-xl border-b border-slate-700 px-4 py-4 shadow-sm flex items-center justify-center relative">
          <button onClick={() => setView('landing')} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:bg-slate-700 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-lg font-bold text-white text-center">Live Canteen Status</h2>
        </div>

        {/* Pull to refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200 ease-out"
          style={{
            height: isRefreshing ? '60px' : `${Math.min(Math.max(0, pullDistance - 20) * 0.4, 80)}px`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / PULL_THRESHOLD, 1)
          }}
        >
          {isRefreshing ? (
            <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
              <Loader2 className="animate-spin" size={20} />
              <span>Refreshing...</span>
            </div>
          ) : (
            <div className="text-slate-500 text-sm font-medium flex flex-col items-center pt-2">
              <RefreshCw
                className={`mb-1 transition-transform duration-300 ${pullDistance > PULL_THRESHOLD ? 'rotate-180 text-blue-400' : ''}`}
                size={20}
              />
              <span className={pullDistance > PULL_THRESHOLD ? 'text-blue-400' : ''}>
                {pullDistance > PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedCanteens.map((canteen) => {
              const isOpen = canteen.status === 'open';
              return (
                <div
                  key={canteen.id}
                  className={`flex items-center justify-between p-12 rounded-xl border transition-all ${isOpen
                    ? 'bg-slate-800 border-green-500/50 shadow-lg shadow-green-500/10'
                    : 'bg-slate-800/50 border-slate-700 opacity-80'
                    }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-full ${isOpen ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                      <CanteenIcon type={canteen.icon} size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{canteen.name}</h3>
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock size={12} />
                        {canteen.lastUpdated ? `Updated ${formatTime(canteen.lastUpdated)}` : 'No updates yet'}
                      </div>
                    </div>
                  </div>

                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${isOpen ? 'bg-green-600 text-white' : 'bg-red-500/20 text-red-400'
                    }`}>
                    {isOpen ? 'OPEN' : 'CLOSED'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // VIEW: OWNER SELECT
  if (view === 'owner-select') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col">
        <div className="p-4 flex items-center">
          <button onClick={() => setView('landing')} className="p-2 text-slate-400">
            <ArrowLeft size={24} />
          </button>
          <h2 className="ml-2 text-xl font-bold">Select Your Canteen</h2>
        </div>

        <div className="flex-1 p-2 md:p-4 grid grid-cols-2 md:grid-cols-3 gap-1.5 overflow-y-auto pb-10">
          {canteens.map((canteen) => (
            <button
              key={canteen.id}
              onClick={() => handleCanteenSelect(canteen.id)}
              className="flex flex-col items-center justify-center p-2 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 active:bg-blue-900 transition-colors aspect-square"
            >
              <CanteenIcon type={canteen.icon} size={48} className="mb-2 text-blue-400" />
              <span className="text-center font-bold leading-tight">{canteen.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // VIEW: OWNER PIN
  if (view === 'owner-pin') {
    const canteen = canteens.find(c => c.id === selectedCanteenId);
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <h3 className="text-2xl font-bold text-slate-800 mb-2">{canteen?.name}</h3>
        <p className="text-slate-500 mb-8">Enter PIN to control status</p>

        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map((_, i) => (
            <div key={i} className={`w-4 h-4 rounded-full ${pinInput.length > i ? 'bg-blue-600' : 'bg-slate-200'}`} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 w-full max-w-xs mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => setPinInput(p => (p.length < 4 ? p + num : p))}
              className="h-16 rounded-full bg-slate-100 text-2xl font-bold text-slate-700 active:bg-slate-200"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => setView('owner-select')}
            className="h-16 flex items-center justify-center text-slate-500"
          >
            Back
          </button>
          <button
            onClick={() => setPinInput(p => (p.length < 4 ? p + '0' : p))}
            className="h-16 rounded-full bg-slate-100 text-2xl font-bold text-slate-700 active:bg-slate-200"
          >
            0
          </button>
          <button
            onClick={() => setPinInput('')}
            className="h-16 flex items-center justify-center text-red-500 font-bold"
          >
            Clear
          </button>
        </div>

        {pinError && (
          <p className="text-red-500 text-sm mb-4">{pinError}</p>
        )}

        <button
          onClick={handlePinSubmit}
          disabled={pinInput.length !== 4}
          className="w-full max-w-xs py-4 bg-blue-600 text-white rounded-xl font-bold text-lg disabled:opacity-50"
        >
          Enter Dashboard
        </button>
      </div>
    );
  }

  // VIEW: OWNER DASHBOARD
  if (view === 'owner-dashboard') {
    const canteen = canteens.find(c => c.id === selectedCanteenId);
    const isOpen = canteen?.status === 'open';

    if (!canteen) return <div>Error loading canteen</div>;

    return (
      <div
        className={`min-h-screen flex flex-col transition-colors duration-500 ${isOpen ? 'bg-green-500' : 'bg-red-500'
          }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 text-white/90">
          <button
            onClick={() => {
              setVerifiedPin(null);
              setView('owner-select');
            }}
            className="px-4 py-2 bg-black/20 rounded-lg text-sm font-medium backdrop-blur-sm"
          >
            Logout
          </button>
          <div className="text-right">
            <h1 className="font-bold text-lg">{canteen.name}</h1>
            <p className="text-xs opacity-80">Tap screen to toggle</p>
          </div>
        </div>

        {/* The Big Toggle Button */}
        <button
          onClick={() => toggleStatus(canteen.status)}
          className="flex-1 flex flex-col items-center justify-center w-full active:scale-95 transition-transform duration-200 outline-none tap-highlight-transparent"
        >
          <div className="bg-white/20 p-12 rounded-full backdrop-blur-sm mb-8 shadow-2xl ring-4 ring-white/10">
            {isOpen ? (
              <Unlock className="w-32 h-32 text-white" strokeWidth={2.5} />
            ) : (
              <Lock className="w-32 h-32 text-white" strokeWidth={2.5} />
            )}
          </div>

          <h2 className="text-6xl font-black text-white tracking-wider mb-4 uppercase drop-shadow-md">
            {isOpen ? "OPEN" : "CLOSED"}
          </h2>

          <p className="text-white/80 text-xl font-medium max-w-[200px] text-center">
            {isOpen ? "Students can see you are Open" : "Students see you are Closed"}
          </p>
        </button>
      </div>
    );
  }

  return <div>Unknown State</div>;
}
