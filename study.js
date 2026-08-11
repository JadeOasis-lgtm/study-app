const deckTitle = document.getElementById("deck-title");
const progressText = document.getElementById("progress-text");
const studyArea = document.getElementById("study-area");
const cardFrontText = document.getElementById("card-front-text");
const cardBackText = document.getElementById("card-back-text");
const flashcardInner = document.getElementById("flashcard-inner");
const showAnswerBtn = document.getElementById("show-answer-btn");
const ratingButtons = document.getElementById("rating-buttons");
const emptyMessage = document.getElementById("empty-message");

// Reads the deck the "Study This Deck" button was clicked from — 
// flashcards.js already saves this to localStorage every time the 
// dropdown changes, so we don't need to pass it any other way
const currentDeck = localStorage.getItem("currentDeck") || "";
deckTitle.textContent = currentDeck ? `Study: ${currentDeck}` : "Study";

function getCards() {
  return JSON.parse(localStorage.getItem("flashcards")) || [];
}

function saveCards(cards) {
  localStorage.setItem("flashcards", JSON.stringify(cards));
}

// The actual study queue: every card in this deck whose dueDate has 
// already passed. new Date(card.dueDate) <= new Date() is the whole 
// "is this due yet?" check — comparing two Date objects directly 
// works the same way you've used elsewhere in this project
let queue = getCards().filter(function(card) {
  return card.deck === currentDeck && new Date(card.dueDate) <= new Date();
});

let currentCard = null;

// The actual spaced repetition algorithm — this is the heart of the feature
function scheduleCard(card, rating) {
  if (rating === "again") {
    card.repetitions = 0;
    card.interval = 0; // 0 signals "bring this back almost immediately," handled below
    card.ease = Math.max(1.3, card.ease - 0.2);
    // 1.3 is SM-2's traditional floor — ease is never allowed to drop 
    // below this, since a lower multiplier would make hard cards 
    // barely grow their interval at all, review after review
  } else {
    // Any rating other than "again" means you got it right, to 
    // varying degrees of confidence — so interval GROWS
    if (card.repetitions === 0) {
      card.interval = 1;
    } else if (card.repetitions === 1) {
      card.interval = 6;
    } else {
      card.interval = Math.round(card.interval * card.ease);
      // This is the compounding growth — a card at interval 10 with 
      // ease 2.5 jumps to interval 25 next time, then interval 25 
      // jumps to ~63, and so on
    }
    card.repetitions += 1;

    if (rating === "hard") {
      card.ease = Math.max(1.3, card.ease - 0.15);
    } else if (rating === "easy") {
      card.ease = card.ease + 0.15;
      card.interval = Math.round(card.interval * 1.3); // extra boost on top of the normal growth
    }
    // "good" deliberately changes nothing about ease — it's the neutral baseline
  }

  const due = new Date();
  if (card.interval === 0) {
    due.setMinutes(due.getMinutes() + 10);
  } else {
    due.setDate(due.getDate() + card.interval);
  }
  card.dueDate = due.toISOString();
}

function showNextCard() {
  flashcardInner.classList.remove("flipped");
  showAnswerBtn.classList.remove("hidden");
  ratingButtons.classList.add("hidden");

  if (queue.length === 0) {
    studyArea.classList.add("hidden");
    emptyMessage.classList.remove("hidden");
    progressText.textContent = "";
    return;
  }

  currentCard = queue[0];

  const reverseMode = localStorage.getItem("reverseMode") === "true";
  // localStorage only ever stores STRINGS — even though we saved a 
  // real boolean, it comes back out as the text "true" or "false", 
  // so this comparison converts it back into an actual boolean

  if (reverseMode) {
    cardFrontText.textContent = currentCard.back;
    cardBackText.textContent = currentCard.front;
  } else {
    cardFrontText.textContent = currentCard.front;
    cardBackText.textContent = currentCard.back;
  }
  progressText.textContent = `${queue.length} card${queue.length === 1 ? "" : "s"} remaining`;
}

function revealAnswer() {
  flashcardInner.classList.add("flipped");
  showAnswerBtn.classList.add("hidden");
  ratingButtons.classList.remove("hidden");
}

showAnswerBtn.addEventListener("click", revealAnswer);

// Bonus: tapping the card itself also flips it, feeling more like a 
// real physical card — but only if it's not ALREADY flipped, so 
// tapping again doesn't fight with the rating buttons underneath
flashcardInner.addEventListener("click", function() {
  if (!flashcardInner.classList.contains("flipped")) revealAnswer();
});

ratingButtons.querySelectorAll(".rating-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    const rating = btn.dataset.rating;
    // data-rating="again" in the HTML becomes btn.dataset.rating 
    // here — "data-*" attributes are the standard way to attach 
    // custom info to an HTML element for JS to read later

    scheduleCard(currentCard, rating);

    // Write the updated card back into the FULL card list (not just 
    // the queue), since the queue is only today's subset
    const allCards = getCards();
    const index = allCards.findIndex(function(c) { return c.id === currentCard.id; });
    if (index !== -1) allCards[index] = currentCard;
    saveCards(allCards);

    queue.shift(); // remove the just-answered card from the front of the line

    if (rating === "again") {
      queue.push(currentCard); // send it to the back — you'll see it again before this session ends
    }

    showNextCard();
  });
});

if (currentDeck === "") {
  studyArea.classList.add("hidden");
  emptyMessage.textContent = "No deck selected.";
  emptyMessage.classList.remove("hidden");
} else {
  showNextCard();
}