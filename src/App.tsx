import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PhonesPage from './components/PhonesPage';
import RepairGuides from './components/RepairGuides';
import GuideDetail from './components/GuideDetail';
import DiagnosticTool from './components/DiagnosticTool';
import CircuitLab from './components/CircuitLab';
import Marketplace from './components/Marketplace';
import UserProgress from './components/UserProgress';
import AuthModal from './components/AuthModal';
import LandingPage from './components/LandingPage';
import AiAssistantView from './components/AiAssistantView';
import { initAnalytics, logPageView } from './lib/analytics';
const SupportView = lazy(() => import('./components/SupportView'));
import BlueprintViewer from './components/BlueprintViewer';
import SettingsView from './components/SettingsView';
import AboutView from './components/AboutView';
import TermsView from './components/TermsView';
import HelpView from './components/HelpView';
import UserDatabaseManager from './components/UserDatabaseManager';
import FileStorageManager from './components/FileStorageManager';
import HomeFeed from './components/HomeFeed';
import DeviceDirectoryView from './components/catalog/LazyDeviceDirectory';
import { usePathname, navigate } from './hooks/usePathname';
import SessionTimeoutWatcher from './components/SessionTimeoutWatcher';
import NotFound from './components/NotFound';
import LoginWall, { signInWallWasOpen } from './components/LoginWall';
import { OwnershipAgreementModal } from './components/OwnershipAgreementModal';
import { isOwnershipSensitive, syncOwnershipFromProfile, useOwnershipAccepted } from './lib/ownershipAgreement';
import { GUEST_TABS, gateEnabled, SIGNIN_REQUIRED_EVENT, LOGIN_SUCCESS_EVENT } from './lib/signInGate';
const TheoryHub = lazy(() => import('./components/theory/TheoryHub'));
const MultimeterPage = lazy(() => import('./components/meter/MultimeterPage'));
const AdminDesk = lazy(() => import('./components/AdminDesk'));
const HubRoutes = lazy(() => import('./components/hub/HubRoutes'));
import { useAdminStatus } from './lib/admin';
import { usePendingVerificationsCount } from './lib/marketplace';
import { storage } from './lib/storage';
import { APP_THEMES, DEFAULT_THEME_ID } from './lib/theme';
import { auth, db, isFirebaseConfigured } from './lib/firebase';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initialGuides, initialCourses, initialPosts } from './data';
import type { UserProfile, Guide, ForumPost } from './types';

const ROUTED_TABS = ['home', 'devices', 'phones', 'blueprint_viewer', '3d_viewer', 'social_annotator', 'guides', 'diagnostic', 'circuit', 'marketplace', 'theory', 'multimeter', 'ai_assistant', 'user_db', 'file_storage', 'settings', 'about', 'support', 'help', 'terms', 'progress', 'admin', 'search', 'device', 'components', 'answers', 'teardowns', 'contributors'];
const TAB_ALIASES: Record<string, string> = { learning: 'theory', studies: 'theory', courses: 'theory', electrical_theory: 'theory', exam_room: 'theory', forum: 'home', parts: 'components', spare_parts: 'components' };
/**
 * Old routes that were merged into another page. They redirect (replace) to the canonical URL:
 *   /studies, /learning, /courses -> /theory#/theory/courses  (Courses merged into Theory)
 *   /electrical-theory, /exam-room -> /theory
 *   /forum -> /  (the Home feed is the community forum, backed by Firestore)
 *   /parts -> /components  (part-number reference lives on Component pages)
 */
const LEGACY_REDIRECTS: Record<string, string> = {
  '/studies': '/theory#/theory/courses',
  '/learning': '/theory#/theory/courses',
  '/courses': '/theory#/theory/courses',
  '/electrical-theory': '/theory',
  '/exam-room': '/theory#/theory/exam',
  '/forum': '/',
  '/parts': '/components',
  '/spare-parts': '/components',
};
function pathForTab(tab: string): string {
  const t = TAB_ALIASES[tab] || tab;
  return t === 'home' ? '/' : `/${t.replace(/_/g, '-')}`;
}
/** Repair hub pages (universal search, device & component pages, Answers, teardowns, guide editor/viewer). */
function isHubPath(pathname: string): boolean {
  return /^\/(search|device|components|answers|teardowns|contributors)(\/|$)/.test(pathname) || /^\/guides\/(new|edit|view)(\/|$)/.test(pathname);
}
const hubFallback = <div className="p-10 text-center text-sm text-slate-500">Loading…</div>;
const SIDEBAR_COLLAPSED_KEY = 'diy_sidebar_collapsed';
function tabFromPath(pathname: string): string {
  const seg = (pathname.split('/')[1] || '').replace(/-/g, '_');
  const t = TAB_ALIASES[seg] || seg;
  if (!t) return 'home';
  return ROUTED_TABS.includes(t) ? t : 'not_found';
}

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => storage.getDarkMode());
  const themeId = DEFAULT_THEME_ID;
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => storage.getIsAuthenticated());
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => storage.getUserProfile());
  // Main tabs are synced with the URL path (/devices, /guides, /marketplace, ...) so links are shareable
  // and browser back/forward work. Sub-paths (e.g. /devices/tv/samsung/...) belong to the tab's own router.
  const { pathname, search: urlSearch } = usePathname();
  const activeTab = tabFromPath(pathname);
  const isHub = isHubPath(pathname);
  // ?q= deep links (e.g. /marketplace?q=iPhone 13 battery from a device page) prefill the tab's search.
  const urlQ = urlSearch.get('q') || '';
  const setActiveTab = (tab: string) => navigate(pathForTab(tab));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [guides, setGuides] = useState<Guide[]>(initialGuides);
  const [posts, setPosts] = useState<ForumPost[]>(initialPosts);
  // Admin UI visibility comes from Firebase (claim / admins doc / users.role, or the
  // VITE_ADMIN_EMAILS bootstrap list). Real authority is enforced by the security rules.
  const adminStatus = useAdminStatus();
  const isAdmin = adminStatus.isAdmin;
  const pendingVerificationsCount = usePendingVerificationsCount(isAdmin);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(!isFirebaseConfigured);
  // Guest preview + login wall (see lib/signInGate.ts). A "guest" is anyone without a Firebase sign-in,
  // including people who pressed "Continue as guest".
  const signedIn = !gateEnabled || !!firebaseUser;
  const ownershipAccepted = useOwnershipAccepted();
  const [wallReason, setWallReason] = useState<string | null>(null);
  const [wallOpen, setWallOpen] = useState<boolean>(() => gateEnabled && signInWallWasOpen());
  
  const [savedGuideIds, setSavedGuideIds] = useState<string[]>(() => storage.getSavedGuideIds());
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const currentTheme = APP_THEMES[themeId] || APP_THEMES[DEFAULT_THEME_ID];

  // Visitor analytics (Firebase / GA4): one page_view per route (path + in-page hash routes).
  useEffect(() => {
    initAnalytics();
    const onHash = () => logPageView();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { logPageView(); }, [pathname]);

  // Merged / retired routes redirect to their canonical page.
  useEffect(() => {
    const target = LEGACY_REDIRECTS[pathname];
    if (target) {
      window.history.replaceState({}, '', target + (urlSearch.toString() && !target.includes('#') ? `?${urlSearch.toString()}` : ''));
      window.dispatchEvent(new Event('app:navigate'));
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, [pathname, urlSearch]);
  
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    storage.setDarkMode(darkMode);
  }, [darkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      setAuthChecked(true);
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            syncOwnershipFromProfile(docSnap.data());
            setCurrentUser(profile);
            setIsAuthenticated(true);
            storage.setIsAuthenticated(true);
            storage.saveUserProfile(profile);
          }
        } catch (error) {
          console.error("Error fetching user profile from Firestore:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Pages and actions ask for sign-in through a window event; the wall closes by itself once signed in.
  useEffect(() => {
    const onRequire = (e: Event) => {
      if (!gateEnabled || auth.currentUser) return;
      setWallReason((e as CustomEvent).detail?.reason || null);
      setWallOpen(true);
    };
    const onLogin = (e: Event) => {
      const profile = (e as CustomEvent).detail?.profile as UserProfile | undefined;
      if (!profile) return;
      setCurrentUser(profile);
      setIsAuthenticated(true);
      storage.setIsAuthenticated(true);
      storage.saveUserProfile(profile);
      setWallOpen(false);
      setWallReason(null);
    };
    window.addEventListener(SIGNIN_REQUIRED_EVENT, onRequire);
    window.addEventListener(LOGIN_SUCCESS_EVENT, onLogin);
    return () => {
      window.removeEventListener(SIGNIN_REQUIRED_EVENT, onRequire);
      window.removeEventListener(LOGIN_SUCCESS_EVENT, onLogin);
    };
  }, []);
  useEffect(() => { if (firebaseUser) { setWallOpen(false); setWallReason(null); } }, [firebaseUser]);

  // Gated pages: everything except the guest tabs (and every repair-hub route).
  const routeGated = !signedIn && (isHub || !GUEST_TABS.has(activeTab));
  // Where "Back" on a gated page goes: the last page this guest could see.
  const lastOpenPath = useRef<string>('/');
  useEffect(() => {
    if (!routeGated) lastOpenPath.current = window.location.pathname + window.location.search + window.location.hash;
  }, [routeGated, pathname, urlSearch]);
  const leaveGatedRoute = useCallback(() => {
    const back = lastOpenPath.current && lastOpenPath.current !== window.location.pathname ? lastOpenPath.current : '/';
    navigate(back, { replace: true });
    if (back.includes('#')) window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, []);
  const closeWall = useCallback(() => { setWallOpen(false); setWallReason(null); }, []);
  /** "Account" / sign-in prompts: guests get the login wall, members the account modal. */
  const openAuth = useCallback(() => {
    if (gateEnabled && !auth.currentUser) { setWallReason(null); setWallOpen(true); }
    else setIsAuthModalOpen(true);
  }, []);

  // Non-admins who land on /admin are sent home once auth + admin checks resolve.
  const adminResolved = authChecked && (!firebaseUser || (adminStatus.uid === firebaseUser.uid && !adminStatus.loading));
  useEffect(() => {
    if (activeTab === 'admin' && adminResolved && !isAdmin) navigate('/', { replace: true });
  }, [activeTab, adminResolved, isAdmin]);

  const handleToggleSaveGuide = (guide: Guide) => {
    const newSavedIds = storage.toggleSaveGuide(guide.id);
    setSavedGuideIds(newSavedIds);
    
    if (newSavedIds.includes(guide.id)) {
      storage.saveGuideOffline(guide);
    } else {
      storage.removeGuideOffline(guide.id);
    }
  };

  const handleCompleteRepair = (eWasteSaved: number) => {
    const updatedUser = {
      ...currentUser,
      repairsCompleted: currentUser.repairsCompleted + 1,
      eWasteDivertedKg: currentUser.eWasteDivertedKg + eWasteSaved,
      co2SavedKg: currentUser.co2SavedKg + (eWasteSaved * 18.5),
      reputationPoints: currentUser.reputationPoints + 50,
    };
    setCurrentUser(updatedUser);
    storage.saveUserProfile(updatedUser);
  };

  // "Source this part" opens the marketplace pre-searched for the part (Spare Parts was merged away).
  const handleSourcePart = (partNumber: string) => {
    setInitialSearchQuery(partNumber);
    navigate(`/marketplace?q=${encodeURIComponent(partNumber)}`);
  };

  const handleSelectMarketplace = (brand: string) => {
    setInitialSearchQuery(brand);
    setActiveTab('marketplace');
  };

  const handleAddPost = (post: ForumPost) => {
    setPosts([post, ...posts]);
  };

  const handleAddReply = (postId: string, content: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const newReply = {
          id: `rep_${Date.now()}`,
          author: currentUser.name,
          avatar: currentUser.avatar,
          role: currentUser.role,
          content,
          createdAt: 'Just now',
          upvotes: 0
        };
        return {
          ...p,
          repliesCount: p.repliesCount + 1,
          replies: [...p.replies, newReply]
        };
      }
      return p;
    }));
  };

  const handleToggleLike = (postId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, upvotes: p.upvotes + 1 };
      }
      return p;
    }));
  };

  const handleCourseComplete = (courseId: string, courseTitle: string) => {
    if (!currentUser.completedCourseIds.includes(courseId)) {
      const updatedUser = {
        ...currentUser,
        completedCourseIds: [...currentUser.completedCourseIds, courseId],
        reputationPoints: currentUser.reputationPoints + 100,
        badges: [
          ...currentUser.badges,
          {
            id: `cert_${Date.now()}`,
            name: `${courseTitle.split(':')[0]} Certified`,
            icon: 'Award',
            description: `Passed comprehensive electrical examination for ${courseTitle}`,
            unlockedAt: new Date().toISOString().split('T')[0]
          }
        ]
      };
      setCurrentUser(updatedUser);
      storage.saveUserProfile(updatedUser);
    }
  };

  const logSearch = async (query: string, resultsCount: number) => {
    try {
      await addDoc(collection(db, 'searchLogs'), {
        query,
        resultsCount,
        timestamp: serverTimestamp(),
        userId: currentUser?.uid || 'anonymous'
      });
    } catch (e) {
      console.error("Error logging search:", e);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Error signing out:", e);
    }
    setIsAuthenticated(false);
    setIsAuthModalOpen(false);
    storage.clearSession();
  };


  const gatedReason = activeTab === 'ai_assistant' || activeTab === 'diagnostic' ? 'Sign in to use the SANWOLF AI assistant and circuit maps. It is free.'
    : activeTab === 'marketplace' ? 'Sign in to buy, sell and see listing details in the marketplace.'
    : null;

  // A gated page for a guest: the full-screen login wall (after sign-in the page opens right here).
  if (routeGated) {
    if (!authChecked) return <div className="min-h-[100dvh] flex items-center justify-center bg-slate-950 text-sm text-slate-400">Loading…</div>;
    return <LoginWall reason={gatedReason} onBack={leaveGatedRoute} />;
  }

  // Signed-out visitors who have not chosen "Continue as guest" see the landing page on /.
  // (Guests can still open the free preview pages directly: /about, /help, /support, /theory.)
  if (!isAuthenticated && (!gateEnabled || activeTab === 'home')) {
    return (
      <LandingPage 
        darkMode={darkMode} 
        onToggleDarkMode={() => setDarkMode(!darkMode)} 
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
          storage.setIsAuthenticated(true);
          storage.saveUserProfile(user);
        }} 
      />
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased">
      {isOfflineMode && (
        <div className="bg-slate-950 text-slate-200 border-b border-slate-800 px-4 py-2 text-xs font-medium flex items-center justify-center gap-3 z-50">
          <span>Offline vault: showing the {savedGuideIds.length} guide{savedGuideIds.length === 1 ? '' : 's'} you saved on this device.</span>
          <button type="button" onClick={() => setIsOfflineMode(false)} className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 font-semibold">Show everything</button>
        </div>
      )}

      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectTab={setActiveTab}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onToggleCollapse={toggleSidebarCollapsed}
        logSearch={logSearch}
      />

      <div className="flex flex-1 min-h-0 w-full">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tabId: string) => {
            if (tabId === 'admin' && !isAdmin) return;
            setActiveTab(tabId);
            setInitialSearchQuery('');
          }}
          isOpen={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
          collapsed={isSidebarCollapsed}
          currentUser={currentUser}
          isAdmin={isAdmin}
          pendingVerificationsCount={pendingVerificationsCount}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onOpenAccount={openAuth}
          isGuest={!signedIn}
          isTabLocked={(id: string) => !signedIn && !GUEST_TABS.has(id)}
          onSignOut={handleSignOut}
        />

        <main className={`flex-1 w-full min-w-0 ${activeTab === 'ai_assistant' ? 'pb-0' : 'pb-16'}`}>
          {activeTab === 'not_found' && <NotFound onGoHome={() => setActiveTab('home')} />}
          {activeTab === 'home' && (
            <HomeFeed 
              posts={posts} 
              currentUser={currentUser} 
              onAddPost={handleAddPost} 
              onAddReply={handleAddReply} 
              onToggleLike={handleToggleLike} 
              themeConfig={currentTheme} 
              onOpenAuth={openAuth}
              onSelectMarketplace={handleSelectMarketplace}
            />
          )}
          {activeTab === 'devices' && (
            <DeviceDirectoryView 
              savedGuideIds={savedGuideIds} 
              onToggleSaveGuide={handleToggleSaveGuide}
              onSourcePart={handleSourcePart}
              onOpenAuth={openAuth}
            />
          )}
          {activeTab === 'phones' && <PhonesPage themeConfig={currentTheme} onNavigateTo3D={() => setActiveTab('blueprint_viewer')} />}
          {(activeTab === 'blueprint_viewer' || activeTab === '3d_viewer' || activeTab === 'social_annotator') && (
            <BlueprintViewer 
              themeConfig={currentTheme} 
              currentUser={currentUser}
              initialView={activeTab === 'social_annotator' ? 'annotator' : 'boardview'}
              onOpenAuth={openAuth}
            />
          )}
          {isHub && (
            <Suspense fallback={hubFallback}>
              <HubRoutes onOpenAuth={openAuth} />
            </Suspense>
          )}
          {activeTab === 'guides' && !isHub && (
            <Suspense fallback={hubFallback}>
              <HubRoutes onOpenAuth={openAuth} />
            </Suspense>
          )}
          {activeTab === 'guides' && !isHub && (
            <RepairGuides 
              guides={guides} 
              savedGuideIds={savedGuideIds} 
              onToggleSaveGuide={handleToggleSaveGuide}
              onSelectGuide={(guide) => setSelectedGuide(guide)}
              isOfflineOnly={isOfflineMode}
              onToggleOfflineOnly={() => setIsOfflineMode(!isOfflineMode)}
              initialSearchQuery={searchQuery || urlQ}
              onNavigateToDiagnostic={() => setActiveTab('diagnostic')}
              onSourcePart={handleSourcePart}
            />
          )}

          {activeTab === 'diagnostic' && (
            <DiagnosticTool 
              onSourcePart={handleSourcePart} 
              onOpenGuide={(id) => {
                const guide = guides.find(g => g.id === id);
                if (guide) setSelectedGuide(guide);
              }} 
            />
          )}
          
          {activeTab === 'circuit' && <CircuitLab />}
          
          {activeTab === 'marketplace' && (
            <Marketplace 
              initialSearchQuery={initialSearchQuery || searchQuery || urlQ} 
              onSelectPartDetail={handleSourcePart}
              themeConfig={currentTheme}
              onOpenAuth={openAuth}
            />
          )}

          {activeTab === 'theory' && (
            <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading Electrical Theory…</div>}>
              <TheoryHub themeConfig={currentTheme} courses={initialCourses} onCourseComplete={handleCourseComplete} />
            </Suspense>
          )}

          {activeTab === 'multimeter' && (
            <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading Multimeter Lab…</div>}>
              <MultimeterPage themeConfig={currentTheme} />
            </Suspense>
          )}

          {activeTab === 'ai_assistant' && (
            <AiAssistantView />
          )}

          {activeTab === 'user_db' && (
            <UserDatabaseManager currentUser={currentUser} />
          )}

          {activeTab === 'file_storage' && (
            <FileStorageManager currentUser={currentUser} />
          )}

          {activeTab === 'settings' && (
            <SettingsView 
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode(!darkMode)}
              currentUser={currentUser}
              onUpdateUser={(updatedUser) => {
                setCurrentUser(updatedUser);
                storage.saveUserProfile(updatedUser);
              }}
              isOfflineMode={isOfflineMode}
              onToggleOfflineMode={() => setIsOfflineMode(!isOfflineMode)}
              savedGuidesCount={savedGuideIds.length}
              onSignOut={handleSignOut}
            />
          )}

          {activeTab === 'support' && (
            <Suspense fallback={hubFallback}><SupportView /></Suspense>
          )}

          {activeTab === 'terms' && <TermsView />}

          {activeTab === 'about' && (
            <AboutView />
          )}

          {activeTab === 'help' && (
            <HelpView onNavigate={setActiveTab} />
          )}

          {activeTab === 'progress' && (
            <UserProgress 
              currentUser={currentUser}
              savedGuides={guides.filter(g => savedGuideIds.includes(g.id))}
              onOpenGuide={(g) => setSelectedGuide(g)}
              onRemoveSavedGuide={handleToggleSaveGuide}
              onNavigateToGuides={() => setActiveTab('guides')}
              onOpenAuth={openAuth}
            />
          )}

          {activeTab === 'admin' && isAdmin && (
            <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading Admin Desk…</div>}>
              <AdminDesk themeConfig={currentTheme} />
            </Suspense>
          )}
        </main>
      </div>

      {/* Guide Detail Modal */}
      {/* FRP / unlock guides open with the Ownership Agreement first (Cancel closes the guide). */}
      {selectedGuide && !ownershipAccepted && isOwnershipSensitive(selectedGuide.title) && (
        <OwnershipAgreementModal onAgree={() => undefined} onCancel={() => setSelectedGuide(null)} />
      )}
      {selectedGuide && (ownershipAccepted || !isOwnershipSensitive(selectedGuide.title)) && (
        <GuideDetail 
          guide={selectedGuide}
          onClose={() => setSelectedGuide(null)}
          onCompleteRepair={handleCompleteRepair}
          onSourcePart={handleSourcePart}
          onToggleSaveGuide={handleToggleSaveGuide}
          isSaved={savedGuideIds.includes(selectedGuide.id)}
        />
      )}

      {/* "Sign in to continue" for gated actions on the free pages (AI help, posting, exams...) */}
      {wallOpen && !signedIn && (
        <LoginWall reason={wallReason} onBack={closeWall} onDismiss={closeWall} />
      )}

      {/* Ends the session after SESSION_MAX_HOURS (default 5h) */}
      <SessionTimeoutWatcher isAuthenticated={isAuthenticated} onExpired={handleSignOut} />

      {/* General Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
          storage.setIsAuthenticated(true);
          storage.saveUserProfile(user);
          setIsAuthModalOpen(false);
        }}
      />
    </div>
  );
}
