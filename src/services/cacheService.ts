import { RepairGuide, UserProfile, CompanyVerificationRequest, ForumPost } from '../types';

const STORAGE_KEYS = {
  USER_PROFILE: 'diyelectronics_user_profile',
  OFFLINE_GUIDES: 'diyelectronics_offline_guides',
  SAVED_GUIDE_IDS: 'diyelectronics_saved_guide_ids',
  THEME_MODE: 'diyelectronics_dark_mode',
  VERIFICATION_REQUESTS: 'diyelectronics_verification_requests',
  CACHED_FORUM_POSTS: 'diyelectronics_forum_posts',
  REPAIR_HISTORY: 'diyelectronics_repair_history',
  IS_AUTHENTICATED: 'diyelectronics_is_authenticated',
};

// Default technician user profile
export const DEFAULT_USER: UserProfile = {
  id: 'tech_usr_102',
  name: 'Alex Vance',
  email: 'alex.vance@diyelectronics.org',
  phoneNumber: '+1 (555) 382-9012',
  authProvider: 'google',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  role: 'Technician',
  isVerifiedTrader: false,
  reputationPoints: 1420,
  experiencePoints: 3850,
  repairsCompleted: 27,
  eWasteDivertedKg: 64.8,
  co2SavedKg: 182.4,
  coursesEnrolled: ['course_1', 'course_2'],
  completedCourseIds: ['course_1'],
  savedGuideIds: ['guide_1', 'guide_3'],
  badges: [
    {
      id: 'badge_1',
      name: 'Soldering Novice',
      icon: 'Flame',
      description: 'Completed 5 successful board repairs',
      unlockedAt: '2026-08-10',
    },
    {
      id: 'badge_2',
      name: 'E-Waste Champion',
      icon: 'Leaf',
      description: 'Diverted over 50kg of electronics from landfills',
      unlockedAt: '2026-09-02',
    },
    {
      id: 'badge_3',
      name: 'Diagnostic Hawk',
      icon: 'Search',
      description: 'Used AI diagnostic tool to trace 10 component faults',
      unlockedAt: '2026-09-12',
    },
  ],
};

export const CacheService = {
  getUserProfile(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  },

  saveUserProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  },

  getSavedGuideIds(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_GUIDE_IDS);
      return data ? JSON.parse(data) : ['guide_1', 'guide_3'];
    } catch {
      return ['guide_1', 'guide_3'];
    }
  },

  toggleSaveGuide(guideId: string): string[] {
    const current = this.getSavedGuideIds();
    let updated: string[];
    if (current.includes(guideId)) {
      updated = current.filter(id => id !== guideId);
    } else {
      updated = [...current, guideId];
    }
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_GUIDE_IDS, JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
    return updated;
  },

  saveGuideOffline(guide: RepairGuide): void {
    try {
      const offline = this.getOfflineGuides();
      offline[guide.id] = { ...guide, isSavedOffline: true, cachedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEYS.OFFLINE_GUIDES, JSON.stringify(offline));
    } catch (e) {
      console.warn('LocalStorage offline guide save failed', e);
    }
  },

  removeGuideOffline(guideId: string): void {
    try {
      const offline = this.getOfflineGuides();
      delete offline[guideId];
      localStorage.setItem(STORAGE_KEYS.OFFLINE_GUIDES, JSON.stringify(offline));
    } catch (e) {
      console.warn('LocalStorage offline guide delete failed', e);
    }
  },

  getOfflineGuides(): Record<string, RepairGuide & { cachedAt?: string }> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OFFLINE_GUIDES);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  getVerificationRequests(): CompanyVerificationRequest[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VERIFICATION_REQUESTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn(e);
    }
    return [];
  },

  saveVerificationRequests(requests: CompanyVerificationRequest[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.VERIFICATION_REQUESTS, JSON.stringify(requests));
    } catch (e) {
      console.warn(e);
    }
  },

  getDarkMode(): boolean {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.THEME_MODE);
      return val ? JSON.parse(val) : false;
    } catch {
      return false;
    }
  },

  setDarkMode(isDark: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME_MODE, JSON.stringify(isDark));
    } catch (e) {
      console.warn(e);
    }
  },

  getIsAuthenticated(): boolean {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.IS_AUTHENTICATED);
      return val ? JSON.parse(val) : false;
    } catch {
      return false;
    }
  },

  setIsAuthenticated(isAuth: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, JSON.stringify(isAuth));
    } catch (e) {
      console.warn(e);
    }
  },

  clearSession(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, JSON.stringify(false));
    } catch (e) {
      console.warn(e);
    }
  },
};
