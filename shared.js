// shared.js — code used across MULTIPLE pages. Every page on your 
// site reads/writes the SAME localStorage (it's tied to your whole 
// site, not any individual HTML file) — that's what lets a streak 
// earned on the Pomodoro page show up correctly here too, with no 
// extra syncing code needed.

//#region Theme Colors
const THEME_COLORS = {
  red: "#ff6b6b",
  green: "#6bcf7f",
  blue: "#4d96ff",
  purple: "#b98eff"
};

const savedTheme = localStorage.getItem("theme") || "red";
document.documentElement.style.setProperty("--accent", THEME_COLORS[savedTheme]);

//#endregion


//#region Different Subjects

// A fixed palette, assigned to subjects in the order they're created — 
// this is what gives each subject a consistent, distinct color 
// everywhere it shows up across the whole app
const SUBJECT_COLORS = ["#ff6b6b", "#6bcf7f", "#4d96ff", "#b98eff", "#ffd93d", "#ffa94d", "#ff6bb0", "#4ddbc4"];

function getSubjects() {
  return JSON.parse(localStorage.getItem("subjects")) || [];
}

function saveSubjects(subjects) {
  localStorage.setItem("subjects", JSON.stringify(subjects));
  syncToCloud("subjects");
}

function addSubject(name) {
  const subjects = getSubjects();

  // Case-insensitive check so "Biology" and "biology" aren't treated 
  // as two different subjects by accident
  const existing = subjects.find(function(s) {
    return s.name.toLowerCase() === name.toLowerCase();
  });
  if (existing) return existing;

  // % cycles back to the start of the palette once you have more 
  // subjects than colors — the 9th subject reuses color #1, and so on
  const color = SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length];

  const newSubject = { name: name, color: color };
  subjects.push(newSubject);
  saveSubjects(subjects);
  return newSubject;
}

// Deletes a subject/deck, along with every flashcard and to-do tagged
// with it. sessionHistory and cardReviewHistory are deliberately left
// alone — those are a record of study time that already happened,
// not "content" that belongs to the subject.
function deleteSubject(name) {
  const subjects = getSubjects().filter(function(s) { return s.name !== name; });
  saveSubjects(subjects);

  const cards = JSON.parse(localStorage.getItem("flashcards")) || [];
  const remainingCards = cards.filter(function(c) { return c.deck !== name; });
  localStorage.setItem("flashcards", JSON.stringify(remainingCards));

  const todos = JSON.parse(localStorage.getItem("todos")) || [];
  const remainingTodos = todos.filter(function(t) { return t.subject !== name; });
  localStorage.setItem("todos", JSON.stringify(remainingTodos));
  syncToCloud("todos"); // ADD THIS LINE

  if (localStorage.getItem("currentSubject") === name) {
    localStorage.removeItem("currentSubject");
  }
  if (localStorage.getItem("currentDeck") === name) {
    localStorage.removeItem("currentDeck");
  }
}
//#endregion


//#region streak calculation
function calculateStreak() {
  const goalHistory = JSON.parse(localStorage.getItem("goalHistory")) || {};

  const qualifyingDayStrings = Object.keys(goalHistory).filter(function(dayString) {
    return goalHistory[dayString].met;
  });

  if (qualifyingDayStrings.length === 0) return 0;

  const activeDays = qualifyingDayStrings
    .map(function(dayString) { return new Date(dayString); })
    .sort(function(a, b) { return b - a; });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysSinceLastSession = Math.round((today - activeDays[0]) / 86400000);
  if (daysSinceLastSession > 1) return 0;

  let streak = 1;
  for (let i = 1; i < activeDays.length; i++) {
    const gap = Math.round((activeDays[i - 1] - activeDays[i]) / 86400000);
    if (gap === 1) streak++;
    else break;
  }
  return streak;
}

// Only fills in a streak display if THIS page actually has one — 
// that "if" check means shared.js is safe to include on every page, 
// even ones with no streak element at all, without throwing errors
function updateStreakDisplay() {
  const streakDisplayEl = document.getElementById("streak-display");
  if (streakDisplayEl) {
    streakDisplayEl.textContent = `🔥 Streak: ${calculateStreak()}`;
  }
}

updateStreakDisplay();

//#endregion


//#region display flashcards due

function updateDueBadge() {
  const dueBadge = document.getElementById("due-badge");
  if (dueBadge) {
    const allCards = JSON.parse(localStorage.getItem("flashcards")) || [];
    const dueCount = allCards.filter(function(card) {
      return new Date(card.dueDate) <= new Date();
    }).length;

    if (dueCount > 0) {
      dueBadge.textContent = dueCount;
      dueBadge.classList.remove("hidden");
    } else {
      dueBadge.classList.add("hidden"); // NEW — if a review on your phone drops this to 0, hide it here too, not just show it
    }
  }
}
updateDueBadge();

//#endregion


//#region flashcard count

function getCardReviewHistory() {
  return JSON.parse(localStorage.getItem("cardReviewHistory")) || [];
}

function saveCardReviewHistory(history) {
  localStorage.setItem("cardReviewHistory", JSON.stringify(history));
  syncToCloud("cardReviewHistory");
}

// One entry per card reviewed — deliberately separate from 
// sessionHistory/streak/goal, since this isn't meant to touch those at all
function recordCardReview(subject) {
  const history = getCardReviewHistory();
  history.push({
    date: new Date().toISOString(),
    subject: subject || "None"
  });
  saveCardReviewHistory(history);
}

//#endregion


//#region todos
function getTodos() {
  return JSON.parse(localStorage.getItem("todos")) || [];
}

function saveTodos(todos) {
  localStorage.setItem("todos", JSON.stringify(todos));
  syncToCloud("todos");
}

//#endregion


//#region cloud sync
// shared.js is a plain (non-module) script, so it can't use a
// top-level "import ... from" the way login.js/auth-guard.js do. A
// dynamic import() is the plain-script equivalent — just a normal
// function call returning a Promise — so this works with zero
// changes to how shared.js or any page that loads it is set up.
let syncModulePromise = null;
function getSyncModule() {
  if (!syncModulePromise) {
    syncModulePromise = import("./firestore-sync.js");
  }
  return syncModulePromise;
}

// Call right after writing something to localStorage, with the same
// key you just saved. Pushes it to Firestore in the background —
// doesn't block, and if it fails (offline, e.g.), the next
// successful save naturally catches the cloud back up.
function syncToCloud(key) {
  getSyncModule().then(function(module) {
    module.pushKey(key);
  });
}
//#endregion

//#region live cloud updates
window.addEventListener("cloud-data-updated", function() {
  updateStreakDisplay();
  updateDueBadge();
});
//#endregion