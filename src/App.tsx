import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import NavigationTabs from './components/NavigationTabs';
import GuideFeed from './components/GuideFeed';
import GuideDetailModal from './components/GuideDetailModal';
import DiagnosticTool from './components/DiagnosticTool';
import CircuitSimulator from './components/CircuitSimulator';
import SparePartsDatabase from './components/SparePartsDatabase';
import Marketplace from './components/Marketplace';
import ElectronicStudies from './components/ElectronicStudies';
import CommunityForum from './components/CommunityForum';
import ProgressDashboard from './components/ProgressDashboard';
import AdminDashboard from './components/AdminDashboard';
import AuthModal from './components/AuthModal';
import AuthPage from './components/AuthPage';

import {
  RepairGuide,
  UserProfile,
  SparePart,
  MarketplaceItem,
  StudyCourse,
  ForumPost,
  CompanyVerificationRequest,
} from './types';

import {
  INITIAL_GUIDES,
  INITIAL_PARTS,
  INITIAL_STUDIES,
  INITIAL_FORUM_POSTS,
  INITIAL_MARKETPLACE,
  INITIAL_VERIFICATION_REQUESTS,
} from './data/mockData';

import { CacheService, DEFAULT_USER } from './services/cacheService';
import { Wrench, Leaf, ShieldCheck, Heart, Sparkles, WifiOff } from 'lucide-react';

export default function App() {
  // Theme & App State
  const [darkMode, setDarkMode] = useState<boolean>(() => CacheService.getDarkMode());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => CacheService.getIsAuthenticated());
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => CacheService.getUserProfile());
  const [activeTab, setActiveTab] = useState<string>('guides');
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Data Collections
  const [guides, setGuides] = useState<RepairGuide[]>(INITIAL_GUIDES);
  const [parts, setParts] = useState<SparePart[]>(INITIAL_PARTS);
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>(INITIAL_MARKETPLACE);
  const [courses, setCourses] = useState<StudyCourse[]>(INITIAL_STUDIES);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>(INITIAL_FORUM_POSTS);
  const [verifications, setVerifications] = useState<CompanyVerificationRequest[]>(() => {
    const cached = CacheService.getVerificationRequests();
    return cached.length > 0 ? cached : INITIAL_VERIFICATION_REQUESTS;
  });

  // Saved Guides for Offline
  const [savedGuideIds, setSavedGuideIds] = useState<string[]>(() => CacheService.getSavedGuideIds());
  const [selectedGuideForModal, setSelectedGuideForModal] = useState<RepairGuide | null>(null);

  // Search carry-over for cross-tab queries
  const [partsInitialQuery, setPartsInitialQuery] = useState<string>('');

  // Sync Dark Mode with <html> class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    CacheService.setDarkMode(darkMode);
  }, [darkMode]);

  // Handle Guide Offline Save Toggle
  const handleToggleSaveGuide = (guide: RepairGuide) => {
    const updatedIds = CacheService.toggleSaveGuide(guide.id);
    setSavedGuideIds(updatedIds);

    if (updatedIds.includes(guide.id)) {
      CacheService.saveGuideOffline(guide);
    } else {
      CacheService.removeGuideOffline(guide.id);
    }
  };

  // Handle successful device repair completion on bench
  const handleCompleteRepair = (eWasteKg: number) => {
    const updated: UserProfile = {
      ...currentUser,
      repairsCompleted: currentUser.repairsCompleted + 1,
      eWasteDivertedKg: currentUser.eWasteDivertedKg + eWasteKg,
      co2SavedKg: currentUser.co2SavedKg + eWasteKg * 18.5,
      reputationPoints: currentUser.reputationPoints + 50,
    };
    setCurrentUser(updated);
    CacheService.saveUserProfile(updated);
  };

  // Cross-Navigation: Diagnostic -> Spare Parts
  const handleSourcePartFromDiagnostic = (query: string) => {
    setPartsInitialQuery(query);
    setActiveTab('parts');
  };

  // Cross-Navigation: Spare Parts -> Marketplace
  const handleOrderPartFromDatabase = (partNumber: string) => {
    setGlobalSearch(partNumber);
    setActiveTab('marketplace');
  };

  // Company verification submission
  const handleRequestVerification = (req: CompanyVerificationRequest) => {
    const next = [req, ...verifications];
    setVerifications(next);
    CacheService.saveVerificationRequests(next);
  };

  // Admin Approval: Updates request status and grants verified badges across marketplace & parts
  const handleApproveVerification = (reqId: string) => {
    const target = verifications.find((r) => r.id === reqId);
    const updatedReqs: CompanyVerificationRequest[] = verifications.map((r) =>
      r.id === reqId ? { ...r, status: 'Approved (Verified)' as const, reviewerNotes: 'Verified official trading registration papers. Authenticated company.' } : r
    );
    setVerifications(updatedReqs);
    CacheService.saveVerificationRequests(updatedReqs);

    if (target) {
      // Bestow verified badge in marketplace items
      setMarketplaceItems((prev) =>
        prev.map((item) => {
          if (item.seller.name.toLowerCase().includes(target.companyName.toLowerCase()) || target.companyName.toLowerCase().includes(item.seller.name.toLowerCase())) {
            return {
              ...item,
              seller: {
                ...item.seller,
                isVerifiedCompany: true,
                companyRegistrationNumber: target.registrationNumber,
                tradingCertificateName: `Certified Registered Trader #${target.registrationNumber}`,
              },
            };
          }
          return item;
        })
      );

      // Bestow verified badge in spare parts suppliers
      setParts((prev) =>
        prev.map((p) => {
          if (p.supplier.name.toLowerCase().includes(target.companyName.toLowerCase()) || target.companyName.toLowerCase().includes(p.supplier.name.toLowerCase())) {
            return {
              ...p,
              supplier: {
                ...p.supplier,
                isVerifiedCompany: true,
              },
            };
          }
          return p;
        })
      );
    }
  };

  const handleRejectVerification = (reqId: string, reason: string) => {
    const updated = verifications.map((r) =>
      r.id === reqId ? { ...r, status: 'Rejected' as const, reviewerNotes: reason } : r
    );
    setVerifications(updated);
    CacheService.saveVerificationRequests(updated);
  };

  // Forum interactions
  const handleAddForumPost = (post: ForumPost) => {
    setForumPosts([post, ...forumPosts]);
  };

  const handleAddForumReply = (postId: string, content: string) => {
    setForumPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const newReply = {
            id: `rep_${Date.now()}`,
            author: currentUser.name,
            avatar: currentUser.avatar,
            role: currentUser.role,
            content,
            createdAt: 'Just now',
            upvotes: 0,
          };
          return {
            ...p,
            repliesCount: p.repliesCount + 1,
            replies: [...p.replies, newReply],
          };
        }
        return p;
      })
    );
  };

  const handleToggleForumLike = (postId: string) => {
    setForumPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p))
    );
  };

  // Course completion badge award
  const handleCourseComplete = (courseId: string, title: string) => {
    if (!currentUser.completedCourseIds.includes(courseId)) {
      const updatedUser: UserProfile = {
        ...currentUser,
        completedCourseIds: [...currentUser.completedCourseIds, courseId],
        reputationPoints: currentUser.reputationPoints + 100,
        badges: [
          ...currentUser.badges,
          {
            id: `cert_${Date.now()}`,
            name: `${title.split(':')[0]} Certified`,
            icon: 'Award',
            description: `Passed comprehensive electrical examination for ${title}`,
            unlockedAt: new Date().toISOString().split('T')[0],
          },
        ],
      };
      setCurrentUser(updatedUser);
      CacheService.saveUserProfile(updatedUser);
    }
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setIsAuthOpen(false);
    CacheService.clearSession();
  };

  const pendingVerificationsCount = verifications.filter((r) => r.status === 'Pending Review').length;

  // Enforce Sign In / Sign Up as the First Page before users see the inside of the app
  if (!isAuthenticated) {
    return (
      <AuthPage
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
          CacheService.setIsAuthenticated(true);
          CacheService.saveUserProfile(user);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors duration-200 flex flex-col font-sans antialiased">
      
      {/* Offline Mode Banner (when active) */}
      {isOfflineMode && (
        <div className="bg-amber-400 text-stone-950 px-4 py-2 text-xs font-black flex items-center justify-center gap-2 shadow-xs z-50">
          <WifiOff className="w-4 h-4 stroke-[2.5]" />
          <span>OFFLINE BENCH MODE ACTIVE: Browsing {savedGuideIds.length} cached guides from local storage.</span>
        </div>
      )}

      {/* Global Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        isOfflineMode={isOfflineMode}
        onToggleOfflineMode={() => setIsOfflineMode(!isOfflineMode)}
        savedGuidesCount={savedGuideIds.length}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
        searchQuery={globalSearch}
        onSearchChange={setGlobalSearch}
        onSelectTab={setActiveTab}
        activeTab={activeTab}
      />

      {/* Primary Category Navigation Tabs with Black/Yellow Icons */}
      <NavigationTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingVerificationsCount={pendingVerificationsCount}
      />

      {/* Main App Stage Container */}
      <main className="flex-1 w-full pb-16">
        {activeTab === 'guides' && (
          <GuideFeed
            guides={guides}
            savedGuideIds={savedGuideIds}
            onToggleSaveGuide={handleToggleSaveGuide}
            onSelectGuide={(g) => setSelectedGuideForModal(g)}
            isOfflineOnly={isOfflineMode}
            onToggleOfflineOnly={() => setIsOfflineMode(!isOfflineMode)}
            initialSearchQuery={globalSearch}
            onNavigateToDiagnostic={() => setActiveTab('diagnostic')}
          />
        )}

        {activeTab === 'diagnostic' && (
          <DiagnosticTool
            onSourcePart={handleSourcePartFromDiagnostic}
            onOpenGuide={(id) => {
              const g = guides.find((item) => item.id === id);
              if (g) setSelectedGuideForModal(g);
            }}
          />
        )}

        {activeTab === 'circuit' && <CircuitSimulator />}

        {activeTab === 'parts' && (
          <SparePartsDatabase
            parts={parts}
            initialSearchQuery={partsInitialQuery || globalSearch}
            onSelectMarketplace={handleOrderPartFromDatabase}
          />
        )}

        {activeTab === 'marketplace' && (
          <Marketplace
            items={marketplaceItems}
            onRequestVerification={handleRequestVerification}
            onSelectPartDetail={(partNumber) => {
              setPartsInitialQuery(partNumber);
              setActiveTab('parts');
            }}
          />
        )}

        {activeTab === 'studies' && (
          <ElectronicStudies
            courses={courses}
            onCourseComplete={handleCourseComplete}
          />
        )}

        {activeTab === 'forum' && (
          <CommunityForum
            posts={forumPosts}
            currentUser={currentUser}
            onAddPost={handleAddForumPost}
            onAddReply={handleAddForumReply}
            onToggleLike={handleToggleForumLike}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressDashboard
            currentUser={currentUser}
            savedGuides={guides.filter((g) => savedGuideIds.includes(g.id))}
            onOpenGuide={(g) => setSelectedGuideForModal(g)}
            onRemoveSavedGuide={(id) => {
              const next = CacheService.toggleSaveGuide(id);
              setSavedGuideIds(next);
            }}
            onNavigateToGuides={() => setActiveTab('guides')}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard
            verifications={verifications}
            onApproveVerification={handleApproveVerification}
            onRejectVerification={handleRejectVerification}
          />
        )}
      </main>

      {/* Interactive Step-by-Step Guide Detail Modal */}
      {selectedGuideForModal && (
        <GuideDetailModal
          guide={selectedGuideForModal}
          onClose={() => setSelectedGuideForModal(null)}
          isSaved={savedGuideIds.includes(selectedGuideForModal.id)}
          onToggleSave={handleToggleSaveGuide}
          onSourcePart={(partNumber) => {
            setSelectedGuideForModal(null);
            setPartsInitialQuery(partNumber);
            setActiveTab('parts');
          }}
          onCompleteRepair={handleCompleteRepair}
        />
      )}

      {/* Authentication & Sign-in Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          CacheService.saveUserProfile(user);
        }}
        onSignOut={handleSignOut}
      />

      {/* Eco-Friendly Sustainability Footer */}
      <footer className="w-full border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 py-10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-stone-950 stroke-[2.5]" />
              </div>
              <span className="font-black text-sm tracking-tight text-stone-950 dark:text-stone-100">
                DIYELECTRONICS
              </span>
              <span className="text-xs text-stone-400 font-mono ml-2">
                Open Hardware & Peer-to-Peer Repair Platform
              </span>
            </div>

            <div className="flex items-center gap-6 text-xs text-stone-500 font-medium">
              <button onClick={() => setActiveTab('diagnostic')} className="hover:text-amber-500">
                AI Diagnostic Engine
              </button>
              <button onClick={() => setActiveTab('circuit')} className="hover:text-amber-500">
                Circuit Lab
              </button>
              <button onClick={() => setActiveTab('marketplace')} className="hover:text-amber-500">
                Verified Marketplace
              </button>
              <button onClick={() => setActiveTab('studies')} className="hover:text-amber-500">
                Course Certifications
              </button>
              <button onClick={() => setActiveTab('admin')} className="hover:text-amber-500">
                Admin Desk
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100 dark:border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-stone-400">
            <p>
              Dedicated to electronic longevity, right to repair legislation, and preventing toxic e-waste in global landfills.
            </p>
            <p className="flex items-center gap-1 font-mono">
              <span>Built with precision for repair technicians & students</span>
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
