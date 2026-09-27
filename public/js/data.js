// data.js — static config for the picker & query building

export const MOODS = [
  { id: "cozy",        label: "Cozy",           terms: ["friendship", "domestic fiction"] },
  { id: "adventurous", label: "Adventurous",    terms: ["adventure fiction", "adventure"] },
  { id: "mindbending", label: "Mind-bending",   terms: ["science fiction", "philosophy"] },
  { id: "heartache",   label: "Heartbreaking",  terms: ["grief", "loss"] },
  { id: "funny",       label: "Funny",          terms: ["humor", "humorous fiction"] },
  { id: "spooky",      label: "Spooky",         terms: ["horror", "ghost stories"] },
  { id: "hopeful",     label: "Hopeful",        terms: ["inspiration", "self-realization"] },
  { id: "dark",        label: "Dark & twisty",  terms: ["psychological fiction", "noir fiction"] },
];

export const DECADES = [
  { id: "1800s", label: "1800s",        start: 1800, end: 1899 },
  { id: "1900s", label: "1900s–40s",    start: 1900, end: 1949 },
  { id: "1950s", label: "50s–60s",      start: 1950, end: 1969 },
  { id: "1970s", label: "70s–80s",      start: 1970, end: 1989 },
  { id: "1990s", label: "90s",          start: 1990, end: 1999 },
  { id: "2000s", label: "2000s",        start: 2000, end: 2009 },
  { id: "2010s", label: "2010s",        start: 2010, end: 2019 },
  { id: "2020s", label: "Brand new",    start: 2020, end: 2026 },
];

export const GENRES = [
  { id: "romance",   label: "Romance",    term: "romance" },
  { id: "mystery",   label: "Mystery",    term: "mystery" },
  { id: "scifi",     label: "Sci-Fi",     term: "science fiction" },
  { id: "fantasy",   label: "Fantasy",    term: "fantasy fiction" },
  { id: "horror",    label: "Horror",     term: "horror" },
  { id: "literary",  label: "Literary",   term: "literature" },
  { id: "poetry",    label: "Poetry",     term: "poetry" },
  { id: "biography", label: "Biography",  term: "biography" },
  { id: "history",   label: "History",    term: "history" },
  { id: "thriller",  label: "Thriller",   term: "thriller" },
];

export const LOADING_CAPTIONS = [
  "Combing the stacks…",
  "Dusting off a spine…",
  "Reading the room…",
  "Matching hearts to hardbacks…",
  "Wrapping your parcel…",
  "Consulting the shelf elves…",
];
