// api.js — talks to the free, unauthenticated Open Library API
import { MOODS, DECADES, GENRES } from "./data.js";

const SEARCH_BASE = "https://openlibrary.org/search.json";
const FIELDS = "title,author_name,first_publish_year,cover_i,subject,first_sentence,key,ia";
const RESULT_LIMIT = 100;

const NOISY_SUBJECT = /(nyt|new york times|protected daisy|accessible book|overdrive|internet archive|lending library|large type|staff pick|bestseller|open library|reading level|^\d)/i;

/**
 * Build a list of query attempts, most specific first, falling back to
 * broader ones so we (almost) always find a match.
 */
function buildAttempts(selection) {
  const mood = MOODS.find((m) => m.id === selection.mood);
  const decade = DECADES.find((d) => d.id === selection.decade);
  const genre = GENRES.find((g) => g.id === selection.genre);

  const moodTerm = mood ? mood.terms[0] : null;
  const genreTerm = genre ? genre.term : null;
  const yearRange = decade ? [decade.start, decade.end] : null;

  const attempts = [];

  if (moodTerm && genreTerm) attempts.push({ subjects: [moodTerm, genreTerm], yearRange });
  if (genreTerm) attempts.push({ subjects: [genreTerm], yearRange });
  if (moodTerm) attempts.push({ subjects: [moodTerm], yearRange });
  if (yearRange) attempts.push({ subjects: ["fiction"], yearRange });
  if (moodTerm && genreTerm) attempts.push({ subjects: [moodTerm, genreTerm], yearRange: null });
  if (genreTerm) attempts.push({ subjects: [genreTerm], yearRange: null });
  if (moodTerm) attempts.push({ subjects: [moodTerm], yearRange: null });
  attempts.push({ subjects: ["fiction"], yearRange: null });

  // de-dupe identical attempts
  const seen = new Set();
  return attempts.filter((a) => {
    const key = JSON.stringify(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildUrl(attempt, offset) {
  const parts = attempt.subjects.map((s) => `subject:"${s}"`);
  if (attempt.yearRange) {
    parts.push(`first_publish_year:[${attempt.yearRange[0]} TO ${attempt.yearRange[1]}]`);
  }
  const q = parts.join(" ");
  const params = new URLSearchParams({
    q,
    fields: FIELDS,
    limit: String(RESULT_LIMIT),
    language: "eng",
  });
  if (offset) params.set("offset", String(offset));
  return `${SEARCH_BASE}?${params.toString()}`;
}

async function fetchAttempt(attempt) {
  // first, a light probe to learn how many results exist so we can jump
  // to a random page of the catalogue instead of always the same 100
  const probeUrl = buildUrl(attempt, 0);
  const probeRes = await fetch(probeUrl);
  if (!probeRes.ok) throw new Error(`Open Library responded ${probeRes.status}`);
  const probeData = await probeRes.json();
  const numFound = probeData.numFound || 0;
  if (numFound === 0) return [];

  let docs = probeData.docs || [];

  if (numFound > RESULT_LIMIT) {
    const maxOffset = Math.min(numFound - RESULT_LIMIT, 900);
    const offset = Math.floor(Math.random() * (maxOffset + 1));
    if (offset > 0) {
      const url = buildUrl(attempt, offset);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        docs = data.docs || docs;
      }
    }
  }

  return docs.filter((d) => d.cover_i && d.title && d.author_name && d.author_name.length);
}

function cleanKeywords(subjectList, fallbackTerms) {
  const pool = (subjectList || [])
    .filter((s) => typeof s === "string" && s.length < 40 && !NOISY_SUBJECT.test(s));

  const titleCased = (s) =>
    s.replace(/\b\w/g, (c) => c.toUpperCase());

  const unique = [];
  const seenLower = new Set();
  for (const s of pool) {
    const lower = s.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      unique.push(titleCased(s));
    }
  }

  if (unique.length < 3 && fallbackTerms) {
    for (const t of fallbackTerms) {
      const lower = t.toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        unique.push(titleCased(t));
      }
      if (unique.length >= 3) break;
    }
  }

  return unique.slice(0, 3);
}

function buildHint(doc) {
  // first_sentence is sometimes an array of strings, sometimes objects
  const raw = doc.first_sentence;
  if (raw && raw.length) {
    const first = typeof raw[0] === "string" ? raw[0] : raw[0]?.value;
    if (first && first.trim().length > 0 && first.length < 220) {
      return `"${first.trim()}"`;
    }
  }

  const cleanSubjects = (doc.subject || []).filter(
    (s) => typeof s === "string" && !NOISY_SUBJECT.test(s) && s.length < 30
  );
  const a = cleanSubjects[0];
  const b = cleanSubjects.find((s) => s !== a);

  if (a && b) {
    return `A story shelved somewhere between ${a.toLowerCase()} and ${b.toLowerCase()}.`;
  }
  if (a) {
    return `A story with a strong streak of ${a.toLowerCase()}.`;
  }
  if (doc.first_publish_year) {
    return `A story that first found readers around ${doc.first_publish_year}.`;
  }
  return "A story waiting to introduce itself.";
}

function normalize(doc, selection) {
  const fallbackTerms = [
    MOODS.find((m) => m.id === selection.mood)?.label,
    GENRES.find((g) => g.id === selection.genre)?.label,
  ].filter(Boolean);

  return {
    key: doc.key,
    title: doc.title,
    author: (doc.author_name && doc.author_name[0]) || "Unknown author",
    year: doc.first_publish_year || null,
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : null,
    hint: buildHint(doc),
    keywords: cleanKeywords(doc.subject, fallbackTerms),
  };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Find up to `count` distinct random matching books. Tries increasingly
 * broad queries until enough usable results (cover + title + author) are
 * collected, topping up from broader searches if a narrow one runs short.
 */
export async function findBlindDates(selection, count = 5) {
  const attempts = buildAttempts(selection);
  const picked = [];
  const seenKeys = new Set();
  const seenTitles = new Set();

  for (const attempt of attempts) {
    try {
      const docs = shuffle(await fetchAttempt(attempt));
      for (const doc of docs) {
        const titleKey = doc.title.toLowerCase().trim();
        if (seenKeys.has(doc.key) || seenTitles.has(titleKey)) continue;
        seenKeys.add(doc.key);
        seenTitles.add(titleKey);
        picked.push(normalize(doc, selection));
        if (picked.length >= count) return picked;
      }
    } catch (err) {
      continue;
    }
  }

  if (picked.length === 0) throw new Error("No matches found in the stacks tonight.");
  return picked;
}
