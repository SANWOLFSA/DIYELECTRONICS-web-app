import type React from 'react';
import { useState } from 'react';
import { X, Phone, Mail, ShieldCheck, Wrench, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../types';
import { CacheService, DEFAULT_USER } from '../services/cacheService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onLoginSuccess: (user: UserProfile) => void;
  onSignOut?: () => void;
}

export default function AuthModal({ isOpen, onClose, currentUser, onLoginSuccess, onSignOut }: AuthModalProps) {
  const [authMethod, setAuthMethod] = useState<'options' | 'phone' | 'email'>('options');
  const [phoneNumber, setPhoneNumber] = useState('+1 ');
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpStep) {
      if (phoneNumber.length < 8) return;
      setIsSubmitting(true);
      setTimeout(() => {
        setIsSubmitting(false);
        setOtpStep(true);
      }, 600);
    } else {
      if (otpCode.length < 4) return;
      completeLogin({
        ...currentUser,
        id: `usr_phone_${Date.now()}`,
        name: fullName || 'DIY Tech ' + phoneNumber.slice(-4),
        phoneNumber: phoneNumber,
        email: `${phoneNumber.replace(/[^0-9]/g, '')}@sms.diyelectronics.org`,
        authProvider: 'phone',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      });
    }
  };

  const handleSocialLogin = (provider: 'google' | 'facebook') => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const isGoogle = provider === 'google';
      completeLogin({
        ...currentUser,
        id: `usr_${provider}_${Date.now()}`,
        name: isGoogle ? 'Alex Vance' : 'Marcus Vance',
        email: isGoogle ? 'alex.vance@gmail.com' : 'marcus.repair@facebook.com',
        authProvider: provider,
        avatar: isGoogle
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      });
    }, 700);
  };

  const handleQuickDemo = () => {
    completeLogin(DEFAULT_USER);
  };

  const completeLogin = (user: UserProfile) => {
    CacheService.saveUserProfile(user);
    setSuccessMsg(`Welcome, ${user.name}!`);
    setTimeout(() => {
      onLoginSuccess(user);
      onClose();
      setSuccessMsg('');
      setAuthMethod('options');
      setOtpStep(false);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden p-6">
        {/* Subtle branded background banner overlay */}
        <div 
          className="absolute -top-12 -left-12 -right-12 h-36 bg-cover bg-center opacity-10 pointer-events-none"
          style={{ backgroundImage: "url('/assets/diy-electronics-bg.jpg')" }}
        />
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with DIYELECTRONICS branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-400 text-stone-950 font-black text-2xl shadow-lg mb-3">
            <Wrench className="w-7 h-7 text-stone-950" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-stone-950 dark:text-amber-400">
            DIYELECTRONICS
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Join thousands of technicians reducing e-waste through self-repair
          </p>
        </div>

        {successMsg ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <p className="text-lg font-bold text-stone-900 dark:text-stone-100">{successMsg}</p>
            <p className="text-xs text-stone-500">Signing you in securely...</p>
          </div>
        ) : authMethod === 'options' ? (
          <div className="space-y-3">
            {/* Phone Number Option */}
            <button
              onClick={() => setAuthMethod('phone')}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold transition-all shadow-xs"
            >
              <Phone className="w-5 h-5 text-amber-500" />
              <span>Continue with Phone Number</span>
            </button>

            {/* Google Mail Option */}
            <button
              onClick={() => handleSocialLogin('google')}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800/80 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold transition-all shadow-xs"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google Mail</span>
            </button>

            {/* Facebook Option */}
            <button
              onClick={() => handleSocialLogin('facebook')}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-semibold transition-all shadow-xs"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Continue with Facebook</span>
            </button>

            {/* Quick Demo Access */}
            <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2">
              <button
                onClick={handleQuickDemo}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
              >
                <ShieldCheck className="w-5 h-5" />
                <span>Enter as Verified Technician (Demo)</span>
              </button>

              {onSignOut && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSignOut();
                  }}
                  className="w-full py-2 px-4 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-stone-600 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 text-xs font-bold transition-all text-center"
                >
                  Sign Out of Current Account
                </button>
              )}

              <p className="text-center text-[11px] text-stone-500 mt-2">
                Instant access without phone verification. All features unlocked.
              </p>
            </div>
          </div>
        ) : (
          /* Phone OTP Flow */
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('options');
                setOtpStep(false);
              }}
              className="text-xs text-amber-500 hover:underline font-medium"
            >
              ← Back to login options
            </button>

            {!otpStep ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                    Your Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jordan Smith"
                    className="w-full px-3 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                    Mobile Phone Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      required
                      className="w-full px-3 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">
                    We will send a 4-digit SMS verification code to confirm your device.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold transition-colors"
                >
                  {isSubmitting ? 'Sending Code...' : 'Send SMS Code'}
                </button>
              </>
            ) : (
              <>
                <div className="text-center py-2">
                  <p className="text-xs text-stone-500">
                    Enter the 4-digit code sent to <span className="font-semibold text-stone-800 dark:text-stone-200">{phoneNumber}</span>
                  </p>
                  <p className="text-xs text-amber-500 font-mono mt-1">
                    (Use code: <span className="font-bold">4821</span> for demo)
                  </p>
                </div>
                <div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="4821"
                    required
                    className="w-full text-center tracking-widest text-2xl font-mono py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold transition-colors"
                >
                  Verify & Continue
                </button>
              </>
            )}
          </form>
        )}

        <div className="mt-6 text-center text-[11px] text-stone-500 dark:text-stone-400">
          By continuing, you agree to DIYELECTRONICS Right-to-Repair terms and battery safety guidelines.
        </div>
      </div>
    </div>
  );
}
