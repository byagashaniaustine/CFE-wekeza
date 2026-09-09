// "Jipime Uwezo wa Uwekezaji" — Test Your Investing Ability.
//
// A rotating self-test: each attempt draws QUIZ_LEN questions at random from a
// larger pool, so the quiz feels fresh every time. Questions are everyday and
// relatable, topic-tagged to a curriculum module (so wrong answers become
// "areas to improve" + a recommended module), and each carries a one-line
// `why` used to gently correct a wrong answer. Feedback is warm and varied
// with light emoji; the result shows a score bar and a tiered message.
import type { Lang, Loc } from "./curriculum.ts";
import { findModule } from "./curriculum.ts";

export interface QuizQuestion {
  q: Loc;
  options: Loc[]; // exactly 3 (A, B, C)
  answer: number; // 0-2
  topic: string; // module id
  why: Loc; // one-line explanation of the correct answer
}

const t = (en: string, sw: string): Loc => ({ en, sw });

/** How many questions each attempt asks (drawn at random from QUIZ_BANK). */
export const QUIZ_LEN = 7;

export const QUIZ_BANK: QuizQuestion[] = [
  {
    q: t("Before you invest, what should you have ready first?", "Kabla ya kuwekeza, unapaswa kuwa na nini kwanza?"),
    options: [t("An emergency fund", "Mfuko wa dharura"), t("A big loan", "Mkopo mkubwa"), t("A new phone", "Simu mpya")],
    answer: 0, topic: "basic-concepts",
    why: t("An emergency fund (3–6 months of expenses) comes first.", "Mfuko wa dharura (matumizi ya miezi 3–6) huja kwanza."),
  },
  {
    q: t("If you keep cash under the mattress for years, inflation will…", "Ukihifadhi fedha taslimu kwa miaka, mfumuko wa bei uta…"),
    options: [t("Grow it", "Kuiongeza"), t("Eat its value", "Kula thamani yake"), t("Do nothing", "Hakuna athari")],
    answer: 1, topic: "basic-concepts",
    why: t("Inflation slowly eats the value of idle cash.", "Mfumuko wa bei hula thamani ya fedha iliyolala."),
  },
  {
    q: t("“Don't put all your eggs in one basket” means…", "“Usiweke mayai yote kikapu kimoja” maana yake…"),
    options: [t("Spread your money", "Sambaza fedha yako"), t("Buy one thing only", "Nunua kitu kimoja"), t("Avoid banks", "Epuka benki")],
    answer: 0, topic: "portfolio-building",
    why: t("Spreading money across investments lowers your risk.", "Kusambaza fedha kwenye uwekezaji mbalimbali hupunguza hatari."),
  },
  {
    q: t("Compound interest means you earn returns on…", "Riba ya mkusanyiko maana yake unapata faida juu ya…"),
    options: [t("Fees only", "Ada pekee"), t("Your deposit only", "Amana yako pekee"), t("Your money AND past returns", "Fedha yako NA faida iliyopita")],
    answer: 2, topic: "basic-concepts",
    why: t("You earn on your money and on the returns it already made.", "Unapata faida juu ya fedha yako na faida iliyokwisha pata."),
  },
  {
    q: t("Which can you turn into cash the fastest?", "Kipi unaweza kubadilisha kuwa fedha haraka zaidi?"),
    options: [t("A plot of land", "Kiwanja"), t("A money-market / Liquid fund", "Mfuko wa Liquid"), t("A 10-year bond", "Hatifungani ya miaka 10")],
    answer: 1, topic: "basic-concepts",
    why: t("A money-market / Liquid fund is easiest to cash out quickly.", "Mfuko wa Liquid ni rahisi kuutoa fedha haraka."),
  },
  {
    q: t("Why invest instead of only saving in a normal account?", "Kwa nini kuwekeza badala ya kuweka akiba tu?"),
    options: [t("To grow money above inflation", "Kukuza fedha kuzidi mfumuko"), t("To hide money", "Kuficha fedha"), t("To avoid all risk", "Kuepuka hatari yote")],
    answer: 0, topic: "why-invest",
    why: t("Investing aims to grow your money faster than inflation.", "Uwekezaji hulenga kukuza fedha kuliko mfumuko wa bei."),
  },
  {
    q: t("An offer promises very high returns. Usually that means…", "Fursa inaahidi faida kubwa sana. Kawaida inamaanisha…"),
    options: [t("No risk at all", "Hakuna hatari"), t("Higher risk too", "Hatari kubwa pia"), t("Government backing", "Dhamana ya serikali")],
    answer: 1, topic: "fundamentals",
    why: t("Higher potential returns almost always carry higher risk.", "Faida kubwa huja na hatari kubwa zaidi."),
  },
  {
    q: t("What is the best first step when planning to invest?", "Hatua bora ya kwanza katika mipango ya uwekezaji ni ipi?"),
    options: [t("Copy a friend", "Kumuiga rafiki"), t("Set a clear goal", "Weka lengo wazi"), t("Borrow to invest", "Kopa ili uwekeze")],
    answer: 1, topic: "planning",
    why: t("Start with a clear goal and time frame.", "Anza na lengo wazi na muda."),
  },
  {
    q: t("A balanced portfolio usually holds…", "Portfolio yenye uwiano kawaida ina…"),
    options: [t("One share only", "Hisa moja tu"), t("A mix of investments", "Mchanganyiko wa uwekezaji"), t("Only cash", "Fedha taslimu tu")],
    answer: 1, topic: "portfolio-building",
    why: t("A mix — funds, shares, bonds — balances growth and safety.", "Mchanganyiko — mifuko, hisa, hatifungani — huleta uwiano."),
  },
  {
    q: t("About how little can start you in the UTT Umoja Fund?", "Kwa kiasi gani kidogo unaweza kuanza Mfuko wa Umoja (UTT)?"),
    options: [t("About TZS 10,000", "Takribani TZS 10,000"), t("TZS 1,000,000", "TZS 1,000,000"), t("TZS 500,000", "TZS 500,000")],
    answer: 0, topic: "utt-basics",
    why: t("You can start UTT unit trusts from around TZS 10,000.", "Unaweza kuanza mifuko ya UTT kuanzia ~TZS 10,000."),
  },
  {
    q: t("When you invest in a UTT fund, you own…", "Ukiwekeza kwenye mfuko wa UTT, unamiliki…"),
    options: [t("Units of the fund", "Vipande vya mfuko"), t("The whole fund", "Mfuko mzima"), t("A bank branch", "Tawi la benki")],
    answer: 0, topic: "utt-units",
    why: t("Your money buys “units” of a shared, managed fund.", "Fedha yako hununua “vipande” vya mfuko unaosimamiwa."),
  },
  {
    q: t("A fund's NAV per unit is…", "NAV kwa kipande cha mfuko ni…"),
    options: [t("A hidden fee", "Ada iliyofichwa"), t("The price of one unit", "Bei ya kipande kimoja"), t("The bank's profit", "Faida ya benki")],
    answer: 1, topic: "utt-nav",
    why: t("NAV per unit is the current price of one unit.", "NAV kwa kipande ni bei ya sasa ya kipande kimoja."),
  },
  {
    q: t("To buy shares on the DSE, you first need…", "Kununua hisa DSE, kwanza unahitaji…"),
    options: [t("A CDS account", "Akaunti ya CDS"), t("A dollar account", "Akaunti ya dola"), t("A passport", "Pasipoti")],
    answer: 0, topic: "dse-cds",
    why: t("You need a CDS account, opened through a licensed broker.", "Unahitaji akaunti ya CDS, kupitia dalali mwenye leseni."),
  },
  {
    q: t("Buying a share means you…", "Kununua hisa maana yake…"),
    options: [t("Own part of the company", "Unamiliki sehemu ya kampuni"), t("Lend it money forever", "Unaikopesha milele"), t("Work there", "Unafanya kazi hapo")],
    answer: 0, topic: "dse-shares",
    why: t("A share is part-ownership of a listed company.", "Hisa ni umiliki wa sehemu ya kampuni iliyoorodheshwa."),
  },
  {
    q: t("A dividend is…", "Gawio ni…"),
    options: [t("A penalty", "Adhabu"), t("A share of profit paid to owners", "Sehemu ya faida kwa wamiliki"), t("A type of loan", "Aina ya mkopo")],
    answer: 1, topic: "dse-dividends",
    why: t("Dividends are profits paid out to shareholders.", "Gawio ni faida inayolipwa kwa wanahisa."),
  },
  {
    q: t("The minimum for a Treasury bond at the Bank of Tanzania is about…", "Kima cha chini cha hatifungani BoT ni takribani…"),
    options: [t("TZS 100", "TZS 100"), t("TZS 10,000", "TZS 10,000"), t("TZS 1,000,000", "TZS 1,000,000")],
    answer: 2, topic: "gs-tbonds",
    why: t("Treasury bonds start around TZS 1,000,000.", "Hatifungani huanza takribani TZS 1,000,000."),
  },
  {
    q: t("A Treasury bill (T-bill) is…", "Dhamana ya muda mfupi (T-bill) ni…"),
    options: [t("A short-term (up to 1 year) govt loan", "Mkopo wa serikali wa muda mfupi (hadi mwaka 1)"), t("A 20-year plan", "Mpango wa miaka 20"), t("A share", "Hisa")],
    answer: 0, topic: "gs-tbills",
    why: t("T-bills are short-term government borrowing, up to one year.", "T-bills ni mikopo ya serikali ya muda mfupi, hadi mwaka."),
  },
  {
    q: t("Who licenses investment firms in Tanzania?", "Nani hutoa leseni kwa makampuni ya uwekezaji Tanzania?"),
    options: [t("A WhatsApp group", "Kikundi cha WhatsApp"), t("CMSA", "CMSA"), t("A friend", "Rafiki")],
    answer: 1, topic: "ecosystem",
    why: t("CMSA licenses and supervises investment firms.", "CMSA ndiyo hutoa leseni na kusimamia."),
  },
  {
    q: t("Someone guarantees 30% profit every month. This is…", "Mtu anahakikishia faida 30% kila mwezi. Hii ni…"),
    options: [t("A great deal", "Fursa nzuri"), t("Likely a scam", "Huenda ni ulaghai"), t("A pension", "Pensheni")],
    answer: 1, topic: "investor-protection",
    why: t("“Guaranteed” high monthly returns are a classic scam sign.", "Faida “ya uhakika” kubwa kila mwezi ni dalili ya ulaghai."),
  },
  {
    q: t("You're told to pay into a personal mobile number to “invest”. You should…", "Umeambiwa ulipe kwenye namba binafsi ya simu ili “kuwekeza”. Unapaswa…"),
    options: [t("Pay fast before it's gone", "Lipa haraka"), t("Stop — it's a red flag", "Simama — ni dalili mbaya"), t("Send half", "Tuma nusu")],
    answer: 1, topic: "investor-protection",
    why: t("Real investments never use a personal number — walk away.", "Uwekezaji halisi hautumii namba binafsi — jiepushe."),
  },
  {
    q: t("When is the best time to start saving for retirement?", "Wakati gani mzuri kuanza kuweka akiba ya uzeeni?"),
    options: [t("As early as possible", "Mapema iwezekanavyo"), t("Only after age 50", "Baada ya miaka 50 tu"), t("Never", "Kamwe")],
    answer: 0, topic: "pen-retirement",
    why: t("Start early — compounding rewards time in the market.", "Anza mapema — mkusanyiko hulipa muda."),
  },
  {
    q: t("A self-employed bodaboda rider can join a pension through…", "Dereva wa bodaboda anayejiajiri anaweza kujiunga na pensheni kupitia…"),
    options: [t("NSSF voluntary (NISS)", "NSSF kwa hiari (NISS)"), t("No option exists", "Hakuna njia"), t("Only big companies", "Kampuni kubwa tu")],
    answer: 0, topic: "pen-niss",
    why: t("Informal workers can join NSSF voluntarily through NISS.", "Sekta isiyo rasmi hujiunga NSSF kwa hiari kupitia NISS."),
  },
  {
    q: t("Share prices dip for a few weeks. A long-term investor usually…", "Bei za hisa zimeshuka kwa wiki chache. Mwekezaji wa muda mrefu kawaida…"),
    options: [t("Panics and sells everything", "Anaogopa na kuuza vyote"), t("Stays calm and keeps the plan", "Anatulia na kufuata mpango"), t("Borrows to buy more", "Anakopa kununua zaidi")],
    answer: 1, topic: "decision-making",
    why: t("Long-term investors ride out short dips instead of panic-selling.", "Wawekezaji wa muda mrefu huvumilia mishuko badala ya kuuza kwa hofu."),
  },
];

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function pickOne<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

/** Draw a fresh, random set of question indices for one attempt. */
export function pickQuiz(n: number = QUIZ_LEN): number[] {
  return shuffle(QUIZ_BANK.map((_, i) => i)).slice(0, Math.min(n, QUIZ_BANK.length));
}

// Warm, varied reactions (light emoji added by answerFeedback).
const HIT: Loc[] = [
  t("Nailed it", "Umeipata"), t("Exactly right", "Sawa kabisa"), t("Spot on", "Umenoa"),
  t("Yes — correct", "Ndiyo — sahihi"), t("Sharp", "Mjanja"),
];
const MISS: Loc[] = [
  t("Not quite", "Sio sahihi"), t("So close", "Karibu sana"), t("Good try", "Jaribio zuri"), t("Almost", "Karibu"),
];

/** Build the lively per-answer reply: reaction, streak, running score, and a
 *  one-line correction when the answer was wrong. */
export function answerFeedback(
  correct: boolean,
  streak: number,
  score: number,
  answered: number,
  why: Loc,
  lang: Lang,
): string {
  const react = correct ? pickOne(HIT)[lang] : pickOne(MISS)[lang];
  let msg = `${correct ? "✅" : "❌"} ${react}.`;
  if (!correct) msg += ` ${why[lang]}`;
  if (correct && streak >= 2) msg += `\n🔥 ${streak} ${lang === "sw" ? "mfululizo" : "in a row"}!`;
  msg += `\n${lang === "sw" ? "Alama" : "Score"}: ${score}/${answered}`;
  return msg;
}

const TIERS = (pct: number): Loc =>
  pct >= 85
    ? t("Investor brain! 🧠", "Ubongo wa mwekezaji! 🧠")
    : pct >= 60
    ? t("Strong — you know your stuff. 💪", "Vizuri — unaelewa vyema. 💪")
    : pct >= 35
    ? t("Good start — keep going. 🌱", "Mwanzo mzuri — endelea. 🌱")
    : t("Everyone starts here — you've got this. 🚀", "Kila mtu huanza hapa — utaweza. 🚀");

/** End-of-quiz message: score bar, percentage, a tiered note, weak areas and a
 *  recommended module. `total` is the number of questions this attempt asked. */
export function quizResult(score: number, wrongTopics: string[], total: number, lang: Lang): string {
  const pct = Math.round((score / total) * 100);
  const bar = "🟩".repeat(score) + "⬜".repeat(Math.max(0, total - score));
  const head = lang === "sw" ? "Matokeo yako" : "Your result";
  let msg = `${head}\n${bar}\n${score}/${total} (${pct}%)\n\n${TIERS(pct)[lang]}`;

  if (wrongTopics.length === 0) return msg;

  const counts = new Map<string, number>();
  for (const topic of wrongTopics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([topic]) => topic);

  const areaNames = ranked
    .map((id) => findModule(id)?.short[lang])
    .filter((x): x is string => Boolean(x));
  if (areaNames.length) {
    msg += `\n\n${lang === "sw" ? "Ya kuboresha" : "Brush up on"}: ${areaNames.join(", ")}`;
  }
  const rec = findModule(ranked[0]);
  if (rec) msg += `\n${lang === "sw" ? "Anza na" : "Start with"}: ${rec.title[lang]}`;
  return msg;
}
