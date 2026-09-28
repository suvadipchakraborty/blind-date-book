// app.js — main controller: tabs, picker, teaser/reveal flow, pile, sharing
import { MOODS, DECADES, GENRES, LOADING_CAPTIONS } from "./data.js";
import { findBlindDates } from "./api.js";
import { getPile, addToPile, removeFromPile, isInPile } from "./storage.js";

const APP_URL = "https://blind-date-book.suvadipchakraborty.workers.dev/";
const FEEDBACK_EMAIL = "suvadipchakraborty@gmail.com";

const state = {
  selection: { mood: null, decade: null, genre: null },
  books: [],
  current: 0,
  revealed: new Set(),
};

const MAX_DATES = 5;

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

  track: document.getElementById("carousel-track"),
  dots: document.getElementById("dots"),
  prevBtn: document.getElementById("prev-btn"),
  nextBtn: document.getElementById("next-btn"),
  swipeHint: document.getElementById("swipe-hint"),
  eyebrow: document.getElementById("teaser-eyebrow"),
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
  else {
    // keep "Add to TBR pile" buttons in sync if the pile changed elsewhere
    [...el.track.children].forEach((slide, i) => {
      const btn = slide.querySelector(".save-btn");
      if (btn && state.books[i]) updateSaveButton(btn, state.books[i]);
    });
  }
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
    const books = await findBlindDates(state.selection, MAX_DATES);
    state.books = books;
    state.current = 0;
    state.revealed = new Set();
    renderCarousel();
    showStage("teaser");
    el.track.scrollLeft = 0;
    updateCarouselUI();
  } catch (err) {
    el.errorText.textContent =
      "This date fell through. The stacks are quiet for that combination right now — try loosening your picks.";
    showStage("error");
  } finally {
    stopLoadingCaptions();
  }
}

// ---------- carousel ----------
function renderCarousel() {
  el.track.innerHTML = "";
  el.dots.innerHTML = "";
  const total = state.books.length;

  el.eyebrow.textContent = total > 1 ? `${total} dates have arrived` : "Your date has arrived";
  el.swipeHint.style.display = total > 1 ? "block" : "none";
  el.prevBtn.style.visibility = el.nextBtn.style.visibility = total > 1 ? "visible" : "hidden";

  state.books.forEach((book, i) => {
    const slide = document.createElement("div");
    slide.className = "slide";
    slide.dataset.index = i;
    slide.innerHTML = `
      <p class="slide-count">Date ${i + 1} of ${total}</p>
      <div class="parcel-wrap">
        <div class="reveal-card">
          <div class="reveal-cover-frame">
            <img class="reveal-cover" alt="" />
            <div class="reveal-cover-fallback">📖</div>
          </div>
          <p class="reveal-eyebrow">Tonight you read</p>
          <h3 class="reveal-title"></h3>
          <p class="reveal-author"></p>
          <p class="reveal-year"></p>
          <div class="reveal-actions">
            <button class="btn btn-ghost save-btn" type="button"></button>
            <button class="btn btn-ghost icon-btn share-btn" type="button" aria-label="Share this book">
              <span class="icon">⤴</span>
            </button>
          </div>
        </div>
        <div class="parcel-front" tabindex="0" role="button" aria-label="Tap to unwrap your blind date book">
          <div class="parcel-half parcel-left"></div>
          <div class="parcel-half parcel-right"></div>
          <div class="parcel-seal">?</div>
          <div class="parcel-body">
            <p class="parcel-eyebrow">A stranger, whispering</p>
            <p class="parcel-hint"></p>
            <div class="keyword-row"></div>
            <p class="parcel-tap-hint">tap to unwrap</p>
          </div>
        </div>
      </div>`;

    // fill text safely (textContent, never innerHTML, for API data)
    slide.querySelector(".parcel-hint").textContent = book.hint;
    const kwRow = slide.querySelector(".keyword-row");
    book.keywords.forEach((kw) => {
      const span = document.createElement("span");
      span.className = "keyword-chip";
      span.textContent = kw;
      kwRow.appendChild(span);
    });
    slide.querySelector(".reveal-title").textContent = book.title;
    slide.querySelector(".reveal-author").textContent = `by ${book.author}`;
    slide.querySelector(".reveal-year").textContent = book.year ? `First published ${book.year}` : "";

    const img = slide.querySelector(".reveal-cover");
    if (book.coverUrl) {
      img.alt = `Cover of ${book.title}`;
      img.onload = () => img.classList.add("is-loaded");
      img.src = book.coverUrl;
    }

    const wrap = slide.querySelector(".parcel-wrap");
    const front = slide.querySelector(".parcel-front");
    const unwrapIt = () => unwrap(i, wrap, front);
    front.addEventListener("click", unwrapIt);
    front.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        unwrapIt();
      }
    });

    const saveBtn = slide.querySelector(".save-btn");
    updateSaveButton(saveBtn, book);
    saveBtn.addEventListener("click", () => {
      addToPile(book);
      updateSaveButton(saveBtn, book);
      showToast("Added to your TBR pile 📚");
    });
    slide.querySelector(".share-btn").addEventListener("click", () => shareBook(book));

    el.track.appendChild(slide);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "dot";
    dot.setAttribute("aria-label", `Go to date ${i + 1}`);
    dot.addEventListener("click", () => goToSlide(i));
    el.dots.appendChild(dot);
  });
}

function unwrap(index, wrap, front) {
  if (front.classList.contains("is-torn")) return;
  front.classList.add("is-torn");
  wrap.classList.add("is-revealed");
  state.revealed.add(index);
  updateCarouselUI();
  if (navigator.vibrate) navigator.vibrate([14, 40, 14]);
}

function goToSlide(i) {
  const slide = el.track.children[i];
  if (!slide) return;
  const left = slide.offsetLeft - (el.track.clientWidth - slide.clientWidth) / 2;
  el.track.scrollTo({ left, behavior: "smooth" });
}

function currentIndexFromScroll() {
  const center = el.track.scrollLeft + el.track.clientWidth / 2;
  let best = 0;
  let bestDist = Infinity;
  [...el.track.children].forEach((slide, i) => {
    const dist = Math.abs(slide.offsetLeft + slide.clientWidth / 2 - center);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}

function updateCarouselUI() {
  const total = state.books.length;
  [...el.track.children].forEach((slide, i) =>
    slide.classList.toggle("is-current", i === state.current)
  );
  [...el.dots.children].forEach((dot, i) => {
    dot.classList.toggle("is-current", i === state.current);
    dot.classList.toggle("is-revealed", state.revealed.has(i));
  });
  el.prevBtn.disabled = state.current <= 0;
  el.nextBtn.disabled = state.current >= total - 1;
}

let scrollRaf = null;
el.track.addEventListener("scroll", () => {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = null;
    const idx = currentIndexFromScroll();
    if (idx !== state.current) {
      state.current = idx;
      updateCarouselUI();
    }
  });
}, { passive: true });

el.prevBtn.addEventListener("click", () => goToSlide(Math.max(0, state.current - 1)));
el.nextBtn.addEventListener("click", () =>
  goToSlide(Math.min(state.books.length - 1, state.current + 1))
);

el.findBtn.addEventListener("click", goOnADate);
el.retryBtn.addEventListener("click", goOnADate);
el.againBtn.addEventListener("click", goOnADate);
el.changeMoodBtn.addEventListener("click", () => showStage("picker"));

// ---------- save to pile ----------
function updateSaveButton(btn, book) {
  const saved = isInPile(book.key);
  btn.innerHTML = saved
    ? `<span class="icon">✓</span> In your TBR pile`
    : `<span class="icon">＋</span> Add to TBR pile`;
}

// ---------- share ----------
async function shareBook(book) {
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
}

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
