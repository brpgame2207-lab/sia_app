/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import ChatRoom from './ChatRoom';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  Shield,
  User,
  MessageSquare,
  Search,
  X,
  MapPin,
  Sparkles,
  ArrowRight,
  Droplets,
  Zap,
  Navigation,
  Loader2,
  Clock,
  AlertTriangle,
  MessageCircle,
  Coffee,
  HeartHandshake,
  Stethoscope,
  Brain,
  Settings,
  LogOut,
  Bell,
  Moon,
  Sun,
  Users,
  CheckCircle,
  Award,
  Bookmark,
  ChevronRight,
  Eye,
  EyeOff,
  AlertCircle,
  Lock,
  Key
} from 'lucide-react';
import { askSakhiKnows, moderateArinResponse, moderateTimeCapsuleNote } from './services/sakhiAI';
import { getZoneWithCache, getDistanceKm, Zone as ArinZone } from './services/arinLocationService';
import { auth, firebaseInitError, swRegistration } from './firebase';
import { db, firebaseDbInitError } from './services/firebaseConfig';
import { capsuleDb, capsuleFirebaseInitError } from './services/capsuleFirebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  FirebaseUser as FirebaseUser
} from './services/devFirebaseWrapper';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  increment,
  setDoc,
  getDocs,
  runTransaction,
  deleteDoc
} from './services/devDbWrapper';



// --- Types ---
type AppState = 'login' | 'idle' | 'finding' | 'peer-chat' | 'chat-summary';
type AppView = 'main' | 'profile' | 'settings';
type Tab = 'home' | 'arin' | 'sakhi' | 'capsule';
type ChatMessage = { role: 'user' | 'ai' | 'peer'; content: string; sender?: string };
type Question = { id: string; user: string; text: string; time: string; replies: number; zone_id: string; city?: string; timestamp: number };
type CapsuleVote = 'up' | 'down';
type TimeCapsuleNote = {
  id: string;
  text: string;
  originalText: string;
  category: string;
  clusterKey: string;
  userId: string;
  lat: number;
  lng: number;
  timestamp: number;
  thumbsUp: number;
  thumbsDown: number;
  votes?: Record<string, CapsuleVote>;
  status: 'APPROVED' | 'REJECTED' | 'NEEDS_IMPROVEMENT';
};
type SOSAlert = {
  id: string;
  user_id: string;
  name?: string;
  email: string;
  lat: number;
  lng: number;
  timestamp: number;
  message?: string;
  request_type?: string;
  status: 'searching' | 'accepted' | 'closed';
  active?: boolean;
  helper_id?: string | null;
  helper_name?: string | null;
};
type ArinResponse = { id: string; question_id: string; text: string; time: string; verdict: 'APPROVED' | 'REJECTED' | 'NEEDS_IMPROVEMENT'; safe_summary: string; show_original: boolean; timestamp: number; thumbsUp?: number; thumbsDown?: number; likes?: number; votes?: Record<string, CapsuleVote> };
type Zone = ArinZone;

const FirebaseSetupErrorPage = ({ message }: { message: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-sia-cream p-6">
    <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-sia-pink-light/40 shadow-xl p-8 md:p-12">
      <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-6">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h2 className="font-serif italic font-bold text-4xl text-sia-text mb-4">App Setup Needed</h2>
      <p className="text-sia-text-muted mb-6">
        SIA could not connect to Firebase, so authentication and community features cannot start yet.
      </p>
      <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm mb-6">
        {message}
      </div>
      <div className="p-4 rounded-2xl bg-sia-cream/60 border border-sia-pink-light/30 text-sia-text text-sm leading-relaxed">
        Add valid values for these keys in .env and restart the dev server:
        <br />VITE_FIREBASE_API_KEY
        <br />VITE_FIREBASE_AUTH_DOMAIN
        <br />VITE_FIREBASE_PROJECT_ID
        <br />VITE_FIREBASE_APP_ID
      </div>
    </div>
  </div>
);

// --- Components ---
const LoginPage = ({ onLogin, onSwitchToSignup, onInstall, showInstall }: { onLogin: () => void, onSwitchToSignup: () => void, onInstall?: () => void, showInstall?: boolean }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    if (!auth) {
      setError('Firebase auth is not configured. Please check your .env Firebase keys.');
      setIsLoading(false);
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Generate and store Session ID
      const sessionId = Date.now().toString() + Math.random().toString(36).substring(2);
      localStorage.setItem('sia_session_id', sessionId);

      if (db) {
        await setDoc(doc(db, "user_sessions", userCredential.user.uid), {
          sessionId: sessionId,
          timestamp: Date.now()
        });

        // Mark user as active in central users collection
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: userCredential.user.email,
          active: true,
          lastSeen: Date.now()
        }, { merge: true });
      }

      onLogin();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please check your credentials or sign up if you don\'t have an account.');
      } else {
        setError(err.message || 'Failed to login. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sia-cream p-6 relative overflow-hidden">
      {showInstall && onInstall && (
        <div className="absolute top-6 right-6 z-20">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onInstall}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full glass border border-sia-pink/20 text-sia-pink text-[10px] uppercase font-bold tracking-[0.2em] shadow-md hover:bg-white/40 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-sia-pink" /> Install App
          </motion.button>
        </div>
      )}
      <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-sia-pink-light/30 rounded-full blur-[100px] -mr-40 -mt-40 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-sia-pink-light/20 rounded-full blur-[80px] -ml-40 -mb-40" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 bg-gradient-to-tr from-sia-pink to-sia-peach rounded-[2rem] flex items-center justify-center shadow-lg mx-auto mb-6"
          >
            <Shield className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="font-serif italic font-bold text-5xl text-sia-text mb-2">Welcome Back</h2>
          <p className="text-sia-text-muted font-light uppercase tracking-[0.2em] text-[10px]">Securely access your sanctuary</p>
        </div>

        <div className="glass p-10 rounded-[3rem] border border-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-sia-peach via-sia-pink to-sia-peach" />

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-500 text-[10px] font-bold uppercase tracking-widest text-center">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-sia-pink opacity-60 ml-4">Email Identity</label>
              <div className="relative flex items-center">
                <div className="absolute left-6 text-sia-pink/40 pointer-events-none z-10">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-16 bg-white/60 border border-sia-pink-light rounded-full pl-14 pr-6 focus:outline-none focus:ring-2 focus:ring-sia-pink transition-all text-sia-text font-light"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-sia-pink opacity-60 ml-4">Password</label>
              <div className="relative flex items-center">
                <div className="absolute left-6 text-sia-pink/40 pointer-events-none z-10">
                  <Shield className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-16 bg-white/60 border border-sia-pink-light rounded-full pl-14 pr-14 focus:outline-none focus:ring-2 focus:ring-sia-pink transition-all text-sia-text font-light"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-6 text-sia-pink/40 hover:text-sia-pink transition-colors z-10"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isLoading}
              className="w-full h-16 bg-sia-pink text-white rounded-full font-bold uppercase tracking-[0.2em] text-xs shadow-lg shadow-sia-pink/20 hover:bg-sia-pink-dark transition-all flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Secure Login <ArrowRight className="w-4 h-4" /></>}
            </motion.button>
          </form>

          <div className="mt-8 pt-8 border-t border-sia-pink-light/30 flex flex-col items-center gap-4">
            <p className="text-[10px] text-sia-text-muted font-bold uppercase tracking-widest opacity-60">Don't have an account?</p>
            <button
              onClick={onSwitchToSignup}
              className="w-full h-14 bg-white border border-sia-pink-light text-sia-pink rounded-full font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-sia-pink-light/30 transition-all shadow-sm"
            >
              Create an Account
            </button>
            <p>DEMO CREDENTIALS</p>
            <p className="text-[10px]">priyanka.sharma@edu.com    password : Priyanka@123</p>
            <p className="text-[10px]">meera.nair@edu.com    password : Meera@123</p>
            <p className="text-[10px]">nithya.rao@edu.com    password : Nithya@123</p>
          </div>
        </div>
      </motion.div >
    </div >
  );
};

const SignupPage = ({ onSignup, onSwitchToLogin, onInstall, showInstall }: { onSignup: () => void, onSwitchToLogin: () => void, onInstall?: () => void, showInstall?: boolean }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uniqueCode, setUniqueCode] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const VERIFIED_CODES: Record<string, string> = {
    'deepthi@edu.com': 'Ux1yHGIRL',
    'shreya.hari@edu.com': 'MnHt2GIRL',
    'revati@edu.com': 'Ty4erGIRL'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const expectedCode = VERIFIED_CODES[email.toLowerCase().trim()];
    if (!expectedCode || uniqueCode.trim() !== expectedCode) {
      setError("Invalid unique code for this email identity.");
      return;
    }

    setIsLoading(true);
    if (!auth) {
      setError('Firebase auth is not configured. Please check your .env Firebase keys.');
      setIsLoading(false);
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Generate and store Session ID
      const sessionId = Date.now().toString() + Math.random().toString(36).substring(2);
      localStorage.setItem('sia_session_id', sessionId);

      if (db) {
        await setDoc(doc(db, "user_sessions", userCredential.user.uid), {
          sessionId: sessionId,
          timestamp: Date.now()
        });

        // Initialize user as active
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: userCredential.user.email,
          active: true,
          lastSeen: Date.now()
        }, { merge: true });
      }

      onSignup();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setError('Authentication configuration error. Please ensure Email/Password provider is enabled in Firebase Console.');
      } else {
        setError(err.message || 'Failed to create account.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sia-cream p-6 relative overflow-hidden">
      {showInstall && onInstall && (
        <div className="absolute top-6 right-6 z-20">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onInstall}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full glass border border-sia-pink/20 text-sia-pink text-[10px] uppercase font-bold tracking-[0.2em] shadow-md hover:bg-white/40 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-sia-pink" /> Install App
          </motion.button>
        </div>
      )}
      <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-sia-pink-light/30 rounded-full blur-[100px] -mr-40 -mt-40 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-sia-pink-light/20 rounded-full blur-[80px] -ml-40 -mb-40" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 bg-gradient-to-tr from-sia-pink to-sia-peach rounded-[2rem] flex items-center justify-center shadow-lg mx-auto mb-6"
          >
            <Sparkles className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="font-serif italic font-bold text-5xl text-sia-text mb-2">Join SIA</h2>
          <p className="text-sia-text-muted font-light uppercase tracking-[0.2em] text-[10px]">Create your anonymous identity</p>
        </div>

        <div className="glass p-10 rounded-[3rem] border border-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-sia-peach via-sia-pink to-sia-peach" />

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-500 text-[10px] font-bold uppercase tracking-widest text-center">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-sia-pink opacity-60 ml-4">Email Identity</label>
              <div className="relative flex items-center">
                <div className="absolute left-6 text-sia-pink/40 pointer-events-none z-10">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-16 bg-white/60 border border-sia-pink-light rounded-full pl-14 pr-6 focus:outline-none focus:ring-2 focus:ring-sia-pink transition-all text-sia-text font-light"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-sia-pink opacity-60 ml-4">Password</label>
              <div className="relative flex items-center">
                <div className="absolute left-6 text-sia-pink/40 pointer-events-none z-10">
                  <Shield className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-16 bg-white/60 border border-sia-pink-light rounded-full pl-14 pr-14 focus:outline-none focus:ring-2 focus:ring-sia-pink transition-all text-sia-text font-light"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-6 text-sia-pink/40 hover:text-sia-pink transition-colors z-10"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-sia-pink opacity-60 ml-4">Confirm Password</label>
              <div className="relative flex items-center">
                <div className="absolute left-6 text-sia-pink/40 pointer-events-none z-10">
                  <Shield className="w-5 h-5" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-16 bg-white/60 border border-sia-pink-light rounded-full pl-14 pr-14 focus:outline-none focus:ring-2 focus:ring-sia-pink transition-all text-sia-text font-light"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-6 text-sia-pink/40 hover:text-sia-pink transition-colors z-10"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-sia-pink opacity-60 ml-4">Unique Identity Code</label>
              <div className="relative flex items-center">
                <div className="absolute left-6 text-sia-pink/40 pointer-events-none z-10">
                  <Key className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Enter your unique code"
                  value={uniqueCode}
                  onChange={(e) => setUniqueCode(e.target.value)}
                  className="w-full h-16 bg-white/60 border border-sia-pink-light rounded-full pl-14 pr-6 focus:outline-none focus:ring-2 focus:ring-sia-pink transition-all text-sia-text font-light tracking-widest"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isLoading}
              className="w-full h-16 bg-sia-pink text-white rounded-full font-bold uppercase tracking-[0.2em] text-xs shadow-lg shadow-sia-pink/20 hover:bg-sia-pink-dark transition-all flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </motion.button>
          </form>

          <div className="mt-8 pt-8 border-t border-sia-pink-light/30 flex flex-col items-center gap-4">
            <p className="text-[10px] text-sia-text-muted font-bold uppercase tracking-widest opacity-60">Already have an account?</p>
            <button
              onClick={onSwitchToLogin}
              className="w-full h-14 bg-white border border-sia-pink-light text-sia-pink rounded-full font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-sia-pink-light/30 transition-all shadow-sm"
            >
              Login Instead
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const Navbar = ({ onProfile, onBack, showBack = false, activeView }: { onProfile?: () => void; onBack?: () => void; showBack?: boolean; activeView: AppView }) => (
  <nav className="fixed top-0 left-0 w-full h-20 px-10 flex items-center justify-between z-[100] bg-white/40 backdrop-blur-md border-b border-sia-pink-light">
    <div className="flex items-center gap-4">
      {showBack && (
        <button onClick={onBack} className="p-2 hover:bg-sia-pink-light rounded-full transition-colors">
          <ArrowRight className="w-6 h-6 text-sia-pink rotate-180" />
        </button>
      )}
      <div className="text-2xl font-bold tracking-tighter text-sia-pink font-serif italic">SIA</div>
    </div>
    <div className="flex items-center gap-6">
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`w-11 h-11 rounded-full border-2 border-white glass shadow-lg flex items-center justify-center cursor-pointer transition-all duration-300 group relative
          ${activeView !== 'main' ? 'bg-sia-pink/10 ring-4 ring-sia-pink/5' : 'bg-sia-pink-light hover:bg-white'}`}
        onClick={onProfile}
      >
        <div className="absolute inset-0 rounded-full bg-sia-pink/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
        <User className={`w-5 h-5 transition-colors ${activeView !== 'main' ? 'text-sia-pink' : 'text-sia-pink/60'}`} />
      </motion.div>
    </div>
  </nav>
);


const ProfileMenu = ({ onClose, onNavigate }: { onClose: () => void, onNavigate: (view: AppView | 'logout') => void }) => {
  const menuItems = [
    { id: 'profile', icon: User, label: 'Profile', desc: 'Personal details, trust level, and activity' },
    { id: 'settings', icon: Settings, label: 'Settings', desc: 'Privacy, notifications, and preferences' },
    { id: 'logout', icon: LogOut, label: 'Logout', desc: 'Securely sign out from SIA', isDestructive: true },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="fixed top-24 right-10 z-[110] w-80 glass rounded-[2.5rem] shadow-2xl border border-white/60 p-4 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-sia-pink/5 to-transparent pointer-events-none" />
      <div className="relative space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'logout') {
                onNavigate('logout'); // Signal logout trigger
              } else {
                onNavigate(item.id as AppView);
              }
              onClose();
            }}
            className="w-full p-4 rounded-[1.8rem] flex items-center gap-4 text-left transition-all hover:bg-white/60 group"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 
              ${item.isDestructive ? 'bg-red-50 text-red-500' : 'bg-sia-warm-bg text-sia-pink'}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className={`text-sm font-bold uppercase tracking-widest ${item.isDestructive ? 'text-red-500' : 'text-sia-text'}`}>{item.label}</h4>
              <p className="text-[10px] text-sia-text-muted font-light leading-tight mt-0.5">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-sia-text opacity-20" />
          </button>
        ))}
      </div>
    </motion.div>
  );
};

const ProfilePage = ({ currentZone, user }: { currentZone?: Zone, user: FirebaseUser | null }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState('Anonymous Sister');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setUserEmail(user.email || 'anonymous@sia.com');
      if (db) {
        getDocs(query(collection(db, "users"), where("__name__", "==", user.uid))).then(snap => {
          if (snap.size > 0) {
            const data = snap.docs[0].data();
            if (data.name) setUserName(data.name);
            if (data.phone) setUserPhone(data.phone);
            if (data.institution) setInstitution(data.institution);
            else if (user.displayName) setUserName(user.displayName);
            else if (!data.name) setUserName(user.email?.split('@')[0] || 'Anonymous Sister');
          }
        });
      }
    }
  }, [user]);

  const handleSave = async () => {
    if (!user || !db) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        name: userName,
        phone: userPhone,
        institution: institution
      }, { merge: true });
      setIsEditing(false);
    } catch (e) {
      console.error("Failed to update profile:", e);
      alert("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-24 md:pt-32 px-4 md:px-6 max-w-5xl mx-auto pb-40">
      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-10 mb-16 bg-white/40 p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border border-white/60 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5 scale-150 rotate-12">
          <Award className="w-64 h-64 text-sia-pink" />
        </div>

        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white glass shadow-xl flex items-center justify-center relative group shrink-0">
          <div className="absolute inset-0 rounded-full bg-sia-pink/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <User className="w-10 h-10 md:w-12 md:h-12 text-sia-pink/40" />
          <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-sia-pink text-white flex items-center justify-center shadow-lg border-2 border-white">
            <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
          </div>
        </div>

        <div className="flex-1 text-center md:text-left space-y-6 z-10">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-4">
              {isEditing ? (
                <input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Your Name"
                  className="bg-white/80 border border-sia-pink-light rounded-xl px-4 py-2 font-serif italic font-bold text-xl md:text-2xl text-sia-text focus:outline-none focus:ring-2 focus:ring-sia-pink w-full max-w-xs text-center md:text-left"
                />
              ) : (
                <h2 className="font-serif italic font-bold text-3xl md:text-4xl text-sia-text leading-tight">{userName}</h2>
              )}

              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-[10px] font-bold uppercase tracking-widest text-sia-pink bg-sia-pink-light/30 px-4 py-2 rounded-full hover:bg-sia-pink hover:text-white transition-all shadow-sm"
                >
                  Edit Profile
                </button>
              )}

              {isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-2 bg-sia-pink-light text-sia-pink rounded-full hover:bg-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <Shield className="w-4 h-4 text-sia-pink/40" />
                {isEditing ? (
                  <input
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Enter your institution name..."
                    className="bg-white border-2 border-sia-pink-light rounded-2xl px-5 py-3 text-base text-sia-text focus:outline-none focus:border-sia-pink focus:ring-8 focus:ring-sia-pink/10 w-full max-w-sm shadow-md transition-all placeholder:text-sia-text-muted/40"
                  />
                ) : (
                  <span className="text-sia-text-muted font-medium text-sm uppercase tracking-widest opacity-60">
                    {institution || "Enter your institution name..."}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center md:justify-start gap-3">
                <MessageCircle className="w-4 h-4 text-sia-pink/40" />
                <span className="text-sia-text-muted font-light text-sm">{userEmail}</span>
              </div>

              <div className="flex items-center justify-center md:justify-start gap-3">
                <AlertCircle className="w-4 h-4 text-sia-pink/40" />
                {isEditing ? (
                  <input
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="Enter your phone number..."
                    className="bg-white border-2 border-sia-pink-light rounded-2xl px-5 py-3 text-base text-sia-text focus:outline-none focus:border-sia-pink focus:ring-8 focus:ring-sia-pink/10 w-full max-w-sm shadow-md transition-all placeholder:text-sia-text-muted/40"
                  />
                ) : (
                  <span className="text-sia-text-muted font-light text-sm">
                    {userPhone || "Enter your phone number..."}
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="text-sia-text-muted font-light text-base md:text-lg italic px-4 md:px-0">"Helping others find comfort and safety."</p>
        </div>
      </div>
    </div>
  );
};

const InstallGuideModal = ({ isOpen, onClose, device }: { isOpen: boolean, onClose: () => void, device: 'ios' | 'android' | 'desktop' }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/10 backdrop-blur-md flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-md glass p-10 rounded-[3rem] border border-white shadow-2xl relative text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-8 right-8 p-2 hover:bg-sia-pink/5 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-sia-text-muted" />
        </button>

        <div className="w-20 h-20 bg-sia-pink-light/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-sia-pink" />
        </div>

        <h3 className="font-serif italic font-bold text-3xl text-sia-text mb-4">How to Install SIA</h3>
        <p className="text-sia-text-muted text-sm font-light leading-relaxed mb-8">
          Add SIA to your home screen to launch it instantly in fullscreen and access it offline.
        </p>

        <div className="text-left space-y-6 bg-white/50 p-6 rounded-[2rem] border border-sia-pink-light/20 mb-8">
          {device === 'ios' && (
            <>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-sia-pink text-white flex items-center justify-center font-bold text-xs shrink-0">1</div>
                <p className="text-xs text-sia-text font-light leading-relaxed">
                  Tap the <span className="font-bold text-sia-pink">Share</span> button at the bottom of Safari (represented by a square with an upward arrow).
                </p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-sia-pink text-white flex items-center justify-center font-bold text-xs shrink-0">2</div>
                <p className="text-xs text-sia-text font-light leading-relaxed">
                  Scroll down the options list and tap <span className="font-bold text-sia-pink">Add to Home Screen</span>.
                </p>
              </div>
            </>
          )}

          {device === 'android' && (
            <>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-sia-pink text-white flex items-center justify-center font-bold text-xs shrink-0">1</div>
                <p className="text-xs text-sia-text font-light leading-relaxed">
                  Tap Chrome's <span className="font-bold text-sia-pink">three-dot menu</span> in the top-right corner of the browser.
                </p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-sia-pink text-white flex items-center justify-center font-bold text-xs shrink-0">2</div>
                <p className="text-xs text-sia-text font-light leading-relaxed">
                  Select <span className="font-bold text-sia-pink">Install app</span> or <span className="font-bold text-sia-pink">Add to Home Screen</span>.
                </p>
              </div>
            </>
          )}

          {device === 'desktop' && (
            <>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-sia-pink text-white flex items-center justify-center font-bold text-xs shrink-0">1</div>
                <p className="text-xs text-sia-text font-light leading-relaxed">
                  Look at the right-hand end of Chrome's address bar (URL bar) at the very top of your browser.
                </p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-sia-pink text-white flex items-center justify-center font-bold text-xs shrink-0">2</div>
                <p className="text-xs text-sia-text font-light leading-relaxed">
                  Click the **Install Icon** (a monitor with a down arrow, or standard `+` symbol) and click **Install**.
                </p>
              </div>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-4 bg-sia-pink text-white rounded-full font-bold uppercase tracking-[0.2em] text-xs shadow-lg hover:bg-sia-pink-dark transition-all"
        >
          Got It
        </button>
      </motion.div>
    </motion.div>
  );
};

const SettingsPage = ({ onInstall, showInstall }: { onInstall?: () => void, showInstall?: boolean }) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [settings, setSettings] = useState({
    notifications: true,
    anonymousMode: true,
    location: true,
    capsuleVisibility: 'nearby',
    theme: 'light',
    safety: 'high'
  });

  const toggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const sections = [
    ...(showInstall ? [{
      title: "App Installation",
      items: [
        { id: 'installPwa', icon: Sparkles, label: 'Install SIA App', desc: 'Add SIA to your home screen for quick, offline access', type: 'button' }
      ]
    }] : []),
    {
      title: "Help & Support",
      items: [
        { id: 'reportIssue', icon: AlertCircle, label: 'Report an issue', desc: 'Let us know if something isn\'t working correctly', type: 'button' },
        { id: 'changePassword', icon: Lock, label: 'Change Password', desc: 'Update your account security credentials', type: 'button' },
      ]
    }
  ];

  return (
    <div className="pt-32 px-6 max-w-3xl mx-auto pb-40">
      <SectionHeading
        title="Settings ⚙️"
        subtitle="Customize your SIA experience to feel safe and supported."
      />

      <div className="space-y-12">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-sia-pink opacity-40 ml-4">{section.title}</h3>
            <div className="bg-white/60 rounded-[3rem] border border-sia-pink-light shadow-sm overflow-hidden">
              {section.items.map((item, i) => (
                <div
                  key={item.id}
                  className={`p-8 flex items-center justify-between hover:bg-white/40 transition-colors ${i !== section.items.length - 1 ? 'border-b border-sia-pink-light/30' : ''}`}
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-sia-warm-bg flex items-center justify-center text-sia-pink">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-sia-text uppercase tracking-widest">{item.label}</h4>
                      <p className="text-[10px] text-sia-text-muted font-light mt-0.5">{item.desc}</p>
                    </div>
                  </div>

                  {item.type === 'toggle' ? (
                    <button
                      onClick={() => toggle(item.id as keyof typeof settings)}
                      className={`w-14 h-8 rounded-full transition-all duration-300 relative p-1 ${settings[item.id as keyof typeof settings] ? 'bg-sia-pink' : 'bg-sia-pink-light'}`}
                    >
                      <motion.div
                        animate={{ x: settings[item.id as keyof typeof settings] ? 24 : 0 }}
                        className="w-6 h-6 rounded-full bg-white shadow-md"
                      />
                    </button>
                  ) : item.type === 'select' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-sia-pink opacity-40">{(item as any).options?.[0]}</span>
                      <ChevronRight className="w-4 h-4 text-sia-pink opacity-30" />
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (item.id === 'installPwa' && onInstall) {
                          onInstall();
                        } else if (item.id === 'reportIssue') {
                          setShowReportModal(true);
                        }
                      }}
                      className="w-10 h-10 rounded-full bg-sia-pink/5 flex items-center justify-center text-sia-pink hover:bg-sia-pink hover:text-white transition-all group"
                    >
                      <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showReportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/10 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => !isSubmitting && setShowReportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-lg glass p-10 rounded-[3rem] border border-white shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowReportModal(false)}
                className="absolute top-8 right-8 p-2 hover:bg-sia-pink/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-sia-text-muted" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center shadow-sm">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif italic font-bold text-2xl text-sia-text">Report an Issue</h3>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-sia-text opacity-30">Your safety is our priority</p>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-sm text-sia-text-muted font-light leading-relaxed">
                  Please describe the problem you faced. Whether it's a scam, a safety concern, or an app bug, we're here to listen and help.
                </p>

                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Tell us what happened..."
                  className="w-full h-40 p-6 bg-white/50 rounded-[2rem] border border-sia-pink-light/30 focus:outline-none focus:ring-4 focus:ring-sia-pink/5 transition-all text-sm font-light resize-none placeholder:text-sia-text-muted/40 shadow-inner"
                />

                <button
                  disabled={!reportText.trim() || isSubmitting}
                  onClick={async () => {
                    setIsSubmitting(true);
                    // Simulate API call
                    await new Promise(r => setTimeout(r, 1500));
                    setShowReportModal(false);
                    setReportText('');
                    setIsSubmitting(false);
                    alert("Your report has been submitted anonymously. Thank you for helping keep the community safe.");
                  }}
                  className="w-full py-4 bg-sia-pink text-white rounded-full font-bold uppercase tracking-[0.2em] text-xs shadow-lg hover:bg-sia-pink-dark transition-all disabled:opacity-50 disabled:hover:scale-100 active:scale-95"
                >
                  {isSubmitting ? "Submitting..." : "Submit Grievance"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LogoutModal = ({ onClose, onLogout }: { onClose: () => void, onLogout: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[200] bg-black/10 backdrop-blur-md flex items-center justify-center p-6"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.9, y: 20 }}
      className="w-full max-w-md glass p-10 rounded-[3rem] border border-white shadow-2xl text-center relative"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-20 h-20 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-8">
        <LogOut className="w-8 h-8" />
      </div>

      <h3 className="font-serif italic font-bold text-3xl mb-4 text-sia-text">Are you sure?</h3>
      <p className="text-sia-text-muted text-sm font-light mb-10">
        You are about to sign out from SIA. Your anonymous session data will be preserved for your next visit.
      </p>

      <div className="flex flex-col gap-4">
        <button
          onClick={onLogout}
          className="w-full h-16 rounded-full bg-sia-pink text-white font-bold uppercase tracking-[0.2em] text-[10px] shadow-lg hover:bg-sia-pink-dark transition-all"
        >
          Logout
        </button>
        <button
          onClick={onClose}
          className="w-full h-16 rounded-full bg-white border border-sia-pink-light text-sia-text opacity-60 font-bold uppercase tracking-[0.2em] text-[10px] hover:opacity-100 transition-all"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const BottomNav = ({ activeTab, onTabChange }: { activeTab: Tab, onTabChange: (tab: Tab) => void }) => {
  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: 'home', icon: Shield, label: 'Home' },
    { id: 'arin', icon: Users, label: 'Hub' },
    { id: 'sakhi', icon: Sparkles, label: 'Sakhi' },
    { id: 'capsule', icon: Heart, label: 'NearHer' },

  ];

  return (
    <div className="fixed bottom-0 left-0 w-full h-20 bg-white/85 backdrop-blur-md border-t border-sia-pink-light z-[100] px-6">
      <div className="max-w-5xl mx-auto h-full flex items-center justify-around">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center gap-1 transition-all duration-300 relative px-4 py-2 ${activeTab === tab.id ? 'text-sia-pink' : 'text-sia-text-muted opacity-70 hover:opacity-100'
              }`}
          >
            <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'fill-sia-pink/10' : ''}`} />
            <span className={`text-[10px] font-bold tracking-widest ${tab.label === 'NearHer' ? '' : 'uppercase'}`}>{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 bg-sia-pink/10 rounded-2xl -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

const PeerChat = ({ onBack, peerName }: { onBack: () => void, peerName?: string | null }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'peer', content: 'Hi, I saw your request. I am nearby. How can I help?', sender: peerName || 'Anonymous sister' }
  ]);
  const [input, setInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const sendMsg = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    setMessages([...messages, { role: 'user', content: input }]);
    setInput('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed inset-0 z-[100] bg-sia-cream flex flex-col"
    >
      <div className="h-20 px-6 flex items-center justify-between border-b border-sia-pink-light bg-white">
        <button onClick={onBack} className="p-2"><X className="w-6 h-6 text-sia-text-muted" /></button>
        <div className="text-center">
          <div className="text-sm font-bold text-sia-text tracking-widest">{peerName || "SIA SECURE CHAT"}</div>
          <div className="text-[10px] text-green-500 font-bold uppercase">Connected Anonymously</div>
        </div>
        <div className="w-10 h-10 rounded-full bg-sia-pink-light flex items-center justify-center">
          <User className="w-5 h-5 text-sia-pink" />
        </div>
      </div>

      <div
        ref={chatContainerRef}
        className="flex-1 p-6 overflow-y-auto space-y-4"
      >
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-[1.5rem] shadow-sm ${m.role === 'user' ? 'bg-sia-pink text-white rounded-br-none' : 'bg-white text-sia-text rounded-tl-none border border-sia-pink-light'
              }`}>
              {m.sender && <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">{m.sender}</div>}
              <p className="text-sm">{m.content}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={sendMsg} className="p-6 bg-white border-t border-sia-pink-light">
        <div className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="w-full h-14 bg-sia-warm-bg rounded-full px-6 pr-14 focus:outline-none border border-sia-pink-light"
          />
          <button className="absolute right-2 top-2 w-10 h-10 rounded-full bg-sia-pink flex items-center justify-center text-white">
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4 text-center">
          <p className="text-[10px] text-sia-text-muted uppercase tracking-widest opacity-40">This chat self-destructs after completion</p>
        </div>
      </form>
    </motion.div>
  );
};

const ChatSummary = ({
  onOpenChat,
  onHelpReceived,
  currentZone,
  user,
  peerName,
  isRequester
}: {
  onOpenChat: () => void | Promise<void>,
  onHelpReceived: () => void | Promise<void>,
  currentZone?: Zone,
  user?: FirebaseUser | null,
  peerName?: string | null,
  isRequester?: boolean
}) => {
  const [latestNote, setLatestNote] = useState<string | null>(null);

  useEffect(() => {
    if (!currentZone?.center?.lat || !db) return;

    const activeDb = capsuleDb || db;
    const q = query(collection(activeDb, "time_capsules"), orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notes = snapshot.docs.map(doc => doc.data() as TimeCapsuleNote);
      const nearby = notes.filter(note => {
        const dist = getDistanceKm(currentZone.center.lat, currentZone.center.lng, note.lat, note.lng);
        return dist <= 0.3 && note.status === 'APPROVED';
      });

      if (nearby.length > 0) {
        setLatestNote(nearby[0].text);
      } else {
        setLatestNote("Anonymous wisdom, comfort, and survival notes left by women within 300 meters.");
      }
    });

    return () => unsubscribe();
  }, [currentZone, db]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-sia-cream/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="min-h-full p-6 flex flex-col items-center justify-center">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#d81b60 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }} />

        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="w-full max-w-2xl bg-white/90 backdrop-blur-xl rounded-[3rem] p-8 md:p-12 shadow-2xl border border-sia-pink-light flex flex-col items-center text-center relative overflow-hidden shrink-0 my-8"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sia-peach via-sia-pink to-sia-peach" />

          <div className="w-20 h-20 rounded-full bg-sia-pink-light/30 flex items-center justify-center mb-6">
            <MessageCircle className="w-8 h-8 text-sia-pink" />
          </div>

          <h3 className="font-serif italic font-bold text-3xl mb-2 text-sia-text">Session Active</h3>
          <p className="text-sia-text-muted text-sm font-light mb-8 leading-relaxed max-w-md mx-auto">
            Your secure connection is active. You can open the chat or close the session if you've received help.
          </p>

          <div className="w-full bg-sia-cream/40 rounded-[2rem] border border-sia-pink-light/30 p-6 mb-8 text-left">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-sia-pink" />
              <h4 className="font-bold text-sia-text uppercase tracking-widest text-xs">NearHer Wisdom</h4>
            </div>

            <div className="flex flex-col gap-3 bg-white p-6 rounded-2xl border border-sia-pink-light/20 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05]">
                <Heart className="w-12 h-12 text-sia-pink" />
              </div>
              <p className="text-sm font-serif italic text-sia-text leading-relaxed relative z-10">
                "{latestNote || "Loading nearby wisdom..."}"
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] uppercase tracking-widest text-sia-pink font-bold bg-sia-pink/5 px-2 py-1 rounded-full">Nearby Note</span>
                <span className="ml-auto text-[9px] uppercase tracking-widest text-green-500 font-bold bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" /> Secure Session
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-4">
            <button
              onClick={onOpenChat}
              className="w-full h-16 rounded-full bg-sia-pink text-white font-bold uppercase tracking-[0.2em] text-[10px] shadow-lg hover:bg-sia-pink-dark transition-all flex items-center justify-center gap-3"
            >
              <MessageSquare className="w-4 h-4" /> Open Chat
            </button>

            {isRequester && (
              <button
                onClick={onHelpReceived}
                className="w-full h-16 rounded-full bg-white border border-sia-pink-light text-sia-pink font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-sia-pink-light/10 transition-all flex items-center justify-center gap-3"
              >
                <CheckCircle className="w-4 h-4" /> Help Received
              </button>
            )}
          </div>

          {isRequester && (
            <button
              onClick={onHelpReceived}
              className="mt-6 text-[9px] font-bold uppercase tracking-[0.3em] text-sia-text-muted hover:text-red-500 transition-colors flex items-center gap-2 opacity-60 hover:opacity-100"
            >
              <X className="w-3 h-3" /> Cancel Request
            </button>
          )}

          <div className="mt-8 pt-6 border-t border-dashed border-sia-pink-light/50 w-full">
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-sia-text opacity-30">
              <Shield className="w-3 h-3" /> Secure & Anonymous
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};


const SOSModal = ({ onClose, onSelect }: { onClose: () => void, onSelect: (opt: string) => void }) => {
  const options = [
    { id: 'pads', icon: Droplets, title: 'Menstrual Supplies', desc: 'Need sanitary support nearby', accent: 'bg-sia-pink-light', iconColor: 'text-sia-pink' },
    { id: 'pain', icon: Zap, title: 'Pain Relief', desc: 'Looking for quick cramp relief', accent: 'bg-[#F3E5F5]', iconColor: 'text-[#9C27B0]' },
    { id: 'escort', icon: Navigation, title: 'Safe Escort', desc: 'Need someone to walk with you safely', accent: 'bg-[#E8F5E9]', iconColor: 'text-[#2E7D32]' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/10 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full max-w-lg bg-white rounded-t-[3rem] p-8 pb-28 shadow-[0_-10px_50px_rgba(0,0,0,0.1)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-[#FCE4EC] rounded-full mx-auto mb-10" />
        <h3 className="font-serif italic font-bold text-3xl text-center mb-2 text-sia-text">How can we help?</h3>
        <p className="text-sia-text-muted text-center mb-8 px-4 font-light">Your request will be broadcasted anonymously to nearby verified women.</p>

        <div className="grid grid-cols-1 gap-4">
          {options.map((opt) => (
            <motion.button
              key={opt.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(opt.title)}
              className="w-full p-4 rounded-[2.5rem] flex items-center gap-5 text-left border border-sia-pink-light hover:shadow-lg hover:border-sia-pink transition-all bg-white group"
            >
              <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center ${opt.accent} transition-transform group-hover:scale-110`}>
                <opt.icon className={`w-6 h-6 ${opt.iconColor}`} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-800 text-lg leading-tight">{opt.title}</h4>
                <p className="text-sia-text-muted text-sm font-light">{opt.desc}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-sia-pink opacity-30" />
            </motion.button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="absolute top-6 right-8 p-3 rounded-full bg-sia-cream text-sia-pink-light hover:text-sia-pink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </motion.div>
    </motion.div>
  );
};

const WaitingScreen = ({
  onCancel,
  onMatchFound,
  onNoHelpFound,
  currentZone,
  user,
  activeSosId
}: {
  onCancel: () => void | Promise<void>,
  onMatchFound: (helperName: string) => void | Promise<void>,
  onNoHelpFound: () => void | Promise<void>,
  currentZone?: Zone,
  user?: FirebaseUser | null,
  activeSosId?: string | null
}) => {
  const [matchFound, setMatchFound] = useState(false);
  const [helperName, setHelperName] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: () => void;

    const listenForHelper = async () => {
      // Simulate brief "searching" delay for UX
      await new Promise(resolve => setTimeout(resolve, 3000));

      if (!isMounted) return;

      if (!db || !activeSosId) {
        onNoHelpFound();
        return;
      }

      try {
        const docRef = doc(db, "active_sos_alerts", activeSosId);
        unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.status === 'accepted' && data.helper_name) {
              setHelperName(data.helper_name);
              setMatchFound(true);
              // Small delay before automatically transitioning to chat
              setTimeout(() => {
                if (isMounted) onMatchFound(data.helper_name);
              }, 2000);
            }
          }
        });
      } catch (e) {
        console.error("Failed to listen for helper:", e);
        onNoHelpFound();
      }
    };

    listenForHelper();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [activeSosId, onNoHelpFound, onMatchFound]);

  return (
    <div className="min-h-screen pt-32 px-6 flex flex-col items-center bg-sia-cream">
      <div className="relative mb-12">
        <div className="absolute inset-0 w-80 h-80 -left-8 -top-8 border border-sia-pink/10 rounded-full opacity-50" />
        <div className="absolute inset-0 w-64 h-64 border border-sia-pink/20 rounded-full opacity-40" />

        <div className={`w-48 h-48 rounded-full bg-gradient-to-br transition-all duration-700 ${matchFound ? 'from-green-400 to-green-600 scale-110 shadow-[0_20px_60px_rgba(34,197,94,0.3)]' : 'from-sia-peach to-sia-pink shadow-[0_20px_50px_rgba(216,27,96,0.3)] pulsate'} flex flex-col items-center justify-center text-white border-4 border-white/20 z-10 relative`}>
          {matchFound ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center justify-center">
              <Shield className="w-12 h-12 text-white mb-2" />
              <span className="font-bold tracking-widest text-xl">FOUND</span>
            </motion.div>
          ) : (
            <>
              <Sparkles className="w-12 h-12 text-white mb-2" />
              <span className="font-bold tracking-widest text-xl">SIA</span>
            </>
          )}
        </div>

        {!matchFound && [...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 1.2],
              x: Math.random() * 260 - 130,
              y: Math.random() * 260 - 130
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeOut"
            }}
            className="absolute top-1/2 left-1/2"
          >
            <Heart className="w-4 h-4 text-sia-pink fill-sia-pink/20" />
          </motion.div>
        ))}
      </div>

      <h2 className="font-serif italic text-4xl text-center mb-3 text-sia-text">
        {matchFound ? 'Sakhi found!' : 'Finding support...'}
      </h2>
      <p className="text-sia-text-muted text-center mb-8 max-w-sm font-light">
        {matchFound ? 'A nearby sakhi has confirmed she can help.' : 'Connecting you with verified sakhis nearby. Your identity remains private throughout.'}
      </p>

      {!matchFound && (
        <div className="bg-white/40 backdrop-blur-md px-6 py-4 rounded-full flex items-center gap-3 mb-12 border border-sia-pink-light shadow-sm">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-[9px] uppercase tracking-widest font-bold text-sia-text/40">Ephemeral Connection • Verified Support</span>
        </div>
      )}

      {matchFound ? (
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => onMatchFound(helperName)}
          className="w-full max-w-xs h-16 rounded-full bg-green-500 text-white font-bold uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-4 hover:bg-green-600 transition-colors"
        >
          Receive Help <ArrowRight className="w-5 h-5" />
        </motion.button>
      ) : (
        <div className="w-full max-w-xs p-8 rounded-[3rem] border border-dashed border-sia-pink-light bg-white/20 text-center mb-12">
          <Shield className="w-6 h-6 text-sia-pink mx-auto mb-3 opacity-40" />
          <p className="text-[10px] text-sia-text-muted leading-relaxed uppercase tracking-[0.2em] font-bold">Privacy Locked: Location masked</p>
        </div>
      )}

      <div className="flex flex-col gap-4 w-full max-w-xs mt-8">

        <button
          onClick={onCancel}
          className="w-full py-2 text-[10px] text-sia-pink opacity-40 uppercase tracking-widest font-bold hover:opacity-100 transition-opacity"
        >
          {matchFound ? 'Cancel Match' : 'Cancel Request'}
        </button>
      </div>
    </div>
  );
};

const SectionHeading = ({ title, subtitle, className = "" }: { title: string, subtitle: string, className?: string }) => (
  <div className={`text-center mb-12 ${className}`}>
    <h2 className="font-serif italic font-bold text-4xl md:text-5xl text-sia-text mb-4 tracking-tight">{title}</h2>
    <p className="text-sia-text-muted max-w-xl mx-auto font-light leading-relaxed">{subtitle}</p>
  </div>
);

const ChatBubble = ({ message, isSakhi = false }: { message: string, isSakhi?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: "spring", damping: 20, stiffness: 200 }}
    className={`flex ${isSakhi ? 'justify-start' : 'justify-end'} mb-4 px-4`}
  >
    <div className={`max-w-[85%] px-5 py-3 rounded-[1.5rem] shadow-md flex flex-col ${isSakhi
      ? 'bg-white rounded-tl-none text-sia-text border border-sia-pink-light/40'
      : 'bg-sia-pink rounded-br-none text-white shadow-[0_4px_15px_rgba(216,27,96,0.15)]'
      }`}>
      <p className="text-sm leading-relaxed">{message}</p>
      <div className={`text-[8px] font-bold uppercase tracking-tighter mt-2 opacity-40 self-end ${isSakhi ? 'text-sia-text' : 'text-white'}`}>
        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  </motion.div>
);





const formatTimeAgo = (timestamp: number) => {
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const CapsuleCard = ({
  icon: Icon,
  text,
  time,
  category,
  clusterCount,
  thumbsUp,
  thumbsDown,
  userVote,
  onVote
}: any) => (
  <motion.div
    whileHover={{ y: -8, scale: 1.02 }}
    className="p-6 md:p-8 rounded-[2.5rem] md:rounded-[2.8rem] bg-white/60 backdrop-blur-xl border border-sia-pink-light shadow-sm hover:shadow-[0_20px_50px_rgba(216,27,96,0.1)] transition-all relative group"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-sia-pink/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.8rem]" />

    <div className="flex items-start gap-5 relative z-10">
      <div className="w-14 h-14 rounded-2xl bg-sia-pink-light flex items-center justify-center shrink-0 shadow-inner group-hover:bg-sia-pink group-hover:text-white transition-colors duration-500">
        <Icon className="w-6 h-6 text-sia-pink group-hover:text-white transition-colors" />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-sia-pink opacity-50">
            Anonymous Sister
          </span>
          <span className="w-1 h-1 bg-sia-pink/20 rounded-full" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-sia-text/30">
            {time}
          </span>
        </div>

        <p className="text-base text-sia-text leading-relaxed mb-5 font-serif italic">
          “{text}”
        </p>

        <div className="pt-4 border-t border-sia-pink-light/40">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sia-text-muted mb-3">
            Mark 👍 - True &nbsp; 👎 - False
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onVote('up')}
              className={`px-4 py-2 rounded-full border text-xs font-bold transition-all ${userVote === 'up'
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-white border-sia-pink-light text-sia-text-muted hover:text-green-700'
                }`}
            >
              👍 {thumbsUp}
            </button>

            <button
              onClick={() => onVote('down')}
              className={`px-4 py-2 rounded-full border text-xs font-bold transition-all ${userVote === 'down'
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'bg-white border-sia-pink-light text-sia-text-muted hover:text-red-700'
                }`}
            >
              👎 {thumbsDown}
            </button>
          </div>
        </div>
      </div>
    </div>

    {clusterCount > 0 && (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute -top-3 -right-3 px-4 py-2 bg-white border border-sia-pink-light text-sia-pink text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg flex items-center gap-2"
      >
        <div className="w-2 h-2 bg-sia-pink rounded-full animate-ping" />
        {clusterCount} {clusterCount === 1 ? 'woman' : 'women'} shared similar
      </motion.div>
    )}

    <div className="mt-5 text-[9px] font-black uppercase tracking-widest text-sia-pink/40">
      {category}
    </div>
  </motion.div>
);

const TimeCapsulePage = ({
  currentZone,
  user
}: {
  currentZone: Zone;
  user: FirebaseUser | null;
}) => {
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [note, setNote] = useState('');
  const [capsules, setCapsules] = useState<TimeCapsuleNote[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeDb = capsuleDb || db;

  useEffect(() => {
    if (!activeDb) return;

    const unsubscribe = onSnapshot(collection(activeDb, "time_capsules"), (snapshot) => {
      const notes: TimeCapsuleNote[] = [];
      snapshot.forEach((docSnap: any) => {
        notes.push({ id: docSnap.id, ...docSnap.data() } as TimeCapsuleNote);
      });
      setCapsules(
        notes
          .filter((note) => note.status === 'APPROVED')
          .sort((a, b) => b.timestamp - a.timestamp)
      );
    }, (error) => {
      console.error('Failed to load capsules:', error);
    });

    return () => unsubscribe();
  }, [activeDb]);

  const nearbyCapsules = capsules.filter((capsule) => {
    if (!currentZone?.center?.lat || !currentZone?.center?.lng) return false;

    const distanceKm = getDistanceKm(
      currentZone.center.lat,
      currentZone.center.lng,
      capsule.lat,
      capsule.lng
    );

    return distanceKm <= 0.3;
  });

  const groupedCapsules = Object.values(
    nearbyCapsules.reduce((groups, capsule) => {
      const existing = groups[capsule.clusterKey];

      if (!existing) {
        groups[capsule.clusterKey] = {
          representative: capsule,
          count: 1,
          thumbsUp: capsule.thumbsUp || 0,
          thumbsDown: capsule.thumbsDown || 0
        };
        return groups;
      }

      existing.count += 1;
      existing.thumbsUp += capsule.thumbsUp || 0;
      existing.thumbsDown += capsule.thumbsDown || 0;

      if (capsule.timestamp > existing.representative.timestamp) {
        existing.representative = capsule;
      }

      return groups;
    }, {} as Record<string, {
      representative: TimeCapsuleNote;
      count: number;
      thumbsUp: number;
      thumbsDown: number;
    }>)
  ).sort((a, b) => b.representative.timestamp - a.representative.timestamp);

  const handleSubmitCapsule = async () => {
    if (!note.trim()) return;

    if (!activeDb || !user) {
      alert('Please log in before posting a capsule.');
      return;
    }

    if (!currentZone?.center?.lat || !currentZone?.center?.lng) {
      alert('Location is still being detected. Please try again in a moment.');
      return;
    }

    setIsSubmitting(true);

    try {
      const nearbyForAi = nearbyCapsules.map((capsule) => ({
        text: capsule.text,
        clusterKey: capsule.clusterKey
      }));

      const moderation = await moderateTimeCapsuleNote(note, nearbyForAi);

      if (moderation.verdict !== 'APPROVED') {
        alert(moderation.reason || 'This note needs changes before it can be posted.');
        return;
      }

      await addDoc(collection(activeDb, "time_capsules"), {
        originalText: note.trim(),
        text: moderation.safe_summary || note.trim(),
        category: moderation.category || 'Community Wisdom',
        clusterKey: moderation.clusterKey || `capsule-${Date.now()}`,
        userId: user.uid,
        lat: currentZone.center.lat,
        lng: currentZone.center.lng,
        timestamp: Date.now(),
        thumbsUp: 0,
        thumbsDown: 0,
        votes: {},
        status: 'APPROVED'
      });

      setNote('');
      setShowWriteModal(false);
    } catch (error) {
      console.error('Failed to post time capsule:', error);
      alert('Could not post this capsule right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoteCapsule = async (capsule: TimeCapsuleNote, vote: CapsuleVote) => {
    if (!activeDb || !user) return;

    const capsuleRef = doc(activeDb, "time_capsules", capsule.id);

    try {
      await runTransaction(activeDb, async (transaction) => {
        const snap = await transaction.get(capsuleRef);
        if (!snap.exists()) return;

        const data = snap.data() as TimeCapsuleNote;
        const votes = data.votes || {};
        const previousVote = votes[user.uid];

        if (previousVote === vote) return;

        let thumbsUp = data.thumbsUp || 0;
        let thumbsDown = data.thumbsDown || 0;

        if (previousVote === 'up') thumbsUp -= 1;
        if (previousVote === 'down') thumbsDown -= 1;

        if (vote === 'up') thumbsUp += 1;
        if (vote === 'down') thumbsDown += 1;

        if (thumbsDown > 3) {
          transaction.update(capsuleRef, {
            status: 'REJECTED',
            thumbsUp,
            thumbsDown,
            [`votes.${user.uid}`]: vote
          });
          return;
        }

        transaction.update(capsuleRef, {
          thumbsUp,
          thumbsDown,
          [`votes.${user.uid}`]: vote
        });
      });
    } catch (error) {
      console.error('Failed to vote on capsule:', error);
    }
  };

  return (
    <div className="pt-32 px-6 max-w-5xl mx-auto pb-40 relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-sia-pink/5 blur-3xl"
            animate={{
              x: [0, Math.random() * 200 - 100, 0],
              y: [0, Math.random() * 200 - 100, 0],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              width: `${Math.random() * 400 + 100}px`,
              height: `${Math.random() * 400 + 100}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        <SectionHeading
          title="NearHer 💗"
          subtitle="Anonymous wisdom, comfort, and survival notes left by women within 300 meters."
        />

        <div className="flex justify-center mb-16">
          <motion.button
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowWriteModal(true)}
            className="w-full max-w-xl px-6 md:px-10 py-4 md:py-6 rounded-full bg-sia-pink text-white font-bold shadow-[0_20px_50px_rgba(216,27,96,0.3)] flex items-center justify-center gap-4 group overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-sia-peach/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <span className="uppercase tracking-[0.2em] text-[10px] relative z-10">
              Leave A Note
            </span>
            <Heart className="w-5 h-5 fill-white group-hover:animate-bounce relative z-10" />
          </motion.button>
        </div>



        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          {groupedCapsules.length === 0 && (
            <div className="md:col-span-2 p-14 rounded-[3rem] border border-dashed border-sia-pink-light/50 bg-white/40 text-center">
              <p className="font-serif italic text-2xl text-sia-text opacity-40">
                No NearHer notes nearby yet. You can be the first within this 300m circle.
              </p>
            </div>
          )}

          {groupedCapsules.map((group) => {
            const cap = group.representative;
            return (
              <CapsuleCard
                key={cap.clusterKey}
                icon={HeartHandshake}
                text={cap.text}
                time={formatTimeAgo(cap.timestamp)}
                category={cap.category}
                clusterCount={group.count}
                thumbsUp={group.thumbsUp}
                thumbsDown={group.thumbsDown}
                userVote={cap.votes?.[user?.uid || '']}
                onVote={(vote: CapsuleVote) => handleVoteCapsule(cap, vote)}
              />
            );
          })}
        </div>

        <AnimatePresence>
          {showWriteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/10 backdrop-blur-xl flex items-center justify-center p-6"
              onClick={() => setShowWriteModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 30 }}
                className="w-full max-w-2xl bg-white/80 backdrop-blur-2xl p-6 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] border border-white shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sia-peach via-sia-pink to-sia-peach" />

                <button
                  onClick={() => setShowWriteModal(false)}
                  className="absolute top-6 right-6 md:top-10 md:right-10 p-2 md:p-3 rounded-full hover:bg-sia-pink-light/30 text-sia-text/40 hover:text-sia-pink transition-all z-[110]"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                <div className="mb-10">
                  <h3 className="font-serif italic font-bold text-3xl md:text-4xl mb-3 text-sia-text pr-12">
                    Leave a Kindness 💗
                  </h3>
                  <p className="text-sia-text-muted text-sm md:text-base font-light italic">
                    “Women quietly leaving care, comfort, and wisdom for those who follow.”
                  </p>
                </div>

                <div className="space-y-8">
                  <div className="relative">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-sia-pink opacity-50 ml-6 mb-3 block">
                      Your Wisdom
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What helped you during a difficult moment? Share something comforting or useful..."
                      className="w-full h-32 md:h-48 p-6 md:p-10 bg-white/50 rounded-[1.5rem] md:rounded-[2.5rem] border border-sia-pink-light/30 focus:ring-4 focus:ring-sia-pink/5 focus:border-sia-pink/30 focus:outline-none transition-all text-lg md:text-xl font-serif italic text-sia-text resize-none placeholder:text-sia-text/20"
                    />
                  </div>

                  <button
                    onClick={handleSubmitCapsule}
                    disabled={isSubmitting}
                    className="w-full h-20 rounded-full bg-sia-pink text-white font-bold uppercase tracking-[0.3em] text-xs shadow-[0_15px_40px_rgba(216,27,96,0.3)] hover:bg-sia-pink-dark transition-all mt-6 active:scale-95 disabled:opacity-60"
                  >
                    {isSubmitting ? 'Verifying With AI...' : 'Seal in Capsule 💗'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};


// Arin Page - Community Forum
// Arin Page - Community Forum
const ArinCommunityPage = ({
  questions,
  newQuestion,
  setNewQuestion,
  handlePostQuestion,
  onRespond,
  onVoteResponse,
  currentZone,
  responses,
  user

}: {
  questions: Question[],
  newQuestion: string,
  setNewQuestion: (v: string) => void,
  handlePostQuestion: (e: React.FormEvent) => void,
  onRespond: (q: Question) => void,
  onVoteResponse: (response: ArinResponse, vote: CapsuleVote) => void,
  currentZone: Zone,
  responses: ArinResponse[],
  user: FirebaseUser | null

}) => (
  <div className="pt-32 px-6 max-w-5xl mx-auto pb-40">
    <div className="text-center mb-12 md:mb-16">
      <h2 className="font-serif italic font-bold text-5xl md:text-7xl text-sia-text mb-4 tracking-tight">Hub Community</h2>
      <p className="text-sia-text-muted max-w-2xl mx-auto font-light leading-relaxed text-base md:text-lg">
        Anonymous peer-support in your region. Your wisdom stays in your city.
      </p>
    </div>

    {/* Ask Question Box */}
    <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 shadow-sm border border-sia-pink-light/30 mb-16 md:20">
      <form onSubmit={handlePostQuestion} className="space-y-6">
        <textarea
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="What's on your mind? Ask anonymously in your region..."
          className="w-full h-24 md:h-32 p-5 md:p-6 bg-sia-cream/50 rounded-[1.5rem] md:rounded-[2rem] border border-sia-pink-light/20 focus:outline-none focus:ring-2 focus:ring-sia-pink/20 transition-all text-sm md:text-base font-light resize-none placeholder:text-sia-text-muted/40"
        />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sia-text opacity-40">
            <MapPin className="w-4 h-4 text-sia-pink" /> BROADCASTING TO {currentZone.city}
          </div>
          <button
            type="submit"
            className="w-full md:w-auto px-10 py-4 bg-sia-pink text-white rounded-full font-bold uppercase tracking-[0.2em] text-xs shadow-lg hover:bg-sia-pink-dark transition-all hover:scale-105"
          >
            Post Question
          </button>
        </div>
      </form>
    </div>

    {/* Questions List */}
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-8 px-4">
        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-sia-text opacity-30">Questions Nearby</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] text-sia-pink font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-sia-pink rounded-full animate-pulse" />
            Live Updates • {questions.length} total
          </div>
        </div>
      </div>

      {/* Diagnostics log removed for build stability */}

      {questions.filter(q => q.city === currentZone.city).length === 0 && (
        <div className="p-20 text-center bg-white/40 rounded-[3rem] border border-dashed border-sia-pink-light/40">
          <p className="font-serif italic text-2xl text-sia-text opacity-40">Be the first to ask in {currentZone.city}. This space is safe and anonymous.</p>
        </div>
      )}

      {questions.filter(q => q.city === currentZone.city).map((q) => (
        <motion.div
          key={q.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] bg-white border border-sia-pink-light/30 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">Anonymous</span>
            <span className="text-[10px] text-gray-300 font-bold uppercase ml-auto tracking-widest">{q.time}</span>
          </div>
          <h4 className="font-serif italic font-bold text-sia-text text-xl md:text-3xl leading-snug mb-10 group-hover:text-sia-pink transition-colors">“{q.text}”</h4>

          {/* Responses Sub-feed */}
          <div className="space-y-4 mb-8">
            {responses.filter(r => r.question_id === q.id).map(r => (
              <div key={r.id} className={`p-5 rounded-[1.8rem] border relative group/res transition-all ${r.verdict === 'REJECTED' || r.verdict === 'NEEDS_IMPROVEMENT' ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-sia-cream/30 border-sia-pink-light/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-3 h-3 text-sia-pink" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-sia-pink opacity-60">Anonymous Sister</span>
                  <span className="text-[9px] text-gray-300 ml-auto uppercase font-bold">{r.time}</span>
                </div>

                {r.verdict === 'APPROVED' ? (
                  <>
                    <p className="text-sm text-sia-text font-light leading-relaxed">
                      {r.show_original ? r.text : r.safe_summary}
                    </p>
                    <div className="mt-3 flex items-center justify-end gap-3">
                      <button
                        onClick={() => onVoteResponse(r, 'up')}
                        className={`px-4 py-2 rounded-full border text-xs font-bold transition-all ${r.votes?.[user?.uid || ''] === 'up'
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-white border-sia-pink-light text-sia-text-muted hover:text-green-700'
                          }`}
                      >
                        👍 {r.thumbsUp || 0}
                      </button>

                      <button
                        onClick={() => onVoteResponse(r, 'down')}
                        className={`px-4 py-2 rounded-full border text-xs font-bold transition-all ${r.votes?.[user?.uid || ''] === 'down'
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : 'bg-white border-sia-pink-light text-sia-text-muted hover:text-red-700'
                          }`}
                      >
                        👎 {r.thumbsDown || 0}
                      </button>
                    </div>

                  </>
                ) : (
                  <div className="flex items-center gap-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">This response could not be verified for safety</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-8 border-t border-dashed border-sia-pink-light/50">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-sia-pink-light/30">
                <MessageSquare className="w-4 h-4 text-sia-pink" />
              </div>
              <span className="text-xs font-bold text-sia-text-muted uppercase tracking-widest">{q.replies} Replies</span>
            </div>
            <button
              onClick={() => onRespond(q)}
              className="w-full md:w-auto text-[10px] font-bold uppercase tracking-[0.2em] text-sia-pink hover:bg-sia-pink hover:text-white px-8 py-3 rounded-full border border-sia-pink/20 transition-all shadow-sm active:scale-95"
            >
              Respond Anonymously
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const ArinRespondModal = ({
  question,
  onClose,
  onPost,
  input,
  setInput,
  isVerifying
}: {
  question: Question,
  onClose: () => void,
  onPost: (e: React.FormEvent) => void,
  input: string,
  setInput: (v: string) => void,
  isVerifying: boolean
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[150] bg-black/10 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6"
    onClick={onClose}
  >
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      className="w-full max-w-2xl bg-white rounded-t-[3rem] md:rounded-[3rem] p-8 md:p-12 shadow-2xl relative"
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute top-8 right-8 p-3 rounded-full hover:bg-sia-cream text-sia-text/20 hover:text-sia-pink transition-all">
        <X className="w-6 h-6" />
      </button>

      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">Responding to Peer</span>
        </div>
        <h3 className="font-serif italic font-bold text-2xl text-sia-text leading-tight mb-2">“{question.text}”</h3>
        <p className="text-[10px] text-sia-text-muted uppercase tracking-widest font-bold opacity-40">Your response will undergo AI safety verification</p>
      </div>

      <form onSubmit={onPost} className="space-y-6">
        <textarea
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Share your wisdom or comfort anonymously..."
          className="w-full h-40 p-6 md:p-8 bg-sia-cream/40 rounded-[2rem] border border-sia-pink-light/30 focus:outline-none focus:ring-4 focus:ring-sia-pink/5 transition-all text-lg font-light resize-none"
        />
        <button
          type="submit"
          disabled={isVerifying || !input.trim()}
          className="w-full h-16 rounded-full bg-sia-pink text-white font-bold uppercase tracking-[0.2em] text-xs shadow-lg hover:bg-sia-pink-dark transition-all disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Verifying Safety...
            </>
          ) : (
            'Post Anonymous Response'
          )}
        </button>
      </form>
    </motion.div>
  </motion.div>
);

const LocationExplainerModal = ({
  onAllow,
  onManual
}: {
  onAllow: () => void,
  onManual: () => void
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[200] bg-black/20 backdrop-blur-xl flex items-center justify-center p-6"
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="w-full max-w-md bg-white rounded-[3rem] p-10 text-center shadow-2xl border border-sia-pink-light/30"
    >
      <div className="w-20 h-20 bg-sia-pink-light/30 rounded-full flex items-center justify-center mx-auto mb-8">
        <MapPin className="w-10 h-10 text-sia-pink" />
      </div>
      <h3 className="font-serif italic font-bold text-3xl text-sia-text mb-4 tracking-tight">Find Your Hub City</h3>
      <p className="text-sia-text-muted font-light leading-relaxed mb-10">
        Hub connects you with verified sisters in your city — anonymously.
        Your exact location is never stored.
      </p>
      <div className="space-y-4">
        <button
          onClick={onAllow}
          className="w-full py-5 bg-sia-pink text-white rounded-full font-bold uppercase tracking-[0.2em] text-[10px] shadow-lg hover:bg-sia-pink-dark transition-all"
        >
          Allow Location Access
        </button>
        <button
          onClick={onManual}
          className="w-full py-5 border border-sia-pink/20 text-sia-pink rounded-full font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-sia-cream transition-all"
        >
          Choose My City Manually
        </button>
      </div>
    </motion.div>
  </motion.div>
);




export default function App() {
  const firebaseSetupError = firebaseInitError || firebaseDbInitError;
  const [appState, setAppState] = useState<AppState | 'loading'>('loading');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  // Track which SOS alerts have already triggered a pop-up to avoid spamming
  const alertedSOSIds = useRef<Set<string>>(new Set());
  const nativeNotifications = useRef<Record<string, Notification>>({});
  const sessionStartTime = useRef<number>(Date.now());

  // --- PWA Installation Support ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(true); // Always display banner initially for max discoverability
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    // Detect user device for target instructions
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setDeviceType('ios');
    } else if (/android/.test(ua)) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setShowInstallBanner(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    } else {
      // Fallback: show visual manual installation instructions
      setShowInstallGuide(true);
    }
  };

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setAppState('login');
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        sessionStartTime.current = Date.now();
        setAppState('idle');

        // Request notification permission upfront on login
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().then(p => console.log("🔔 Notification permission:", p));
        }
      } else {
        setUser(null);
        setAppState('login');
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Session Monitor (One Active Session Per User) ---
  useEffect(() => {
    if (!user || !db || !auth) return;

    const sessionRef = doc(db, "user_sessions", user.uid);
    const unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const localSessionId = localStorage.getItem('sia_session_id');

        // If the database has a session ID and it doesn't match our local one
        if (data.sessionId && localSessionId && data.sessionId !== localSessionId) {
          console.warn("🔒 Security Alert: Account accessed from another device. Logging out.");
          window.alert("You have been securely logged out because your account was accessed from a new device.");
          localStorage.removeItem('sia_session_id');
          signOut(auth).catch(e => console.error("Auto-logout error:", e));
        }
      }
    });

    return () => unsubscribeSession();
  }, [user]);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [activeView, setActiveView] = useState<AppView>('main');
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'ai', content: "Hello! I'm SIA Wellness AI. How can I help you feel better today?" }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [provider, setProvider] = useState('Groq');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [arinResponses, setArinResponses] = useState<ArinResponse[]>([]);
  const [currentZone, setCurrentZone] = useState<Zone>(() => {
    try {
      const cached = localStorage.getItem('arin_zone');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error("Failed to parse cached zone from localStorage:", e);
    }
    return {
      id: 'initial',
      name: 'Detecting...',
      type: 'city',
      display_name: 'DETECTING...',
      city: 'DETECTING...',
      precise_name: 'DETECTING...',
      center: { lat: 0, lng: 0 },
      radius_km: 0
    };
  });
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [responseInput, setResponseInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [activeSosId, setActiveSosId] = useState<string | null>(null);
  const [isRequester, setIsRequester] = useState(false);
  const [connectedPeerName, setConnectedPeerName] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  // --- Service Worker Message Listener ---
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = async (event: MessageEvent) => {
      console.log('📨 [App] Message from SW:', event.data);
      if (event.data && event.data.type === 'SOS_ACKNOWLEDGED') {
        const sosId = event.data.sosId;
        console.log('✅ [SOS] Acknowledged notification for SOS ID:', sosId);

        if (!user || !db) {
          console.error("Cannot claim SOS: User or DB not initialized.");
          return;
        }

        try {
          // Attempt to claim the SOS using a transaction
          const sosRef = doc(db, "active_sos_alerts", sosId);
          await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(sosRef);
            if (!snap.exists()) {
              throw "SOS Alert does not exist.";
            }

            const data = snap.data();
            if (data.status !== 'searching') {
              throw "Another sister has already responded to this SOS.";
            }

            // Claim it (Anonymous)
            const helperName = 'A verified sister';
            transaction.update(sosRef, {
              status: 'accepted',
              helper_id: user.uid,
              helper_name: helperName
            });

            // Set local state to navigate to chat
            setConnectedPeerName("Sister");
          });

          // If transaction succeeded:
          setIsRequester(false); // We are the HELPER
          setActiveSosId(sosId);
          setAppState('peer-chat');

        } catch (error) {
          console.error("❌ Failed to claim SOS:", error);
          window.alert(error === "Another sister has already responded to this SOS."
            ? error
            : "Failed to connect to the SOS session.");
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [user, db]);

  // --- Firebase Real-time Sync ---
  useEffect(() => {
    if (!db) {
      return;
    }
    console.log("🔥 [Firebase] Connecting to Project:", db.app.options.projectId);

    // Listen for questions
    const qQuery = query(collection(db, "arin_questions"), orderBy("timestamp", "desc"));
    const unsubscribeQuestions = onSnapshot(qQuery, (snapshot) => {
      const source = snapshot.metadata.fromCache ? "Local Cache" : "Live Server";
      console.log(`📨 [Firebase] Received ${snapshot.size} Questions from ${source}`);
      const qs: Question[] = [];
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        qs.push({ id: doc.id, ...data } as Question);
      });
      setQuestions(qs);
    }, (error) => {
      console.error("❌ Firebase Questions Error:", error.code, error.message);
      alert("Firebase Connection Error: " + error.message);
    });

    // Listen for responses
    const rQuery = query(collection(db, "arin_responses"), orderBy("timestamp", "asc"));
    const unsubscribeResponses = onSnapshot(rQuery, (snapshot) => {
      console.log("📨 Received Responses Update:", snapshot.size);
      const rs: ArinResponse[] = [];
      snapshot.forEach((doc: any) => {
        rs.push({ id: doc.id, ...doc.data() } as ArinResponse);
      });
      setArinResponses(rs);
    }, (error) => {
      console.error("❌ Firebase Responses Error:", error.code, error.message);
    });

    // Listen for Active SOS Alerts
    const sosQuery = query(
      collection(db, "active_sos_alerts"),
      where("active", "==", true)
    );
    const unsubscribeSOS = onSnapshot(sosQuery, (snapshot) => {
      // Only process if user is logged in and session is active
      if (!user || appState === 'login') {
        console.log(`⏭️ [SOS] Skipping: user=${!!user}, appState=${appState}`);
        return;
      }

      console.log(`🔔 [SOS Listener] Received update with ${snapshot.size} active alerts, ${snapshot.docChanges().length} changes`);
      snapshot.docChanges().forEach((change: any) => {
        console.log(`📋 [SOS] Change type: ${change.type}, doc: ${change.doc.id}`);
        if (change.type === "added" || change.type === "modified") {
          const alertData = change.doc.data();
          const sosAlert = { id: change.doc.id, ...alertData } as SOSAlert;

          // Filter with detailed logging
          const isOthers = sosAlert.user_id !== user.uid;
          const isRecent = Date.now() - sosAlert.timestamp < 5 * 60 * 1000;
          const isNewForUs = sosAlert.timestamp >= sessionStartTime.current - 5000;
          const alreadyAlerted = alertedSOSIds.current.has(sosAlert.id);
          const hasLocation = currentZone.center.lat !== 0;

          console.log(`🔍 [SOS Filter] Alert ${sosAlert.id}: status=${sosAlert.status}, isOthers=${isOthers}, isRecent=${isRecent}, isNewForUs=${isNewForUs}, alreadyAlerted=${alreadyAlerted}`);

          if (isOthers && isRecent && hasLocation) {
            // If the SOS is no longer active (cancelled or ended), try to close its notification
            if (sosAlert.status !== 'searching' || !sosAlert.active) {
              // Close native fallback notification if it exists
              if (nativeNotifications.current[sosAlert.id]) {
                nativeNotifications.current[sosAlert.id].close();
                delete nativeNotifications.current[sosAlert.id];
                console.log(`✅ [SOS] Closed native notification for tag: ${sosAlert.id}`);
              }

              if (swRegistration?.active) {
                swRegistration.active.postMessage({ type: 'CANCEL_SOS_ALERT', tag: sosAlert.id });
                console.log(`✅ [SOS] Sent CANCEL_SOS_ALERT to SW for tag: ${sosAlert.id}`);
              } else if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                  if (reg.active) {
                    reg.active.postMessage({ type: 'CANCEL_SOS_ALERT', tag: sosAlert.id });
                  }
                });
              }
              return; // Stop processing this change
            }

            // Normal Trigger Logic: If searching and not alerted yet
            if (sosAlert.status === 'searching' && isNewForUs && !alreadyAlerted) {
              const dist = getDistanceKm(currentZone.center.lat, currentZone.center.lng, sosAlert.lat, sosAlert.lng);
              console.log(`📏 [SOS] Distance: ${dist.toFixed(3)} km`);

              if (dist <= 0.5) {
                console.log("🎯 MATCH! Triggering SOS notification for:", sosAlert.id);

                // Mark as alerted IMMEDIATELY to prevent re-triggering
                alertedSOSIds.current.add(sosAlert.id);

                const title = `🚨 SIA ALERT 💗: `;
                const body = `Someone nearby requested ${sosAlert.request_type} support!`;

                console.log(`🔔 [SOS] Notification permission: ${"Notification" in window ? Notification.permission : "NOT_SUPPORTED"}`);

                // Try multiple notification methods for Android compatibility
                const sendNotification = async () => {
                  try {
                    // Method 1: postMessage to our service worker (best Android support)
                    if (swRegistration?.active) {
                      swRegistration.active.postMessage({
                        type: 'SOS_ALERT',
                        title,
                        body,
                        tag: sosAlert.id
                      });
                      console.log("✅ [SOS] Sent via SW postMessage!");
                      return;
                    }

                    // Method 2: Get any active service worker registration
                    if ('serviceWorker' in navigator) {
                      const reg = await navigator.serviceWorker.ready;
                      if (reg.active) {
                        reg.active.postMessage({
                          type: 'SOS_ALERT',
                          title,
                          body,
                          tag: sosAlert.id
                        });
                        console.log("✅ [SOS] Sent via navigator.serviceWorker.ready!");
                        return;
                      }
                    }

                    // Method 3: Direct showNotification (desktop fallback)
                    if ("Notification" in window && Notification.permission === "granted") {
                      const notification = new Notification(title, { body, icon: '/icon.png', tag: sosAlert.id });
                      nativeNotifications.current[sosAlert.id] = notification;

                      notification.onclick = () => {
                        window.focus();
                        notification.close();
                      };

                      console.log("✅ [SOS] Sent via new Notification()");
                      return;
                    }

                    // Method 4: window.alert as last resort
                    window.alert(`${title}\n${body}`);
                    console.log("⚠️ [SOS] Fell back to window.alert");
                  } catch (err) {
                    console.error("❌ [SOS] All notification methods failed:", err);
                    window.alert(`${title}\n${body}`);
                  }
                };

                sendNotification();
              } else {
                console.log(`❌ [SOS] Too far: ${dist.toFixed(3)} km > 0.5 km`);
              }
            }
          }
        }
      });
    }, (error) => {
      console.error("❌ SOS Listener Error:", error);
    });

    return () => {
      unsubscribeQuestions();
      unsubscribeResponses();
      unsubscribeSOS();
    };
  }, [user, currentZone, appState]);

  // --- Monitor Active Session Status (Sync termination for both parties) ---
  useEffect(() => {
    if (!db || !activeSosId || appState === 'finding' || appState === 'login') return;

    const sosRef = doc(db, "active_sos_alerts", activeSosId);
    const unsubscribe = onSnapshot(sosRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (!data.active) {
          console.log("🛑 [Session] Terminated by peer or cancelled.");
          setActiveSosId(null);
          setConnectedPeerName(null);
          setAppState('idle');
          setActiveTab('home');
        }
      } else {
        // Doc deleted or doesn't exist anymore
        console.log("🗑️ [Session] Alert document removed.");
        setActiveSosId(null);
        setConnectedPeerName(null);
        setAppState('idle');
        setActiveTab('home');
      }
    }, (error) => {
      console.error("❌ Session Monitor Error:", error);
    });

    return () => unsubscribe();
  }, [activeSosId, db, appState]);

  // --- Auto-detect Location After Login & 10s Tracking ---
  const updateLocationInFirebase = async (zone: Zone) => {
    if (!user || !db || zone.center.lat === 0) return;
    try {
      // Update location heartbeat
      await setDoc(doc(db, "users_location", user.uid), {
        email: user.email || 'anonymous@sia.com',
        lat: zone.center.lat,
        lng: zone.center.lng,
        timestamp: Date.now(),
        lastSeen: Date.now(),
        active: true
      });

      // Update central user status
      await updateDoc(doc(db, "users", user.uid), {
        active: true,
        lastSeen: Date.now()
      });
    } catch (e) {
      console.error("Failed to update status in Firebase:", e);
    }
  };



  useEffect(() => {
    if (!user || appState === 'login') return;

    // Initial fetch
    getZoneWithCache().then((zone) => {
      if (zone) {
        setCurrentZone(zone);
        updateLocationInFirebase(zone);
      }
    });

    // Setup 10s interval for live tracking
    const interval = setInterval(() => {
      console.log("🔄 Tracking: Fetching latest precise location...");
      getZoneWithCache(true).then((zone) => {
        if (zone) {
          setCurrentZone(zone);
          updateLocationInFirebase(zone);
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [user, appState]);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isTyping]);

  useEffect(() => {
    if (activeTab === 'arin') {
      handleInitialLocation();
    }
  }, [activeTab]);

  const handleInitialLocation = async () => {
    setIsLocating(true);
    const zone = await getZoneWithCache(true);
    if (zone) {
      setCurrentZone(zone);
      updateLocationInFirebase(zone);
    }
    setIsLocating(false);
  };

  const handleAllowLocation = async () => {
    await handleInitialLocation();
  };

  const handleSendMessage = async (msg?: string) => {
    const textToSend = msg || userInput;
    if (!textToSend.trim()) return;

    setIsTyping(true);

    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: textToSend }
    ]);

    if (!msg) setUserInput('');

    try {
      const { reply, provider: activeProvider } = await askSakhiKnows(textToSend, history);

      setHistory(prev => [
        ...prev,
        { role: 'user', content: textToSend },
        { role: 'assistant', content: reply },
      ]);

      setChatMessages(prev => [
        ...prev,
        { role: 'ai', content: reply }
      ]);

      setProvider(activeProvider || 'Unavailable');
    } catch (error) {
      console.error('Sakhi chat error:', error);
      const fallbackReply = 'Sakhi Knows is taking a short break. Please try again in a moment. 💙';

      setChatMessages(prev => [
        ...prev,
        { role: 'ai', content: fallbackReply }
      ]);
      setHistory(prev => [
        ...prev,
        { role: 'user', content: textToSend },
        { role: 'assistant', content: fallbackReply },
      ]);
      setProvider('Unavailable');
    } finally {
      setIsTyping(false);
    }
  };


  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    const activeDb = db;
    if (!activeDb) {
      alert('Firebase is not configured yet. Please add Firebase keys in .env.');
      return;
    }
    const qData = {
      user: 'Anonymous',
      text: newQuestion.trim(),
      time: 'Just now',
      replies: 0,
      zone_id: currentZone.id,
      city: currentZone.city,
      timestamp: Date.now()
    };

    try {
      await addDoc(collection(activeDb, "arin_questions"), qData);
      setNewQuestion('');
    } catch (err) {
      console.error("Firebase error posting question:", err);
    }
  };

  const handlePostResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseInput.trim() || !selectedQuestion) return;
    const activeDb = db;
    if (!activeDb) {
      alert('Firebase is not configured yet. Please add Firebase keys in .env.');
      return;
    }
    setIsVerifying(true);
    // Add a temporary local message to show it's "Verifying"
    const tempResponseId = 'temp-' + Date.now();
    const tempResponse: ArinResponse = {
      id: tempResponseId,
      question_id: selectedQuestion.id,
      text: responseInput,
      time: 'Verifying...',
      verdict: 'APPROVED',
      safe_summary: '',
      show_original: true,
      thumbsUp: 0,
      thumbsDown: 0,
      votes: {},

      timestamp: Date.now()
    };
    setArinResponses(prev => [...prev, tempResponse]);

    try {
      const moderation = await moderateArinResponse(selectedQuestion.text, responseInput);

      // Remove the temp message
      setArinResponses(prev => prev.filter(r => r.id !== tempResponseId));

      if (moderation.verdict !== 'APPROVED') {
        alert("Your response could not be posted: " + (moderation.reason || "Please make the reply more helpful, safe, and specific."));
        setIsVerifying(false);
        return;
      }


      const resData = {
        question_id: selectedQuestion.id,
        text: responseInput,
        time: 'Just now',
        verdict: moderation.verdict,
        safe_summary: moderation.safe_summary || '',
        show_original: moderation.show_original ?? true,
        thumbsUp: 0,
        thumbsDown: 0,
        votes: {},

        timestamp: Date.now()
      };

      await addDoc(collection(activeDb, "arin_responses"), resData);
      // Increment reply count
      const qRef = doc(activeDb, "arin_questions", selectedQuestion.id);
      await updateDoc(qRef, {
        replies: increment(1)
      });

      setResponseInput('');
      setShowRespondModal(false);
    } catch (err) {
      console.error("Moderation or Firebase error:", err);
      alert("Moderation service is busy. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSOSClick = () => {
    setShowSOSModal(true);
  };

  const handleSelectOption = async (option: string) => {
    setShowSOSModal(false);
    setAppState('finding');
    setIsRequester(true); // We are the REQUESTER

    let zoneToUse = currentZone;

    if (zoneToUse.center.lat === 0) {
      console.log("📍 Lat is 0, attempting fast recovery from cache or fresh lookup...");
      const resolvedZone = await getZoneWithCache(false);
      if (resolvedZone && resolvedZone.center.lat !== 0) {
        zoneToUse = resolvedZone;
        setCurrentZone(resolvedZone);
      } else {
        const freshZone = await getZoneWithCache(true);
        if (freshZone && freshZone.center.lat !== 0) {
          zoneToUse = freshZone;
          setCurrentZone(freshZone);
        }
      }
    }

    // Default fallback coordinates if still 0 (e.g. user denied GPS)
    if (zoneToUse.center.lat === 0) {
      console.warn("⚠️ Location remains 0. Falling back to default center for broadcast to prevent failure.");
      zoneToUse = {
        ...zoneToUse,
        center: { lat: 12.9716, lng: 77.5946 } // Default fallback (e.g., Bangalore center) to ensure broadcast works
      };
    }

    // Broadcast SOS Alert to nearby users
    if (db && user) {
      try {
        console.log("🚀 Broadcasting SOS Alert for:", option, "at", zoneToUse.center);
        const docRef = await addDoc(collection(db, "active_sos_alerts"), {
          user_id: user.uid,
          email: user.email || 'anonymous@sia.com',
          name: 'Sister',
          request_type: option,
          lat: zoneToUse.center.lat,
          lng: zoneToUse.center.lng,
          timestamp: Date.now(),
          active: true,
          status: 'searching', // new: true 1-to-1 handshake
          helper_id: null,
          helper_name: 'A verified sister'
        });
        setActiveSosId(docRef.id);
        console.log("✅ Broadcast Successful, SOS ID:", docRef.id);
      } catch (e) {
        console.error("❌ Failed to broadcast SOS alert:", e);
      }
    } else {
      console.warn("⚠️ Cannot broadcast SOS: Missing db or user data", { db: !!db, user: !!user });
    }
  };

  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  const handleMenuNavigate = (view: AppView | 'logout') => {
    if (view === 'logout') {
      setShowLogoutModal(true);
    } else {
      setActiveView(view);
    }
  };

  const handleBackToMain = () => {
    setActiveView('main');
    setActiveTab('home');
  };

  const handleLogout = async () => {
    try {
      if (!auth) {
        setShowLogoutModal(false);
        return;
      }

      // Mark location and user as inactive before logging out
      if (user && db) {
        try {
          const userRef = doc(db, "users", user.uid);
          const locRef = doc(db, "users_location", user.uid);

          await Promise.all([
            updateDoc(userRef, { active: false }),
            deleteDoc(locRef)
          ]);

          console.log("🗑️ User marked as inactive and location removed.");
        } catch (e) {
          console.error("Failed to update location status on logout:", e);
        }
      }

      await signOut(auth);
      setShowLogoutModal(false);
      setAppState('login');
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
      setShowLogoutModal(false);
    }
  };

  if (appState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sia-cream">
        <Loader2 className="w-12 h-12 text-sia-pink animate-spin" />
      </div>
    );
  }

  if (firebaseSetupError) {
    return <FirebaseSetupErrorPage message={firebaseSetupError} />;
  }

  if (appState === 'login') {
    return authView === 'login' ? (
      <LoginPage 
        onLogin={() => setAppState('idle')} 
        onSwitchToSignup={() => setAuthView('signup')} 
        onInstall={handleInstallClick}
        showInstall={showInstallBanner}
      />
    ) : (
      <SignupPage 
        onSignup={() => setAppState('idle')} 
        onSwitchToLogin={() => setAuthView('login')} 
        onInstall={handleInstallClick}
        showInstall={showInstallBanner}
      />
    );
  }
  if (appState === 'peer-chat') {
    return (
      <ChatRoom
        roomId={activeSosId || "room_123"}
        currentUser={user?.uid || "user1"}
        peerName={connectedPeerName}
        isRequester={isRequester}
        onBack={() => setAppState('chat-summary')}
        onEndSession={async () => {
          if (activeSosId && db) {
            try {
              await updateDoc(doc(db, "active_sos_alerts", activeSosId), { active: false });
            } catch (e) {
              console.error("Failed to mark session as inactive:", e);
            }
          }
          setActiveSosId(null);
          setConnectedPeerName(null);
          setAppState('idle');
          setActiveTab('home');
        }}
      />
    );
  }

  if (appState === 'chat-summary') {
    return (
      <ChatSummary
        onOpenChat={() => setAppState('peer-chat')}
        onHelpReceived={async () => {
          if (activeSosId && db) {
            try {
              await updateDoc(doc(db, "active_sos_alerts", activeSosId), { active: false });
            } catch (e) {
              console.error("Failed to close session:", e);
            }
          }
          setActiveSosId(null);
          setConnectedPeerName(null);
          setAppState('idle');
          setActiveTab('home');
        }}
        currentZone={currentZone}
        user={user}
        peerName={connectedPeerName}
        isRequester={isRequester}
      />
    );
  }

  if (appState === 'finding') {
    return (
      <div className="min-h-screen font-sans bg-sia-cream">
        <Navbar activeView={activeView} />
        <WaitingScreen
          onCancel={async () => {
            const sosIdToCancel = activeSosId;

            // 1. Immediately dismiss notifications for helpers
            if (sosIdToCancel) {
              const cancelMsg = { type: 'CANCEL_SOS_ALERT', tag: sosIdToCancel };
              if (swRegistration?.active) {
                swRegistration.active.postMessage(cancelMsg);
              } else if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                  if (reg.active) reg.active.postMessage(cancelMsg);
                });
              }
              // Also close any native desktop fallback
              if (nativeNotifications.current[sosIdToCancel]) {
                nativeNotifications.current[sosIdToCancel].close();
                delete nativeNotifications.current[sosIdToCancel];
              }
            }

            // 2. Mark alert inactive in Firestore
            if (sosIdToCancel && db) {
              try {
                await updateDoc(doc(db, "active_sos_alerts", sosIdToCancel), { active: false, status: 'closed' });
              } catch (e) {
                console.error("Failed to cancel session:", e);
              }
            }

            setActiveSosId(null);
            setConnectedPeerName(null);
            setAppState('idle');
          }}
          onMatchFound={(helperName) => {
            setConnectedPeerName(helperName);
            setAppState('chat-summary');
          }}
          onNoHelpFound={async () => {
            if (activeSosId && db) {
              try {
                await updateDoc(doc(db, "active_sos_alerts", activeSosId), { active: false });
              } catch (e) {
                console.error("Failed to close session on timeout:", e);
              }
            }
            setActiveSosId(null);
            window.alert("No available help found nearby right now.");
            setAppState('idle');
            setActiveTab('home');
          }}
          currentZone={currentZone}
          user={user}
          activeSosId={activeSosId}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-sia-cream selection:bg-sia-pink-light overflow-x-hidden pb-32">
      <Navbar
        showBack={activeView !== 'main' || activeTab !== 'home'}
        onBack={activeView !== 'main' ? handleBackToMain : () => setActiveTab('home')}
        onProfile={handleProfileClick}
        activeView={activeView}
      />

      <AnimatePresence>
        {showProfileMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[105] bg-transparent"
              onClick={() => setShowProfileMenu(false)}
            />
            <ProfileMenu
              onClose={() => setShowProfileMenu(false)}
              onNavigate={handleMenuNavigate}
            />
          </>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeView === 'profile' && (
          <motion.div
            key="profile-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ProfilePage currentZone={currentZone} user={user} />
          </motion.div>
        )}

        {activeView === 'settings' && (
          <motion.div
            key="settings-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SettingsPage onInstall={handleInstallClick} showInstall={true} />
          </motion.div>
        )}

        {activeView === 'main' && (
          <>
            {activeTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {/* Hero Section */}
                <section id="hero" className="relative pt-40 pb-20 px-6 overflow-hidden min-h-[90vh] flex flex-col justify-center">
                  {/* Background decorations */}
                  <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-sia-pink-light/30 rounded-full blur-[120px] -mr-60 -mt-60" />
                  <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-sia-pink-light/20 rounded-full blur-[100px] -ml-60 -mb-60" />

                  <div className="max-w-6xl mx-auto w-full relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-20">
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="flex-1 text-center lg:text-left space-y-8"
                      >
                        <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white border border-sia-pink-light text-sia-pink text-[10px] uppercase font-bold tracking-[0.2em] shadow-sm">
                          <Shield className="w-3 h-3" /> Anonymous Peer Network
                        </div>
                        <h1 className="font-serif italic font-bold text-7xl md:text-9xl text-sia-text !leading-[0.85] tracking-tight">
                          You’re not<br /> <span className="text-sia-pink">alone</span>
                        </h1>
                        <p className="text-lg md:text-2xl text-sia-text-muted max-w-xl mx-auto lg:mx-0 font-light leading-relaxed">
                          Private support during period emergencies — without the discomfort of asking.
                        </p>
                      </motion.div>

                      {/* SOS Button Area */}
                      <div className="flex-1 flex flex-col items-center justify-center relative">

                        <div className="absolute w-[30rem] h-[30rem] border border-sia-pink/5 rounded-full animate-pulse" />
                        <div className="absolute w-[24rem] h-[24rem] border border-sia-pink/10 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />

                        <div className="relative">
                          <motion.button
                            id="sos-button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleSOSClick}
                            className="relative w-64 h-64 md:w-80 md:h-80 rounded-full bg-gradient-to-br from-sia-peach to-sia-pink shadow-[0_20px_60px_rgba(216,27,96,0.4)] flex flex-col items-center justify-center text-white border-[10px] border-white group z-10"
                          >
                            <Heart className="w-12 h-12 text-white mb-4 fill-white animate-bounce" />
                            <span className="font-bold text-5xl md:text-6xl tracking-[0.2em] drop-shadow-md">HELP</span>
                            <div className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </motion.button>

                          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-full text-center">
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-sia-pink opacity-40">Tap to request support anonymously</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Custom PWA Install Banner */}
                <AnimatePresence>
                  {showInstallBanner && (
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="max-w-6xl mx-auto px-6 mb-12"
                    >
                      <div className="glass p-8 md:p-10 rounded-[3rem] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 border border-white shadow-2xl">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-sia-peach via-sia-pink to-sia-peach" />
                        
                        <div className="flex items-center gap-6 text-center md:text-left flex-col md:flex-row">
                          <div className="w-16 h-16 rounded-2xl bg-sia-pink/10 text-sia-pink flex items-center justify-center shrink-0 shadow-inner">
                            <Sparkles className="w-8 h-8 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="font-serif italic font-bold text-2xl text-sia-text">Install SIA on Your Device</h3>
                            <p className="text-sia-text-muted text-sm font-light leading-relaxed mt-1">
                              Access your anonymous menstrual support sanctuary directly from your desktop or phone home screen. Works completely offline!
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 w-full md:w-auto shrink-0 justify-center">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleInstallClick}
                            className="px-8 h-14 bg-sia-pink text-white rounded-full font-bold uppercase tracking-[0.2em] text-[10px] shadow-lg hover:bg-sia-pink-dark transition-all flex items-center gap-2"
                          >
                            Install Now <ArrowRight className="w-3.5 h-3.5" />
                          </motion.button>
                          
                          <button
                            onClick={() => setShowInstallBanner(false)}
                            className="w-14 h-14 rounded-full bg-sia-warm-bg border border-sia-pink-light text-sia-text-muted hover:text-sia-pink transition-colors flex items-center justify-center shrink-0"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mission & Impact moved here */}
                <section id="mission" className="py-32 px-6">
                  <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
                    <div className="flex-[1.5] p-12 md:p-20 bg-white border border-sia-pink-light rounded-[3rem] relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 transition-transform group-hover:rotate-0">
                        <Heart className="w-64 h-64 text-sia-pink fill-sia-pink" />
                      </div>
                      <h2 className="font-serif italic font-bold text-5xl md:text-6xl mb-12 text-sia-text leading-tight">The Power of<br />Solidarity</h2>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                        <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300 }}>
                          <div className="text-7xl font-display font-semibold text-sia-pink mb-4 tracking-tighter">175M+</div>
                          <p className="text-sia-text-muted font-bold leading-relaxed uppercase tracking-[0.2em] text-[10px] opacity-60">Women face monthly emergencies in India</p>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300 }}>
                          <div className="text-7xl font-display font-semibold text-sia-pink mb-4 tracking-tighter">Instant</div>
                          <p className="text-sia-text-muted font-bold leading-relaxed uppercase tracking-[0.2em] text-[10px] opacity-60">Anonymous help available with just one tap</p>
                        </motion.div>
                      </div>

                      <div className="mt-16 pt-16 border-t border-dashed border-sia-pink-light">
                        <p className="text-2xl font-serif italic text-sia-text-muted mb-8 italic">"Because asking shouldn't be the hardest part."</p>
                        <div className="flex items-center gap-4">
                          <div className="flex -space-x-4">
                            {[1, 2, 3, 4].map(i => (
                              <div key={i} className="w-12 h-12 rounded-full border-4 border-white bg-sia-warm-bg overflow-hidden shadow-sm">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=sister${i}`} alt="user" />
                              </div>
                            ))}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-sia-text opacity-40">Verified Support Network</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-8">
                      <div className="flex-1 p-10 bg-sia-warm-bg border border-sia-pink-light rounded-[3rem] flex flex-col justify-center">
                        <Shield className="w-10 h-10 text-sia-pink mb-6 opacity-30" />
                        <h3 className="font-bold text-xl mb-4 text-sia-text uppercase tracking-widest">Our Mission</h3>
                        <p className="text-sia-text-muted font-light text-sm leading-relaxed">
                          SIA creates a dignified path to support. By anonymizing the request and masking the location, we dissolve the social friction that prevents women from getting help when they need it most.
                        </p>
                      </div>

                      <div className="flex-1 p-10 bg-sia-pink text-white rounded-[3rem] flex flex-col justify-center relative overflow-hidden group">
                        <Sparkles className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10" />
                        <h3 className="font-bold text-xl mb-4 uppercase tracking-widest">Flash Wisdom</h3>
                        <p className="text-white/80 font-light text-sm leading-relaxed mb-4">
                          "Self-care is how you take your power back." - Quick wellness insights powered by Sakhi.
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-12 bg-white/30 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ x: "-100%" }}
                              animate={{ x: "100%" }}
                              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                              className="h-full w-full bg-white"
                            />
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">Daily Insight</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {activeTab === 'arin' && (
              <motion.div
                key="arin"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ArinCommunityPage
                  questions={questions}
                  newQuestion={newQuestion}
                  setNewQuestion={setNewQuestion}
                  handlePostQuestion={handlePostQuestion}
                  onRespond={(q) => {
                    setSelectedQuestion(q);
                    setShowRespondModal(true);
                  }}
                  onVoteResponse={(response, vote) => {
                    const userId = user?.uid || '';
                    const previousVote = response.votes?.[userId];

                    // Calculate new counts
                    let newThumbsUp = response.thumbsUp || 0;
                    let newThumbsDown = response.thumbsDown || 0;

                    // Remove previous vote if any
                    if (previousVote === 'up') newThumbsUp = Math.max(0, newThumbsUp - 1);
                    if (previousVote === 'down') newThumbsDown = Math.max(0, newThumbsDown - 1);

                    // Add new vote
                    if (vote === 'up') newThumbsUp += 1;
                    if (vote === 'down') newThumbsDown += 1;

                    // Update local state
                    setArinResponses(prev => prev.map(r =>
                      r.id === response.id ? {
                        ...r,
                        votes: { ...r.votes, [userId]: vote },
                        thumbsUp: newThumbsUp,
                        thumbsDown: newThumbsDown
                      } : r
                    ));

                    // Persist to Firebase
                    const rRef = doc(db, "arin_responses", response.id);
                    updateDoc(rRef, {
                      thumbsUp: newThumbsUp,
                      thumbsDown: newThumbsDown,
                      votes: { ...(response.votes || {}), [userId]: vote }
                    }).catch(err => console.error("Error voting:", err));
                  }}
                  currentZone={currentZone}
                  responses={arinResponses}
                  user={user}
                />
              </motion.div>
            )}

            {activeTab === 'capsule' && (
              <motion.div
                key="capsule"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <TimeCapsulePage currentZone={currentZone} user={user} />

              </motion.div>
            )}

            {activeTab === 'sakhi' && (
              <motion.div
                key="sakhi"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-sia-cream flex flex-col pt-20 pb-20"
              >
                <div className="flex-1 w-full flex flex-col bg-white/40 backdrop-blur-sm overflow-hidden relative">
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#d81b60 0.8px, transparent 0.8px)', backgroundSize: '30px 30px' }} />

                  {/* Header - Integrated with SIA Branding */}
                  <div className="flex items-center justify-between p-4 md:p-8 bg-white/80 backdrop-blur-md border-b border-sia-pink-light/30 z-10">
                    <div className="flex items-center gap-6">
                      <motion.div
                        animate={{ rotate: [0, 15, -15, 0] }}
                        transition={{ repeat: Infinity, duration: 4 }}
                        className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sia-peach to-sia-pink flex items-center justify-center shadow-xl"
                      >
                        <Sparkles className="w-8 h-8 text-white" />
                      </motion.div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl font-bold text-sia-pink font-serif italic tracking-tighter">SIA</span>
                          <span className="text-sia-text/20">|</span>
                          <h4 className="font-bold text-sia-text text-base uppercase tracking-widest">Wellness AI</h4>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-green-500">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          Secure Session Active
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-3">
                      <div className="px-6 py-2.5 rounded-full bg-sia-pink/5 border border-sia-pink/10 text-[10px] font-bold text-sia-pink uppercase tracking-[0.2em] shadow-sm">
                        Private & Secure Session
                      </div>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div
                    ref={chatContainerRef}
                    className="flex-1 space-y-8 overflow-y-auto scrollbar-hide px-4 md:px-12 py-10 relative z-0"
                  >
                    <AnimatePresence mode="popLayout">
                      {chatMessages.map((msg, i) => (
                        <ChatBubble key={i} isSakhi={msg.role === 'ai'} message={msg.content} />
                      ))}
                    </AnimatePresence>

                    {isTyping && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex justify-start mb-4 px-4"
                      >
                        <div className="bg-white/90 backdrop-blur-sm px-8 py-5 rounded-[2rem] rounded-tl-none border border-sia-pink-light/30 flex items-center gap-4 shadow-sm">
                          <div className="flex gap-1.5">
                            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-2 h-2 bg-sia-pink rounded-full" />
                            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-sia-pink rounded-full" />
                            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-sia-pink rounded-full" />
                          </div>
                          <span className="text-[10px] text-sia-text-muted font-bold uppercase tracking-[0.3em]">Sakhi is reflecting...</span>
                        </div>
                      </motion.div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 md:p-6 bg-white/90 backdrop-blur-md border-t border-sia-pink-light/30 z-10">
                    <form
                      className="relative max-w-4xl mx-auto"
                      onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                    >
                      <motion.div
                        whileFocus={{ scale: 1.01 }}
                        className="relative flex items-center"
                      >
                        <input
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          placeholder="Ask Sakhi something..."
                          disabled={isTyping}
                          className="w-full bg-sia-warm-bg border border-sia-pink-light/40 h-12 md:h-14 rounded-full px-6 pr-16 focus:outline-none focus:border-sia-pink focus:ring-4 focus:ring-sia-pink/5 shadow-inner transition-all disabled:opacity-50 text-sm md:text-base font-light placeholder:text-sia-text/30"
                        />
                        <motion.button
                          type="submit"
                          disabled={isTyping || !userInput.trim()}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-sia-pink flex items-center justify-center text-white shadow-lg hover:bg-sia-pink-dark transition-all disabled:bg-gray-200 disabled:shadow-none"
                        >
                          <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                        </motion.button>
                      </motion.div>
                      <div className="flex items-center justify-center gap-2 mt-3 text-[8px] font-bold uppercase tracking-[0.2em] text-sia-text opacity-30">
                        <Shield className="w-2.5 h-2.5" /> Sakhi provides wellness support, not medical advice.
                      </div>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {activeView === 'main' && (
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      {/* Footer Look-alike from design */}
      <footer className="h-16 bg-white border-t border-sia-pink-light px-10 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sia-text opacity-40">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Searching for support within ~300m
        </div>
        <div className="text-[10px] font-bold text-sia-pink opacity-40 italic font-serif">Created with care for her dignity and safety</div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {showSOSModal && (
          <SOSModal
            onClose={() => setShowSOSModal(false)}
            onSelect={handleSelectOption}
          />
        )}
        {showLogoutModal && (
          <LogoutModal
            onClose={() => setShowLogoutModal(false)}
            onLogout={handleLogout}
          />
        )}
        {showRespondModal && selectedQuestion && (
          <ArinRespondModal
            question={selectedQuestion}
            onClose={() => setShowRespondModal(false)}
            onPost={handlePostResponse}
            input={responseInput}
            setInput={setResponseInput}
            isVerifying={isVerifying}
          />
        )}
        <InstallGuideModal
          isOpen={showInstallGuide}
          onClose={() => setShowInstallGuide(false)}
          device={deviceType}
        />
      </AnimatePresence>
    </div>
  );
}
