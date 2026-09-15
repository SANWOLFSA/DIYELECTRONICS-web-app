import type React from 'react';
import { useState } from 'react';
import {
  Wrench,
  Shield,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Zap,
  Cpu,
  Leaf,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { UserProfile } from '../types';
import { DEFAULT_USER } from '../services/cacheService';

interface AuthPageProps {
  onLoginSuccess: (user: UserProfile) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function AuthPage({ onLoginSuccess, darkMode, onToggleDarkMode }: AuthPageProps) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [method, setMethod] = useState<'phone' | 'email'>('phone');

  // Phone states
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpResendTimer, setOtpResendTimer] = useState(30);

  // Email & password states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userRole, setUserRole] = useState<'Technician' | 'Student' | 'Shop Owner'>('Technician');
  const [companyName, setCompanyName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // General feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Handle Phone flow
  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!phoneNumber.trim() || phoneNumber.length < 7) {
      setErrorMessage('Please provide a valid phone number with area code.');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setOtpStep(true);
      setOtpResendTimer(30);
    }, 600);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (otpCode.length < 4) {
      setErrorMessage('Please enter the 4-digit code (use demo code: 4821).');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const user: UserProfile = {
        ...DEFAULT_USER,
        id: `usr_phone_${Date.now()}`,
        name: fullName.trim() || (authMode === 'signup' ? 'Registered Technician' : 'Alex Vance'),
        phoneNumber: `${countryCode} ${phoneNumber}`,
        email: email.trim() || `tech_${phoneNumber.slice(-4)}@sms.diyelectronics.org`,
        authProvider: 'phone',
        role: userRole,
      };
      completeAuth(user);
    }, 700);
  };

  // Handle Email flow
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (authMode === 'signup' && !agreedToTerms) {
      setErrorMessage('You must agree to the Right-to-Repair and Safety standards.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const user: UserProfile = {
        ...DEFAULT_USER,
        id: `usr_email_${Date.now()}`,
        name: fullName.trim() || (authMode === 'signup' ? email.split('@')[0] : 'Alex Vance'),
        email: email.trim(),
        authProvider: 'email',
        role: userRole,
        companyName: userRole === 'Shop Owner' ? companyName || 'Apex Repair Lab' : undefined,
      };
      completeAuth(user);
    }, 700);
  };

  // Handle Social Providers
  const handleSocialAuth = (provider: 'google' | 'facebook') => {
    setErrorMessage('');
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const isGoogle = provider === 'google';
      const user: UserProfile = {
        ...DEFAULT_USER,
        id: `usr_${provider}_${Date.now()}`,
        name: isGoogle ? 'Alex Vance' : 'Jordan Chen',
        email: isGoogle ? 'alex.vance@gmail.com' : 'jordan.chen@techmail.com',
        authProvider: provider,
        role: 'Technician',
      };
      completeAuth(user);
    }, 700);
  };

  // Quick Demo Access
  const handleDemoAccess = () => {
    setErrorMessage('');
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      completeAuth(DEFAULT_USER);
    }, 400);
  };

  const completeAuth = (user: UserProfile) => {
    setSuccessNotice(`Authentication successful. Loading bench for ${user.name}...`);
    setTimeout(() => {
      onLoginSuccess(user);
    }, 600);
  };

  return (
    <div 
      className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between transition-colors relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/assets/diy-electronics-bg.jpg')" }}
    >
      {/* Background Dimming & Blur Overlay for optimal readability */}
      <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-[2px] pointer-events-none" />
      
      {/* Top Bar with Brand & Theme Switcher */}
      <header className="w-full border-b border-stone-800/80 bg-stone-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shadow-md">
              <Wrench className="w-5 h-5 text-stone-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tight text-stone-950 dark:text-amber-400">
                  DIYELECTRONICS
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-stone-950 uppercase tracking-wider">
                  AUTH GATE
                </span>
              </div>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold hidden sm:block">
                Open Hardware & Electronics Self-Repair Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 transition-colors flex items-center gap-2 text-xs font-semibold"
              aria-label="Toggle Theme"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-stone-700" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>

            <button
              onClick={handleDemoAccess}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Zap className="w-3.5 h-3.5 fill-stone-950" />
              <span>Instant Demo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex items-center justify-center relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-stretch">
          
          {/* Left Column: Showcase & Benefits */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6 bg-stone-900 text-stone-100 rounded-3xl p-6 sm:p-10 border border-stone-800 shadow-xl relative overflow-hidden">
            {/* Background glowing circuit pattern accents */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-4 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Technician Sign In Required to Enter</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                Empowering the <span className="text-amber-400">Right to Repair</span>
              </h1>

              <p className="text-sm sm:text-base text-stone-300 leading-relaxed">
                Sign in to unlock professional diagnostic tools, interactive circuit simulators, verified replacement parts, and peer-reviewed motherboard repair guides.
              </p>
            </div>

            {/* Feature Highlights Bento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 relative z-10 my-4">
              <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700/80 space-y-1.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black uppercase text-stone-100 tracking-wider">AI Diagnostic Engine</h2>
                <p className="text-[11px] text-stone-400">Multimeter probe coordinates, voltage rail checks, and root cause pinpointing.</p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700/80 space-y-1.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black uppercase text-stone-100 tracking-wider">Interactive Circuit Lab</h2>
                <p className="text-[11px] text-stone-400">Real-time Ohm&apos;s law calculations, load testing, and virtual breadboarding.</p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700/80 space-y-1.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black uppercase text-stone-100 tracking-wider">Verified Parts Trading</h2>
                <p className="text-[11px] text-stone-400">Zero counterfeit ICs. Sellers hold vetted commercial business registrations.</p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700/80 space-y-1.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-400/20 text-emerald-400 flex items-center justify-center">
                  <Leaf className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black uppercase text-stone-100 tracking-wider">E-Waste Prevention</h2>
                <p className="text-[11px] text-stone-400">Live tracker measuring kilograms of electronics diverted from toxic landfills.</p>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="pt-4 border-t border-stone-800 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-400 relative z-10">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400" />
                <span>100% Free & Open Hardware</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400" />
                <span>Offline Caching Support</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400" />
                <span>Community Audited</span>
              </div>
            </div>
          </div>

          {/* Right Column: Sign In / Sign Up Form Card */}
          <div className="lg:col-span-6 bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-xl flex flex-col justify-between">
            
            <div>
              {/* Tab Switcher: Sign In vs Sign Up */}
              <div className="flex rounded-2xl bg-stone-100 dark:bg-stone-800 p-1.5 mb-6">
                <button
                  onClick={() => {
                    setAuthMode('signin');
                    setErrorMessage('');
                    setOtpStep(false);
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                    authMode === 'signin'
                      ? 'bg-amber-400 text-stone-950 shadow-sm'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  <span>Sign In to Workbench</span>
                </button>
                <button
                  onClick={() => {
                    setAuthMode('signup');
                    setErrorMessage('');
                    setOtpStep(false);
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                    authMode === 'signup'
                      ? 'bg-amber-400 text-stone-950 shadow-sm'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  <span>Create Account</span>
                </button>
              </div>

              {/* Title & Subtitle */}
              <div className="mb-6">
                <h2 className="text-2xl font-black text-stone-900 dark:text-stone-100">
                  {authMode === 'signin' ? 'Welcome Back, Technician' : 'Join DIYELECTRONICS'}
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
                  {authMode === 'signin'
                    ? 'Authenticate to access your diagnostic logs, saved teardowns, and circuit tests.'
                    : 'Create your technician profile to save offline guides, take certification exams, and post repair tips.'}
                </p>
              </div>

              {/* Feedback messages */}
              {errorMessage && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successNotice && (
                <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 animate-pulse" />
                  <span className="font-bold">{successNotice}</span>
                </div>
              )}

              {/* Fast Social Sign In Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => handleSocialAuth('google')}
                  disabled={isSubmitting}
                  className="py-2.5 px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-xs"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Google Mail</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSocialAuth('facebook')}
                  disabled={isSubmitting}
                  className="py-2.5 px-3.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-xs"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span>Facebook</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center mb-5">
                <div className="w-full border-t border-stone-200 dark:border-stone-800" />
                <span className="absolute px-3 bg-white dark:bg-stone-900 text-[11px] font-mono text-stone-400 uppercase tracking-wider">
                  Or use phone / email
                </span>
              </div>

              {/* Sub-method switcher: Phone vs Email */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setMethod('phone');
                    setOtpStep(false);
                    setErrorMessage('');
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    method === 'phone'
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-stone-900 dark:text-amber-300'
                      : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5 text-amber-500" />
                  <span>Phone (SMS OTP)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMethod('email');
                    setErrorMessage('');
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    method === 'email'
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-stone-900 dark:text-amber-300'
                      : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-amber-500" />
                  <span>Email & Password</span>
                </button>
              </div>

              {/* Form Mode 1: Phone Authentication */}
              {method === 'phone' && (
                <div>
                  {!otpStep ? (
                    <form onSubmit={handleSendOtp} className="space-y-3.5">
                      {authMode === 'signup' && (
                        <div>
                          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                            Your Name
                          </label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="e.g. Jordan Smith"
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </div>
                      )}

                      {authMode === 'signup' && (
                        <div>
                          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                            Primary Technician Role
                          </label>
                          <select
                            value={userRole}
                            onChange={(e) => setUserRole(e.target.value as 'Technician' | 'Student' | 'Shop Owner')}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          >
                            <option value="Technician">Workbench Repair Technician</option>
                            <option value="Student">Electronics Student / Apprentice</option>
                            <option value="Shop Owner">Electronics Repair Business & Parts Trader</option>
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                          Mobile Phone Number
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="px-2.5 py-2.5 rounded-xl text-xs font-mono bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                          >
                            <option value="+1">US/CA (+1)</option>
                            <option value="+44">UK (+44)</option>
                            <option value="+49">DE (+49)</option>
                            <option value="+33">FR (+33)</option>
                            <option value="+81">JP (+81)</option>
                            <option value="+61">AU (+61)</option>
                            <option value="+91">IN (+91)</option>
                            <option value="+27">ZA (+27)</option>
                          </select>
                          <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="(555) 234-5678"
                            required
                            className="flex-1 px-3.5 py-2.5 rounded-xl text-xs font-mono bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </div>
                        <p className="text-[11px] text-stone-400 mt-1">
                          We will send a 4-digit SMS verification code to verify your bench station.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
                      >
                        <span>{isSubmitting ? 'Sending SMS...' : 'Send SMS Verification Code'}</span>
                        <ArrowRight className="w-4 h-4 stroke-[3]" />
                      </button>
                    </form>
                  ) : (
                    /* OTP Verification Sub-step */
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center space-y-1">
                        <p className="text-xs text-stone-700 dark:text-stone-300">
                          Verification code dispatched to:
                        </p>
                        <p className="font-mono font-bold text-sm text-stone-900 dark:text-amber-400">
                          {countryCode} {phoneNumber}
                        </p>
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 pt-1">
                          (Quick Demo Code: <button type="button" onClick={() => setOtpCode('4821')} className="underline font-bold font-mono">4821</button>)
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1 text-center">
                          Enter 4-Digit SMS Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="4821"
                          autoFocus
                          required
                          className="w-full text-center tracking-widest text-2xl font-mono py-3 rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-stone-500">
                        <button
                          type="button"
                          onClick={() => setOtpStep(false)}
                          className="text-stone-600 dark:text-stone-400 hover:underline"
                        >
                          ← Change phone number
                        </button>
                        <span>Resend in {otpResendTimer}s</span>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
                      >
                        <span>{isSubmitting ? 'Verifying Code...' : 'Verify Code & Enter App'}</span>
                        <ArrowRight className="w-4 h-4 stroke-[3]" />
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Form Mode 2: Email & Password */}
              {method === 'email' && (
                <form onSubmit={handleEmailSubmit} className="space-y-3.5">
                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Alex Vance"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  )}

                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                        Select Your Technician Profile Role
                      </label>
                      <select
                        value={userRole}
                        onChange={(e) => setUserRole(e.target.value as 'Technician' | 'Student' | 'Shop Owner')}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="Technician">Electronics Repair Technician</option>
                        <option value="Student">Electronics Student / Apprentice</option>
                        <option value="Shop Owner">Commercial Repair Shop / Parts Supplier</option>
                      </select>
                    </div>
                  )}

                  {authMode === 'signup' && userRole === 'Shop Owner' && (
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                        Registered Business / Shop Name
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Silicon Valley Micro-Soldering Ltd."
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="technician@diyelectronics.org"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        Password
                      </label>
                      {authMode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => alert('For this demo, any password with 6+ characters or Instant Demo will log you in.')}
                          className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {authMode === 'signup' && (
                    <label className="flex items-start gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-0.5 rounded text-amber-500 focus:ring-amber-400"
                      />
                      <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
                        I pledge adherence to lithium-ion thermal safety protocols and support the global Right to Repair.
                      </span>
                    </label>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
                  >
                    <span>{authMode === 'signin' ? 'Sign In & Enter App' : 'Complete Registration'}</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </button>
                </form>
              )}

            </div>

            {/* Bottom Demo Access Card */}
            <div className="mt-8 pt-5 border-t border-stone-100 dark:border-stone-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-400 text-stone-950 flex items-center justify-center shrink-0 font-black">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-stone-900 dark:text-stone-100">
                      Want to test immediately?
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Bypass typing with one-click Master Technician demo access.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDemoAccess}
                  className="px-4 py-2 rounded-xl bg-stone-950 text-white dark:bg-amber-400 dark:text-stone-950 hover:opacity-90 font-bold text-xs whitespace-nowrap transition-all shadow-xs shrink-0 text-center"
                >
                  Enter as Demo Tech
                </button>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-stone-800/80 py-4 bg-stone-900/60 backdrop-blur-md text-center text-xs text-stone-400 relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 DIYELECTRONICS Open Hardware Foundation. All schematics & guides community audited.</span>
          <span className="font-mono text-[11px] text-amber-400 font-bold">
            Zero E-Waste • Genuine Tested Components • Right-to-Repair
          </span>
        </div>
      </footer>

    </div>
  );
}
