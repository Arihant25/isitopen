'use client';

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
  Utensils,
  UtensilsCrossed,
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
  Globe,
  MessageSquare,
  X,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  HandCoins,
  AlertTriangle,
  Cannabis,
  Landmark
} from 'lucide-react';
import { Analytics } from '@/lib/analytics';

// --- Types ---
interface Canteen {
  id: string;
  name: string;
  icon: string;
  status: 'open' | 'closed';
  lastUpdated?: string;
  note?: string;
  noteUpdatedAt?: string;
}

interface VotesData {
  [canteenId: string]: {
    openVotes: number;
    closedVotes: number;
  };
}

type View = 'landing' | 'student' | 'owner-select' | 'owner-pin' | 'owner-dashboard';
type Language = 'en' | 'hi' | 'te';

// --- Translations ---
const translations = {
  en: {
    appTitle: 'Is it Open?',
    appSubtitle: 'Check if your favourite shop is open.',
    iWantToEat: 'I want to Shop',
    checkStatusList: 'Check status list',
    iAmCanteen: 'I am a Shop',
    updateMyStatus: 'Update my status',
    visitor: 'Visitor',
    liveCanteenStatus: 'Live Shop Status',
    updated: 'Updated',
    ago: 'ago',
    noUpdatesYet: 'No updates yet',
    open: 'OPEN',
    closed: 'CLOSED',
    selectYourCanteen: 'Select Your Shop',
    enterPinToControl: 'Enter PIN to control status',
    wrongPin: 'Wrong PIN. Please try again.',
    failedToVerify: 'Failed to verify PIN.',
    back: 'Back',
    clear: 'Clear',
    enter: 'Enter',
    logout: 'Logout',
    tapToToggle: 'Tap screen to toggle',
    studentsCanSeeOpen: 'Students can see you are Open',
    studentsSeeClose: 'Students see you are Closed',
    refreshing: 'Refreshing...',
    releaseToRefresh: 'Release to refresh',
    pullToRefresh: 'Pull to refresh',
    cooking: 'Cooking...',
    errorLoadingCanteen: 'Error loading shop',
    unknownState: 'Unknown State',
    failedToUpdate: 'Failed to update status',
    addNote: 'Add note',
    editNote: 'Edit note',
    noteHint: 'Share updates with students (240 chars)',
    notePlaceholder: 'e.g., Today\'s special menu!',
    saveNote: 'Save',
    clearNote: 'Clear',
    noteExpires: 'Expires in',
    hours: 'h',
    minutes: 'm',
    somethingWrong: 'Something Wrong?',
    yesItsOpen: 'Yes, it\'s open',
    noItsClosed: 'No, it\'s closed',
    yesItsClosed: 'Yes, it\'s closed',
    noItsOpen: 'No, it\'s open',
    peopleSaidOpen: 'said it\'s open',
    peopleSaidClosed: 'said it\'s closed',
    thankYou: 'Thanks for your feedback!',
    communityFeedback: 'Community Feedback',
    mightBeIncorrect: 'Might be incorrect',
  },
  hi: {
    appTitle: 'क्या खुला है?',
    appSubtitle: 'देखें कि आपकी पसंदीदा दुकान खुली है या नहीं।',
    iWantToEat: 'मैं खरीदना चाहता हूं',
    checkStatusList: 'स्थिति सूची देखें',
    iAmCanteen: 'मैं दुकान हूं',
    updateMyStatus: 'मेरी स्थिति अपडेट करें',
    visitor: 'आगंतुक',
    liveCanteenStatus: 'लाइव दुकान स्थिति',
    updated: 'अपडेट किया',
    ago: 'पहले',
    noUpdatesYet: 'अभी तक कोई अपडेट नहीं',
    open: 'खुला',
    closed: 'बंद',
    selectYourCanteen: 'अपनी दुकान चुनें',
    enterPinToControl: 'स्थिति नियंत्रित करने के लिए पिन दर्ज करें',
    wrongPin: 'गलत पिन। कृपया पुनः प्रयास करें।',
    failedToVerify: 'पिन सत्यापित करने में विफल।',
    back: 'वापस',
    clear: 'साफ़',
    enter: 'दर्ज करें',
    logout: 'लॉगआउट',
    tapToToggle: 'टॉगल करने के लिए स्क्रीन टैप करें',
    studentsCanSeeOpen: 'छात्र देख सकते हैं कि आप खुले हैं',
    studentsSeeClose: 'छात्र देखते हैं कि आप बंद हैं',
    refreshing: 'रिफ्रेश हो रहा है...',
    releaseToRefresh: 'रिफ्रेश के लिए छोड़ें',
    pullToRefresh: 'रिफ्रेश के लिए खींचें',
    cooking: 'पक रहा है...',
    errorLoadingCanteen: 'दुकान लोड करने में त्रुटि',
    unknownState: 'अज्ञात स्थिति',
    failedToUpdate: 'स्थिति अपडेट करने में विफल',
    addNote: 'नोट जोड़ें',
    editNote: 'नोट संपादित करें',
    noteHint: 'छात्रों के साथ अपडेट साझा करें (240 अक्षर)',
    notePlaceholder: 'जैसे, आज विशेष मेनू!',
    saveNote: 'सेव करें',
    clearNote: 'हटाएं',
    noteExpires: 'समाप्ति में',
    hours: 'घं',
    minutes: 'मि',
    somethingWrong: 'कुछ गलत है?',
    yesItsOpen: 'हां, यह खुला है',
    noItsClosed: 'नहीं, यह बंद है',
    yesItsClosed: 'हां, यह बंद है',
    noItsOpen: 'नहीं, यह खुला है',
    peopleSaidOpen: 'ने कहा यह खुला है',
    peopleSaidClosed: 'ने कहा यह बंद है',
    thankYou: 'आपकी प्रतिक्रिया के लिए धन्यवाद!',
    communityFeedback: 'समुदाय प्रतिक्रिया',
    mightBeIncorrect: 'गलत हो सकता है',
  },
  te: {
    appTitle: 'తెరిచి ఉందా?',
    appSubtitle: 'మీ ఇష్టమైన షాప్ తెరిచి ఉందో చూడండి.',
    iWantToEat: 'నేను షాపింగ్ చేయాలనుకుంటున్నాను',
    checkStatusList: 'స్థితి జాబితా చూడండి',
    iAmCanteen: 'నేను షాప్ ని',
    updateMyStatus: 'నా స్థితిని అప్డేట్ చేయండి',
    visitor: 'సందర్శకుడు',
    liveCanteenStatus: 'ప్రత్యక్ష దుకాణం స్థితి',
    updated: 'నవీకరించబడింది',
    ago: 'క్రితం',
    noUpdatesYet: 'ఇంకా అప్డేట్‌లు లేవు',
    open: 'తెరిచి ఉంది',
    closed: 'మూసి ఉంది',
    selectYourCanteen: 'మీ షాప్ ఎంచుకోండి',
    enterPinToControl: 'స్థితిని నియంత్రించడానికి పిన్ నమోదు చేయండి',
    wrongPin: 'తప్పు పిన్. దయచేసి మళ్ళీ ప్రయత్నించండి.',
    failedToVerify: 'పిన్ ధృవీకరించడం విఫలమైంది.',
    back: 'వెనుకకు',
    clear: 'క్లియర్',
    enter: 'ఎంటర్',
    logout: 'లాగౌట్',
    tapToToggle: 'టోగుల్ చేయడానికి స్క్రీన్ టాప్ చేయండి',
    studentsCanSeeOpen: 'మీరు తెరిచి ఉన్నారని విద్యార్థులు చూడవచ్చు',
    studentsSeeClose: 'మీరు మూసి ఉన్నారని విద్యార్థులు చూస్తారు',
    refreshing: 'రిఫ్రెష్ అవుతోంది...',
    releaseToRefresh: 'రిఫ్రెష్ చేయడానికి విడుదల చేయండి',
    pullToRefresh: 'రిఫ్రెష్ చేయడానికి లాగండి',
    cooking: 'వండుతోంది...',
    errorLoadingCanteen: 'షాప్ లోడ్ చేయడంలో లోపం',
    unknownState: 'తెలియని స్థితి',
    failedToUpdate: 'స్థితిని అప్డేట్ చేయడం విఫలమైంది',
    addNote: 'నోట్ జోడించండి',
    editNote: 'నోట్ మార్చండి',
    noteHint: 'విద్యార్థులతో అప్డేట్‌లు పంచుకోండి (240 అక్షరాలు)',
    notePlaceholder: 'ఉదా., ఈ రోజు ప్రత్యేక మెనూ!',
    saveNote: 'సేవ్',
    clearNote: 'క్లియర్',
    noteExpires: 'గడువు ముగుస్తుంది',
    hours: 'గం',
    minutes: 'ని',
    somethingWrong: 'ఏదైనా తప్పు?',
    yesItsOpen: 'అవును, ఇది తెరిచి ఉంది',
    noItsClosed: 'లేదు, ఇది మూసి ఉంది',
    yesItsClosed: 'అవును, ఇది మూసి ఉంది',
    noItsOpen: 'లేదు, ఇది తెరిచి ఉంది',
    peopleSaidOpen: 'మంది ఇది తెరిచి ఉందని చెప్పారు',
    peopleSaidClosed: 'మంది ఇది మూసి ఉందని చెప్పారు',
    thankYou: 'మీ అభిప్రాయానికి ధన్యవాదాలు!',
    communityFeedback: 'సమాజ అభిప్రాయం',
    mightBeIncorrect: 'తప్పు కావచ్చు',
  },
};

const languageNames: Record<Language, string> = {
  en: 'English',
  hi: 'हिंदी',
  te: 'తెలుగు',
};

// --- Language Context ---
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;
}>({
  language: 'en',
  setLanguage: () => { },
  t: translations.en,
});

const useLanguage = () => useContext(LanguageContext);

// --- Voting Dialog Component ---
const VotingDialog = ({
  canteen,
  votes,
  onClose,
  onVote
}: {
  canteen: Canteen;
  votes: { openVotes: number; closedVotes: number } | undefined;
  onClose: () => void;
  onVote: (canteenId: string, voteType: 'open' | 'closed') => void;
}) => {
  const { t } = useLanguage();
  const [hasVoted, setHasVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const openVotes = votes?.openVotes || 0;
  const closedVotes = votes?.closedVotes || 0;
  const totalVotes = openVotes + closedVotes;
  const openPercent = totalVotes > 0 ? (openVotes / totalVotes) * 100 : 50;

  const handleVote = async (voteType: 'open' | 'closed') => {
    setSubmitting(true);
    await onVote(canteen.id, voteType);
    setHasVoted(true);
    setSubmitting(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-5 border border-slate-700">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">{t.somethingWrong}</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-700 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          {/* Canteen info */}
          <div className="flex items-center gap-3 mb-5 p-3 bg-slate-700/50 rounded-xl">
            <div className={`p-2 rounded-full ${canteen.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              <CanteenIcon type={canteen.icon} size={20} />
            </div>
            <div>
              <p className="font-semibold text-white">{canteen.name}</p>
              <p className={`text-sm ${canteen.status === 'open' ? 'text-green-400' : 'text-red-400'}`}>
                {canteen.status === 'open' ? t.open : t.closed}
              </p>
            </div>
          </div>

          {/* Vote buttons or thank you message */}
          {hasVoted ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/20 rounded-full mb-3">
                <ThumbsUp className="text-green-400" size={24} />
              </div>
              <p className="text-white font-medium">{t.thankYou}</p>
            </div>
          ) : (
            <div className="space-y-3 mb-5">
              {canteen.status === 'open' ? (
                /* When status shows OPEN, ask if it's really open */
                <>
                  <button
                    onClick={() => handleVote('open')}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    <ThumbsUp size={18} />
                    {t.yesItsOpen}
                  </button>
                  <button
                    onClick={() => handleVote('closed')}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    <ThumbsDown size={18} />
                    {t.noItsClosed}
                  </button>
                </>
              ) : (
                /* When status shows CLOSED, ask if it's really closed */
                <>
                  <button
                    onClick={() => handleVote('closed')}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    <ThumbsUp size={18} />
                    {t.yesItsClosed}
                  </button>
                  <button
                    onClick={() => handleVote('open')}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    <ThumbsDown size={18} />
                    {t.noItsOpen}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Community feedback section */}
          {totalVotes > 0 && (
            <div className="border-t border-slate-700 pt-4">
              <p className="text-slate-400 text-sm font-medium mb-3">{t.communityFeedback}</p>

              {/* Vote counts */}
              <div className="flex justify-between text-sm mb-2">
                <span className="text-green-400">{openVotes} {t.peopleSaidOpen}</span>
                <span className="text-red-400">{closedVotes} {t.peopleSaidClosed}</span>
              </div>

              {/* Bar graph */}
              <div className="h-4 bg-slate-700 rounded-full overflow-hidden flex">
                <div
                  className="bg-green-500 transition-all duration-300"
                  style={{ width: `${openPercent}%` }}
                />
                <div
                  className="bg-red-500 transition-all duration-300"
                  style={{ width: `${100 - openPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// --- Language Toggle Component ---
const LanguageToggle = () => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-300 transition-colors border border-slate-700"
      >
        <Globe size={16} />
        <span>{languageNames[language]}</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
            {(Object.keys(languageNames) as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => {
                  setLanguage(lang);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${language === lang
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
                  }`}
              >
                {languageNames[lang]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// --- Components ---

// Loading Screen
const Loading = () => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-slate-400">
      <div className="loader mb-6"></div>
      <p>{t.cooking}</p>
    </div>
  );
};

// Icon Helper
const CanteenIcon = ({ type, size = 24, className }: { type: string; size?: number; className?: string }) => {
  if (type === 'rice') return <UtensilsCrossed size={size} className={className} />;
  if (type === 'meat') return <Utensils size={size} className={className} />;
  if (type === 'coffee') return <Coffee size={size} className={className} />;
  if (type === 'pizza') return <Pizza size={size} className={className} />;
  if (type === 'drink') return <CupSoda size={size} className={className} />;
  if (type === 'noodles') return <Soup size={size} className={className} />;
  if (type === 'cake') return <CakeSlice size={size} className={className} />;
  if (type === 'snack') return <Sandwich size={size} className={className} />;
  if (type === 'waffle') return <Cookie size={size} className={className} />;
  if (type === 'cannabis') return <Cannabis size={size} className={className} />;
  if (type === 'landmark') return <Landmark size={size} className={className} />;
  return <Store size={size} className={className} />;
};

// Visitor Counter Component
const VisitorCounter = () => {
  const { t } = useLanguage();
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
      <span>{t.visitor} #{Math.floor(count).toLocaleString()}</span>
    </div>
  );
};

// Main App Component
export default function Home() {
  const [language, setLanguage] = useState<Language>('en');
  const [view, setView] = useState<View>('landing');
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [selectedCanteenId, setSelectedCanteenId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifiedPin, setVerifiedPin] = useState<string | null>(null);

  // Note editing state
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Community votes state
  const [votes, setVotes] = useState<VotesData>({});
  const [votingCanteen, setVotingCanteen] = useState<Canteen | null>(null);

  // Pull to refresh state
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const PULL_THRESHOLD = 120;

  const t = translations[language];

  // Load language from localStorage on mount (client-side only)
  useEffect(() => {
    const saved = localStorage.getItem('language');
    if (saved && (saved === 'en' || saved === 'hi' || saved === 'te')) {
      setLanguage(saved as Language);
    }
  }, []);

  // Save language to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

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

  // Fetch community votes
  const fetchVotes = useCallback(async () => {
    try {
      const response = await fetch('/api/votes');
      if (response.ok) {
        const data = await response.json();
        setVotes(data.votes || {});
      }
    } catch (error) {
      console.error('Failed to fetch votes:', error);
    }
  }, []);

  // Submit a vote
  const submitVote = async (canteenId: string, voteType: 'open' | 'closed') => {
    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canteenId, voteType }),
      });
      if (response.ok) {
        const data = await response.json();
        setVotes(prev => ({
          ...prev,
          [canteenId]: {
            openVotes: data.openVotes,
            closedVotes: data.closedVotes,
          }
        }));
      }
    } catch (error) {
      console.error('Failed to submit vote:', error);
    }
  };

  // Initial fetch and polling for real-time updates
  useEffect(() => {
    fetchCanteens();
    fetchVotes();
    Analytics.pageView(); // Track page view on load

    // Poll every 5 seconds for updates
    const interval = setInterval(() => {
      fetchCanteens();
      fetchVotes();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchCanteens, fetchVotes]);

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
        headers: {
          'Content-Type': 'application/json'
        },
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
        if (response.status === 429) {
          const data = await response.json();
          setPinError(data.error || 'Too many attempts. Try again later.');
        } else {
          setPinError(t.wrongPin);
        }
        setPinInput('');
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      setPinError(t.failedToVerify);
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
          'Content-Type': 'application/json'
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
        alert(error.error || t.failedToUpdate);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert(t.failedToUpdate);
    }
  };

  const formatTimeAgo = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ${t.ago}`;
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min${diffInMinutes !== 1 ? 's' : ''} ${t.ago}`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ${t.ago}`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ${t.ago}`;
  };

  const getNoteExpiryTime = (noteUpdatedAt?: string) => {
    if (!noteUpdatedAt) return null;
    const expiryTime = new Date(noteUpdatedAt).getTime() + 12 * 60 * 60 * 1000;
    const remaining = expiryTime - Date.now();
    if (remaining <= 0) return null;
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return { hours, minutes };
  };

  const saveNote = async (note: string) => {
    if (!selectedCanteenId || !verifiedPin) return;

    setSavingNote(true);
    try {
      const response = await fetch(`/api/canteens/${selectedCanteenId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note, pin: verifiedPin }),
      });

      if (response.ok) {
        const updatedCanteen = await response.json();
        setCanteens(prev =>
          prev.map(c => c.id === selectedCanteenId ? updatedCanteen : c)
        );
        setShowNoteInput(false);
        setNoteInput('');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save note');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note');
    } finally {
      setSavingNote(false);
    }
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
  if (loading) return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <Loading />
    </LanguageContext.Provider>
  );

  // VIEW: LANDING
  if (view === 'landing') {
    return (
      <LanguageContext.Provider value={{ language, setLanguage, t }}>
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 space-y-8">
          {/* Language Toggle */}
          <div className="absolute top-4 right-4">
            <LanguageToggle />
          </div>

          <div className="text-center space-y-2">
            <img src="/osdg_logo.webp" alt="OSDG Logo" className="max-w-48 h-auto mx-auto mb-4" />
            <h1 className="text-4xl font-bold tracking-tight text-blue-400">{t.appTitle}</h1>
            <p className="text-slate-400">{t.appSubtitle}</p>
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
                <HandCoins className="w-8 h-8 text-blue-600" />
              </div>
              <span className="text-xl font-bold">{t.iWantToEat}</span>
              <span className="text-sm text-slate-500">{t.checkStatusList}</span>
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
              <span className="text-xl font-bold">{t.iAmCanteen}</span>
              <span className="text-sm text-slate-500">{t.updateMyStatus}</span>
            </button>
          </div>

          <VisitorCounter />
        </div>
      </LanguageContext.Provider>
    );
  }

  const inactiveCanteenIds = new Set(['devids', 'dammams-milk-canteen', 'cie-canteen', 'uncles', 'vindhya-stationery']);
  // VIEW: STUDENT LIST
  if (view === 'student') {
    const sortedCanteens = [...canteens].sort((a, b) => {
      const aOpen = a.status === 'open' ? 1 : 0;
      const bOpen = b.status === 'open' ? 1 : 0;
      return bOpen - aOpen;
    });

    return (
      <LanguageContext.Provider value={{ language, setLanguage, t }}>
        <div
          className="min-h-screen bg-slate-900 flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="sticky top-0 z-10 bg-slate-800/90 backdrop-blur-xl border-b border-slate-700 px-4 py-4 shadow-sm flex items-center justify-between">
            <button onClick={() => setView('landing')} className="p-2 text-slate-400 hover:bg-slate-700 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </button>
            <h2 className="text-lg font-bold text-white text-center">{t.liveCanteenStatus}</h2>
            <LanguageToggle />
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
                <span>{t.refreshing}</span>
              </div>
            ) : (
              <div className="text-slate-500 text-sm font-medium flex flex-col items-center pt-2">
                <RefreshCw
                  className={`mb-1 transition-transform duration-300 ${pullDistance > PULL_THRESHOLD ? 'rotate-180 text-blue-400' : ''}`}
                  size={20}
                />
                <span className={pullDistance > PULL_THRESHOLD ? 'text-blue-400' : ''}>
                  {pullDistance > PULL_THRESHOLD ? t.releaseToRefresh : t.pullToRefresh}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortedCanteens.map((canteen) => {
                const isOpen = canteen.status === 'open';
                const canteenVotes = votes[canteen.id];
                const openVotes = canteenVotes?.openVotes || 0;
                const closedVotes = canteenVotes?.closedVotes || 0;
                const totalVotes = openVotes + closedVotes;
                // Show warning if there are votes and people disagree with the status
                const showVoteWarning = totalVotes >= 2 && (
                  (isOpen && closedVotes > openVotes) || (!isOpen && openVotes > closedVotes)
                );
                const isInactive = inactiveCanteenIds.has(canteen.id);

                return (
                  <div
                    key={canteen.id}
                    className={`flex flex-col p-4 rounded-xl border transition-all ${isOpen
                      ? showVoteWarning
                        ? 'bg-slate-800 border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                        : 'bg-slate-800 border-green-500/50 shadow-lg shadow-green-500/10'
                      : showVoteWarning
                        ? 'bg-slate-800/50 border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                        : 'bg-slate-800/50 border-slate-700 opacity-80'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-full ${isOpen ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                          <CanteenIcon type={canteen.icon} size={24} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-lg">{canteen.name}</h3>
                          <div className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock size={12} />
                            {canteen.lastUpdated ? (
                              language === 'te'
                                ? `${formatTimeAgo(canteen.lastUpdated)} ${t.updated}`
                                : `${t.updated} ${formatTimeAgo(canteen.lastUpdated)}`
                            ) : t.noUpdatesYet}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {showVoteWarning && (
                          <div className="p-1.5 rounded-full bg-yellow-500/20 text-yellow-400" title={t.mightBeIncorrect}>
                            <AlertTriangle size={16} />
                          </div>
                        )}
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${isOpen ? 'bg-green-600 text-white' : 'bg-red-500/20 text-red-400'
                          }`}>
                          {isOpen ? t.open : t.closed}
                        </div>
                        <button
                          onClick={() => setVotingCanteen(canteen)}
                          className="p-2 rounded-full hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200"
                          title={t.somethingWrong}
                        >
                          <HelpCircle size={18} />
                        </button>
                      </div>
                    </div>

                    {isInactive && (
                      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-yellow-400">
                        <AlertTriangle size={14} />
                        <span>Currently Inactive</span>
                      </div>
                    )}

                    {/* Note display */}
                    {canteen.note && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <p className="text-sm text-slate-300 leading-relaxed">{canteen.note}</p>
                      </div>
                    )}

                    {/* Community votes bar */}
                    {totalVotes > 0 && (
                      <div
                        className="mt-3 pt-3 border-t border-slate-700/50 cursor-pointer"
                        onClick={() => setVotingCanteen(canteen)}
                      >
                        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                          <span className={openVotes > closedVotes ? 'text-green-400' : ''}>
                            {openVotes} {t.peopleSaidOpen}
                          </span>
                          <span className={closedVotes > openVotes ? 'text-yellow-400' : ''}>
                            {closedVotes} {t.peopleSaidClosed}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden flex">
                          <div
                            className="bg-green-500 transition-all duration-300"
                            style={{ width: `${(openVotes / totalVotes) * 100}%` }}
                          />
                          <div
                            className="bg-red-500 transition-all duration-300"
                            style={{ width: `${(closedVotes / totalVotes) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Voting Dialog */}
          {votingCanteen && (
            <VotingDialog
              canteen={votingCanteen}
              votes={votes[votingCanteen.id]}
              onClose={() => setVotingCanteen(null)}
              onVote={submitVote}
            />
          )}
        </div>
      </LanguageContext.Provider>
    );
  }

  // VIEW: OWNER SELECT
  if (view === 'owner-select') {
    return (
      <LanguageContext.Provider value={{ language, setLanguage, t }}>
        <div className="min-h-screen bg-slate-900 text-white flex flex-col">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center">
              <button onClick={() => setView('landing')} className="p-2 text-slate-400">
                <ArrowLeft size={24} />
              </button>
              <h2 className="ml-2 text-xl font-bold">{t.selectYourCanteen}</h2>
            </div>
            <LanguageToggle />
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
      </LanguageContext.Provider>
    );
  }

  // VIEW: OWNER PIN
  if (view === 'owner-pin') {
    const canteen = canteens.find(c => c.id === selectedCanteenId);
    return (
      <LanguageContext.Provider value={{ language, setLanguage, t }}>
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
          <h3 className="text-2xl font-bold text-slate-800 mb-2">{canteen?.name}</h3>
          <p className="text-slate-500 mb-8">{t.enterPinToControl}</p>

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
              {t.back}
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
              {t.clear}
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
            {t.enter}
          </button>
        </div>
      </LanguageContext.Provider>
    );
  }

  // VIEW: OWNER DASHBOARD
  if (view === 'owner-dashboard') {
    const canteen = canteens.find(c => c.id === selectedCanteenId);
    const isOpen = canteen?.status === 'open';
    const noteExpiry = getNoteExpiryTime(canteen?.noteUpdatedAt);

    if (!canteen) return <div>{t.errorLoadingCanteen}</div>;

    return (
      <LanguageContext.Provider value={{ language, setLanguage, t }}>
        <div
          className={`min-h-screen flex flex-col transition-colors duration-500 ${isOpen ? 'bg-green-500' : 'bg-red-500'
            }`}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 text-white/90">
            <button
              onClick={() => {
                setVerifiedPin(null);
                setShowNoteInput(false);
                setNoteInput('');
                setView('owner-select');
              }}
              className="px-4 py-2 bg-black/20 rounded-lg text-sm font-medium backdrop-blur-sm"
            >
              {t.logout}
            </button>
            <div className="text-right">
              <h1 className="font-bold text-lg">{canteen.name}</h1>
              <p className="text-xs opacity-80">{t.tapToToggle}</p>
            </div>
          </div>

          {/* The Big Toggle Button */}
          <button
            onClick={() => toggleStatus(canteen.status)}
            className="flex-1 flex flex-col items-center justify-center w-full active:scale-95 transition-transform duration-200 outline-none tap-highlight-transparent"
          >
            <div className="bg-white/20 p-10 rounded-full backdrop-blur-sm mb-6 shadow-2xl ring-4 ring-white/10">
              {isOpen ? (
                <Unlock className="w-24 h-24 text-white" strokeWidth={2.5} />
              ) : (
                <Lock className="w-24 h-24 text-white" strokeWidth={2.5} />
              )}
            </div>

            <h2 className="text-5xl font-black text-white tracking-wider mb-3 uppercase drop-shadow-md">
              {isOpen ? t.open : t.closed}
            </h2>

            <p className="text-white/80 text-lg font-medium max-w-[200px] text-center">
              {isOpen ? t.studentsCanSeeOpen : t.studentsSeeClose}
            </p>
          </button>

          {/* Note Section */}
          <div className="p-4 bg-black/20 backdrop-blur-sm">
            {showNoteInput ? (
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value.slice(0, 240))}
                    placeholder={t.notePlaceholder}
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 resize-none focus:outline-none focus:border-white/40"
                    rows={2}
                  />
                  <span className="absolute bottom-2 right-2 text-xs text-white/50">
                    {noteInput.length}/240
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveNote(noteInput)}
                    disabled={savingNote}
                    className="flex-1 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors disabled:opacity-50"
                  >
                    {savingNote ? '...' : t.saveNote}
                  </button>
                  <button
                    onClick={() => {
                      setShowNoteInput(false);
                      setNoteInput('');
                    }}
                    className="px-4 py-2 bg-white/10 text-white/70 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {canteen.note && noteExpiry ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 bg-white/10 p-3 rounded-xl">
                      <MessageSquare size={16} className="text-white/70 mt-0.5 shrink-0" />
                      <p className="text-white/90 text-sm flex-1">{canteen.note}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/50 text-xs">
                        {t.noteExpires} {noteExpiry.hours}{t.hours} {noteExpiry.minutes}{t.minutes}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setNoteInput(canteen.note || '');
                            setShowNoteInput(true);
                          }}
                          className="px-3 py-1 bg-white/10 text-white/80 rounded-lg text-sm hover:bg-white/20 transition-colors"
                        >
                          {t.editNote}
                        </button>
                        <button
                          onClick={() => saveNote('')}
                          className="px-3 py-1 bg-white/10 text-white/60 rounded-lg text-sm hover:bg-white/20 transition-colors"
                        >
                          {t.clearNote}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNoteInput(true)}
                    className="w-full py-3 bg-white/10 text-white/80 rounded-xl font-medium hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageSquare size={18} />
                    {t.addNote}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </LanguageContext.Provider>
    );
  }

  return <div>{t.unknownState}</div>;
}
