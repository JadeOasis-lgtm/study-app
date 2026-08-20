const calendarGrid = document.getElementById("calendar-grid");
const viewDayBtn = document.getElementById("view-day-btn");
const viewWeekBtn = document.getElementById("view-week-btn");
const viewMonthBtn = document.getElementById("view-month-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const todayBtn = document.getElementById("today-btn");
const calendarLabel = document.getElementById("calendar-label");

const addTodoModal = document.getElementById("add-todo-modal");
const modalTodoText = document.getElementById("modal-todo-text");
const modalTodoSubject = document.getElementById("modal-todo-subject");
const modalTodoDateDisplay = document.getElementById("modal-todo-date-display");
const modalTodoConfirm = document.getElementById("modal-todo-confirm");
const modalTodoCancel = document.getElementById("modal-todo-cancel");

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

let currentView = "month"; // "day" | "week" | "month"
let currentDate = new Date();
let modalTargetDate = null;

// "YYYY-MM-DD" in LOCAL time — not toISOString(), which converts to UTC
// first and can silently roll evening dates over to "tomorrow"
function dateToString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatFullDate(date) {
  return `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

//#region date range helpers
function getMonthGridDays(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();

  const lastOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastOfMonth.getDate();

  const days = [];

  for (let i = startWeekday; i > 0; i--) {
    days.push({ date: new Date(year, month, 1 - i), inCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({ date: new Date(year, month, day), inCurrentMonth: true });
  }
  let nextMonthDay = 1;
  while (days.length < 42) {
    days.push({ date: new Date(year, month + 1, nextMonthDay), inCurrentMonth: false });
    nextMonthDay++;
  }

  return days;
}

function getWeekDays(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}
//#endregion

function getTodosGroupedByDate() {
  const grouped = {};
  getTodos().forEach(function(todo) {
    if (!todo.dueDate) return;
    if (!grouped[todo.dueDate]) grouped[todo.dueDate] = [];
    grouped[todo.dueDate].push(todo);
  });
  return grouped;
}

function moveTodoToDate(todoId, newDateStr) {
  if (!newDateStr) return;
  const todos = getTodos();
  const todo = todos.find(function(t) { return t.id === todoId; });
  if (!todo) return;
  todo.dueDate = newDateStr;
  saveTodos(todos);
  renderCurrentView();
}

function openMovePopup(todo, chipEl) {
  const existing = chipEl.querySelector(".move-date-input");
  if (existing) {
    existing.remove();
    return;
  }

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "move-date-input";
  dateInput.value = todo.dueDate;

  dateInput.addEventListener("change", function() {
    moveTodoToDate(todo.id, dateInput.value);
  });
  dateInput.addEventListener("blur", function() {
    dateInput.remove();
  });

  chipEl.appendChild(dateInput);
  dateInput.focus();
  if (dateInput.showPicker) dateInput.showPicker();
}

function buildTodoChip(todo) {
  const chip = document.createElement("div");
  chip.className = "calendar-todo-chip" + (todo.completed ? " completed" : "");
  chip.draggable = true;

  chip.addEventListener("dragstart", function(event) {
    event.dataTransfer.setData("text/plain", todo.id);
    chip.classList.add("dragging");
  });
  chip.addEventListener("dragend", function() {
    chip.classList.remove("dragging");
  });

  if (todo.subject) {
    const matching = getSubjects().find(function(s) { return s.name === todo.subject; });
    chip.style.borderLeftColor = matching ? matching.color : "#888";
  }

  const text = document.createElement("span");
  text.className = "calendar-todo-text";
  text.textContent = todo.text;
  text.addEventListener("click", function() {
    openMovePopup(todo, chip);
  });
  chip.appendChild(text);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "calendar-todo-delete";
  deleteBtn.textContent = "×";
  deleteBtn.addEventListener("click", function(event) {
    event.stopPropagation();
    saveTodos(getTodos().filter(function(t) { return t.id !== todo.id; }));
    renderCurrentView();
  });
  chip.appendChild(deleteBtn);

  return chip;
}

// Shared by Month, Week, and Day — builds one day's full cell:
// number/label, its to-do chips, the add button, and (optionally)
// drag-and-drop drop handling
function buildDayCell(date, todosByDate, todayStr, options) {
  options = options || {};
  const dateStr = dateToString(date);

  const cell = document.createElement("div");
  cell.className = "calendar-day";
  if (options.otherMonth) cell.classList.add("other-month");
  if (dateStr === todayStr) cell.classList.add("today");

  // Clicking a calendar cell opens that date in Day view
  if (!options.fullLabel) {
    cell.addEventListener("click", function(event) {
      // Don't switch views when clicking a to-do or button inside the cell
      if (
        event.target.closest(".calendar-todo-chip") ||
        event.target.closest(".add-day-todo-btn")
      ) {
        return;
      }

      currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      switchView("day");
    });
  }

  const dayNumber = document.createElement("div");
  dayNumber.className = "calendar-day-number";
  dayNumber.textContent = options.fullLabel ? formatFullDate(date) : date.getDate();
  cell.appendChild(dayNumber);

  (todosByDate[dateStr] || []).forEach(function(todo) {
    cell.appendChild(buildTodoChip(todo));
  });

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-day-todo-btn";
  addBtn.textContent = options.fullLabel ? "+ Add To-Do" : "+";
  addBtn.addEventListener("click", function() {
    openAddForm(dateStr);
  });
  cell.appendChild(addBtn);

  if (!options.noDrop) {
    cell.addEventListener("dragover", function(event) {
      event.preventDefault();
      cell.classList.add("drag-over");
    });
    cell.addEventListener("dragleave", function() {
      cell.classList.remove("drag-over");
    });
    cell.addEventListener("drop", function(event) {
      event.preventDefault();
      cell.classList.remove("drag-over");
      moveTodoToDate(event.dataTransfer.getData("text/plain"), dateStr);
    });
  }

  return cell;
}

function appendWeekdayHeaders() {
  WEEKDAY_NAMES.forEach(function(name) {
    const header = document.createElement("div");
    header.className = "calendar-weekday-header";
    header.textContent = name;
    calendarGrid.appendChild(header);
  });
}

function setGridViewClass(view) {
  calendarGrid.classList.remove("month-grid", "week-grid", "day-grid");
  calendarGrid.classList.add(view + "-grid");
}

function renderMonthView() {
  setGridViewClass("month");
  calendarGrid.innerHTML = "";
  appendWeekdayHeaders();

  const days = getMonthGridDays(currentDate.getFullYear(), currentDate.getMonth());
  const todosByDate = getTodosGroupedByDate();
  const todayStr = dateToString(new Date());

  days.forEach(function(day) {
    const cell = buildDayCell(day.date, todosByDate, todayStr, { otherMonth: !day.inCurrentMonth });
    calendarGrid.appendChild(cell);
  });
}

function renderWeekView() {
  setGridViewClass("week");
  calendarGrid.innerHTML = "";
  appendWeekdayHeaders();

  const days = getWeekDays(currentDate);
  const todosByDate = getTodosGroupedByDate();
  const todayStr = dateToString(new Date());

  days.forEach(function(day) {
    const cell = buildDayCell(day, todosByDate, todayStr, {});
    calendarGrid.appendChild(cell);
  });
}

function renderDayView() {
  setGridViewClass("day");
  calendarGrid.innerHTML = "";

  const todosByDate = getTodosGroupedByDate();
  const todayStr = dateToString(new Date());

  const cell = buildDayCell(currentDate, todosByDate, todayStr, { fullLabel: true, noDrop: true });
  calendarGrid.appendChild(cell);
}

function updateCalendarLabel() {
  if (currentView === "month") {
    calendarLabel.textContent = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  } else if (currentView === "week") {
    const days = getWeekDays(currentDate);
    const start = days[0];
    const end = days[6];
    calendarLabel.textContent = start.getMonth() === end.getMonth()
      ? `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
      : `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  } else {
    calendarLabel.textContent = formatFullDate(currentDate);
  }
}

function renderCurrentView() {
  updateCalendarLabel();
  if (currentView === "month") {
    renderMonthView();
  } else if (currentView === "week") {
    renderWeekView();
  } else {
    renderDayView();
  }
}

function switchView(view) {
  currentView = view;
  viewDayBtn.classList.toggle("active", view === "day");
  viewWeekBtn.classList.toggle("active", view === "week");
  viewMonthBtn.classList.toggle("active", view === "month");
  renderCurrentView();
}

viewDayBtn.addEventListener("click", function() { switchView("day"); });
viewWeekBtn.addEventListener("click", function() { switchView("week"); });
viewMonthBtn.addEventListener("click", function() { switchView("month"); });

prevBtn.addEventListener("click", function() {
  if (currentView === "month") {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  } else if (currentView === "week") {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7);
  } else {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1);
  }
  renderCurrentView();
});

nextBtn.addEventListener("click", function() {
  if (currentView === "month") {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  } else if (currentView === "week") {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7);
  } else {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
  }
  renderCurrentView();
});

todayBtn.addEventListener("click", function() {
  currentDate = new Date();
  renderCurrentView();
});

//#region add-todo modal
function openAddForm(dateStr) {
  modalTargetDate = dateStr;
  modalTodoText.value = "";
  modalTodoDateDisplay.textContent = dateStr;

  modalTodoSubject.innerHTML = "";
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "No subject";
  modalTodoSubject.appendChild(noneOption);
  getSubjects().forEach(function(subject) {
    const option = document.createElement("option");
    option.value = subject.name;
    option.textContent = subject.name;
    modalTodoSubject.appendChild(option);
  });

  addTodoModal.classList.remove("hidden");
  modalTodoText.focus();
}

function closeAddForm() {
  addTodoModal.classList.add("hidden");
  modalTargetDate = null;
}

modalTodoConfirm.addEventListener("click", function() {
  const text = modalTodoText.value.trim();
  if (text === "") return;

  const todos = getTodos();
  todos.push({
    id: Date.now().toString(),
    text: text,
    subject: modalTodoSubject.value,
    dueDate: modalTargetDate,
    completed: false,
    createdDate: dateToString(new Date())
  });
  saveTodos(todos);
  closeAddForm();
  renderCurrentView();
});

modalTodoCancel.addEventListener("click", closeAddForm);

addTodoModal.addEventListener("click", function(event) {
  if (event.target === addTodoModal) {
    closeAddForm();
  }
});
//#endregion

switchView("month");