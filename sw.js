// A service worker is a separate background script — it doesn't run 
// on the page itself, and it can't touch the DOM. Its main power is 
// intercepting network requests, which is what lets it serve files 
// from a local cache instead of the internet.

const CACHE_NAME = "pomodoro-cache-22";
// Naming it with a version number lets us bust old caches later just 
// by changing this string — you'll see how below

// The "app shell" — every file needed for the app to fully function 
// with zero internet connection
const FILES_TO_CACHE = [
  "auth-guard.js",
  "calendar.css",
  "calendar.html",
  "calendar.js",
  "index.html",
  "main.css",
  "login.css",
  "login.html",
  "login.js",
  "shared.css",
  "shared.js",
  "pomodoro.html",
  "pomodoro.css",
  "pomodoro.js",
  "firebase-init.js",
  "firestore-sync.js",
  "flashcards.css",
  "flashcards.html",
  "flashcards.js",
  "todo.html",
  "todo.css",
  "todo.js",
  "stats.html",
  "stats.css",
  "stats.js",
  "study.html",
  "study.css",
  "study.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "sounds/light_rain.mp3",
  "sounds/soothing_instrumental.mp3",
  "sounds/happy_instrumental.mp3",
  "sounds/universfield-tranquil-flow-387676.mp3"
];

// "install" fires ONCE, the very first time this service worker is 
// registered (or whenever its code changes). This is our one chance 
// to pre-download and cache everything the app needs
self.addEventListener("install", function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  // event.waitUntil() tells the browser "don't consider install 
  // finished until this promise resolves" — without it, the browser 
  // might move on before caching actually completes
});

// "activate" fires once this service worker takes over control. 
// Good moment to clean up any OLD cached versions left over from 
// before, so you're not silently accumulating stale files forever
self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return clients.claim(); // NEW — once activated, immediately take
                                // control of any already-open tabs too,
                                // instead of only affecting future page loads
    })
  );
});

// "fetch" fires for EVERY network request the page makes — loading 
// index.html, script.js, an mp3, anything. This is the actual 
// offline magic: check the cache first, and only reach out to the 
// real network if it's not there
self.addEventListener("fetch", function(event) {
  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).catch(function() {
        // We only reach here if there's NO cache match AND the real 
        // network request also failed (e.g. offline). 
        // event.request.mode === "navigate" specifically identifies 
        // "the user is loading a whole page," as opposed to a request 
        // for an image, script, or font. For that one specific case, 
        // fall back to our cached main.html — this is what correctly 
        // handles someone opening the bare root URL while offline
        if (event.request.mode === "navigate") {
          return caches.match("index.html");
        }
      });
    })
  );
});