import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA-Q3X6ZJdS2EvEBDeyzsVtYCpQlFNQYX8",
  authDomain: "fir-b2f88.firebaseapp.com",
  projectId: "fir-b2f88",
  storageBucket: "fir-b2f88.firebasestorage.app",
  messagingSenderId: "133625889233",
  appId: "1:133625889233:web:742b2dd31f596137b8a0f0",
  measurementId: "G-ZR867LYG77"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
export { auth, provider };
