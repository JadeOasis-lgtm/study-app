import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { startSync, migrateIfNeeded } from "./firestore-sync.js"; // migrateIfNeeded added

onAuthStateChanged(auth, function(user) {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  console.log("[DEBUG] signed in as:", user.email, user.uid); // ADD THIS LINE
  migrateIfNeeded(user).then(function() {
    startSync(user);
  });
});