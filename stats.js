// Reads the SAME sessionHistory your Pomodoro page has been writing 
// to all along — nothing new is being tracked here, we're just 
// presenting existing data a different way
const sessionHistory = JSON.parse(localStorage.getItem("sessionHistory")) || [];

function getMonday(date) {
  const d = new Date(date); // copy, so we don't mutate whatever was passed in
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // If today IS Sunday (0), we need to go back 6 days to reach Monday.
  // Any other day, we go back (day - 1) days — e.g. Wednesday (3) 
  // goes back 2 days to land on Monday.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);

  d.setDate(diff);
  d.setHours(0, 0, 0, 0); // snap to midnight, so time-of-day never affects comparisons
  return d;
}

function updateSummaryCards() {
  const now = new Date();

  const todayMinutes = sessionHistory
    .filter(function(entry) {
      return new Date(entry.date).toDateString() === now.toDateString();
    })
    .reduce(function(total, entry) { return total + entry.minutes; }, 0);

  const thisMonday = getMonday(now); // reuses the same helper the histogram already relies on

  const weekMinutes = sessionHistory
    .filter(function(entry) {
        return new Date(entry.date) >= thisMonday;
    })
    .reduce(function(total, entry) { return total + entry.minutes; }, 0);

  // NEW: no filter at all — every session ever recorded, all summed together
  const totalMinutes = sessionHistory.reduce(function(total, entry) {
    return total + entry.minutes;
  }, 0);

  document.getElementById("today-minutes").textContent = Math.round(todayMinutes);
  document.getElementById("week-minutes").textContent = Math.round(weekMinutes);
  document.getElementById("total-minutes").textContent = Math.round(totalMinutes);
}

function updateBestDay() {
  // Same "build a lookup table keyed by day" pattern from calculateStreak()
  const minutesByDay = {};

  sessionHistory.forEach(function(entry) {
    const dayString = new Date(entry.date).toDateString();
    minutesByDay[dayString] = (minutesByDay[dayString] || 0) + entry.minutes;
  });

  // Object.values() pulls out just the NUMBERS from that lookup table, 
  // discarding the day-string keys — we only care about the totals here
  const allDayTotals = Object.values(minutesByDay);
  const best = allDayTotals.length > 0 ? Math.max(...allDayTotals) : 0;

  document.getElementById("best-day").textContent = Math.round(best);
}


function updateHistogram() {
  const container = document.getElementById("weekly-histogram");
  container.innerHTML = "";

  const thisMonday = getMonday(new Date());
  const subjects = getSubjects(); // from shared.js
  const days = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(thisMonday);
    day.setDate(thisMonday.getDate() + i);
    const dayString = day.toDateString();

    const dayEntries = sessionHistory.filter(function(entry) {
      return new Date(entry.date).toDateString() === dayString;
    });

    // NEW: instead of one total, build a lookup of minutes PER SUBJECT 
    // for this specific day
    const minutesBySubject = {};
    dayEntries.forEach(function(entry) {
      const subjectName = entry.subject || "None";
      minutesBySubject[subjectName] = (minutesBySubject[subjectName] || 0) + entry.minutes;
    });

    const dayTotal = dayEntries.reduce(function(total, entry) {
      return total + entry.minutes;
    }, 0);

    // NEW: count how many card-review entries fall on this same day
    const dayCardCount = cardReviewHistory.filter(function(entry) {
      return new Date(entry.date).toDateString() === dayString;
    }).length;

    const label = day.toLocaleDateString("en-US", { weekday: "short" });
    days.push({ label: label, total: dayTotal, bySubject: minutesBySubject, cardCount: dayCardCount }); // ADDED cardCount
  }

  const maxMinutes = Math.max(...days.map(function(d) { return d.total; }), 1);

  days.forEach(function(day) {
    const wrapper = document.createElement("div");
    wrapper.className = "bar-wrapper";

    const minutesLabel = document.createElement("div");
    minutesLabel.className = "bar-minutes";
    minutesLabel.textContent = Math.round(day.total);

    const barStack = document.createElement("div");
    barStack.className = "bar-stack";
    barStack.style.height = `${(day.total / maxMinutes) * 100}%`;

    // Loop through KNOWN subjects first, in a consistent order, so 
    // the same subject always stacks in the same position/color 
    // across every day — then handle "None" separately at the end
    subjects.forEach(function(subject) {
      const mins = day.bySubject[subject.name];
      if (mins) {
        const segment = document.createElement("div");
        segment.className = "bar-segment";
        segment.style.backgroundColor = subject.color;
        segment.style.flex = mins; // the ratio trick — see CSS comment
        barStack.appendChild(segment);
      }
    });

    if (day.bySubject["None"]) {
      const segment = document.createElement("div");
      segment.className = "bar-segment";
      segment.style.backgroundColor = "#555"; // neutral gray for unlabeled sessions
      segment.style.flex = day.bySubject["None"];
      barStack.appendChild(segment);
    }

    const dayLabel = document.createElement("div");
    dayLabel.className = "bar-label";
    dayLabel.textContent = day.label;

    const tooltip = buildTooltip(day, subjects);
    wrapper.appendChild(tooltip);

    // Tap-to-toggle for touch devices, since :hover doesn't apply 
    // to a finger on a screen the way it does a mouse cursor
    wrapper.addEventListener("click", function() {
      wrapper.classList.toggle("show-tooltip");
    });

    wrapper.appendChild(minutesLabel);
    wrapper.appendChild(barStack);
    wrapper.appendChild(dayLabel);
    container.appendChild(wrapper);
  });
}


function updateLegend() {
  const legendContainer = document.getElementById("histogram-legend");
  legendContainer.innerHTML = "";

  const subjects = getSubjects();

  // Only show a subject in the legend if it actually has minutes 
  // logged somewhere in sessionHistory — no point listing subjects 
  // you created but never actually used yet
  const usedSubjectNames = new Set(
    sessionHistory.map(function(entry) { return entry.subject || "None"; })
  );

  subjects.forEach(function(subject) {
    if (!usedSubjectNames.has(subject.name)) return;

    const item = document.createElement("div");
    item.className = "legend-item";

    const swatch = document.createElement("div");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = subject.color;

    const label = document.createElement("span");
    label.textContent = subject.name;

    item.appendChild(swatch);
    item.appendChild(label);
    legendContainer.appendChild(item);
  });

  if (usedSubjectNames.has("None")) {
    const item = document.createElement("div");
    item.className = "legend-item";

    const swatch = document.createElement("div");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = "#555";

    const label = document.createElement("span");
    label.textContent = "None";

    item.appendChild(swatch);
    item.appendChild(label);
    legendContainer.appendChild(item);
  }
}


function buildTooltip(day, subjects) {
  const tooltip = document.createElement("div");
  tooltip.className = "bar-tooltip";

  const hasMinutesData = Object.keys(day.bySubject).length > 0;
  const hasCardData = day.cardCount > 0;

  if (!hasMinutesData && !hasCardData) {
    tooltip.textContent = "No activity";
    return tooltip;
  }

  subjects.forEach(function(subject) {
    const mins = day.bySubject[subject.name];
    if (!mins) return;

    const row = document.createElement("div");
    row.className = "tooltip-row";

    const swatch = document.createElement("div");
    swatch.className = "tooltip-swatch";
    swatch.style.backgroundColor = subject.color;

    const text = document.createElement("span");
    text.textContent = `${subject.name}: ${Math.round(mins)} min`;

    row.appendChild(swatch);
    row.appendChild(text);
    tooltip.appendChild(row);
  });

  if (day.bySubject["None"]) {
    const row = document.createElement("div");
    row.className = "tooltip-row";

    const swatch = document.createElement("div");
    swatch.className = "tooltip-swatch";
    swatch.style.backgroundColor = "#555";

    const text = document.createElement("span");
    text.textContent = `None: ${Math.round(day.bySubject["None"])} min`;

    row.appendChild(swatch);
    row.appendChild(text);
    tooltip.appendChild(row);
  }

  // NEW: a plain text row (no color swatch) showing this day's card count
  if (hasCardData) {
    const cardRow = document.createElement("div");
    cardRow.className = "tooltip-row";
    cardRow.textContent = `🗂️ ${day.cardCount} card${day.cardCount === 1 ? "" : "s"} reviewed`;
    tooltip.appendChild(cardRow);
  }

  return tooltip;
}


function updateLastWeekSummary() {
  const thisMonday = getMonday(new Date());

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  // lastMonday and thisMonday now mark the exact boundaries of "last week"

  const lastWeekMinutes = sessionHistory
    .filter(function(entry) {
      const entryDate = new Date(entry.date);
      // >= lastMonday catches last Monday itself; < thisMonday 
      // correctly EXCLUDES this week's Monday from "last week"'s total
      return entryDate >= lastMonday && entryDate < thisMonday;
    })
    .reduce(function(total, entry) { return total + entry.minutes; }, 0);

  const average = lastWeekMinutes / 7;
  // Divides by 7 regardless of how many days actually had sessions — 
  // this treats "average per day" as spread across the whole week, 
  // not just active days. (If you'd rather average only over days 
  // you actually studied, that's a different, slightly more involved 
  // calculation — let me know if you'd prefer that instead)

  document.getElementById("last-week-total").textContent = Math.round(lastWeekMinutes);
  document.getElementById("last-week-average").textContent = Math.round(average);
}

//#region flashcards

const cardReviewHistory = getCardReviewHistory();


updateSummaryCards();
updateBestDay();
updateLastWeekSummary();
updateHistogram();
updateLegend(); 