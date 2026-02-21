import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCNbuzJPStroRQpetbc-wF7VBKR-Qdu4Qo",
  authDomain: "pr-connexion-app-123.firebaseapp.com",
  projectId: "pr-connexion-app-123",
  storageBucket: "pr-connexion-app-123.firebasestorage.app",
  messagingSenderId: "1088483110910",
  appId: "1:1088483110910:web:a9c3c0f6556fe6b2411aaf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Cloud Messaging and get a reference to the service
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export default app;
