import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase configuration
// Replace these values with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBlOHJMRMhexZpNVrS-xwAb_F-gOohvh4k",
  authDomain: "globetrotter-aebe3.firebaseapp.com",
  projectId: "globetrotter-aebe3",
  storageBucket: "globetrotter-aebe3.firebasestorage.app",
  messagingSenderId: "78092910259",
  appId: "1:78092910259:web:3c89a8f3f15e91e545bac6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
