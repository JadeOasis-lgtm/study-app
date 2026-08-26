// firebase-init.js — connects to your Firebase project. This file is
// an ES MODULE (that's the whole reason for type="module" wherever
// it's loaded) — modules are what let us use "import" statements
// pulling code straight from Google's CDN, with no npm/build step.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// These are the exact values Firebase gave you — public identifiers,
// safe to sit in your public GitHub repo
const firebaseConfig = {
  apiKey: "AIzaSyBpMNYQkVwEAS2Cv0VdooJvalrDAWQPhqM",
  authDomain: "study-app-sync.firebaseapp.com",
  projectId: "study-app-sync",
  storageBucket: "study-app-sync.firebasestorage.app",
  messagingSenderId: "31006089867",
  appId: "1:31006089867:web:638192ac0a5fa3fdc36a8e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // not used yet — that's Phase 2

// Any other module script can now grab these with:
// import { app, auth, db } from "./firebase-init.js";
export { app, auth, db };