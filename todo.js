const addTodoForm = document.getElementById("add-todo-form");
const todoTextInput = document.getElementById("todo-text-input");
const todoSubjectSelect = document.getElementById("todo-subject-select");
const todoDueInput = document.getElementById("todo-due-input");
const todoList = document.getElementById("todo-list");
const emptyMessage = document.getElementById("todo-empty-message");
const newSubjectContainer = document.getElementById("new-subject-container");
const newSubjectInput = document.getElementById("new-subject-input");
const confirmNewSubjectBtn = document.getElementById("confirm-new-subject-btn");

// Fill the subject dropdown from the same list Pomodoro/Flashcards use —
// getSubjects() already exists in shared.js, so no new data source needed
function populateSubjectDropdown() {
  todoSubjectSelect.querySelectorAll(".subject-option").forEach(function(opt) {
    opt.remove();
  });

  const addNewOption = todoSubjectSelect.querySelector('option[value="__new__"]');

  getSubjects().forEach(function(subject) {
    const option = document.createElement("option");
    option.value = subject.name;
    option.textContent = subject.name;
    option.className = "subject-option";
    todoSubjectSelect.insertBefore(option, addNewOption);
  });
}

// today's date as "YYYY-MM-DD" so it compares cleanly against dueDate,
// which comes out of <input type="date"> in that same format
// Weekday/month names for turning a "YYYY-MM-DD" string into a label
// like "Thu, Aug 27" — same idea calendar.js uses, kept local here
// since only this page needs it
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Date -> "YYYY-MM-DD" using LOCAL time fields. Never toISOString() —
// that converts to UTC first and can roll an evening date to
// "tomorrow" (the same bug you already fixed in calendar.js)
function dateToString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// The reverse direction. `new Date(dateStr)` has the SAME UTC trap —
// it parses the string as UTC midnight, which can land on the wrong
// day depending on your timezone. Building it from the individual
// numbers sidesteps that.
function parseDateString(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateLabel(dateStr) {
  const date = parseDateString(dateStr);
  return `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

function todayString() {
  return dateToString(new Date());
}

function renderTodos() {
  // Only ever render what's still active — this is the key change
  // that makes "completed" mean "gone from this view"
  const activeTodos = getTodos().filter(function(t) { return !t.completed; });

  todoList.innerHTML = "";

  if (activeTodos.length === 0) {
    emptyMessage.classList.remove("hidden");
    return;
  }
  emptyMessage.classList.add("hidden");

  const todayStr = todayString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = dateToString(tomorrow);

  const overdueGroup = [];
  const todayGroup = [];
  const tomorrowGroup = [];
  const futureGroups = {}; // { "YYYY-MM-DD": [todo, ...] }
  const noDateGroup = [];

  activeTodos.forEach(function(todo) {
    if (!todo.dueDate) {
      noDateGroup.push(todo);
    } else if (todo.dueDate < todayStr) {
      overdueGroup.push(todo);
    } else if (todo.dueDate === todayStr) {
      todayGroup.push(todo);
    } else if (todo.dueDate === tomorrowStr) {
      tomorrowGroup.push(todo);
    } else {
      if (!futureGroups[todo.dueDate]) futureGroups[todo.dueDate] = [];
      futureGroups[todo.dueDate].push(todo);
    }
  });

  // Oldest overdue item first — it's been waiting the longest
  overdueGroup.sort(function(a, b) { return a.dueDate.localeCompare(b.dueDate); });

  appendSection(todoList, "Overdue", overdueGroup, { overdue: true, showDate: true });
  appendSection(todoList, "Today", todayGroup);
  appendSection(todoList, "Tomorrow", tomorrowGroup);

  // Object.keys().sort() works here because "YYYY-MM-DD" strings sort
  // correctly as plain text — no need to parse them into dates first
  Object.keys(futureGroups).sort().forEach(function(dateStr) {
    appendSection(todoList, formatDateLabel(dateStr), futureGroups[dateStr]);
  });

  appendSection(todoList, "No Date", noDateGroup);
}

// Builds one section (heading + its own <ul>) and appends it —
// skipped entirely if the group is empty, so you never see a "Tomorrow"
// heading with nothing under it
function appendSection(container, title, todos, options) {
  if (todos.length === 0) return;
  options = options || {};

  const section = document.createElement("div");
  section.className = "todo-section";

  const header = document.createElement("h2");
  header.className = "todo-section-header" + (options.overdue ? " overdue-header" : "");
  header.textContent = title;
  section.appendChild(header);

  const list = document.createElement("ul");
  list.className = "todo-section-list";
  todos.forEach(function(todo) {
    list.appendChild(buildTodoItem(todo, options.showDate));
  });
  section.appendChild(list);

  container.appendChild(section);
}

function buildTodoItem(todo, showDate) {
  const li = document.createElement("li");
  li.className = "todo-item";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.addEventListener("change", function() {
    if (!checkbox.checked) return;

    // Step 1: play the animation by adding the class — this doesn't
    // touch localStorage yet, it just triggers the CSS transition
    li.classList.add("completing");

    // Step 2: wait for that transition to actually finish, THEN
    // update the data and re-render. Without this, renderTodos()
    // would rebuild the whole list instantly and you'd never see
    // the fade at all.
    li.addEventListener("transitionend", function handler() {
      li.removeEventListener("transitionend", handler); // avoid firing twice (opacity + transform both transition)

      const allTodos = getTodos();
      const index = allTodos.findIndex(function(t) { return t.id === todo.id; });
      if (index !== -1) {
        allTodos[index].completed = true;
        saveTodos(allTodos);
      }
      renderTodos();
    });
  });
  li.appendChild(checkbox);

  const text = document.createElement("span");
  text.className = "todo-text";
  text.textContent = todo.text;
  li.appendChild(text);

  if (todo.subject) {
    const tag = document.createElement("span");
    tag.className = "todo-subject-tag";
    const matchingSubject = getSubjects().find(function(s) { return s.name === todo.subject; });
    tag.style.background = matchingSubject ? matchingSubject.color : "#888";
    tag.textContent = todo.subject;
    li.appendChild(tag);
  }

  // Only shown in the Overdue section — everywhere else, the section
  // header already tells you the date, so repeating it would be noise
  if (showDate && todo.dueDate) {
    const due = document.createElement("span");
    due.className = "todo-due-date overdue";
    due.textContent = formatDateLabel(todo.dueDate);
    li.appendChild(due);
  }

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-todo-btn";
  deleteBtn.textContent = "×";
  deleteBtn.addEventListener("click", function() {
    const remaining = getTodos().filter(function(t) { return t.id !== todo.id; });
    saveTodos(remaining);
    renderTodos();
  });
  li.appendChild(deleteBtn);

  return li;
}

addTodoForm.addEventListener("submit", function(event) {
  event.preventDefault();

  const newTodo = {
    id: Date.now().toString(),
    text: todoTextInput.value,
    subject: todoSubjectSelect.value,
    dueDate: todoDueInput.value,
    completed: false,
    createdDate: todayString()
  };

  const todos = getTodos();
  todos.push(newTodo);
  saveTodos(todos);

  addTodoForm.reset();
  renderTodos();
});


confirmNewSubjectBtn.addEventListener("click", function() {
  const name = newSubjectInput.value.trim();
  if (name === "") return;

  addSubject(name); // shared.js — adds {name, color} to the shared list, next color from the palette

  populateSubjectDropdown();
  todoSubjectSelect.value = name; // jump straight to the one you just made

  newSubjectInput.value = "";
  newSubjectContainer.classList.add("hidden");
});

const deleteSubjectBtn = document.getElementById("delete-subject-btn");

deleteSubjectBtn.addEventListener("click", function() {
  const name = todoSubjectSelect.value;
  if (name === "") return; // "No subject" selected — nothing to delete

  const confirmed = confirm(`Delete "${name}"? This also deletes all its flashcards and to-dos. This can't be undone.`);
  if (!confirmed) return;

  deleteSubject(name); // shared.js
  populateSubjectDropdown();
  renderTodos(); // some todos may have just disappeared, so the list needs a re-render too
});

todoSubjectSelect.addEventListener("change", function() {
  if (todoSubjectSelect.value === "__new__") {
    newSubjectContainer.classList.remove("hidden");
    newSubjectInput.focus();
    todoSubjectSelect.value = ""; // snap back to "No subject" instead of visually sitting on "+ Add New Subject"
  } else {
    newSubjectContainer.classList.add("hidden");
  }
});

populateSubjectDropdown();
renderTodos();

window.addEventListener("cloud-data-updated", renderTodos);