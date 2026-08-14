export const COLLECTIONS = [
  { slug: "18-25", label: "18-25 Adults", weight: 400, terms: ["18 25"] },
  { slug: "amateur", label: "Amateur", weight: 700, terms: ["amateur", "homemade", "home made", "real couple"] },
  { slug: "anal", label: "Anal", weight: 450, terms: ["anal", "ass fuck", "assfuck"] },
  { slug: "asian", label: "Asian", weight: 450, terms: ["asian", "korean", "chinese", "thai", "pinay", "filipina"] },
  { slug: "big-breasts", label: "Big Breasts", weight: 450, terms: ["big tits", "big boobs", "big breasts", "huge tits"] },
  { slug: "big-butt", label: "Big Butt", weight: 400, terms: ["big ass", "big butt", "huge ass", "thick ass"] },
  { slug: "college-roleplay", label: "College Roleplay", weight: 250, terms: ["college", "campus", "coed", "dorm"] },
  { slug: "cosplay", label: "Cosplay", weight: 300, terms: ["cosplay", "costume", "superhero", "comic"] },
  { slug: "doggy-style", label: "Doggy Style", weight: 450, terms: ["doggy", "doggystyle", "doggy style"] },
  { slug: "ebony", label: "Ebony", weight: 350, terms: ["ebony", "black women", "black woman", "black girls"] },
  { slug: "hentai-anime", label: "Hentai & Anime", weight: 500, terms: ["hentai", "anime", "cartoon", "animated"] },
  { slug: "japanese", label: "Japanese", weight: 450, terms: ["japanese", "jav", "japan"] },
  { slug: "latina", label: "Latina", weight: 300, terms: ["latina", "latin", "brazilian", "mexican"] },
  { slug: "lesbian", label: "Lesbian", weight: 500, terms: ["lesbian", "girls only", "girl on girl"] },
  { slug: "massage", label: "Massage", weight: 300, terms: ["massage", "masseuse", "spa"] },
  { slug: "milf-mature", label: "MILF & Mature", weight: 500, terms: ["milf", "mature", "older woman", "cougar"] },
  { slug: "oral", label: "Oral", weight: 450, terms: ["oral", "blowjob", "blow job", "deepthroat", "pussy licking", "cunnilingus"] },
  { slug: "pov", label: "POV", weight: 400, terms: ["pov", "point of view"] },
  { slug: "romantic", label: "Romantic", weight: 350, terms: ["romantic", "romance", "passionate", "sensual", "love making"] },
  { slug: "rough", label: "Rough", weight: 300, terms: ["rough", "hardcore", "hard sex"] },
  { slug: "step-fantasy", label: "Step Fantasy", weight: 300, terms: ["stepmom", "step mom", "stepmother", "stepsister", "step sister", "stepbrother", "step brother"] },
  { slug: "threesome-group", label: "Threesome & Group", weight: 400, terms: ["threesome", "foursome", "group sex", "orgy", "gangbang"] },
  { slug: "trans", label: "Trans", weight: 300, terms: ["trans", "transgender", "transsexual"] },
  { slug: "creampie-cumshot", label: "Creampie & Cumshot", weight: 350, terms: ["creampie", "cumshot", "cum shot", "facial"] },
  { slug: "roleplay", label: "Roleplay", weight: 300, terms: ["roleplay", "role play", "fantasy", "uniform"] },
  { slug: "ai-3d", label: "AI & 3D", weight: 200, terms: ["ai generated", "ai porn", "3d", "cgi", "virtual"] },
];

// The import is intended to feel like a hand-picked popular feed. Recency and
// diversity remain tie-breakers, but raw popularity gets the largest share.
export const LANE_SHARES = Object.freeze({ popular: 0.7, rated: 0.15, recent: 0.1, diverse: 0.05 });

// Conservative launch filter: uncertain age or consent is rejected instead of guessed.
export const HARD_REJECT_TERMS = [
  "underage", "under age", "minor", "child", "preteen", "pre-teen", "schoolgirl", "school girl",
  "teen", "teenager", "barely legal", "lolita", "loli", "young girl", "little girl", "jailbait",
  "rape", "raped", "forced sex", "non consensual", "non-consensual", "unconscious", "drugged",
  "sleeping girl", "hidden camera", "hidden cam", "spycam", "spy cam", "revenge porn", "leaked",
  "deepfake", "deep fake", "face swap", "faceswap", "real incest", "biological incest",
  "bestiality", "zoophilia", "animal sex", "scat", "feces", "coprophilia", "vomit",
  "watersports", "water sports", "golden shower", "piss drinking", "gore", "snuff",
  "prolapse", "fisting", "extreme insertion", "painal", "abuse", "torture",
];

export function allocateQuotas(total) {
  const weightTotal = COLLECTIONS.reduce((sum, item) => sum + item.weight, 0);
  const raw = COLLECTIONS.map((item) => ({ ...item, exact: total * item.weight / weightTotal }));
  const result = raw.map((item) => ({ ...item, quota: Math.floor(item.exact) }));
  let remainder = total - result.reduce((sum, item) => sum + item.quota, 0);
  result.sort((a, b) => (b.exact - b.quota) - (a.exact - a.quota));
  for (let index = 0; index < result.length && remainder > 0; index += 1, remainder -= 1) result[index].quota += 1;
  return result.sort((a, b) => COLLECTIONS.findIndex((item) => item.slug === a.slug) - COLLECTIONS.findIndex((item) => item.slug === b.slug));
}

export function matchCollections(text) {
  const haystack = ` ${String(text).toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return COLLECTIONS.filter((collection) => collection.terms.some((term) => haystack.includes(` ${term.replace(/[^a-z0-9]+/g, " ")} `)));
}

export function rejectionReason(text) {
  const haystack = ` ${String(text).toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const term = HARD_REJECT_TERMS.find((candidate) => haystack.includes(` ${candidate.replace(/[^a-z0-9]+/g, " ")} `));
  return term ? `blocked_term:${term}` : null;
}
