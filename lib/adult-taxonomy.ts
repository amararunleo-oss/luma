import pornhubCollectionAliases from "@/lib/pornhub-category-aliases.json";

export type AdultCategoryDefinition = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  aliases: readonly string[];
};

export const ADULT_CATEGORY_MINIMUM_VIDEOS = 8;

export const ADULT_CATEGORIES: readonly AdultCategoryDefinition[] = [
  { slug: "sex", name: "Sex Videos", shortName: "Sex", description: "Browse adult sex videos and popular intimate scenes, organized by style, duration and related category.", aliases: ["adult sex", "sex video", "sex videos", "hot sex"] },
  { slug: "nude", name: "Nude & Naked Videos", shortName: "Nude", description: "Browse adult nude and naked videos with related performer, movie, television and explicit categories.", aliases: ["naked", "nudity"] },
  { slug: "topless", name: "Topless Videos", shortName: "Topless", description: "Explore adult topless videos with related nude, performer and body-type categories.", aliases: ["bare breasts"] },
  { slug: "amateur", name: "Amateur Videos", shortName: "Amateur", description: "Explore amateur and homemade adult videos with related POV, couple and verified performer categories.", aliases: ["homemade", "real couple", "home video"] },
  { slug: "hentai", name: "Hentai & Animated Videos", shortName: "Hentai", description: "Discover adult hentai, anime-inspired animation and 3D fantasy videos in one focused collection.", aliases: ["anime", "animated", "cartoon"] },
  { slug: "milf", name: "MILF & Mature Videos", shortName: "MILF", description: "Browse adult MILF and mature performer videos, with related categories and popular selections.", aliases: ["mature", "older woman"] },
  { slug: "lesbian", name: "Lesbian Videos", shortName: "Lesbian", description: "Explore adult lesbian videos, romantic scenes and related oral and couple categories.", aliases: ["girl girl", "women only"] },
  { slug: "japanese", name: "Japanese Adult Videos", shortName: "Japanese", description: "Browse Japanese adult videos and related Asian performer categories with clear titles and tags.", aliases: ["japan", "jav"] },
  { slug: "asian", name: "Asian Adult Videos", shortName: "Asian", description: "Explore adult Asian videos across Japanese, Korean, Pinay and related performer categories.", aliases: ["korean", "pinay"] },
  { slug: "anal", name: "Anal Videos", shortName: "Anal", description: "Browse adult anal videos with related positions, performers and popular scene categories.", aliases: ["anal sex"] },
  { slug: "doggy-style", name: "Doggy Style Videos", shortName: "Doggy Style", description: "Explore adult doggy style videos and related sex-position categories, ordered for useful discovery.", aliases: ["doggy", "doggystyle", "rear entry"] },
  { slug: "oral", name: "Oral & Pussy Licking Videos", shortName: "Oral", description: "Browse adult oral sex and pussy licking videos with related couple and lesbian categories.", aliases: ["pussy licking", "cunnilingus", "oral sex", "blowjob"] },
  { slug: "pussy-licking", name: "Pussy Licking Videos", shortName: "Pussy Licking", description: "Browse adult pussy licking and cunnilingus videos from recent validated embeds.", aliases: ["cunnilingus", "licking pussy", "eating pussy"] },
  { slug: "blowjob", name: "Blowjob Videos", shortName: "Blowjob", description: "Browse recent adult blowjob and deep-throat videos from validated embeds.", aliases: ["blow job", "deepthroat", "deep throat", "sucking dick"] },
  { slug: "big-tits", name: "Big Tits Videos", shortName: "Big Tits", description: "Explore adult big tits and busty performer videos with related body-type categories.", aliases: ["big breasts", "big boobs", "busty", "huge tits"] },
  { slug: "big-butt", name: "Big Butt Videos", shortName: "Big Butt", description: "Browse adult big butt videos with related performer, position and body-type categories.", aliases: ["butt", "big ass", "booty", "curvy"] },
  { slug: "big-dick", name: "Big Dick Videos", shortName: "Big Dick", description: "Explore adult big dick videos with related couple, oral and sex-position categories.", aliases: ["large penis", "well endowed"] },
  { slug: "cumshot", name: "Cumshot Videos", shortName: "Cumshot", description: "Browse adult cumshot videos and related oral, couple and explicit scene categories.", aliases: ["cum shot", "facial"] },
  { slug: "romantic", name: "Romantic Sex Videos", shortName: "Romantic", description: "Discover romantic adult videos focused on sensual, passionate and intimate couple scenes.", aliases: ["sensual", "passionate", "romantic sex"] },
  { slug: "rough-sex", name: "Rough Sex Videos", shortName: "Rough", description: "Browse consensual adult rough sex videos from verified sources with related positions and performers.", aliases: ["rough", "hard sex", "intense"] },
  { slug: "pov", name: "POV Videos", shortName: "POV", description: "Explore adult point-of-view videos across amateur, oral and popular sex-position categories.", aliases: ["point of view", "first person"] },
  { slug: "roleplay", name: "Adult Roleplay Videos", shortName: "Roleplay", description: "Browse clearly adult roleplay videos, costumes and fantasy scenarios with related categories.", aliases: ["role play", "fantasy roleplay"] },
  { slug: "cosplay", name: "Cosplay Videos", shortName: "Cosplay", description: "Explore adult cosplay videos with gaming, fantasy and roleplay themes.", aliases: ["costume", "gaming cosplay"] },
  { slug: "threesome", name: "Threesome & Group Videos", shortName: "Threesome", description: "Browse adult threesome and group videos with related couple and multi-performer categories.", aliases: ["group sex", "multiple partners"] },
  { slug: "transgender", name: "Transgender Videos", shortName: "Trans", description: "Explore adult transgender performer videos with respectful labels and related categories.", aliases: ["trans", "transsexual"] },
  { slug: "ai-3d", name: "AI & 3D Adult Videos", shortName: "AI & 3D", description: "Browse fictional AI-generated and 3D adult videos that do not impersonate real people.", aliases: ["3d", "cgi", "ai adult"] },
  { slug: "step-family-roleplay", name: "Step-Family Roleplay Videos", shortName: "Step Roleplay", description: "Explore clearly adult step-family fantasy roleplay videos with age-verified performers.", aliases: ["stepmom", "stepsister", "stepbrother", "step fantasy"] },
  { slug: "sex-positions", name: "Sex Position Videos", shortName: "Positions", description: "Browse adult sex-position videos including doggy style, cowgirl, missionary and related categories.", aliases: ["sex positions", "cowgirl", "missionary"] },
  { slug: "babe", name: "Babe Videos", shortName: "Babe", description: "Explore adult performer videos grouped with popular style, body-type and scene categories.", aliases: ["hot babe", "sexy babe"] },
] as const;

function slugifyTerm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const ADULT_DISCOVERY_TAGS = [...new Set(ADULT_CATEGORIES.flatMap((category) => [category.slug, ...category.aliases.map(slugifyTerm)]))];

export function adultCategoryTagSlugs(category: AdultCategoryDefinition) {
  return [...new Set([category.slug, ...category.aliases.map(slugifyTerm)])];
}

export function adultCategoryMatchTerms(category: AdultCategoryDefinition) {
  return [...new Set([
    ...adultCategoryTagSlugs(category),
    ...(pornhubCollectionAliases[category.slug as keyof typeof pornhubCollectionAliases] ?? []),
  ].map(slugifyTerm))];
}

const categoryTerms = new Map<string, AdultCategoryDefinition>();
for (const category of ADULT_CATEGORIES) {
  categoryTerms.set(category.slug, category);
  categoryTerms.set(category.name.toLowerCase(), category);
  for (const alias of category.aliases) categoryTerms.set(alias.toLowerCase(), category);
}

export const AGE_RISK_TERMS = [
  "underage",
  "minor",
  "young girl",
  "teen",
  "schoolgirl",
  "school girl",
  "barely legal",
  "lolita",
  "child",
  "college girl",
] as const;

export function adultCategoryBySlugOrName(value: string) {
  return categoryTerms.get(value.trim().toLowerCase());
}

export function adultCategoryForTag(tag: { slug: string; name: string }) {
  return adultCategoryBySlugOrName(tag.slug) ?? adultCategoryBySlugOrName(tag.name);
}

export function containsAgeRiskTerm(values: readonly string[]) {
  const text = values.join(" ").toLowerCase();
  return AGE_RISK_TERMS.some((term) => text.includes(term));
}
