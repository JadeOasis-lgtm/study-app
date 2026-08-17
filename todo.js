const addTodoForm = document.getElementById("add-todo-form");
const todoTextInput = document.getElementById("todo-text-input");
const todoSubjectSelect = document.getElementById("todo-subject-select");
const todoDueInput = document.getElementById("todo-due-input");
const todoList = document.getElementById("todo-list");
const emptyMessage = document.getElementById("todo-empty-message");
const newSubjectBtn = document.getElementById("new-subject-btn");
const newSubjectContainer = document.getElementById("new-subject-container");
const newSubjectInput = document.getElementById("new-subject-input");
const confirmNewSubjectBtn = document.getElementById("confirm-new-subject-btn");

function getTodos() {
  return JSON.parse(localStorage.getItem("todos")) || [];
}

function saveTodos(todos) {
  localStorage.setItem("todos", JSON.stringify(todos));
}

// Fill the subject dropdown from the same list Pomodoro/Flashcards use —
// getSubjects() already exists in shared.js, so no new data source needed
function populateSubjectDropdown() {
  todoSubjectSelect.innerHTML = "";

  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "No subject";
  todoSubjectSelect.appendChild(noneOption);

  getSubjects().forEach(function(subject) {
    const option = document.createElement("option");
    option.value = subject.name;
    option.textContent = subject.name;
    todoSubjectSelect.appendChild(option);
  });
}

// today's date as "YYYY-MM-DD" so it compares cleanly against dueDate,
// which comes out of <input type="date"> in that same format
function todayString() {
  return new Date().toISOString().split("T")[0];
}

function renderTodos() {
  const todos = getTodos();
  const subjects = getSubjects();

  todoList.innerHTML = "";

  if (todos.length === 0) {
    emptyMessage.classList.remove("hidden");
    return;
  }
  emptyMessage.classList.add("hidden");

  // Incomplete first, then by due date (earliest first, no-date items last)
  const sorted = todos.slice().sort(function(a, b) {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  sorted.forEach(function(todo) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.completed ? " completed" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.addEventListener("change", function() {
      todo.completed = checkbox.checked;
      const allTodos = getTodos();
      const index = allTodos.findIndex(function(t) { return t.id === todo.id; });
      if (index !== -1) allTodos[index] = todo;
      saveTodos(allTodos);
      renderTodos();
    });
    li.appendChild(checkbox);

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.text;
    li.appendChild(text);

    if (todo.subject) {
      const tag = document.createElement("span");
      tag.className = "todo-subject-tag";
      const matchingSubject = subjects.find(function(s) { return s.name === todo.subject; });
      tag.style.background = matchingSubject ? matchingSubject.color : "#888";
      tag.textContent = todo.subject;
      li.appendChild(tag);
    }

    if (todo.dueDate) {
      const due = document.createElement("span");
      due.className = "todo-due-date";
      if (!todo.completed && todo.dueDate < todayString()) {
        due.classList.add("overdue");
      }
      due.textContent = todo.dueDate;
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

    todoList.appendChild(li);
  });
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


newSubjectBtn.addEventListener("click", function() {
  newSubjectContainer.classList.toggle("hidden");
  newSubjectInput.focus();
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

populateSubjectDropdown();
renderTodos();