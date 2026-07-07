import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  enableNetwork,
  disableNetwork
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Inicializa o app do Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Firestore com cache local offline persistente e gerenciamento de abas múltiplas
const db = initializeFirestore(
  app, 
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  },
  (firebaseConfig as any).firestoreDatabaseId
);

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
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.warn('Firestore Error: ', JSON.stringify(errInfo));
}

export { db, collection, doc, setDoc, getDocs, onSnapshot, enableNetwork, disableNetwork };
