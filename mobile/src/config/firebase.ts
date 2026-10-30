import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyD3PFo-2s8hw2A5KgK7herT9cU0WqmWGjg",
  authDomain: "adani-energy-2f5e0.firebaseapp.com",
  projectId: "adani-energy-2f5e0",
  storageBucket: "adani-energy-2f5e0.firebasestorage.app",
  messagingSenderId: "381966539358",
  appId: "1:381966539358:web:1d6b976a8f5f7598d3b2cf",
  measurementId: "G-5F4Y1JX3EB"
};

// Initialize Firebase app singleton
export const firebaseApp: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Cloud Firestore database instance
export const firestoreDb: Firestore = getFirestore(firebaseApp);

export default firebaseApp;
