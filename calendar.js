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

let currentView = "month"; // "day" | "week" | "month" — only month renders for real so far
let currentDate = new Date(); // the day/week/month currently on screen, moved by prev/next
let modalTargetDate = null; // which day's "+" button opened the add modal

function buildTodoChip(todo) {
  const chip = document.createElement("div");
  chip.className = "calendar-todo-chip" + (todo.completed ? " completed" : "");
  chip.draggable = true;

  // Drag-and-drop, half 1: this chip announces its own id when a drag starts
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
    event.stopPropagation(); // don't also trigger the move popup underneath
    saveTodos(getTodos().filter(function(t) { return t.id !== todo.id; }));
    renderCurrentView();
  });
  chip.appendChild(deleteBtn);

  return chip;
}

// "YYYY-MM-DD" from a Date object — same format todo.js already stores
// dueDate in, so calendar and to-do pages read/write identically
function dateToString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

//#region month grid generation
function getMonthGridDays(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday

  const lastOfMonth = new Date(year, month + 1, 0); // day 0 of next month = last day of this one
  const daysInMonth = lastOfMonth.getDate();

  const days = [];

  // Padding from the end of the previous month, so day 1 lands under
  // the correct weekday column instead of always starting top-left
    for (let i = startWeekday; i > 0; i--) {
    days.push({ date: new Date(year, month, 1 - i), inCurrentMonth: false });
    }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push({ date: new Date(year, month, day), inCurrentMonth: true });
  }

  // Padding from the start of next month, filling out to a full 6
  // rows (42 cells) so the grid's height doesn't jump between months
  let nextMonthDay = 1;
  while (days.length < 42) {
    days.push({ date: new Date(year, month + 1, nextMonthDay), inCurrentMonth: false });
    nextMonthDay++;
  }

  return days;
}
//#endregion

function getTodosGroupedByDate() {
  const grouped = {};
  getTodos().forEach(function(todo) {
    if (!todo.dueDate) return; // to-dos with no date don't appear on the calendar
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
  if (chipEl.querySelector(".move-date-input")) return; // already open

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "move-date-input";
  dateInput.value = todo.dueDate;

  dateInput.addEventListener("change", function() {
    moveTodoToDate(todo.id, dateInput.value);
  });

  chipEl.appendChild(dateInput);
  dateInput.focus();
  if (dateInput.showPicker) dateInput.showPicker(); // opens the native picker immediately, where supported
}

function openMovePopup(todo, chipEl) {
  // Check if a popup is already open on this chip
  const existing = chipEl.querySelector(".move-date-input");
  if (existing) {
    existing.remove(); // Toggle it closed if clicked again
    return;
  }

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "move-date-input";
  dateInput.value = todo.dueDate;

  // Move the to-do when a new date is selected
  dateInput.addEventListener("change", function() {
    moveTodoToDate(todo.id, dateInput.value);
  });

  // Remove the input if the user clicks away without changing anything
  dateInput.addEventListener("blur", function() {
    dateInput.remove();
  });

  chipEl.appendChild(dateInput);
  dateInput.focus();
  if (dateInput.showPicker) dateInput.showPicker(); // Opens native picker
}

function renderMonthView() {
  calendarGrid.innerHTML = "";

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function(name) {
    const header = document.createElement("div");
    header.className = "calendar-weekday-header";
    header.textContent = name;
    calendarGrid.appendChild(header);
  });

  const days = getMonthGridDays(currentDate.getFullYear(), currentDate.getMonth());
  const todosByDate = getTodosGroupedByDate();
  const todayStr = dateToString(new Date());

  days.forEach(function(day) {
    const dateStr = dateToString(day.date);
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    if (!day.inCurrentMonth) cell.classList.add("other-month");
    if (dateStr === todayStr) cell.classList.add("today");

    const dayNumber = document.createElement("div");
    dayNumber.className = "calendar-day-number";
    dayNumber.textContent = day.date.getDate();
    cell.appendChild(dayNumber);

    (todosByDate[dateStr] || []).forEach(function(todo) {
      cell.appendChild(buildTodoChip(todo));
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "add-day-todo-btn";
    addBtn.textContent = "+";
    addBtn.addEventListener("click", function() {
      openAddForm(dateStr);
    });
    cell.appendChild(addBtn);

    // Drag-and-drop, half 2: this cell accepts whatever chip gets dropped on it
    cell.addEventListener("dragover", function(event) {
      event.preventDefault(); // required — without this, the browser refuses the drop
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

    calendarGrid.appendChild(cell);
  });
}

function updateCalendarLabel() {
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  calendarLabel.textContent = currentView === "month"
    ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    : dateToString(currentDate);
}

function renderCurrentView() {
  updateCalendarLabel();
  if (currentView === "month") {
    renderMonthView();
  } else {
    calendarGrid.innerHTML = `<p class="empty-message">${currentView === "day" ? "Day" : "Week"} view is coming in the next round — Month view is fully working for now.</p>`;
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
  }
  renderCurrentView();
});

nextBtn.addEventListener("click", function() {
  if (currentView === "month") {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
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

// Close the modal if the user clicks the dark background (outside the modal box)
addTodoModal.addEventListener("click", function(event) {
  if (event.target === addTodoModal) {
    closeAddForm();
  }
});
//#endregion

switchView("month");