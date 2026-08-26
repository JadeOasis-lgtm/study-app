import { auth } from "./firebase-init.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const googleBtn = document.getElementById("google-signin-btn");
const showEmailBtn = document.getElementById("show-email-btn");
const emailForm = document.getElementById("email-form");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const emailSignUpBtn = document.getElementById("email-signup-btn");
const errorDisplay = document.getElementById("auth-error");

// Installed home-screen PWAs run in "standalone" mode — no browser
// bar at all. Google's sign-in popup wants a real browser window to
// pop open, which is unreliable in that mode on iOS. A full-page
// redirect (navigate away, then back) works reliably there instead.
function isStandalonePWA() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function showError(message) {
  errorDisplay.textContent = message;
  errorDisplay.classList.remove("hidden");
}

// Already signed in? Skip this page entirely.
onAuthStateChanged(auth, function(user) {
  if (user) {
    window.location.href = "index.html";
  }
});

googleBtn.addEventListener("click", function() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  if (isStandalonePWA()) {
    signInWithRedirect(auth, provider);
  } else {
    signInWithPopup(auth, provider).catch(function(error) {
      showError(error.message);
    });
  }
});

// Only relevant after a redirect (the standalone-PWA path above) —
// this is what catches you coming back from Google
getRedirectResult(auth).catch(function(error) {
  showError(error.message);
});

showEmailBtn.addEventListener("click", function() {
  emailForm.classList.toggle("hidden");
});

// Attached to the FORM's submit event (not the button's click) so
// pressing Enter in the password field also works, same as any
// normal login form
emailForm.addEventListener("submit", function(event) {
  event.preventDefault();
  signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
    .catch(function(error) { showError(error.message); });
});

emailSignUpBtn.addEventListener("click", function() {
  createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
    .catch(function(error) { showError(error.message); });
});