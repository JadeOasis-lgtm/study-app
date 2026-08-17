//#region constant variables

const deckPicker = document.getElementById("deck-picker");
const newDeckRow = document.getElementById("new-deck-row");
const newDeckInput = document.getElementById("new-deck-input");
const newDeckConfirm = document.getElementById("new-deck-confirm");
const noDeckMessage = document.getElementById("no-deck-message");
const studyBtn = document.getElementById("study-btn");
const browseBtn = document.getElementById("browse-btn");
const addCardSection = document.getElementById("add-card-section");
const cardFrontInput = document.getElementById("card-front-input");
const cardBackInput = document.getElementById("card-back-input");
const addCardBtn = document.getElementById("add-card-btn");
const cardListEl = document.getElementById("card-list");

const cancelEditBtn = document.getElementById("cancel-edit-btn");
const formHeading = document.getElementById("form-heading");
const dueCountEl = document.getElementById("due-count");
//#endregion

//#region show cards due
function updateDueCount() {
  const cards = getCards().filter(function(card) {
    return card.deck === deckPicker.value;
  });

  const dueCards = cards.filter(function(card) {
    return new Date(card.dueDate) <= new Date();
  });

  if (cards.length === 0) {
    dueCountEl.textContent = "";
  } else {
    dueCountEl.textContent = `${dueCards.length} of ${cards.length} card${cards.length === 1 ? "" : "s"} due`;
  }

  if (dueCards.length > 0) {
    studyBtn.textContent = `Study This Deck (${dueCards.length} due)`;
    studyBtn.disabled = false;
  } else {
    studyBtn.textContent = "No Cards Due";
    studyBtn.disabled = true;
  }
}
//#endregion

//#region fundamentals
function getCards() {
  return JSON.parse(localStorage.getItem("flashcards")) || [];
}

function saveCards(cards) {
  localStorage.setItem("flashcards", JSON.stringify(cards));
}

function populateDeckDropdown() {
  deckPicker.querySelectorAll(".deck-option").forEach(function(opt) { opt.remove(); });

  const subjects = getSubjects(); // from shared.js — same list Pomodoro uses
  const addNewOption = deckPicker.querySelector('option[value="__new__"]');

  subjects.forEach(function(subject) {
    const option = document.createElement("option");
    option.value = subject.name;
    option.textContent = subject.name;
    option.className = "deck-option";
    deckPicker.insertBefore(option, addNewOption);
  });

  const savedDeck = localStorage.getItem("currentDeck");
  const savedDeckStillExists = subjects.some(function(s) { return s.name === savedDeck; });

  if (savedDeckStillExists) {
    deckPicker.value = savedDeck;
  } else if (subjects.length > 0) {
    deckPicker.value = subjects[0].name;
    localStorage.setItem("currentDeck", subjects[0].name);
  }

  updateUIForDeckState(subjects.length > 0);
}

function updateUIForDeckState(hasDecks) {
  addCardSection.style.display = hasDecks ? "block" : "none";
  studyBtn.style.display = hasDecks ? "block" : "none";
  noDeckMessage.classList.toggle("hidden", hasDecks);
  renderCardList();
}

deckPicker.addEventListener("change", function() {
  if (deckPicker.value === "__new__") {
    newDeckRow.classList.remove("hidden");
    newDeckInput.focus();
    deckPicker.value = localStorage.getItem("currentDeck") || "";
  } else {
    localStorage.setItem("currentDeck", deckPicker.value);
    newDeckRow.classList.add("hidden");
    renderCardList();
  }
});

newDeckConfirm.addEventListener("click", function() {
  const name = newDeckInput.value.trim();
  if (name === "") return;

  addSubject(name); // from shared.js — same function Pomodoro's "Add New Subject" uses
  populateDeckDropdown();
  deckPicker.value = name;
  localStorage.setItem("currentDeck", name);
  newDeckInput.value = "";
  newDeckRow.classList.add("hidden");
  updateUIForDeckState(true);
});

addCardBtn.addEventListener("click", function() {
  const front = cardFrontInput.value.trim();
  const back = cardBackInput.value.trim();
  if (front === "" || back === "") return;

  const cards = getCards();

  if (editingCardId) {
    // EDIT MODE: find the existing card and update just its text — 
    // deliberately NOT touching ease/interval/repetitions/dueDate, 
    // since editing a typo shouldn't reset your actual study progress 
    // on that card
    const index = cards.findIndex(function(c) { return c.id === editingCardId; });
    if (index !== -1) {
      cards[index].front = front;
      cards[index].back = back;
    }
    saveCards(cards);
    stopEditingCard();
  } else {
    // Normal add-mode, exactly as before
    cards.push({
      id: Date.now().toString(),
      deck: deckPicker.value,
      front: front,
      back: back,
      ease: 2.5,
      interval: 0,
      repetitions: 0,
      dueDate: new Date().toISOString()
    });
    saveCards(cards);
    cardFrontInput.value = "";
    cardBackInput.value = "";
  }

  renderCardList();
});

function renderCardList() {
  updateDueCount();

  cardListEl.innerHTML = "";

  const cards = getCards().filter(function(card) {
    return card.deck === deckPicker.value;
  });

  if (cards.length === 0) {
    cardListEl.innerHTML = "<p class='empty-message'>No cards in this deck yet.</p>";
    return;
  }

  cards.forEach(function(card) {
    const item = document.createElement("div");
    item.className = "card-item";

    const frontText = document.createElement("div");
    frontText.className = "card-item-front";
    frontText.textContent = card.front;

    // NEW: a wrapper div holding BOTH buttons, instead of the delete 
    // button sitting alone
    const actions = document.createElement("div");
    actions.className = "card-item-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "edit-card-btn";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", function() {
      startEditingCard(card);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-card-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", function() {
      const remaining = getCards().filter(function(c) { return c.id !== card.id; });
      saveCards(remaining);
      renderCardList();
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(frontText);
    item.appendChild(actions);
    cardListEl.appendChild(item);
  });
}

const reverseToggle = document.getElementById("reverse-toggle");

studyBtn.addEventListener("click", function() {
  localStorage.setItem("reverseMode", reverseToggle.checked);
  window.location.href = "study.html";
});

browseBtn.addEventListener("click", function() {
  localStorage.setItem("reverseMode", reverseToggle.checked);
  window.location.href = "study.html?mode=browse";
});


const deleteDeckBtn = document.getElementById("delete-deck-btn");

deleteDeckBtn.addEventListener("click", function() {
  const name = deckPicker.value;
  if (name === "" || name === "__new__") return;

  const confirmed = confirm(`Delete "${name}"? This also deletes all its flashcards and to-dos. This can't be undone.`);
  if (!confirmed) return;

  deleteSubject(name); // shared.js
  populateDeckDropdown();
});

//#endregion

//#region editing cards
// Tracks whether we're currently editing a card, and which one. 
// null means "not editing" — we're in normal add-mode
let editingCardId = null;

function startEditingCard(card) {
  editingCardId = card.id;
  cardFrontInput.value = card.front;
  cardBackInput.value = card.back;

  formHeading.textContent = "Edit Card";
  addCardBtn.textContent = "Update Card";
  cancelEditBtn.classList.remove("hidden");

  cardFrontInput.focus();
  cardFrontInput.scrollIntoView({ behavior: "smooth", block: "center" });
  // scrollIntoView jumps the page to bring this element into view — 
  // useful here since the card list sits BELOW the form, so editing 
  // a card further down the page would otherwise leave you staring 
  // at an updated form you can't even see without scrolling up manually
}

function stopEditingCard() {
  editingCardId = null;
  cardFrontInput.value = "";
  cardBackInput.value = "";
  formHeading.textContent = "Add a Card";
  addCardBtn.textContent = "Add Card";
  cancelEditBtn.classList.add("hidden");
}

cancelEditBtn.addEventListener("click", stopEditingCard);

//#endregion

populateDeckDropdown();