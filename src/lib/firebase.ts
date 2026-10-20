import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  getDocFromServer,
  collection,
  addDoc,
  serverTimestamp,
  query,
  getDocs,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  // Optional: Google Analytics 4 measurement id (G-XXXX). If unset, Firebase looks it up from the
  // project when Analytics is enabled (Firebase console > Project settings > Integrations > Google Analytics).
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID
};

/** True when the required VITE_FIREBASE_* env vars are present. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

if (!isFirebaseConfigured) {
  console.warn(
    '[firebase] VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_APP_ID are not set. ' +
    'The app will run, but sign-in, Firestore and Storage features are disabled. ' +
    'Copy .env.example to .env and fill in your Firebase web config.'
  );
}

// When config is missing, initialise with harmless placeholder values so that
// getAuth/getFirestore/getStorage don't throw at import time and crash the whole
// app. Any actual Firebase call will then fail and be handled by the caller.
const effectiveConfig = isFirebaseConfigured
  ? firebaseConfig
  : {
      apiKey: 'missing-firebase-api-key',
      authDomain: 'demo-diyelectronics.firebaseapp.com',
      projectId: 'demo-diyelectronics',
      storageBucket: 'demo-diyelectronics.appspot.com',
      messagingSenderId: '0',
      appId: '1:0:web:0',
      firestoreDatabaseId: undefined as string | undefined
    };

const app = initializeApp(effectiveConfig);
export const firebaseApp = app;
export const db = effectiveConfig.firestoreDatabaseId
  ? getFirestore(app, effectiveConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
// Keep users signed in across reloads/tabs; the 5-hour session limit is enforced by
// src/lib/useSessionTimeout.ts on top of this.
if (isFirebaseConfigured) {
  setPersistence(auth, browserLocalPersistence).catch(err =>
    console.warn('[firebase] Could not set local auth persistence.', err)
  );
}
export const storage = getStorage(app);
export { collection, addDoc, serverTimestamp, query, getDocs, onSnapshot, orderBy };

// Helper error handler adhering strictly to standard JSON error guidelines in SKILL.md
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on startup as strictly required by SKILL.md
// async function testConnection() {
//   try {
//     await getDocFromServer(doc(db, 'test', 'connection'));
//   } catch (error) {
//     if (error instanceof Error && error.message.includes('the client is offline')) {
//       console.error("Please check your Firebase configuration.");
//     }
//   }
// }
// testConnection();
