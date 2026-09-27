// storage.js — the "To Be Read" pile, persisted in localStorage

const KEY = "bdwb_tbr_pile_v1";

export function getPile() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePile(pile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pile));
  } catch {
    // storage unavailable (private mode, quota, etc.) — fail silently
  }
}

export function isInPile(bookKey) {
  return getPile().some((b) => b.key === bookKey);
}

export function addToPile(book) {
  const pile = getPile();
  if (pile.some((b) => b.key === book.key)) return pile;
  pile.unshift({
    key: book.key,
    title: book.title,
    author: book.author,
    year: book.year,
    coverUrl: book.coverUrl,
    addedAt: Date.now(),
  });
  savePile(pile);
  return pile;
}

export function removeFromPile(bookKey) {
  const pile = getPile().filter((b) => b.key !== bookKey);
  savePile(pile);
  return pile;
}
