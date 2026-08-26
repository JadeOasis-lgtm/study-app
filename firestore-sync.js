// firestore-sync.js — the full sync module:
//  - startSync(user): pulls Firestore data down into localStorage in
//    real time, any change from either device
//  - migrateIfNeeded(user): fills in any key missing from the cloud
//    using what's in localStorage — never overwrites a key that's
//    already synced, so it's safe to call on every sign-in
//  - pushKey(key): called right after saving something locally,
//    pushes that one value up to Firestore

import { db } from "./firebase-init.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Single source of truth for which localStorage keys sync, and how
// each is stored locally:
// "json"   = read elsewhere with JSON.parse (arrays/objects)
// "string" = read elsewhere as a plain string
// "number" = read elsewhere with Number(...)
export const SYNCED_KEYS = {
  todos: "json",
  subjects: "json",
  sessionHistory: "json",
  cardReviewHistory: "json",
  goalHistory: "json",
  theme: "string",
  currentSubject: "string",
  dailyGoal: "number",
  pomodoroDuration: "number",
  shortDuration: "number",
  longDuration: "number",
  flashcards: "json",
  currentDeck: "string",
  reverseMode: "boolean"
};

let currentUser = null;
let unsubscribe = null;

function localValueToCloudValue(key, rawValue) {
  const type = SYNCED_KEYS[key];
  if (type === "json") return JSON.parse(rawValue);
  if (type === "number") return Number(rawValue);
  if (type === "boolean") return rawValue === "true"; // ADD THIS LINE
  return rawValue;
}

function cloudValueToLocalValue(key, cloudValue) {
  return SYNCED_KEYS[key] === "json" ? JSON.stringify(cloudValue) : cloudValue;
}

export function startSync(user) {
  currentUser = user;
  const userDocRef = doc(db, "users", user.uid);

  unsubscribe = onSnapshot(userDocRef, function(snapshot) {
    if (!snapshot.exists()) return;
    const cloudData = snapshot.data();

    Object.keys(SYNCED_KEYS).forEach(function(key) {
      if (cloudData[key] === undefined) return;
      localStorage.setItem(key, cloudValueToLocalValue(key, cloudData[key]));
    });

    window.dispatchEvent(new CustomEvent("cloud-data-updated"));
  }, function(error) {
    console.error("Firestore sync error:", error);
  });
}

export function stopSync() {
  if (unsubscribe) unsubscribe();
  currentUser = null;
}

export async function migrateIfNeeded(user) {
  const userDocRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userDocRef);
  const cloudData = snapshot.exists() ? snapshot.data() : {};

  const missingData = {};
  Object.keys(SYNCED_KEYS).forEach(function(key) {
    if (cloudData[key] !== undefined) return; // already synced — don't touch it
    const rawValue = localStorage.getItem(key);
    if (rawValue === null) return; // nothing local either
    missingData[key] = localValueToCloudValue(key, rawValue);
  });

  if (Object.keys(missingData).length === 0) return;
  await setDoc(userDocRef, missingData, { merge: true });
}

export function pushKey(key) {
  if (!currentUser) return;
  const rawValue = localStorage.getItem(key);
  if (rawValue === null) return;

  const userDocRef = doc(db, "users", currentUser.uid);
  const update = {};
  update[key] = localValueToCloudValue(key, rawValue);

  setDoc(userDocRef, update, { merge: true }).catch(function(error) {
    console.error("Firestore push error:", error);
  });
}