//#region set up constant variables
// ----- STEP 1: Grab references to our HTML elements -----
// document.getElementById() finds an element by the "id" we set in HTML
// so JavaScript can read or change it

const timerDisplay = document.getElementById("timer-display");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const resetBtn = document.getElementById("reset-btn");

// References to the mode buttons and streak display
const modePomodoroBtn = document.getElementById("mode-pomodoro");
const modeShortBtn = document.getElementById("mode-short");
const modeLongBtn = document.getElementById("mode-long");
const streakDisplay = document.getElementById("streak-display");

//Colors

const themePicker = document. getElementById("theme-picker")

// Load whatever theme was saved last time, defaulting to red
let currentTheme = localStorage.getItem("theme") || "red";
themePicker.value = currentTheme; // reflect it in the dropdown itself
document.documentElement.style.setProperty("--accent", THEME_COLORS[currentTheme]);

themePicker.addEventListener("change", function() {
  currentTheme = themePicker.value;
  document.documentElement.style.setProperty("--accent", THEME_COLORS[currentTheme]);
  localStorage.setItem("theme", currentTheme);
  syncToCloud("theme"); // ADD THIS LINE
});

//#endregion


//#region set up starting states
// ----- STEP 2: Set up our starting state -----


// Load saved durations (in minutes) from localStorage, falling back 
// to the original defaults if nothing's been saved yet
const savedPomodoro = Number(localStorage.getItem("pomodoroDuration")) || 25;
const savedShort = Number(localStorage.getItem("shortDuration")) || 5;
const savedLong = Number(localStorage.getItem("longDuration")) || 15;

const DURATIONS = {
  pomodoro: savedPomodoro * 60,
  short: savedShort * 60,
  long: savedLong * 60
};

let currentMode = "pomodoro"; // Tracks which mode is active right now
let totalSeconds = DURATIONS[currentMode]; // Instead of hardcoding to 25*60, dependent on type
let timerInterval = null;
let isRunning = false;

const pomodoroDurationInput = document.getElementById("pomodoro-duration");
const shortDurationInput = document.getElementById("short-duration");
const longDurationInput = document.getElementById("long-duration");

// Reflect whatever was loaded/saved into the input boxes on page load
pomodoroDurationInput.value = savedPomodoro;
shortDurationInput.value = savedShort;
longDurationInput.value = savedLong;

function updateDuration(mode, input) {
  const minutes = Number(input.value) > 0 ? Number(input.value) : 1;

  DURATIONS[mode] = minutes * 60;

  localStorage.setItem(mode + "Duration", minutes);
  syncToCloud(mode + "Duration");

  // If the mode being edited is the one currently selected, and 
  // nothing's actively running, snap the visible countdown to match 
  // right away instead of waiting for a manual Reset
  if (mode === currentMode && !isRunning) {
    totalSeconds = DURATIONS[mode];
    updateDisplay();
  }
}

pomodoroDurationInput.addEventListener("input", function() {
  updateDuration("pomodoro", pomodoroDurationInput);
});

shortDurationInput.addEventListener("input", function() {
  updateDuration("short", shortDurationInput);
});

longDurationInput.addEventListener("input", function() {
  updateDuration("long", longDurationInput);
});

let streakCount = 0;
//#endregion


//#region Subject Picker

const subjectPicker = document.getElementById("subject-picker");
const newSubjectRow = document.getElementById("new-subject-row");
const newSubjectInput = document.getElementById("new-subject-input");
const newSubjectConfirm = document.getElementById("new-subject-confirm");

function populateSubjectDropdown() {
  // Clear out any subject options from a previous call, but leave 
  // "No subject" and "+ Add New Subject" alone — those two are fixed 
  // and never regenerated
  subjectPicker.querySelectorAll(".subject-option").forEach(function(opt) {
    opt.remove();
  });

  const subjects = getSubjects(); // from shared.js
  const addNewOption = subjectPicker.querySelector('option[value="__new__"]');

  subjects.forEach(function(subject) {
    const option = document.createElement("option");
    option.value = subject.name;
    option.textContent = subject.name;
    option.className = "subject-option";
    // insertBefore places each new option right before "+ Add New 
    // Subject", so that option always stays pinned at the very bottom
    subjectPicker.insertBefore(option, addNewOption);
  });

  subjectPicker.value = localStorage.getItem("currentSubject") || "";
}

subjectPicker.addEventListener("change", function() {
  if (subjectPicker.value === "__new__") {
    newSubjectRow.classList.remove("hidden");
    newSubjectInput.focus();
    // Snap the dropdown back to whatever was selected before, so it 
    // doesn't visually sit on "+ Add New Subject" while you type
    subjectPicker.value = localStorage.getItem("currentSubject") || "";
  } else {
    localStorage.setItem("currentSubject", subjectPicker.value);
    syncToCloud("currentSubject");
    newSubjectRow.classList.add("hidden");
  }
});

newSubjectConfirm.addEventListener("click", function() {
  const name = newSubjectInput.value.trim();
  if (name === "") return;

  addSubject(name); // from shared.js
  populateSubjectDropdown();
  subjectPicker.value = name;
  localStorage.setItem("currentSubject", name);
  syncToCloud("currentSubject");
  newSubjectInput.value = "";
  newSubjectRow.classList.add("hidden");
});

const deleteSubjectBtn = document.getElementById("delete-subject-btn");

deleteSubjectBtn.addEventListener("click", function() {
  const name = subjectPicker.value;
  if (name === "" || name === "__new__") return; // nothing real selected

  const confirmed = confirm(`Delete "${name}"? This also deletes all its flashcards and to-dos. This can't be undone.`);
  if (!confirmed) return;

  deleteSubject(name); // shared.js
  populateSubjectDropdown();
});

populateSubjectDropdown(); // run once on page load

//#endregion


//#region seession history tracking

const statsDisplay = document.getElementById("stats-display");

// localStorage only stores STRINGS — so to save a whole array, we 
// convert it to a JSON string with JSON.stringify() before saving, 
// and JSON.parse() to turn it back into a real array when loading
let sessionHistory = JSON.parse(localStorage.getItem("sessionHistory")) || [];
let goalHistory = JSON.parse(localStorage.getItem("goalHistory")) || {};

function recordSession(minutes) {
  // Stores an object with two pieces of info, instead of just a raw date string
  const entry = {
    date: new Date().toISOString(),
    minutes: minutes,
    subject: subjectPicker.value || "None"
  };

  sessionHistory.push(entry);
  localStorage.setItem("sessionHistory", JSON.stringify(sessionHistory));
  syncToCloud("sessionHistory");

  updateGoalHistory();
  streakCount = calculateStreak();
  updateStreakDisplay();
  
  updateStatsDisplay();
  updateHistogram();
  updateGoalProgress();
}

function updateStatsDisplay() {
  const now = new Date();

  const todayCount = sessionHistory.filter(function(entry) {
    const sessionDate = new Date(entry.date);
    return sessionDate.toDateString() === now.toDateString();
    // .toDateString() strips away the time and gives just the day, 
    // e.g. "Sat Aug 08 2026". Two dates on the same calendar day 
    // will produce the exact same string, so this comparison works 
    // as a simple "is this the same day?" check
  }).length;

  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  // .setDate() shifts a date backward/forward. This takes a COPY of 
  // "now" and moves it back 7 days, giving us a cutoff point

  const weekCount = sessionHistory.filter(function(entry) {
    const sessionDate = new Date(entry.date);
    return sessionDate >= oneWeekAgo;
    // Date objects can be compared directly with >= — JavaScript 
    // treats them as timestamps under the hood, so this just checks 
    // "did this session happen within the last 7 days?"
  }).length;

  statsDisplay.textContent = `Today: ${todayCount} · This Week: ${weekCount}`;
}

function updateHistogram() {
  const container = document.getElementById("weekly-histogram");
  container.innerHTML = ""; // wipes out any old bars before redrawing

  const days = []; // will hold { label, minutes } for each of the last 7 days

  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    // i=6 gives us 6 days ago (start of week), counting down to i=0 (today)

    const dayMinutes = sessionHistory
      .filter(function(entry) {
        return new Date(entry.date).toDateString() === day.toDateString();
      })
      .reduce(function(total, entry) {
        return total + entry.minutes;
      }, 0);
    // .reduce() walks through an array and combines it into ONE value.
    // Here it adds up every session's minutes for that specific day, 
    // starting from 0
    const label = day.toLocaleDateString("en-US", { weekday: "short" });
    // Converts a Date into a readable short weekday name, e.g. "Mon"

    days.push({ label: label, minutes: dayMinutes });
  }

const maxMinutes = Math.max(...days.map(function(d) { return d.minutes; }), 1);
  // .map() transforms an array into a new array — here, turning our 
  // 7 day-objects into just a plain list of their minute values.
  // Math.max(...) then finds the largest one. The "..." (spread syntax) 
  // unpacks the array into individual arguments, since Math.max needs 
  // separate numbers, not one array. The extra ", 1" guarantees we never 
  // divide by zero below, even if the whole week has 0 minutes logged.

  days.forEach(function(day) {
    const wrapper = document.createElement("div");
    // document.createElement() builds a brand new HTML element in 
    // memory — it doesn't appear on the page until we explicitly 
    // attach it, below

    wrapper.className = "bar-wrapper";

    const minutesLabel = document.createElement("div");
    minutesLabel.className = "bar-minutes";
    minutesLabel.textContent = day.minutes.toFixed(1);

    const bar = document.createElement("div");
    bar.className = "bar";
    const heightPercent = (day.minutes / maxMinutes) * 100;
    bar.style.height = `${heightPercent}%`;
    // Setting .style directly from JS applies an inline style — used 
    // here because the height is DATA-driven and different every time, 
    // which isn't something you can hardcode in a .css file

    const dayLabel = document.createElement("div");
    dayLabel.className = "bar-label";
    dayLabel.textContent = day.label;

    wrapper.appendChild(minutesLabel);
    wrapper.appendChild(bar);
    wrapper.appendChild(dayLabel);
    // .appendChild() nests one element inside another — this builds 
    // the wrapper's internal structure before we place it on the page

    container.appendChild(wrapper);
    // finally attaches this whole wrapper into the actual page
  });
}

function updateGoalHistory() {
  const today = new Date();
  const todayString = today.toDateString();

  const todayMinutes = sessionHistory
    .filter(function(entry) {
      return new Date(entry.date).toDateString() === todayString;
    })
    .reduce(function(total, entry) {
      return total + entry.minutes;
    }, 0);

  // This line ALWAYS writes to today's key specifically — it can 
  // never accidentally touch yesterday's or any earlier day's entry, 
  // which is exactly what makes past days "lock in" naturally over time
  goalHistory[todayString] = {
    minutes: todayMinutes,
    goal: dailyGoal, // snapshots whatever the goal is RIGHT NOW
    met: todayMinutes >= dailyGoal
  };

  localStorage.setItem("goalHistory", JSON.stringify(goalHistory));
  syncToCloud("goalHistory");
}

//#endregion


//#region Daily Goal Tracking

//Variable Setup
const goalInput = document.getElementById("daily-goal");
const goalFill = document.getElementById("goal-progress-fill");
const goalPercentage = document.getElementById("goal-percentage");

// Number() converts the saved string back into a real number.
// If nothing's saved yet, default to 60 minutes.
let dailyGoal = Number(localStorage.getItem("dailyGoal")) || 60;
goalInput.value = dailyGoal; // reflect the saved goal in the input box on load


//Update goal progress
function updateGoalProgress() {
  const now = new Date();

  let todayMinutes = sessionHistory
    .filter(function(entry) {
      return new Date(entry.date).toDateString() === now.toDateString();
    })
    .reduce(function(total, entry) {
      return total + entry.minutes;
    }, 0);
  // Same filter-then-reduce pattern from the histogram: first narrow 
  // down to just today's sessions, then sum up their minutes
  
  
  
  //if a Pomodoro is actively counting down right now, add its 
  // in-progress elapsed time too, so the bar moves live instead of 
  // only jumping once a full session finishes
  if (isRunning && currentMode === "pomodoro") {
    const elapsedSeconds = DURATIONS[currentMode] - totalSeconds;
    const elapsedMinutes = elapsedSeconds / 60;
    todayMinutes += elapsedMinutes;
  }


  const rawPercent = (todayMinutes / dailyGoal) * 100;
  const displayPercent = Math.round(rawPercent);
  // Math.round() so we show a clean whole number like "42%" instead 
  // of "41.6666...%"

  const barPercent = Math.min(rawPercent, 100);
  // Math.min() caps the BAR at 100% so it never visually overflows 
  // its container — but note we use rawPercent (uncapped) for the 
  // TEXT below, so hitting 150% of your goal proudly shows "150%" 
  // even though the bar itself just looks full

  goalFill.style.width = `${barPercent}%`;
  goalPercentage.textContent = `${displayPercent}%`;
}

// Runs whenever the input changes — "input" fires on every keystroke, 
// as opposed to "change" which only fires once you click away
goalInput.addEventListener("input", function() {
  const value = Number(goalInput.value);
  dailyGoal = value > 0 ? value : 1;
  // Guards against 0 or negative goals, which would break the math 
  // above (dividing by 0 or a negative number)

  localStorage.setItem("dailyGoal", dailyGoal);
  syncToCloud("dailyGoal");
  updateGoalProgress();
  
  updateGoalHistory();
  streakCount = calculateStreak();
  updateStreakDisplay();
});

// Buttons for Increasing or Decreasing Goal
const goalDecreaseBtn = document.getElementById("goal-decrease");
const goalIncreaseBtn = document.getElementById("goal-increase");

function adjustGoal(amount) {
  const newValue = Math.max(1, dailyGoal + amount);
  // Math.max(1, ...) stops the goal from ever dropping to 0 or negative

  dailyGoal = newValue;
  goalInput.value = dailyGoal; // keeps the visible number in sync with the buttons
  localStorage.setItem("dailyGoal", dailyGoal);
  syncToCloud("dailyGoal");
  updateGoalProgress();
  
  updateGoalHistory();
  streakCount = calculateStreak();
  updateStreakDisplay();
}

goalDecreaseBtn.addEventListener("click", function() {
  adjustGoal(-5); // steps by 5 minutes at a time — change this number if you want finer/coarser control
});

goalIncreaseBtn.addEventListener("click", function() {
  adjustGoal(5);
});

//#endregion


//#region Streak Tracking

function calculateStreak() {
  const qualifyingDayStrings = Object.keys(goalHistory).filter(function(dayString) {
    return goalHistory[dayString].met;
  });

  if (qualifyingDayStrings.length === 0) return 0;

  const activeDays = qualifyingDayStrings
    .map(function(dayString) {
      return new Date(dayString);
    })
    .sort(function(a, b) {
      return b - a;
    });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mostRecentActiveDay = activeDays[0];
  const daysSinceLastSession = Math.round((today - mostRecentActiveDay) / 86400000);

  if (daysSinceLastSession > 1) return 0;

  let streak = 1;
  for (let i = 1; i < activeDays.length; i++) {
    const gap = Math.round((activeDays[i - 1] - activeDays[i]) / 86400000);
    if (gap === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}



//#endregion


//#region Exit When Pressing Enter

// Dismisses the on-screen keyboard when Enter is pressed, mimicking 
// what tapping the checkmark/Done button already does
function dismissKeyboardOnEnter(input) {
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      // e.key tells us which key triggered this event; "Enter" 
      // covers both Return and the checkmark-style confirm key
      input.blur();
      // .blur() removes focus from the input — the same effect as 
      // tapping elsewhere on the page, which is what closes the 
      // keyboard
    }
  });
}

dismissKeyboardOnEnter(goalInput);
dismissKeyboardOnEnter(pomodoroDurationInput);
dismissKeyboardOnEnter(shortDurationInput);
dismissKeyboardOnEnter(longDurationInput);

//#endregion


//#region track scrolling

const themeSelectContainer = document.getElementById("theme-select");
let lastScrollY = window.scrollY;

let maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
// Calculated once up front, OUTSIDE the scroll handler

function updateMaxScroll() {
  maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
}

// Only recalculate when the page's actual layout changes — not during 
// scrolling itself, which is what was causing the instability
window.addEventListener("resize", updateMaxScroll);
window.addEventListener("orientationchange", updateMaxScroll);

window.addEventListener("scroll", function() {
  const currentScrollY = Math.max(0, Math.min(window.scrollY, maxScrollY));
  // Now clamps against a STABLE ceiling instead of a constantly 
  // shifting one

  if (currentScrollY > lastScrollY && currentScrollY > 50) {
    themeSelectContainer.classList.add("hidden");
  } else if (currentScrollY < lastScrollY) {
    themeSelectContainer.classList.remove("hidden");
  }

  lastScrollY = currentScrollY;
});

//#endregion


//#region sound

let audioCtx = null; // will hold our one shared audio context

function getAudioContext() {
  if (!audioCtx) {
    // window.AudioContext is standard; webkitAudioContext is an older 
    // fallback some Safari versions still need
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    // iOS often starts audio "asleep" until directly woken up by a tap
    audioCtx.resume();
  }
  return audioCtx;
}

// Plays a short 3-note chime — used when any timer finishes
function playChime() {
  const ctx = getAudioContext();
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 — a simple pleasant chord, walked upward

  notes.forEach(function(freq, i) {
    const oscillator = ctx.createOscillator(); // generates a raw tone at a given pitch
    const gainNode = ctx.createGain(); // lets us control volume / fade

    oscillator.frequency.value = freq;
    oscillator.type = "sine"; // smooth and soft, vs. "square"/"sawtooth" which sound harsh

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination); // destination = your speakers

    const startTime = ctx.currentTime + i * 0.15; // stagger each note slightly
    gainNode.gain.setValueAtTime(0.15, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
    // fades the note out smoothly instead of cutting off abruptly (avoids a "click" sound)

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.3);
  });
}

// ----- Ambient sound -----

const soundSelect = document.getElementById("ambient-sound");

// Maps each dropdown value to the actual file path
const SOUND_FILES = {
  light_rain: "sounds/light_rain.mp3",
  soothing_instrumental: "sounds/soothing_instrumental.mp3",
  happy_instrumental: "sounds/happy_instrumental.mp3",
  nature: "sounds/universfield-tranquil-flow-387676.mp3",
  water: "sounds/soothing_water.mp3",
  chill_study: "sounds/chill_study.mp3"
};

let ambientAudio = null; // will hold the current

function startAmbientNoise() {
  if (ambientAudio) return;

  const chosen = soundSelect.value;
  if (chosen === "none") return;

  ambientAudio = new Audio(SOUND_FILES[chosen]);
  ambientAudio.loop = true;
  ambientAudio.volume = 0.4;

  ambientAudio.play().catch(function(error) {
    // .play() returns a Promise — if it fails, this catches WHY 
    // instead of failing silently
    console.error("Audio failed to play:", error);
  });

  ambientAudio.addEventListener("error", function() {
    // This fires specifically if the FILE ITSELF couldn't load 
    // (wrong path, missing file, corrupted/unsupported format)
    console.error("Audio failed to load. Check the file path:", SOUND_FILES[chosen]);
  });
}

function stopAmbientNoise() {
  if (ambientAudio) {
    ambientAudio.pause();
    ambientAudio.currentTime = 0; // rewind to the start for next time
    ambientAudio = null; // clear the reference so startAmbientNoise() knows it can start fresh
  }
}

//#endregion


//#region functions
// ----- STEP 3: A function that updates what's shown on screen -----

function updateDisplay() {
  const minutes = Math.floor(totalSeconds / 60);
  // Math.floor rounds DOWN to the nearest whole number

  const seconds = totalSeconds % 60;
  // % is "modulo" — it gives the REMAINDER after dividing.
  // e.g. 65 % 60 = 5. This is the standard trick for turning a total 
  // number of seconds into minutes + leftover seconds

  const minutesStr = String(minutes).padStart(2, "0");
  const secondsStr = String(seconds).padStart(2, "0");
  // padStart(2, "0") makes single digits show as "05" instead of "5"

  timerDisplay.textContent = `${minutesStr}:${secondsStr}`;
  // Backticks `` let us insert variables into a string using ${...} 
  // — this is called a "template literal"
}

// A small function just for refreshing the streak text
function updateStreakDisplay() {
  streakDisplay.textContent = `🔥 Streak: ${streakCount}`;
}

// Switches which mode is active
function switchMode(mode) {
  clearInterval(timerInterval); // stop any timer that's currently running
  isRunning = false;
  stopAmbientNoise()

  currentMode = mode;
  totalSeconds = DURATIONS[mode]; // look up the right duration for this mode
  updateDisplay();
  updateGoalProgress();

  // classList lets us add/remove CSS classes from JavaScript.
  // Here we strip "active" off all three buttons first...
  modePomodoroBtn.classList.remove("active");
  modeShortBtn.classList.remove("active");
  modeLongBtn.classList.remove("active");

  // ...then add it back onto ONLY the one that matches the new mode.
  // This is what visually moves the red highlight between buttons.
  if (mode === "pomodoro") modePomodoroBtn.classList.add("active");
  if (mode === "short") modeShortBtn.classList.add("active");
  if (mode === "long") modeLongBtn.classList.add("active");
}



// ----- STEP 4: The countdown logic itself -----

function tick() {
  if (totalSeconds > 0) {
    totalSeconds--; // shorthand for totalSeconds = totalSeconds - 1
    updateDisplay();
    updateGoalProgress();
  } else {
    clearInterval(timerInterval); // stop once it hits 0
    isRunning = false;
    // Only count a streak when a POMODORO (not a break) finishes
    stopAmbientNoise()
    playChime()
    if (currentMode === "pomodoro") {
      recordSession(DURATIONS.pomodoro / 60);

    totalSeconds = DURATIONS[currentMode];
    updateDisplay();
    }
  }
}



//#endregion


//#region wire up buttons
// ----- STEP 5: Wire up the buttons -----
// addEventListener("click", ...) means "when this is clicked, run this"

startBtn.addEventListener("click", function() {
  if (isRunning) return; // already running? do nothing
  
  getAudioContext(); // "Wakes up" the AudioContext during this real tap, 
                      // so playChime() can safely use it later even though 
                      // tick() itself isn't a direct user gesture


  isRunning = true;
  timerInterval = setInterval(tick, 1000);
  // setInterval runs a function repeatedly, every X milliseconds.
  // 1000ms = 1 second, so tick() fires once per second

  if (currentMode === "pomodoro") {
    startAmbientNoise(); // NEW — only during focus sessions, not breaks
  }
});

pauseBtn.addEventListener("click", function() {
  clearInterval(timerInterval); // tells setInterval to stop firing
  isRunning = false;
  stopAmbientNoise();
  updateGoalProgress();
});

resetBtn.addEventListener("click", function() {
  clearInterval(timerInterval);
  isRunning = false;
  stopAmbientNoise();
  totalSeconds = DURATIONS[currentMode]; // back to whatever it was before
  updateDisplay();
  updateGoalProgress();
});



// Mode button listeners — clicking one calls switchMode with its name
modePomodoroBtn.addEventListener("click", function() {
  switchMode("pomodoro");
});

modeShortBtn.addEventListener("click", function() {
  switchMode("short");
});

modeLongBtn.addEventListener("click", function() {
  switchMode("long");
});
//#endregion


//#region update stuff

// ----- STEP 6: Show the correct time as soon as the page loads -----
updateDisplay();
updateGoalHistory();
streakCount = calculateStreak();
updateStreakDisplay();
updateStatsDisplay();
updateHistogram();
updateGoalProgress();
//#endregion


//#region service worker

// Service workers are an optional browser feature — this check 
// avoids errors on any browser that might not support them at all
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function() {
    navigator.serviceWorker.register("sw.js")
      .then(function() {
        console.log("Service worker registered successfully");
      })
      .catch(function(error) {
        console.log("Service worker registration failed:", error);
      });
  });
}
//#endregion

