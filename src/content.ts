// Bilingual (EN/SW) financial education content for the Tanzania investment sector.
// Grounded in the Curriculum for Certified Financial Educators (CFE), Tanzania
// National Council for Financial Inclusion (2023), modules CFE01–CFE05 —
// especially CFE03 (Money Management: saving, investment, long-term planning)
// and CFE05 (Personal Financial Protection).
//
// NOTE: Figures (minimums, fees, fund lists) researched June 2026. Verify
// against uttamis.co.tz, dse.co.tz, bot.go.tz and cmsa.go.tz before campaigns.

export type Lang = "en" | "sw";

export interface Lesson {
  id: string;
  title: Record<Lang, string>;
  emoji: string;
  chunks: Record<Lang, string[]>;
}


export interface QuizQuestion {
  q: Record<Lang, string>;
  options: Record<Lang, string[]>; // exactly 3 options (A, B, C)
  answer: number; // index 0-2
  explain: Record<Lang, string>;
}

export const DISCLAIMER: Record<Lang, string> = {
  en: "This is education, not financial advice. Verify details with UTT AMIS, DSE, BoT or CMSA before investing.",
  sw: "Hii ni elimu, si ushauri wa kifedha. Hakiki taarifa na UTT AMIS, DSE, BoT au CMSA kabla ya kuwekeza.",
};

export const LESSONS: Lesson[] = [
  {
    id: "basics",
    emoji: "",
    title: { en: "Investment Basics", sw: "Misingi ya Uwekezaji" },
    chunks: {
      en: [
        "Saving vs Investing (1/3)\n\nSaving is putting money aside safely for short-term needs and emergencies. Investing is putting money to work — in unit trusts, shares, or bonds — to grow over time.\n\nGolden rule from the CFE curriculum: build an emergency fund (3–6 months of expenses) before you invest.",
        "Risk & Return (2/3)\n\nHigher possible returns always come with higher risk. In Tanzania:\n\nLower risk: Treasury bills/bonds, UTT Liquid Fund\nMedium: balanced unit trusts (e.g. Umoja Fund)\nHigher: individual DSE shares\n\nDiversification — spreading money across different investments — reduces risk.",
        "Set Goals First (3/3)\n\nMatch the investment to the goal:\n\n- Short-term (under 1 yr): savings account, Liquid Fund, T-bills\n- Medium (1–5 yrs): bond funds, Treasury bonds\n- Long-term (5+ yrs): shares, balanced funds, pension\n\nStart small and be consistent — many options start from TZS 10,000.",
        "In Real Life\n\nInvesting is like planting maize — eat all your seed today and there's nothing next season; plant some and it multiplies.\n\nExample: Asha keeps TZS 300,000 as her emergency fund, then invests TZS 50,000 a month — split across a fund, a bond and some shares. If one does badly, the others cushion her. That is diversification at work.",
      ],
      sw: [
        "Kuweka Akiba dhidi ya Kuwekeza (1/3)\n\nKuweka akiba ni kutunza fedha kwa usalama kwa mahitaji ya muda mfupi na dharura. Kuwekeza ni kuifanya fedha ikufanyie kazi — kwenye mifuko ya uwekezaji, hisa au hatifungani — ili ikue.\n\nKanuni ya dhahabu ya mtaala wa CFE: jenga mfuko wa dharura (matumizi ya miezi 3–6) kabla ya kuwekeza.",
        "Hatari na Faida (2/3)\n\nFaida kubwa huja na hatari kubwa. Tanzania:\n\nHatari ndogo: dhamana za serikali, UTT Liquid Fund\nKati: mifuko mchanganyiko (mf. Mfuko wa Umoja)\nJuu: hisa za kampuni moja DSE\n\nMseto (diversification) — kugawa fedha kwenye uwekezaji tofauti — hupunguza hatari.",
        "Weka Malengo Kwanza (3/3)\n\nLinganisha uwekezaji na lengo:\n\n- Muda mfupi (chini ya mwaka 1): akiba benki, Liquid Fund, dhamana fupi\n- Kati (miaka 1–5): mifuko ya hatifungani, hatifungani za serikali\n- Mrefu (miaka 5+): hisa, mifuko mchanganyiko, pensheni\n\nAnza kidogo, endelea kwa nidhamu — uwekezaji mwingine huanzia TZS 10,000.",
        "Kwa Mazingira Halisi\n\nUwekezaji ni kama kupanda mahindi — ukila mbegu zote leo huna cha msimu ujao; ukipanda kidogo zinazaa zaidi.\n\nMfano: Asha anaweka TZS 300,000 kama mfuko wa dharura, kisha anawekeza TZS 50,000 kila mwezi — kwa kugawa kwenye mfuko, hatifungani na hisa. Kama kimoja kikishuka, vingine vinamkinga. Huo ndio mseto.",
      ],
    },
  },
  {
    id: "utt",
    emoji: "",
    title: { en: "UTT AMIS Unit Trusts", sw: "Mifuko ya UTT AMIS" },
    chunks: {
      en: [
        "What is UTT AMIS? (1/3)\n\nUTT Asset Management and Investor Services is a government-owned fund manager. It pools money from many people into unit trusts managed by professionals — ideal for beginners.\n\nMain funds:\n- Umoja Fund – balanced growth (since 2005)\n- Liquid Fund – low risk, money market\n- Bond Fund – income from bonds\n- Watoto Fund – saving for children\n- Jikimu Fund – regular income\n- Wekeza Maisha – 10-yr investment + life insurance",
        "Minimums & Returns (2/3)\n\n- Umoja Fund: start from about TZS 10,000\n- Liquid Fund: initial TZS 100,000, top-ups TZS 10,000 — recent returns around 12%+, roughly double bank savings interest\n- Wekeza Maisha: min TZS 1,000,000 (lump sum or installments over 10 yrs)\n\nYou buy units; their price (NAV) is published daily. UTT funds have grown past TZS 2.2 trillion under management.",
        "How to Invest (3/3)\n\n1. Dial *150*82# or download the UTT AMIS app\n2. Register with your NIDA ID and fill the form (or visit a UTT AMIS office / email uwekezaji@uttamis.co.tz)\n3. Pay via mobile money (M-Pesa, Tigo Pesa, Airtel Money, Halopesa) or bank\n4. Track your units and top up any time\n\nRegulated by CMSA. Info: uttamis.co.tz",
        "In Real Life\n\nA unit trust is like a daladala — instead of buying a whole bus, many riders pool their fares and the driver (the fund manager) does the work.\n\nExample: Juma starts the Umoja Fund with TZS 10,000 and adds TZS 20,000 a month via *150*82#. If the fund grows about 10% in a year (not guaranteed), his TZS 250,000 of contributions could be worth roughly TZS 263,000 — small money working while he sleeps.",
      ],
      sw: [
        "UTT AMIS ni nini? (1/3)\n\nUTT AMIS ni kampuni ya serikali inayosimamia mifuko ya uwekezaji wa pamoja. Fedha za watu wengi huunganishwa na kusimamiwa na wataalamu — nzuri kwa waanzaji.\n\nMifuko mikuu:\n- Umoja – ukuaji mchanganyiko (tangu 2005)\n- Liquid – hatari ndogo\n- Bond Fund – kipato cha hatifungani\n- Watoto – akiba ya watoto\n- Jikimu – kipato cha mara kwa mara\n- Wekeza Maisha – miaka 10 + bima ya maisha",
        "Kima cha Chini na Faida (2/3)\n\n- Umoja: anzia takriban TZS 10,000\n- Liquid: kuanzia TZS 100,000, nyongeza TZS 10,000 — faida ya hivi karibuni zaidi ya 12%, karibu mara mbili ya riba ya akiba benki\n- Wekeza Maisha: chini TZS 1,000,000 (mkupuo au awamu kwa miaka 10)\n\nUnanunua vipande; bei (NAV) hutangazwa kila siku. Mifuko ya UTT imevuka TZS trilioni 2.2.",
        "Jinsi ya Kuwekeza (3/3)\n\n1. Piga *150*82# au pakua app ya UTT AMIS\n2. Jisajili kwa NIDA yako, jaza fomu (au tembelea ofisi ya UTT AMIS / barua pepe uwekezaji@uttamis.co.tz)\n3. Lipa kwa M-Pesa, Tigo Pesa, Airtel Money, Halopesa au benki\n4. Fuatilia vipande vyako na ongeza wakati wowote\n\nInasimamiwa na CMSA. Taarifa: uttamis.co.tz",
        "Kwa Mazingira Halisi\n\nMfuko wa uwekezaji ni kama daladala — badala ya kununua basi zima, abiria wengi huchangia nauli na dereva (msimamizi wa mfuko) anafanya kazi.\n\nMfano: Juma anaanza Mfuko wa Umoja kwa TZS 10,000 na kuongeza TZS 20,000 kila mwezi kwa *150*82#. Mfuko ukikua takriban 10% kwa mwaka (si uhakika), michango yake ya TZS 250,000 inaweza kufikia karibu TZS 263,000 — fedha ndogo ikifanya kazi.",
      ],
    },
  },
  {
    id: "dse",
    emoji: "",
    title: { en: "DSE — Buying Shares", sw: "DSE — Kununua Hisa" },
    chunks: {
      en: [
        "What is the DSE? (1/3)\n\nThe Dar es Salaam Stock Exchange is Tanzania's market for shares and bonds. About 28 companies are listed (e.g. CRDB, NMB, TBL, Vodacom; plus cross-listed firms like KCB).\n\nWhen you buy a share you own a piece of the company. You can earn through dividends and price growth — but prices can also fall.",
        "How to Start (2/3)\n\n1. Choose a licensed stockbroker (Licensed Dealing Member) — list at dse.co.tz or cmsa.go.tz\n2. Open a CDS account (free, needs ID/KYC) — or open it directly in the DSE Hisa Kiganjani app\n3. Deposit money with your broker and place a buy order (app, phone or office)\n4. Shares are held electronically in your CDS account",
        "Costs & Tips (3/3)\n\n- Total buying/selling fees: max ~2.38% of trade value (broker + DSE + CMSA + CDS fees)\n- Dividends are paid to your bank/mobile account\n- Tip: start with companies you understand, reinvest dividends, think long-term (5+ years)\n- Never buy on rumours — read company reports on dse.co.tz",
        "In Real Life\n\nA share is like owning a slice of a duka — when the shop profits you get a cut (dividend), and if it grows your slice is worth more.\n\nExample: Neema buys 100 CRDB shares at TZS 500 = TZS 50,000, plus ~2.38% fees (~TZS 1,190). A TZS 45-per-share dividend pays her TZS 4,500 that year — and she still owns the shares. Prices can fall too, so she invests for 5+ years.",
      ],
      sw: [
        "DSE ni nini? (1/3)\n\nSoko la Hisa la Dar es Salaam ni soko la hisa na hatifungani Tanzania. Kuna takriban kampuni 28 zilizoorodheshwa (mf. CRDB, NMB, TBL, Vodacom; na za nje kama KCB).\n\nUkinunua hisa unamiliki sehemu ya kampuni. Unapata faida kwa gawio na kupanda kwa bei — lakini bei inaweza pia kushuka.",
        "Jinsi ya Kuanza (2/3)\n\n1. Chagua dalali aliyepewa leseni — orodha ipo dse.co.tz au cmsa.go.tz\n2. Fungua akaunti ya CDS (bure, inahitaji kitambulisho/KYC) — au fungua moja kwa moja kwenye app ya DSE Hisa Kiganjani\n3. Weka fedha kwa dalali wako, toa oda ya kununua (app, simu au ofisini)\n4. Hisa zinahifadhiwa kielektroniki kwenye akaunti yako ya CDS",
        "Gharama na Ushauri (3/3)\n\n- Ada ya kununua/kuuza: hadi ~2.38% ya thamani (dalali + DSE + CMSA + CDS)\n- Gawio hulipwa benki au kwenye simu yako\n- Ushauri: anza na kampuni unazozielewa, wekeza tena gawio, fikiria muda mrefu (miaka 5+)\n- Usinunue kwa uvumi — soma ripoti za kampuni dse.co.tz",
        "Kwa Mazingira Halisi\n\nHisa ni kama kumiliki sehemu ya duka — duka likipata faida unapata sehemu (gawio), na likikua sehemu yako inaongezeka thamani.\n\nMfano: Neema ananunua hisa 100 za CRDB kwa TZS 500 = TZS 50,000, pamoja na ada ~2.38% (~TZS 1,190). Gawio la TZS 45 kwa hisa humpa TZS 4,500 mwaka huo — na bado anamiliki hisa. Bei zinaweza kushuka, hivyo anawekeza miaka 5+.",
      ],
    },
  },
  {
    id: "bonds",
    emoji: "",
    title: { en: "Gov. Securities", sw: "Dhamana za Serikali" },
    chunks: {
      en: [
        "T-bills & T-bonds (1/2)\n\nLending to the government — among the safest investments in Tanzania.\n\n- Treasury bills: short-term (35, 91, 182, 364 days), sold at a discount. Minimum bid TZS 500,000.\n- Treasury bonds: 2–25 years, pay fixed interest (coupon) every 6 months. Minimum TZS 1,000,000. Long bonds have offered double-digit coupons (e.g. ~15%+ on long maturities).",
        "How to Buy (2/2)\n\n1. Open a CDS account at the Bank of Tanzania — directly or through your commercial bank (e.g. NMB, CRDB) or a broker\n2. Watch the BoT auction calendar (bot.go.tz) and submit a bid before the auction\n3. Interest is paid to your bank account; bonds can be sold before maturity on the DSE\n\nBond interest enjoys favourable tax treatment on longer maturities.",
        "In Real Life\n\nA Treasury bond is like lending money to the government and collecting rent on the loan — steady, predictable and very low risk.\n\nExample: Baraka buys a TZS 1,000,000 bond with a 15% coupon. That is TZS 150,000 a year — paid as TZS 75,000 every 6 months into his bank account — and he gets his TZS 1,000,000 back at maturity.",
      ],
      sw: [
        "Dhamana fupi na Hatifungani (1/2)\n\nKuikopesha serikali — uwekezaji salama zaidi Tanzania.\n\n- Dhamana za muda mfupi (T-bills): siku 35, 91, 182, 364, huuzwa kwa punguzo. Kima cha chini TZS 500,000.\n- Hatifungani (T-bonds): miaka 2–25, hulipa riba (kuponi) kila miezi 6. Kima cha chini TZS 1,000,000. Hatifungani ndefu zimetoa riba ya tarakimu mbili (mf. ~15%+).",
        "Jinsi ya Kununua (2/2)\n\n1. Fungua akaunti ya CDS Benki Kuu ya Tanzania (BoT) — moja kwa moja au kupitia benki yako (mf. NMB, CRDB) au dalali\n2. Fuatilia kalenda ya minada ya BoT (bot.go.tz), wasilisha zabuni kabla ya mnada\n3. Riba hulipwa kwenye akaunti yako ya benki; hatifungani zinaweza kuuzwa kabla ya muda kwenye DSE\n\nRiba ya hatifungani ndefu ina msamaha mzuri wa kodi.",
        "Kwa Mazingira Halisi\n\nHatifungani ni kama kuikopesha serikali na kukusanya kodi ya pango kwenye mkopo huo — ya uhakika, tabirika na hatari ndogo sana.\n\nMfano: Baraka ananunua hatifungani ya TZS 1,000,000 yenye riba 15%. Hiyo ni TZS 150,000 kwa mwaka — hulipwa TZS 75,000 kila miezi 6 kwenye akaunti yake ya benki — na anarudishiwa TZS 1,000,000 yake mwisho wa muda.",
      ],
    },
  },
  {
    id: "pension",
    emoji: "",
    title: { en: "Pensions & NSSF", sw: "Pensheni na NSSF" },
    chunks: {
      en: [
        "Retirement Saving (1/2)\n\nThe CFE curriculum lists pensions as a pillar of long-term financial planning.\n\n- Formal workers: NSSF (private sector) or PSSSF (public sector) — employer + employee contribute\n- Self-employed & informal sector: join NSSF voluntarily through the National Informal Sector Scheme (NISS)",
        "NISS — Flexible Contributions (2/2)\n\nNISS allows contributions as low as about TZS 1,000 per day, paid via mobile money — designed for farmers, traders, boda boda riders and other informal workers.\n\nBenefits can include pension, invalidity and survivors' benefits. Register at an NSSF office or nssf.go.tz. Starting early matters more than starting big.",
        "In Real Life\n\nA pension is like filling a water tank drop by drop — barely noticeable each day, but full when you need it most.\n\nExample: Mama Rehema, a mama lishe, saves TZS 1,000 a day into NISS by mobile money — about TZS 30,000 a month. Over 20 years that is TZS 7,200,000 of her own money, plus growth, waiting for retirement. Starting at 25 beats starting at 45.",
      ],
      sw: [
        "Akiba ya Uzeeni (1/2)\n\nMtaala wa CFE unaitaja pensheni kama nguzo ya mipango ya fedha ya muda mrefu.\n\n- Waajiriwa rasmi: NSSF (sekta binafsi) au PSSSF (umma) — mwajiri na mfanyakazi huchangia\n- Wajiajiri na sekta isiyo rasmi: jiunge na NSSF kwa hiari kupitia Mpango wa Sekta Isiyo Rasmi (NISS)",
        "NISS — Michango Nafuu (2/2)\n\nNISS inaruhusu michango kuanzia takriban TZS 1,000 kwa siku, kwa njia ya simu — kwa wakulima, wafanyabiashara, bodaboda na wengine wa sekta isiyo rasmi.\n\nMafao yanaweza kujumuisha pensheni, ulemavu na warithi. Jisajili ofisi ya NSSF au nssf.go.tz. Kuanza mapema ni muhimu kuliko kuanza kwa kiasi kikubwa.",
        "Kwa Mazingira Halisi\n\nPensheni ni kama kujaza tanki la maji tone kwa tone — haionekani kila siku, lakini limejaa pale unapolihitaji zaidi.\n\nMfano: Mama Rehema, mama lishe, anaweka TZS 1,000 kwa siku kwenye NISS kwa simu — karibu TZS 30,000 kwa mwezi. Kwa miaka 20 ni TZS 7,200,000 ya fedha yake mwenyewe, pamoja na ukuaji, ikimsubiri uzeeni. Kuanza ukiwa na miaka 25 ni bora kuliko 45.",
      ],
    },
  },
  {
    id: "safety",
    emoji: "",
    title: { en: "Avoid Scams (CMSA)", sw: "Epuka Ulaghai (CMSA)" },
    chunks: {
      en: [
        "Investor Protection (1/2)\n\nThe CMSA (Capital Markets and Securities Authority) licenses all brokers, fund managers and collective investment schemes in Tanzania. UTT AMIS, DSE brokers and unit trusts are all CMSA-regulated.\n\nBefore investing, check the licence list at cmsa.go.tz under Supervised Entities.",
        "Red Flags of a Scam (2/2)\n\n- \"Guaranteed\" high returns (e.g. 30% per month)\n- Pressure to recruit others (pyramid/Ponzi)\n- Unlicensed apps, Telegram/WhatsApp \"forex/crypto experts\"\n- Asked to pay into a personal mobile number\n- No physical office, no CMSA licence\n\nIf in doubt: don't pay. Report to CMSA or the police. Real investing builds wealth slowly.",
        "In Real Life\n\nA scam is like a mango that looks ripe but is rotten inside — sweet promises outside, loss within.\n\nExample: A WhatsApp group promises guaranteed 30% a month — just bring 3 friends. That is a Ponzi: there is no real investment, only new people's money paying older members until it collapses. Check cmsa.go.tz first; no licence, walk away. Real returns are more like 10–15% a year.",
      ],
      sw: [
        "Ulinzi wa Mwekezaji (1/2)\n\nCMSA (Mamlaka ya Masoko ya Mitaji na Dhamana) ndiyo hutoa leseni kwa madalali, wasimamizi wa mifuko na skimu za uwekezaji wa pamoja Tanzania. UTT AMIS, madalali wa DSE na mifuko yote husimamiwa na CMSA.\n\nKabla ya kuwekeza, hakiki leseni cmsa.go.tz chini ya Supervised Entities.",
        "Dalili za Ulaghai (2/2)\n\n- Faida \"ya uhakika\" kubwa (mf. 30% kwa mwezi)\n- Kushinikizwa kuingiza watu wengine (piramidi/Ponzi)\n- App zisizo na leseni, \"wataalamu\" wa forex/crypto Telegram/WhatsApp\n- Kuambiwa ulipe kwenye namba binafsi ya simu\n- Hakuna ofisi wala leseni ya CMSA\n\nUkiwa na shaka: usilipe. Ripoti CMSA au polisi. Uwekezaji halisi hukuza utajiri taratibu.",
        "Kwa Mazingira Halisi\n\nUlaghai ni kama embe linaloonekana bivu lakini limeoza ndani — ahadi tamu nje, hasara ndani.\n\nMfano: Kikundi cha WhatsApp kinaahidi faida ya uhakika 30% kwa mwezi — lete tu marafiki 3. Hiyo ni Ponzi: hakuna uwekezaji halisi, ni fedha za watu wapya zikilipa wa zamani hadi kuporomoka. Hakiki cmsa.go.tz kwanza; bila leseni, ondoka. Faida halisi ni kama 10–15% kwa mwaka.",
      ],
    },
  },
];

export const QUIZ: QuizQuestion[] = [
  {
    q: {
      en: "What should you build BEFORE you start investing?",
      sw: "Unapaswa kujenga nini KABLA ya kuanza kuwekeza?",
    },
    options: {
      en: ["An emergency fund", "A loan portfolio", "A second job"],
      sw: ["Mfuko wa dharura", "Mkusanyiko wa mikopo", "Kazi ya pili"],
    },
    answer: 0,
    explain: {
      en: "Correct answer: an emergency fund of 3–6 months of expenses protects your investments from being sold early.",
      sw: "Jibu sahihi: mfuko wa dharura wa matumizi ya miezi 3–6 hulinda uwekezaji wako usiuzwe mapema.",
    },
  },
  {
    q: {
      en: "What is the minimum to start the UTT Umoja Fund?",
      sw: "Kima cha chini cha kuanza Mfuko wa Umoja (UTT) ni kipi?",
    },
    options: {
      en: ["About TZS 10,000", "TZS 1,000,000", "TZS 500,000"],
      sw: ["Takriban TZS 10,000", "TZS 1,000,000", "TZS 500,000"],
    },
    answer: 0,
    explain: {
      en: "Umoja Fund starts from about TZS 10,000 — investing is for everyone, not only the rich.",
      sw: "Mfuko wa Umoja huanzia takriban TZS 10,000 — uwekezaji ni kwa kila mtu, si matajiri tu.",
    },
  },
  {
    q: {
      en: "What account do you need to buy shares on the DSE?",
      sw: "Unahitaji akaunti gani kununua hisa DSE?",
    },
    options: {
      en: ["A CDS account", "A dollar account", "A fixed deposit"],
      sw: ["Akaunti ya CDS", "Akaunti ya dola", "Amana ya muda maalum"],
    },
    answer: 0,
    explain: {
      en: "A CDS account, opened via a licensed broker or the DSE Hisa Kiganjani app, holds your shares electronically.",
      sw: "Akaunti ya CDS, inayofunguliwa kwa dalali mwenye leseni au app ya DSE Hisa Kiganjani, huhifadhi hisa zako kielektroniki.",
    },
  },
  {
    q: {
      en: "Minimum bid for a Treasury bond at the Bank of Tanzania?",
      sw: "Kima cha chini cha zabuni ya hatifungani BoT ni kipi?",
    },
    options: {
      en: ["TZS 1,000,000", "TZS 10,000", "TZS 100,000,000"],
      sw: ["TZS 1,000,000", "TZS 10,000", "TZS 100,000,000"],
    },
    answer: 0,
    explain: {
      en: "Treasury bonds start at TZS 1,000,000 (T-bills at TZS 500,000), via a CDS account at BoT or your bank.",
      sw: "Hatifungani huanzia TZS 1,000,000 (dhamana fupi TZS 500,000), kupitia akaunti ya CDS BoT au benki yako.",
    },
  },
  {
    q: {
      en: "Someone on WhatsApp guarantees 30% profit per month. What do you do?",
      sw: "Mtu WhatsApp anakuhakikishia faida ya 30% kwa mwezi. Unafanya nini?",
    },
    options: {
      en: ["Check CMSA licence; likely a scam", "Invest quickly", "Recruit friends first"],
      sw: ["Hakiki leseni CMSA; huenda ni ulaghai", "Wekeza haraka", "Ingiza marafiki kwanza"],
    },
    answer: 0,
    explain: {
      en: "Guaranteed high returns are the number one scam red flag. Verify any scheme at cmsa.go.tz before paying.",
      sw: "Faida kubwa ya uhakika ni dalili namba moja ya ulaghai. Hakiki skimu yoyote cmsa.go.tz kabla ya kulipa.",
    },
  },
];

export const UI: Record<string, Record<Lang, string>> = {
  welcome: {
    en: "Welcome! I'm CFE.Wekeza, your pocket guide to investing in Tanzania. I'll show you simple ways to grow your money — UTT funds, DSE shares, government bonds, pensions — and how to spot scams. No jargon, no pressure.\nAnd beyond the menu — ask me any question about investment matters, and CFE.Wekeza will reply with referenced answers in no time.\nTap a topic to start, or try the quick quiz. (Educational only — not financial advice.)",
    sw: "Karibu! Mimi ni CFE.Wekeza, mwongozo wako wa uwekezaji Tanzania. Nitakuonyesha njia rahisi za kukuza pesa yako — mifuko ya UTT, hisa za DSE, hatifungani za serikali, pensheni — na jinsi ya kutambua matapeli. Bila maneno magumu.\nNa zaidi ya menyu — niulize swali lolote kuhusu masuala ya uwekezaji, nami CFE.Wekeza nitakujibu kwa majibu yenye marejeo papo hapo.\nGusa mada kuanza, au jaribu jaribio fupi. (Kwa elimu tu — si ushauri wa kifedha.)",
  },
  pickLang: {
    en: "Chagua lugha / Choose your language:",
    sw: "Chagua lugha / Choose your language:",
  },
  menuTitle: { en: "Main Menu — pick a topic:", sw: "Menyu Kuu — chagua mada:" },
  menuButton: { en: "Topics", sw: "Mada" },
  next: { en: "Next", sw: "Endelea" },
  menu: { en: "Menu", sw: "Menyu" },
  quizTitle: { en: "Quiz — 5 questions. Reply A, B or C.", sw: "Jaribio — maswali 5. Jibu A, B au C." },
  quizEntry: { en: "Take the Quiz", sw: "Fanya Jaribio" },
  quizEntryDesc: { en: "Test your knowledge (5 questions)", sw: "Pima uelewa wako (maswali 5)" },
  lessonDone: {
    en: "Topic complete! Type menu for more topics or quiz to test yourself.",
    sw: "Mada imekamilika! Andika menyu kwa mada zaidi au jaribio kujipima.",
  },
  correct: { en: "Correct!", sw: "Sahihi!" },
  wrong: { en: "Not quite.", sw: "Si sahihi." },
  quizDone: {
    en: "Quiz finished! Your score: {score}/5.\n\n{score5}Type menu to keep learning.",
    sw: "Jaribio limeisha! Alama zako: {score}/5.\n\n{score5}Andika menyu kuendelea kujifunza.",
  },
  perfect: { en: "Perfect score — you're ready to start your investment journey!\n\n", sw: "Alama zote — uko tayari kuanza safari yako ya uwekezaji!\n\n" },
  fallback: {
    en: "I didn't understand that. Type menu to see topics, quiz for a quiz, or lugha to change language.",
    sw: "Sikuelewa. Andika menyu kuona mada, jaribio kujipima, au lugha kubadili lugha.",
  },
  langSet: { en: "Language set to English", sw: "Lugha imewekwa: Kiswahili" },
};
