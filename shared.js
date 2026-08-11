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
const streakDisplayEl = document.getElementById("streak-display");
if (streakDisplayEl) {
  streakDisplayEl.textContent = `🔥 Streak: ${calculateStreak()}`;
}

//#endregion


//#region display flashcards due

const dueBadge = document.getElementById("due-badge");
if (dueBadge) {
  const allCards = JSON.parse(localStorage.getItem("flashcards")) || [];

  // NOTE: no .filter by deck here at all — combining every deck's 
  // due cards into one single number is exactly what makes this 
  // different from the per-deck count on flashcards.html
  const dueCount = allCards.filter(function(card) {
    return new Date(card.dueDate) <= new Date();
  }).length;

  if (dueCount > 0) {
    dueBadge.textContent = dueCount;
    dueBadge.classList.remove("hidden");
  }
}

//#endregion
