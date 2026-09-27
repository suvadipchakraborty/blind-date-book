// app.js — main controller: tabs, picker, teaser/reveal flow, pile, sharing
import { MOODS, DECADES, GENRES, LOADING_CAPTIONS } from "./data.js";
import { findBlindDate } from "./api.js";
import { getPile, addToPile, removeFromPile, isInPile } from "./storage.js";

const APP_URL = "https://blind-date-book.suvadipchakraborty.workers.dev/";
const FEEDBACK_EMAIL = "suvadipchakraborty@gmail.com";

const state = {
  selection: { mood: null, decade: null, genre: null },
  currentBook: null,
};

// ---------- element refs ----------
const el = {
  tabHome: document.getElementById("tab-home"),
  tabPile: document.getElementById("tab-pile"),
  panelHome: document.getElementById("panel-home"),
  panelPile: document.getElementById("panel-pile"),

  moodChips: document.getElementById("mood-chips"),
  decadeChips: document.getElementById("decade-chips"),
  genreChips: document.getElementById("genre-chips"),
  findBtn: document.getElementById("find-date-btn"),

  pickerStage: document.getElementById("picker-stage"),
  loadingStage: document.getElementById("loading-stage"),
  loadingCaption: document.getElementById("loading-caption"),
  teaserStage: document.getElementById("teaser-stage"),
  errorStage: document.getElementById("error-stage"),
  errorText: document.getElementById("error-text"),
  retryBtn: document.getElementById("retry-btn"),

  parcelWrap: document.getElementById("parcel-wrap"),
  parcelFront: document.getElementById("parcel-front"),
  parcelHint: document.getElementById("parcel-hint"),
  keywordRow: document.getElementById("keyword-row"),

  revealCover: document.getElementById("reveal-cover"),
  revealTitle: document.getElementById("reveal-title"),
  revealAuthor: document.getElementById("reveal-author"),
  revealYear: document.getElementById("reveal-year"),
  saveBtn: document.getElementById("save-btn"),
  shareBtn: document.getElementById("share-btn"),
  againBtn: document.getElementById("again-btn"),
  changeMoodBtn: document.getElementById("change-mood-btn"),

  pileGrid: document.getElementById("pile-grid"),
  pileEmptyCopy: document.getElementById("pile-empty-copy"),

  feedbackLink: document.getElementById("feedback-link"),
  toast: document.getElementById("toast"),
};

// ---------- chip rendering ----------
function renderChips(container, items, groupKey) {
  container.innerHTML = "";
  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = item.label;
    btn.dataset.id = item.id;
    btn.addEventListener("click", () => {
      const isSame = state.selection[groupKey] === item.id;
      state.selection[groupKey] = isSame ? null : item.id;
      [...container.children].forEach((c) =>
        c.classList.toggle("is-selected", c.dataset.id === state.selection[groupKey])
      );
    });
    container.appendChild(btn);
  });
}

renderChips(el.moodChips, MOODS, "mood");
renderChips(el.decadeChips, DECADES, "decade");
renderChips(el.genreChips, GENRES, "genre");

// ---------- tab switching ----------
function activateTab(tab) {
  const isHome = tab === "home";
  el.tabHome.classList.toggle("is-active", isHome);
  el.tabPile.classList.toggle("is-active", !isHome);
  el.tabHome.setAttribute("aria-selected", String(isHome));
  el.tabPile.setAttribute("aria-selected", String(!isHome));
  el.panelHome.classList.toggle("is-active", isHome);
  el.panelPile.classList.toggle("is-active", !isHome);
  el.panelHome.hidden = !isHome;
  el.panelPile.hidden = isHome;
  if (!isHome) renderPile();
}

el.tabHome.addEventListener("click", () => activateTab("home"));
el.tabPile.addEventListener("click", () => activateTab("pile"));

// ---------- stage switching (within Home) ----------
function showStage(name) {
  [el.pickerStage, el.loadingStage, el.teaserStage, el.errorStage].forEach((s) =>
    s.classList.add("is-hidden")
  );
  const map = {
    picker: el.pickerStage,
    loading: el.loadingStage,
    teaser: el.teaserStage,
    error: el.errorStage,
  };
  map[name].classList.remove("is-hidden");
}

let captionTimer = null;
function startLoadingCaptions() {
  let i = 0;
  el.loadingCaption.textContent = LOADING_CAPTIONS[0];
  captionTimer = setInterval(() => {
    i = (i + 1) % LOADING_CAPTIONS.length;
    el.loadingCaption.textContent = LOADING_CAPTIONS[i];
  }, 1300);
}
function stopLoadingCaptions() {
  if (captionTimer) clearInterval(captionTimer);
  captionTimer = null;
}

// ---------- fetch flow ----------
async function goOnADate() {
  showStage("loading");
  startLoadingCaptions();

  try {
    const book = await findBlindDate(state.selection);
    state.currentBook = book;
    populateTeaser(book);
    resetParcel();
    showStage("teaser");
  } catch (err) {
    el.errorText.textContent =
      "This date fell through. The stacks are quiet for that combination right now — try loosening your picks.";
    showStage("error");
  } finally {
    stopLoadingCaptions();
  }
}

function populateTeaser(book) {
  el.parcelHint.textContent = book.hint;
  el.keywordRow.innerHTML = "";
  book.keywords.forEach((kw) => {
    const span = document.createElement("span");
    span.className = "keyword-chip";
    span.textContent = kw;
    el.keywordRow.appendChild(span);
  });

  el.revealTitle.textContent = book.title;
  el.revealAuthor.textContent = `by ${book.author}`;
  el.revealYear.textContent = book.year ? `First published ${book.year}` : "";

  el.revealCover.classList.remove("is-loaded");
  if (book.coverUrl) {
    el.revealCover.src = book.coverUrl;
    el.revealCover.alt = `Cover of ${book.title}`;
    el.revealCover.onload = () => el.revealCover.classList.add("is-loaded");
    el.revealCover.onerror = () => el.revealCover.classList.remove("is-loaded");
  } else {
    el.revealCover.removeAttribute("src");
  }

  updateSaveButton();
}

function resetParcel() {
  el.parcelFront.classList.remove("is-torn");
  el.parcelWrap.classList.remove("is-revealed");
  // force reflow so re-triggering the animation works on repeat dates
  void el.parcelFront.offsetWidth;
  el.parcelFront.style.display = "flex";
}

function unwrap() {
  if (el.parcelFront.classList.contains("is-torn")) return;
  el.parcelFront.classList.add("is-torn");
  el.parcelWrap.classList.add("is-revealed");
  if (navigator.vibrate) navigator.vibrate([14, 40, 14]);
}

el.parcelFront.addEventListener("click", unwrap);
el.parcelFront.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    unwrap();
  }
});
el.parcelFront.setAttribute("tabindex", "0");
el.parcelFront.setAttribute("role", "button");
el.parcelFront.setAttribute("aria-label", "Tap to unwrap your blind date book");

el.findBtn.addEventListener("click", goOnADate);
el.retryBtn.addEventListener("click", goOnADate);
el.againBtn.addEventListener("click", goOnADate);
el.changeMoodBtn.addEventListener("click", () => showStage("picker"));

// ---------- save to pile ----------
function updateSaveButton() {
  if (!state.currentBook) return;
  const saved = isInPile(state.currentBook.key);
  el.saveBtn.innerHTML = saved
    ? `<span class="icon">✓</span> In your TBR pile`
    : `<span class="icon">＋</span> Add to TBR pile`;
}

el.saveBtn.addEventListener("click", () => {
  if (!state.currentBook) return;
  addToPile(state.currentBook);
  updateSaveButton();
  showToast("Added to your TBR pile 📚");
});

// ---------- share ----------
el.shareBtn.addEventListener("click", async () => {
  const book = state.currentBook;
  if (!book) return;
  const text = `I just went on a blind date with "${book.title}" by ${book.author} 📚✨`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Blind Date with a Book", text, url: APP_URL });
    } catch {
      // user cancelled — no-op
    }
  } else {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${text} ${APP_URL}`)}`;
    window.open(waUrl, "_blank", "noopener");
  }
});

// ---------- feedback mailto ----------
el.feedbackLink.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
  "Feedback on Blind Date with a Book"
)}&body=${encodeURIComponent("Hey Suva,\n\nHere's what I think of the app:\n\n")}`;

// ---------- TBR pile rendering ----------
function renderPile() {
  const pile = getPile();
  el.pileEmptyCopy.style.display = pile.length ? "none" : "block";
  el.pileGrid.innerHTML = "";
  pile.forEach((book) => {
    const card = document.createElement("div");
    card.className = "pile-card";
    card.innerHTML = `
      <img class="pile-cover" src="${book.coverUrl || ""}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy" onerror="this.style.opacity=0.3">
      <p class="pile-title">${escapeHtml(book.title)}</p>
      <p class="pile-author">${escapeHtml(book.author)}</p>
      <button class="pile-remove" aria-label="Remove from pile">×</button>
    `;
    card.querySelector(".pile-remove").addEventListener("click", () => {
      removeFromPile(book.key);
      renderPile();
      if (state.currentBook && state.currentBook.key === book.key) updateSaveButton();
    });
    el.pileGrid.appendChild(card);
  });
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ---------- toast ----------
let toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add("is-visible");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("is-visible"), 2200);
}

// ---------- service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---------- init ----------
renderPile();
