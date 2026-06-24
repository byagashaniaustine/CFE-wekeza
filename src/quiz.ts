// General Quiz — bilingual question bank, grading and recommendations.
// Each question is tagged with a `topic` = a curriculum module id, so wrong
// answers can be turned into "areas to improve" and a recommended module.
import type { Lang, Loc } from "./curriculum.ts";
import { findModule } from "./curriculum.ts";

export interface QuizQuestion {
  q: Loc;
  options: Loc[]; // exactly 3 (A, B, C)
  answer: number; // 0-2
  topic: string; // module id
}

const t = (en: string, sw: string): Loc => ({ en, sw });

export const QUIZ_BANK: QuizQuestion[] = [
  {
    q: t("What should you build BEFORE you start investing?", "Unapaswa kujenga nini KABLA ya kuwekeza?"),
    options: [t("An emergency fund", "Mfuko wa dharura"), t("A loan", "Mkopo"), t("A second phone", "Simu ya pili")],
    answer: 0,
    topic: "basic-concepts",
  },
  {
    q: t("What does inflation do to idle cash?", "Mfumuko wa bei hufanya nini kwa fedha iliyolala?"),
    options: [t("Reduces its value", "Hupunguza thamani yake"), t("Increases it", "Huiongeza"), t("Nothing", "Hakuna")],
    answer: 0,
    topic: "basic-concepts",
  },
  {
    q: t("Diversification mainly helps you to:", "Mseto hukusaidia zaidi ku:"),
    options: [t("Reduce risk", "Punguza hatari"), t("Avoid all tax", "Epuka kodi yote"), t("Guarantee profit", "Hakikisha faida")],
    answer: 0,
    topic: "basic-concepts",
  },
  {
    q: t("Compound interest means you earn returns on:", "Riba ya mkusanyiko ina maana unapata faida juu ya:"),
    options: [t("Your money and past returns", "Fedha yako na faida iliyopita"), t("Only your deposit", "Amana yako pekee"), t("Only fees", "Ada pekee")],
    answer: 0,
    topic: "basic-concepts",
  },
  {
    q: t("Which is the most liquid?", "Kipi kina ukwasi zaidi?"),
    options: [t("Money-market fund", "Mfuko wa soko la fedha"), t("Land", "Ardhi"), t("A 10-year plan", "Mpango wa miaka 10")],
    answer: 0,
    topic: "basic-concepts",
  },
  {
    q: t("What is the minimum to start the UTT Umoja Fund?", "Kima cha chini cha kuanza Mfuko wa Umoja (UTT)?"),
    options: [t("About TZS 10,000", "Takriban TZS 10,000"), t("TZS 1,000,000", "TZS 1,000,000"), t("TZS 500,000", "TZS 500,000")],
    answer: 0,
    topic: "utt-basics",
  },
  {
    q: t("What account do you need to buy shares on the DSE?", "Unahitaji akaunti gani kununua hisa DSE?"),
    options: [t("A CDS account", "Akaunti ya CDS"), t("A dollar account", "Akaunti ya dola"), t("A fixed deposit", "Amana ya muda")],
    answer: 0,
    topic: "dse-cds",
  },
  {
    q: t("Minimum bid for a Treasury bond at the Bank of Tanzania?", "Kima cha chini cha zabuni ya hatifungani BoT?"),
    options: [t("TZS 1,000,000", "TZS 1,000,000"), t("TZS 10,000", "TZS 10,000"), t("TZS 100", "TZS 100")],
    answer: 0,
    topic: "gs-tbonds",
  },
  {
    q: t("Who licenses investment firms in Tanzania?", "Nani hutoa leseni kwa makampuni ya uwekezaji Tanzania?"),
    options: [t("CMSA", "CMSA"), t("Your bank", "Benki yako"), t("A WhatsApp group", "Kikundi cha WhatsApp")],
    answer: 0,
    topic: "ecosystem",
  },
  {
    q: t("Someone guarantees 30% profit per month. This is:", "Mtu anahakikishia faida 30% kwa mwezi. Hii ni:"),
    options: [t("Likely a scam", "Huenda ni ulaghai"), t("A safe bet", "Salama"), t("A pension", "Pensheni")],
    answer: 0,
    topic: "ecosystem",
  },
];

const RESULT = {
  header: (s: number, total: number): Loc => ({
    en: `Quiz results\n\nScore: ${s}/${total}`,
    sw: `Matokeo ya jaribio\n\nAlama: ${s}/${total}`,
  }),
  perfect: { en: "\n\nExcellent — you have the basics down!", sw: "\n\nVizuri sana — misingi unaifahamu!" } as Loc,
  improve: { en: "\n\nAreas to improve: ", sw: "\n\nMaeneo ya kuboresha: " } as Loc,
  recommend: { en: "\n\nRecommended next: ", sw: "\n\nPendekezo linalofuata: " } as Loc,
};

/** Build the end-of-quiz results message and pick a recommended module. */
export function quizResult(score: number, wrongTopics: string[], lang: Lang): string {
  const total = QUIZ_BANK.length;
  let msg = RESULT.header(score, total)[lang];

  if (wrongTopics.length === 0) {
    return msg + RESULT.perfect[lang];
  }

  // Tally wrong topics → most-missed first.
  const counts = new Map<string, number>();
  for (const topic of wrongTopics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([topic]) => topic);

  const areaNames = ranked
    .map((id) => findModule(id)?.short[lang])
    .filter((x): x is string => Boolean(x));
  if (areaNames.length) msg += RESULT.improve[lang] + areaNames.join(", ");

  const rec = findModule(ranked[0]);
  if (rec) msg += RESULT.recommend[lang] + rec.title[lang];
  return msg;
}
