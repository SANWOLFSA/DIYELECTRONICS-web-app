export type DeviceCategory = 
  | 'Smartphones'
  | 'Laptops & PCs'
  | 'Audio & Headphones'
  | 'TVs & Monitors'
  | 'Gaming Consoles'
  | 'Power Supplies & Chargers'
  | 'Home Appliances'
  | 'Microcontrollers & IoT'
  | 'Drones & Robotics';

export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export interface RepairGuideStep {
  stepNumber: number;
  title: string;
  description: string;
  imageOrVideoUrl?: string;
  multimeterCheck?: {
    probeRed: string;
    probeBlack: string;
    expectedValue: string;
    mode: 'Voltage' | 'Resistance' | 'Diode / Continuity' | 'Capacitance';
  };
  safetyWarning?: string;
  proTip?: string;
}

export interface ProTipMistake {
  id: string;
  mistakeTitle: string;
  whyItHappens: string;
  preventionTip: string;
  riskLevel: 'Caution' | 'High Risk' | 'Critical Damage';
  componentOrArea: string;
}

export interface ProTipsResponse {
  deviceModel: string;
  brand?: string;
  summary: string;
  benchDoAndDonts: {
    doTip: string;
    dontMistake: string;
  }[];
  commonMistakes: ProTipMistake[];
  torqueOrTempSpecs?: {
    label: string;
    spec: string;
  }[];
  source: string;
}

export interface RepairGuide {
  id: string;
  title: string;
  deviceCategory: DeviceCategory;
  deviceModel: string;
  issueType: string;
  difficulty: DifficultyLevel;
  estimatedTimeMinutes: number;
  author: {
    name: string;
    avatar: string;
    badge: string;
    reputation: number;
  };
  thumbnailUrl: string;
  videoUrl?: string;
  views: number;
  likes: number;
  eWasteSavedKg: number;
  toolsRequired: string[];
  partsRequired: {
    name: string;
    partNumber: string;
    priceApprox: string;
    partId?: string;
  }[];
  steps: RepairGuideStep[];
  publishedAt: string;
  isSavedOffline?: boolean;
}

export interface SparePart {
  id: string;
  partNumber: string;
  name: string;
  category: 'IC Chip' | 'MOSFET / Transistor' | 'Capacitor' | 'Diode / TVS' | 'Display Screen' | 'Connector / Port' | 'Battery' | 'Thermal / Passive';
  packageFootprint: string;
  description: string;
  typicalDevices: string[];
  substitutes: string[];
  specifications: Record<string, string>;
  datasheetSummary: string;
  inStock: boolean;
  priceUSD: number;
  supplier: {
    name: string;
    isVerifiedCompany: boolean;
    rating: number;
    shippingDays: number;
  };
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  author: {
    name: string;
    avatar: string;
    role: 'Technician' | 'Apprentice' | 'Master Engineer' | 'Company Rep';
    isVerifiedCompany?: boolean;
  };
  deviceCategory: DeviceCategory;
  deviceModel: string;
  issueType: string;
  tags: string[];
  upvotes: number;
  userVoted?: boolean;
  repliesCount: number;
  isSolved: boolean;
  createdAt: string;
  replies: {
    id: string;
    author: string;
    avatar: string;
    role: string;
    content: string;
    createdAt: string;
    upvotes: number;
    isAcceptedAnswer?: boolean;
  }[];
}

export interface StudyCourse {
  id: string;
  title: string;
  category: 'Electronics Theory' | 'Practical Bench Skills' | 'Diagnostics' | 'Micro-Soldering' | 'Safety & Compliance';
  level: DifficultyLevel;
  durationHours: number;
  lessonsCount: number;
  description: string;
  instructor: string;
  progressPercent: number;
  isCompleted: boolean;
  skillsAcquired: string[];
  modules: {
    id: string;
    title: string;
    duration: string;
    summary: string;
    hasHandsOnCircuit: boolean;
    quizQuestion?: {
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    };
  }[];
}

export interface MarketplaceItem {
  id: string;
  title: string;
  partNumberOrSku: string;
  category: string;
  condition: 'Brand New (OEM)' | 'Original Refurbished' | 'Tested Salvage';
  priceUSD: number;
  stockQty: number;
  seller: {
    id: string;
    name: string;
    isVerifiedCompany: boolean;
    companyRegistrationNumber?: string;
    tradingCertificateName?: string;
    country: string;
    totalSales: number;
    rating: number;
  };
  images: string[];
  compatibility: string[];
  warrantyDays: number;
  description: string;
  specs: Record<string, string>;
}

export interface CompanyVerificationRequest {
  id: string;
  companyName: string;
  registrationNumber: string;
  countryOfRegistration: string;
  tradingLicenseDocument: string;
  vatTaxNumber: string;
  contactEmail: string;
  contactPhone: string;
  officialAddress: string;
  status: 'Pending Review' | 'Approved (Verified)' | 'Rejected';
  submittedDate: string;
  reviewerNotes?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  authProvider: 'email' | 'phone' | 'google' | 'facebook' | 'guest';
  avatar: string;
  role: 'Technician' | 'Student' | 'Shop Owner' | 'Admin';
  isVerifiedTrader?: boolean;
  companyName?: string;
  reputationPoints: number;
  experiencePoints?: number;
  repairsCompleted: number;
  eWasteDivertedKg: number;
  co2SavedKg: number;
  coursesEnrolled: string[];
  savedGuideIds: string[];
  completedCourseIds: string[];
  badges: {
    id: string;
    name: string;
    icon: string;
    description: string;
    unlockedAt: string;
  }[];
}

export interface CircuitElement {
  id: string;
  type: 'battery' | 'resistor' | 'led' | 'switch' | 'potentiometer' | 'capacitor';
  value: number; // Volts, Ohms, Farads, etc.
  unit: string;
  name: string;
  state?: boolean; // for switch (open/closed)
}

export interface VideoChapter {
  id: string;
  timestamp: string;
  seconds: number;
  title: string;
  actionSummary: string;
  benchTool: string;
  cautionNotice?: string;
  multimeterMode?: string;
  targetComponents?: string[];
}

export interface AIVideoTutorial {
  title: string;
  deviceModel: string;
  issueType: string;
  totalDurationSeconds: number;
  instructorName: string;
  instructorRole: string;
  videoUrl: string;
  benchSafetyProtocol: string;
  magnificationLevel: string;
  hotAirReworkTemp: string;
  chapters: VideoChapter[];
  keyTakeaways: string[];
}

export interface AIVideoTutorialResponse {
  success: boolean;
  tutorial: AIVideoTutorial;
  source: string;
}
