// CFE.Wekeza curriculum model (bilingual EN/SW).
//
// Hierarchy:  Level → Module → Lesson → Screen   (the structured "Learn Investment" path)
//             Academy → Module → Lesson → Screen (the "Investment Products" library)
//
// Each Lesson is a sequence of Screens — this maps 1:1 to a WhatsApp Flow screen
// (one screen per point), and also to the chunked message engine.
//
// Figures researched June 2026 — verify against uttamis.co.tz, dse.co.tz,
// bot.go.tz, cmsa.go.tz, nssf.go.tz before campaigns.

export type Lang = "en" | "sw";
export type Loc = Record<Lang, string>;

export interface Screen {
  title: Loc;
  body: Loc; // keep < 1024 chars for interactive bodies
}

export interface Lesson {
  id: string;
  title: Loc;
  screens: Screen[];
}

export type ModuleStatus = "ready" | "coming_soon";

export interface Module {
  id: string;
  title: Loc;
  short: Loc; // ≤ 20 chars — safe for WhatsApp buttons/list rows
  status: ModuleStatus;
  lessons: Lesson[];
}

export interface Level {
  id: string;
  title: Loc;
  short: Loc;
  emoji: string;
  modules: Module[];
}

export interface Academy {
  id: string;
  title: Loc;
  short: Loc;
  emoji: string;
  modules: Module[];
}

const t = (en: string, sw: string): Loc => ({ en, sw });

// A one-screen lesson (one curriculum "point").
const point = (id: string, title: Loc, body: Loc): Lesson => ({ id, title, screens: [{ title, body }] });

// A module whose content is not authored yet (structure only).
const soon = (id: string, title: Loc, short: Loc): Module => ({ id, title, short, status: "coming_soon", lessons: [] });

const ready = (id: string, title: Loc, short: Loc, lessons: Lesson[]): Module => ({ id, title, short, status: "ready", lessons });

// ─── Beginner Module 1: Definition of Basic Concepts (13 points) ────────────────

const BASIC_CONCEPTS: Lesson[] = [
  point("what-is-investing", t("What is Investing?", "Uwekezaji ni Nini?"), t(
    "Investing means putting your money into something today so it can grow or earn you more in the future, instead of leaving it idle.\n\nWhy people invest: to beat inflation, build wealth, reach goals, and earn extra income.\n\nExamples in Tanzania: UTT AMIS unit trusts, DSE shares, Treasury bills and bonds from the Bank of Tanzania, and NSSF/NISS pension savings.",
    "Kuwekeza ni kuweka fedha yako kwenye kitu leo ili ikue au ikuletee zaidi siku zijazo, badala ya kuiacha bila kazi.\n\nKwa nini watu huwekeza: kushinda mfumuko wa bei, kujenga utajiri, kufikia malengo, na kupata kipato cha ziada.\n\nMifano Tanzania: mifuko ya UTT AMIS, hisa za DSE, dhamana za serikali kupitia Benki Kuu (BoT), na akiba ya pensheni ya NSSF/NISS.",
  )),
  point("what-is-saving", t("What is Saving?", "Kuweka Akiba ni Nini?"), t(
    "Saving means keeping money safe and easy to reach for short-term needs and emergencies, such as in a bank or mobile-money account.\n\nSavings carry little risk and little growth. Their job is safety and access, not high returns.\n\nA healthy first goal is an emergency fund of 3 to 6 months of expenses.",
    "Kuweka akiba ni kutunza fedha kwa usalama ipatikane kwa urahisi kwa mahitaji ya muda mfupi na dharura, mfano benki au M-Pesa.\n\nAkiba ina hatari ndogo na ukuaji mdogo. Kazi yake ni usalama na upatikanaji, si faida kubwa.\n\nLengo zuri la kwanza ni mfuko wa dharura wa matumizi ya miezi 3 hadi 6.",
  )),
  point("saving-vs-investing", t("Saving vs Investing", "Akiba dhidi ya Uwekezaji"), t(
    "Saving and investing are different tools.\n\nSaving: money kept safe for the short term — low risk, low growth, instant access.\nInvesting: money put to work for the long term — more risk, more potential growth, less instant access.\n\nRule of thumb: save for what you need soon and for emergencies; invest for goals more than a few years away, once your emergency fund is in place.",
    "Kuweka akiba na kuwekeza ni zana tofauti.\n\nAkiba: fedha iliyohifadhiwa kwa muda mfupi — hatari ndogo, ukuaji mdogo, upatikanaji wa haraka.\nUwekezaji: fedha inayofanyishwa kazi kwa muda mrefu — hatari zaidi, ukuaji zaidi, upatikanaji mdogo wa haraka.\n\nKanuni: weka akiba kwa mahitaji ya karibu na dharura; wekeza kwa malengo ya zaidi ya miaka michache, ukishakuwa na mfuko wa dharura.",
  )),
  point("what-is-wealth", t("What is Wealth?", "Utajiri ni Nini?"), t(
    "Wealth is the value of what you own, beyond your day-to-day income.\n\nIt is measured by net worth: everything you own (assets) minus everything you owe (liabilities).\n\nBuilding wealth means steadily growing your assets and reducing your debts over time, not just earning a big salary.",
    "Utajiri ni thamani ya vitu unavyomiliki, zaidi ya kipato chako cha kila siku.\n\nHupimwa kwa thamani halisi (net worth): unavyomiliki (mali) kuondoa unavyodaiwa (madeni).\n\nKujenga utajiri ni kuongeza mali na kupunguza madeni kadri muda unavyokwenda, si kupata mshahara mkubwa tu.",
  )),
  point("assets-vs-liabilities", t("Assets vs Liabilities", "Mali dhidi ya Madeni"), t(
    "An asset puts money into your pocket or grows in value: savings, unit trusts, shares, land, a productive business.\n\nA liability takes money out of your pocket: loans, unpaid debts, things that only cost you.\n\nThe path to wealth is simple to state: buy and build assets, and keep liabilities under control.",
    "Mali (asset) huingiza fedha mfukoni au hukua thamani: akiba, mifuko, hisa, ardhi, biashara yenye tija.\n\nDeni (liability) hutoa fedha mfukoni: mikopo, madeni, vitu vinavyokugharimu tu.\n\nNjia ya utajiri ni rahisi: nunua na jenga mali, na dhibiti madeni.",
  )),
  point("what-is-inflation", t("What is Inflation?", "Mfumuko wa Bei ni Nini?"), t(
    "Inflation is the general rise in prices over time. As prices rise, the same amount of money buys less.\n\nFor savers this is a hidden cost: money left idle slowly loses value.\n\nInvesting aims to earn a return higher than inflation, so your money keeps and grows its real value.",
    "Mfumuko wa bei ni kupanda kwa bei kwa ujumla kadri muda unavyokwenda. Bei zikipanda, kiasi kile kile cha fedha hununua kidogo.\n\nKwa wenye akiba hii ni gharama iliyofichika: fedha iliyolala hupoteza thamani taratibu.\n\nUwekezaji hulenga faida inayozidi mfumuko wa bei, ili fedha ibaki na kukua thamani yake halisi.",
  )),
  point("purchasing-power", t("Purchasing Power", "Uwezo wa Kununua"), t(
    "Purchasing power is how much your money can actually buy.\n\nIf prices rise 5% in a year, TZS 100,000 buys about TZS 95,000 worth of goods next year — its purchasing power fell.\n\nProtecting purchasing power is a main reason to invest rather than hold only cash.",
    "Uwezo wa kununua ni kiasi gani fedha yako inaweza kununua kweli.\n\nBei zikipanda 5% kwa mwaka, TZS 100,000 hununua bidhaa za thamani ya takriban TZS 95,000 mwaka ujao — uwezo wake wa kununua umeshuka.\n\nKulinda uwezo wa kununua ni sababu kuu ya kuwekeza badala ya kushikilia fedha taslimu pekee.",
  )),
  point("what-is-risk", t("What is Risk?", "Hatari ni Nini?"), t(
    "Investment risk is the chance that your investment loses value or earns less than you expected.\n\nTypes include: market risk (prices fall), inflation risk (returns below inflation), liquidity risk (you can't sell quickly) and scam/fraud risk (unlicensed schemes).\n\nTake risk you understand and can afford — never money you need soon.",
    "Hatari ya uwekezaji ni uwezekano wa uwekezaji kupoteza thamani au kuleta faida ndogo kuliko ulivyotegemea.\n\nAina: hatari ya soko (bei kushuka), hatari ya mfumuko wa bei, hatari ya ukwasi (kushindwa kuuza haraka) na hatari ya ulaghai (skimu zisizo na leseni).\n\nChukua hatari unayoielewa na kuimudu — kamwe si fedha unayoihitaji karibuni.",
  )),
  point("what-is-return", t("What is Return?", "Faida (Return) ni Nini?"), t(
    "Return is the profit you earn on an investment, usually shown as a percentage per year.\n\nThree common types in Tanzania:\n- Capital gain: the price rises (a DSE share bought at TZS 500 is now TZS 600).\n- Dividend income: a share of company profits paid to shareholders.\n- Interest income: payments from Treasury bills/bonds or a money-market fund.",
    "Faida (return) ni kiasi unachopata kwenye uwekezaji, mara nyingi kama asilimia kwa mwaka.\n\nAina tatu Tanzania:\n- Faida ya mtaji: bei kupanda (hisa ya DSE iliyonunuliwa TZS 500 sasa ni TZS 600).\n- Gawio: sehemu ya faida ya kampuni inayolipwa wanahisa.\n- Riba: malipo kutoka dhamana za serikali au mfuko wa soko la fedha.",
  )),
  point("compound-interest", t("Compound Interest", "Riba ya Mkusanyiko"), t(
    "Simple interest is earned only on your original money. Compound interest is earned on your money AND on the returns it already made — growth on growth.\n\nExample: TZS 1,000,000 at 10% a year. Simple = TZS 100,000 every year. Compound = year 1 earns TZS 100,000, year 2 earns on TZS 1,100,000, and so on.\n\nThe earlier you start and the longer you stay, the faster your money grows.",
    "Riba ya kawaida hupatikana kwenye fedha yako ya awali pekee. Riba ya mkusanyiko hupatikana kwenye fedha yako NA faida iliyokwisha patikana — ukuaji juu ya ukuaji.\n\nMfano: TZS 1,000,000 kwa 10% kwa mwaka. Kawaida = TZS 100,000 kila mwaka. Mkusanyiko = mwaka 1 TZS 100,000, mwaka 2 hupata kwenye TZS 1,100,000, n.k.\n\nUkianza mapema na kukaa muda mrefu, fedha hukua kwa kasi zaidi.",
  )),
  point("diversification", t("Diversification", "Mseto"), t(
    "Diversification means spreading your money across different investments instead of putting it all in one place.\n\nWhy it matters: if one investment performs badly, the others cushion the loss — you don't lose everything at once.\n\nExample: instead of all your money in one company's shares, hold a mix — a UTT fund, a Treasury bond and some shares.",
    "Mseto ni kugawa fedha yako kwenye uwekezaji tofauti badala ya kuweka yote sehemu moja.\n\nKwa nini ni muhimu: uwekezaji mmoja ukifanya vibaya, mingine huziba pengo — hupotezi kila kitu kwa mara moja.\n\nMfano: badala ya fedha yote kwenye hisa za kampuni moja, changanya — mfuko wa UTT, hatifungani na hisa kidogo.",
  )),
  point("liquidity", t("Liquidity", "Ukwasi"), t(
    "Liquidity is how quickly you can turn an investment into cash without losing much value.\n\nLiquid: easy to access fast — savings, mobile money, the UTT Liquid Fund.\nIlliquid: takes time or cost to sell — land, a 10-year plan, some bonds before maturity.\n\nKeep enough in liquid form for emergencies; invest the rest for growth.",
    "Ukwasi (liquidity) ni jinsi unavyoweza kubadili uwekezaji kuwa fedha taslimu haraka bila kupoteza thamani kubwa.\n\nWenye ukwasi: hupatikana haraka — akiba, M-Pesa, UTT Liquid Fund.\nWasio na ukwasi: huchukua muda au gharama kuuza — ardhi, mpango wa miaka 10, baadhi ya hatifungani kabla ya muda.\n\nWeka kiasi cha kutosha chenye ukwasi kwa dharura; wekeza kilichobaki kwa ukuaji.",
  )),
  point("time-value-of-money", t("Time Value of Money", "Thamani ya Fedha kwa Wakati"), t(
    "The time value of money means money today is worth more than the same amount in the future — because it can be invested to grow.\n\nPresent value: what a future amount is worth today. Future value: what today's money grows to later.\n\nThanks to compounding, someone investing small amounts from age 25 often ends up with more than someone who starts bigger at 40.",
    "Thamani ya fedha kwa wakati ina maana fedha ya leo ina thamani zaidi ya kiasi kile kile siku zijazo — kwa sababu inaweza kuwekezwa ikue.\n\nThamani ya sasa: kiasi cha baadaye kina thamani gani leo. Thamani ya baadaye: fedha ya leo itakua kiasi gani baadaye.\n\nKwa mkusanyiko, anayewekeza kidogo kuanzia miaka 25 mara nyingi humzidi anayeanza kwa wingi akiwa na miaka 40.",
  )),
];

// ─── Beginner Module 2: Why Invest? (6 points) ──────────────────────────────────

const WHY_INVEST: Lesson[] = [
  point("importance-of-investing", t("Importance of Investing", "Umuhimu wa Kuwekeza"), t(
    "Investing matters because money that just sits still falls behind. Prices rise, needs grow, and idle cash slowly loses value.\n\nInvesting puts your money to work so it can grow faster than inflation and help you reach life goals.\n\nIt is how ordinary people, not just the wealthy, build security over time.",
    "Uwekezaji ni muhimu kwa sababu fedha inayokaa tu hubaki nyuma. Bei hupanda, mahitaji huongezeka, na fedha iliyolala hupoteza thamani taratibu.\n\nUwekezaji huifanya fedha yako ifanye kazi ili ikue haraka kuliko mfumuko wa bei na kukusaidia kufikia malengo.\n\nNdiyo jinsi watu wa kawaida, si matajiri tu, hujenga usalama kwa muda.",
  )),
  point("building-wealth", t("Building Wealth", "Kujenga Utajiri"), t(
    "Wealth is built by consistently turning income into assets that grow.\n\nEach amount you invest buys a small piece of a fund, a bond, or a company that can earn for you over the years.\n\nSmall, regular investments — even TZS 10,000 at a time — add up to meaningful wealth through patience and compounding.",
    "Utajiri hujengwa kwa kubadili kipato kuwa mali zinazokua kwa nidhamu.\n\nKila kiasi unachowekeza hununua sehemu ndogo ya mfuko, hatifungani, au kampuni inayoweza kukuzalishia kwa miaka.\n\nUwekezaji mdogo wa mara kwa mara — hata TZS 10,000 kwa wakati — hujumlika kuwa utajiri wa maana kwa subira na mkusanyiko.",
  )),
  point("beating-inflation", t("Beating Inflation", "Kushinda Mfumuko wa Bei"), t(
    "If your money grows slower than prices, you are getting poorer even while saving.\n\nBank savings often pay less than inflation. Investments like unit trusts, bonds, and shares aim to earn more, protecting and growing your real value.\n\nBeating inflation is one of the clearest reasons to invest.",
    "Fedha yako ikikua polepole kuliko bei, unakuwa maskini hata ukiwa unaweka akiba.\n\nAkiba za benki mara nyingi hulipa chini ya mfumuko wa bei. Uwekezaji kama mifuko, hatifungani, na hisa hulenga kupata zaidi, kulinda na kukuza thamani halisi.\n\nKushinda mfumuko wa bei ni sababu mojawapo iliyo wazi ya kuwekeza.",
  )),
  point("achieving-goals", t("Achieving Financial Goals", "Kufikia Malengo ya Fedha"), t(
    "Most big goals — land, school fees, a business, a home, retirement — need more money than saving alone can provide in time.\n\nInvesting matches money to goals: it grows your contributions so the target becomes reachable.\n\nName the goal, set a timeline, and choose an investment that fits it.",
    "Malengo makubwa mengi — ardhi, ada, biashara, nyumba, uzeeni — yanahitaji fedha zaidi ya akiba pekee inavyoweza kutoa kwa wakati.\n\nUwekezaji hulinganisha fedha na malengo: hukuza michango yako ili lengo lifikike.\n\nTaja lengo, weka muda, na chagua uwekezaji unaolifaa.",
  )),
  point("long-term-thinking", t("Long-Term Thinking", "Kufikiri kwa Muda Mrefu"), t(
    "Investing rewards patience. Prices rise and fall in the short term, but quality investments tend to grow over many years.\n\nReacting to every dip often locks in losses. A long-term view lets compounding do its work.\n\nThink in years and decades, not days and weeks.",
    "Uwekezaji hulipa subira. Bei hupanda na kushuka kwa muda mfupi, lakini uwekezaji bora huelekea kukua kwa miaka mingi.\n\nKuathirika na kila mshuko mara nyingi huleta hasara. Mtazamo wa muda mrefu huruhusu mkusanyiko ufanye kazi.\n\nFikiria kwa miaka na miongo, si siku na wiki.",
  )),
  point("starting-early", t("Power of Starting Early", "Nguvu ya Kuanza Mapema"), t(
    "Time is an investor's biggest advantage, because of compounding — earning returns on your past returns.\n\nSomeone who invests a little from age 25 often ends up with more than someone who invests more from age 40.\n\nThe best time to start was years ago; the next best time is today.",
    "Muda ni faida kubwa ya mwekezaji, kwa sababu ya mkusanyiko — kupata faida juu ya faida iliyopita.\n\nAnayewekeza kidogo kuanzia miaka 25 mara nyingi humzidi anayewekeza zaidi kuanzia miaka 40.\n\nWakati bora wa kuanza ulikuwa miaka iliyopita; wakati mzuri unaofuata ni leo.",
  )),
];

// ─── Beginner Module 3: Investment Fundamentals (6 points) ──────────────────────

const FUNDAMENTALS: Lesson[] = [
  point("risk-return-relationship", t("Risk & Return Relationship", "Uhusiano wa Hatari na Faida"), t(
    "Risk and return are linked: investments that can earn more usually carry more ups and downs.\n\nLow risk, low return: Treasury bills, money-market funds. Higher risk, higher potential: shares.\n\nThe goal is not to avoid risk entirely, but to take a level of risk you understand and can live with.",
    "Hatari na faida vimeunganishwa: uwekezaji unaoweza kupata zaidi kwa kawaida una kupanda na kushuka zaidi.\n\nHatari ndogo, faida ndogo: dhamana fupi, mifuko ya soko la fedha. Hatari kubwa, uwezekano mkubwa: hisa.\n\nLengo si kuepuka hatari kabisa, bali kuchukua kiwango unachokielewa na kuvumilia.",
  )),
  point("investment-objectives", t("Investment Objectives", "Malengo ya Uwekezaji"), t(
    "Every investment should start with a clear objective. Common ones:\n- Growth: increase your capital over time (shares, balanced funds)\n- Income: receive regular payments (bonds, dividend funds)\n- Safety: protect capital (T-bills, money-market funds)\n\nYour objective guides which investments suit you.",
    "Kila uwekezaji uanze na lengo wazi. Ya kawaida:\n- Ukuaji: kuongeza mtaji kwa muda (hisa, mifuko mchanganyiko)\n- Kipato: kupokea malipo ya mara kwa mara (hatifungani, mifuko ya gawio)\n- Usalama: kulinda mtaji (dhamana fupi, mifuko ya soko la fedha)\n\nLengo lako huongoza uwekezaji unaokufaa.",
  )),
  point("investment-horizon", t("Investment Horizon", "Muda wa Uwekezaji"), t(
    "Your investment horizon is how long until you need the money. It shapes how much risk you can take.\n- Short (under 1 year): stay safe and liquid\n- Medium (1–5 years): bonds and balanced funds\n- Long (5+ years): shares and growth funds can ride out the swings\n\nLonger horizon, more room for risk.",
    "Muda wa uwekezaji ni hadi lini utahitaji fedha. Huamua kiasi cha hatari unachoweza kuchukua.\n- Mfupi (chini ya mwaka 1): kaa salama na yenye ukwasi\n- Kati (miaka 1–5): hatifungani na mifuko mchanganyiko\n- Mrefu (miaka 5+): hisa na mifuko ya ukuaji huvumilia mabadiliko\n\nMuda mrefu zaidi, nafasi zaidi ya hatari.",
  )),
  point("investor-profiles", t("Investor Profiles", "Wasifu wa Wawekezaji"), t(
    "Investors are often grouped by how much risk they accept:\n- Conservative: prefers safety, accepts low returns\n- Balanced: mixes safety and growth\n- Aggressive: accepts big swings for higher potential returns\n\nKnowing your profile — goals, age, and comfort with risk — helps you choose suitable investments.",
    "Wawekezaji mara nyingi hupangwa kwa kiasi cha hatari wanachokubali:\n- Mwangalifu: hupendelea usalama, hukubali faida ndogo\n- Mchanganyiko: huchanganya usalama na ukuaji\n- Mkali: hukubali mabadiliko makubwa kwa faida kubwa zaidi\n\nKujua wasifu wako — malengo, umri, na uvumilivu wa hatari — hukusaidia kuchagua uwekezaji unaofaa.",
  )),
  point("asset-classes", t("Asset Classes", "Aina za Mali"), t(
    "An asset class is a group of similar investments. The main ones in Tanzania:\n- Cash & money market: savings, UTT Liquid Fund\n- Fixed income: Treasury bills and bonds\n- Equities: shares on the DSE\n- Real assets: land and property\n\nMost investors hold a mix across classes to balance risk and return.",
    "Aina ya mali ni kundi la uwekezaji unaofanana. Kuu Tanzania:\n- Fedha na soko la fedha: akiba, UTT Liquid Fund\n- Kipato cha kudumu: dhamana za serikali\n- Hisa: hisa za DSE\n- Mali halisi: ardhi na majengo\n\nWawekezaji wengi hushika mchanganyiko ili kusawazisha hatari na faida.",
  )),
  point("portfolio-concepts", t("Basic Portfolio Concepts", "Misingi ya Portfolio"), t(
    "A portfolio is simply the collection of all your investments.\n\nKey ideas: diversify across asset classes so one loss doesn't sink you; match the mix to your goal and horizon; and review it now and then.\n\nExample: 40% UTT fund, 40% Treasury bonds, 20% shares is a simple starter portfolio.",
    "Portfolio ni mkusanyiko wa uwekezaji wako wote.\n\nMawazo muhimu: sambaza kwenye aina za mali ili hasara moja isikuangushe; linganisha mchanganyiko na lengo na muda wako; na ukague mara kwa mara.\n\nMfano: 40% mfuko wa UTT, 40% hatifungani, 20% hisa ni portfolio rahisi ya kuanzia.",
  )),
];

// ─── Beginner Module 4: Investment Ecosystem (7 points) ─────────────────────────

const ECOSYSTEM: Lesson[] = [
  point("role-of-cmsa", t("Role of the CMSA", "Jukumu la CMSA"), t(
    "The Capital Markets and Securities Authority (CMSA) is the regulator that licenses and supervises brokers, fund managers, and investment schemes in Tanzania.\n\nIts job is to protect investors and keep the market fair.\n\nBefore you invest, confirm a firm is licensed at cmsa.go.tz.",
    "Mamlaka ya Masoko ya Mitaji na Dhamana (CMSA) ndiyo msimamizi anayetoa leseni na kusimamia madalali, wasimamizi wa mifuko, na skimu za uwekezaji Tanzania.\n\nKazi yake ni kulinda wawekezaji na kuweka soko la haki.\n\nKabla ya kuwekeza, thibitisha kampuni ina leseni kwenye cmsa.go.tz.",
  )),
  point("role-of-bot", t("Role of the Bank of Tanzania", "Jukumu la Benki Kuu (BoT)"), t(
    "The Bank of Tanzania (BoT) is the central bank. It runs monetary policy, manages inflation, and issues government securities — Treasury bills and bonds — through regular auctions.\n\nWhen you buy a T-bill or bond, you are lending to the government through the BoT.\n\nInfo: bot.go.tz.",
    "Benki Kuu ya Tanzania (BoT) ni benki kuu. Huendesha sera ya fedha, husimamia mfumuko wa bei, na hutoa dhamana za serikali — dhamana fupi na hatifungani — kupitia minada ya mara kwa mara.\n\nUkinunua dhamana, unaikopesha serikali kupitia BoT.\n\nTaarifa: bot.go.tz.",
  )),
  point("about-dse", t("Dar es Salaam Stock Exchange", "Soko la Hisa la DSE"), t(
    "The DSE is Tanzania's stock exchange, where shares and bonds are listed and traded.\n\nAround 28 companies are listed, such as CRDB, NMB, TBL, and Vodacom.\n\nThrough a licensed broker you can buy and sell these shares and share in company growth and dividends. Info: dse.co.tz.",
    "DSE ni soko la hisa la Tanzania, ambapo hisa na hatifungani huorodheshwa na kuuzwa.\n\nKuna takriban kampuni 28 zilizoorodheshwa, kama CRDB, NMB, TBL, na Vodacom.\n\nKupitia dalali mwenye leseni unaweza kununua na kuuza hisa hizi na kushiriki ukuaji na gawio. Taarifa: dse.co.tz.",
  )),
  point("fund-managers", t("Fund Managers", "Wasimamizi wa Mifuko"), t(
    "A fund manager pools money from many investors and invests it professionally in a unit trust or collective scheme.\n\nIn Tanzania, UTT AMIS is the best-known, government-owned fund manager.\n\nFund managers let beginners access diversified, professionally managed investments with small amounts.",
    "Msimamizi wa mfuko huunganisha fedha za wawekezaji wengi na kuiwekeza kitaalamu kwenye mfuko wa pamoja.\n\nTanzania, UTT AMIS ndiye msimamizi maarufu zaidi, wa serikali.\n\nWasimamizi wa mifuko huwawezesha waanzaji kupata uwekezaji uliosambaa na unaosimamiwa kitaalamu kwa kiasi kidogo.",
  )),
  point("brokers-dealers", t("Brokers and Dealers", "Madalali na Wafanyabiashara"), t(
    "Brokers (Licensed Dealing Members) are firms licensed to buy and sell securities on your behalf at the DSE.\n\nYou place an order with your broker, who executes the trade and charges a fee.\n\nAlways use a CMSA-licensed broker; the list is at dse.co.tz or cmsa.go.tz.",
    "Madalali (Wanachama wenye Leseni) ni makampuni yenye leseni ya kununua na kuuza dhamana kwa niaba yako DSE.\n\nUnatoa oda kwa dalali wako, ambaye hutekeleza muamala na kutoza ada.\n\nDaima tumia dalali mwenye leseni ya CMSA; orodha ipo dse.co.tz au cmsa.go.tz.",
  )),
  point("custodians", t("Custodians", "Wahifadhi (Custodians)"), t(
    "A custodian is an institution that safely holds investors' assets — shares, bonds, and cash — separate from the broker's or manager's own money.\n\nIn Tanzania, your shares are held electronically in a CDS (Central Depository System) account.\n\nCustody keeps your investments safe even if an intermediary fails.",
    "Mhifadhi (custodian) ni taasisi inayohifadhi mali za wawekezaji kwa usalama — hisa, hatifungani, na fedha — kando na fedha za dalali au msimamizi.\n\nTanzania, hisa zako huhifadhiwa kielektroniki kwenye akaunti ya CDS (Mfumo Mkuu wa Uhifadhi).\n\nUhifadhi hulinda uwekezaji wako hata kama mpatanishi atashindwa.",
  )),
  point("collective-schemes", t("Collective Investment Schemes", "Skimu za Uwekezaji wa Pamoja"), t(
    "A collective investment scheme pools money from many people to invest together — for example a unit trust.\n\nEach investor owns units representing a share of the whole pool, managed by professionals.\n\nUTT AMIS funds are the main CMSA-regulated collective schemes in Tanzania.",
    "Skimu ya uwekezaji wa pamoja huunganisha fedha za watu wengi kuwekeza pamoja — mfano mfuko wa uwekezaji.\n\nKila mwekezaji humiliki vipande vinavyowakilisha sehemu ya mkusanyiko mzima, unaosimamiwa na wataalamu.\n\nMifuko ya UTT AMIS ndiyo skimu kuu za pamoja zinazosimamiwa na CMSA Tanzania.",
  )),
];

// ─── Intermediate Module 5: Investment Planning (5 points) ──────────────────────

const PLANNING: Lesson[] = [
  point("setting-goals-intermediate", t("Setting Investment Goals", "Kuweka Malengo ya Uwekezaji"), t(
    "Every investment journey starts with clear goals. A good goal is specific and time-bound: 'TZS 5,000,000 for land in 4 years', not just 'be rich'.\n\nSort goals by time: short (under 1 year), medium (1–5 years), long (5+ years).\n\nYour goals decide how much to invest, where, and for how long.",
    "Kila safari ya uwekezaji huanza na malengo wazi. Lengo zuri ni mahususi na lenye muda: 'TZS 5,000,000 kwa ardhi katika miaka 4', si 'kuwa tajiri' tu.\n\nPanga malengo kwa muda: mfupi (chini ya mwaka 1), kati (miaka 1–5), mrefu (miaka 5+).\n\nMalengo yako huamua kiasi cha kuwekeza, wapi, na kwa muda gani.",
  )),
  point("financial-planning", t("Financial Planning", "Mipango ya Fedha"), t(
    "Financial planning is the bigger picture around your investments: income, expenses, debts, savings and goals together.\n\nStart with a budget — know your monthly surplus (income minus expenses). That surplus is what you can invest.\n\nClear high-interest debts before investing heavily; they often cost more than investments earn.",
    "Mipango ya fedha ni picha pana inayozunguka uwekezaji wako: kipato, matumizi, madeni, akiba na malengo kwa pamoja.\n\nAnza na bajeti — jua ziada yako ya mwezi (kipato kuondoa matumizi). Ziada hiyo ndiyo unayoweza kuwekeza.\n\nLipa madeni yenye riba kubwa kabla ya kuwekeza sana; mara nyingi hugharimu zaidi ya faida ya uwekezaji.",
  )),
  point("emergency-funds-first", t("Emergency Funds Before Investing", "Mfuko wa Dharura Kwanza"), t(
    "Before investing, build an emergency fund of 3–6 months of expenses, kept somewhere safe and liquid.\n\nIt protects your investments: when an emergency hits, you use the fund instead of selling investments at a loss.\n\nKeep it in a savings account or a money-market fund like the UTT Liquid Fund.",
    "Kabla ya kuwekeza, jenga mfuko wa dharura wa matumizi ya miezi 3–6, uhifadhiwe mahali salama na penye ukwasi.\n\nHulinda uwekezaji wako: dharura ikitokea, unatumia mfuko badala ya kuuza uwekezaji kwa hasara.\n\nUhifadhi kwenye akaunti ya akiba au mfuko wa soko la fedha kama UTT Liquid Fund.",
  )),
  point("choosing-investments", t("Choosing Suitable Investments", "Kuchagua Uwekezaji Unaofaa"), t(
    "A suitable investment matches three things: your goal, your time horizon, and your risk tolerance.\n\nShort-term goal? Stay safe and liquid (T-bills, money-market fund). Long-term goal? You can take more risk (shares, balanced funds).\n\nOnly use CMSA-licensed products, and never invest money you'll need very soon.",
    "Uwekezaji unaofaa hulinganisha mambo matatu: lengo lako, muda wako, na uvumilivu wako wa hatari.\n\nLengo la muda mfupi? Kaa salama na penye ukwasi (dhamana fupi, mfuko wa soko la fedha). Lengo la muda mrefu? Waweza kuchukua hatari zaidi (hisa, mifuko mchanganyiko).\n\nTumia bidhaa zenye leseni ya CMSA pekee, na usiwekeze fedha utakayoihitaji karibuni.",
  )),
  point("risk-tolerance", t("Risk Tolerance Assessment", "Kupima Uvumilivu wa Hatari"), t(
    "Risk tolerance is how much ups and downs you can handle without panic — financially and emotionally.\n\nAsk yourself: if my investment dropped 20% for a year, would I hold on or sell? Could I still pay my bills?\n\nHonest answers guide your mix: lower tolerance leans to bonds and funds; higher tolerance can hold more shares.",
    "Uvumilivu wa hatari ni kiasi cha kupanda na kushuka unachoweza kuvumilia bila hofu — kifedha na kihisia.\n\nJiulize: uwekezaji wangu ukishuka 20% kwa mwaka, ningeshikilia au kuuza? Bado ningeweza kulipa gharama zangu?\n\nMajibu ya kweli huongoza mchanganyiko: uvumilivu mdogo huelekea hatifungani na mifuko; mkubwa waweza kushika hisa zaidi.",
  )),
];

// ─── Intermediate Module 6: Portfolio Building (5 points) ───────────────────────

const PORTFOLIO_BUILDING: Lesson[] = [
  point("asset-allocation", t("Asset Allocation", "Mgawanyo wa Mali"), t(
    "Asset allocation is how you split money across asset classes — cash, bonds, and shares.\n\nIt is the biggest driver of your results and risk. A common guide: more bonds/cash for short-term or cautious investors, more shares for long-term ones.\n\nExample: 60% bonds and funds, 40% shares for a balanced long-term investor.",
    "Mgawanyo wa mali ni jinsi unavyogawa fedha kwenye aina za mali — fedha, hatifungani, na hisa.\n\nNdiyo kiendeshi kikubwa cha matokeo na hatari yako. Mwongozo wa kawaida: hatifungani/fedha zaidi kwa muda mfupi au mwangalifu, hisa zaidi kwa wa muda mrefu.\n\nMfano: 60% hatifungani na mifuko, 40% hisa kwa mwekezaji mchanganyiko wa muda mrefu.",
  )),
  point("diversification-strategies", t("Diversification Strategies", "Mikakati ya Mseto"), t(
    "Diversifying lowers risk by not relying on one bet. Spread across:\n- Asset classes (cash, bonds, shares)\n- Sectors (banking, telecoms, manufacturing)\n- Time (invest regularly, not all at once)\n\nFunds like UTT's are diversified by design — an easy way for beginners to spread risk.",
    "Mseto hupunguza hatari kwa kutotegemea kamari moja. Sambaza kwa:\n- Aina za mali (fedha, hatifungani, hisa)\n- Sekta (benki, mawasiliano, viwanda)\n- Muda (wekeza mara kwa mara, si yote kwa pamoja)\n\nMifuko kama ya UTT imesambaa kimuundo — njia rahisi kwa waanzaji kusambaza hatari.",
  )),
  point("portfolio-construction", t("Portfolio Construction", "Kujenga Portfolio"), t(
    "Building a portfolio means choosing specific investments to fill your chosen allocation.\n\nSteps: set your allocation (e.g. 40/40/20), pick one or two options per class, and start with what you can invest regularly.\n\nKeep it simple at first — a money-market fund, a Treasury bond, and a balanced fund can be a full starter portfolio.",
    "Kujenga portfolio ni kuchagua uwekezaji mahususi kujaza mgawanyo uliouchagua.\n\nHatua: weka mgawanyo wako (mf. 40/40/20), chagua chaguo moja au mbili kwa kila aina, na anza na unachoweza kuwekeza mara kwa mara.\n\nWeka rahisi mwanzoni — mfuko wa soko la fedha, hatifungani, na mfuko mchanganyiko unaweza kuwa portfolio kamili ya kuanzia.",
  )),
  point("rebalancing", t("Rebalancing", "Kusawazisha Upya"), t(
    "Over time, winners grow and your mix drifts from its target — say shares rise from 40% to 55%.\n\nRebalancing means adjusting back to your target, by directing new money to the lagging part or trimming the overgrown one.\n\nReview once or twice a year. It keeps your risk where you intended.",
    "Kadri muda unavyokwenda, washindi hukua na mchanganyiko wako huhama lengo — mfano hisa zikipanda kutoka 40% hadi 55%.\n\nKusawazisha upya ni kurudi kwenye lengo lako, kwa kuelekeza fedha mpya kwenye sehemu iliyobaki nyuma au kupunguza iliyokua kupita kiasi.\n\nKagua mara moja au mbili kwa mwaka. Huweka hatari yako pale ulipokusudia.",
  )),
  point("long-term-management", t("Long-Term Portfolio Management", "Usimamizi wa Muda Mrefu"), t(
    "Managing a portfolio is a long game: keep investing regularly, reinvest returns, and avoid reacting to every market move.\n\nReview your goals and allocation yearly, and adjust as your life changes (new job, marriage, nearing a goal).\n\nDiscipline and patience beat constant trading for most investors.",
    "Kusimamia portfolio ni mchezo wa muda mrefu: endelea kuwekeza mara kwa mara, wekeza tena faida, na epuka kuathirika na kila mabadiliko ya soko.\n\nKagua malengo na mgawanyo wako kila mwaka, na rekebisha maisha yanapobadilika (kazi mpya, ndoa, kukaribia lengo).\n\nNidhamu na subira hushinda biashara za mara kwa mara kwa wawekezaji wengi.",
  )),
];

// ─── Intermediate Module 7: Understanding Investment Performance (7 points) ──────

const PERFORMANCE: Lesson[] = [
  point("measuring-returns", t("Measuring Returns", "Kupima Faida"), t(
    "Return measures how much an investment earned, usually as a percentage per year.\n\nTotal return combines price change plus any income (dividends or interest). Example: a share bought at TZS 500, now TZS 540, that paid a TZS 20 dividend = (40+20)/500 = 12%.\n\nAlways compare returns over the same time period.",
    "Faida hupima kiasi uwekezaji ulivyozalisha, mara nyingi kama asilimia kwa mwaka.\n\nFaida jumla huchanganya mabadiliko ya bei pamoja na kipato (gawio au riba). Mfano: hisa iliyonunuliwa TZS 500, sasa TZS 540, iliyolipa gawio TZS 20 = (40+20)/500 = 12%.\n\nDaima linganisha faida kwa kipindi kile kile.",
  )),
  point("capital-gains", t("Capital Gains", "Faida ya Mtaji"), t(
    "A capital gain is the profit when an investment's price rises above what you paid.\n\nExample: buy a DSE share at TZS 500, sell at TZS 650 — your capital gain is TZS 150 per share.\n\nIt is only 'realised' when you sell; until then it is a paper gain that can still rise or fall.",
    "Faida ya mtaji ni faida pale bei ya uwekezaji inapopanda zaidi ya uliyolipa.\n\nMfano: nunua hisa ya DSE TZS 500, uza TZS 650 — faida yako ya mtaji ni TZS 150 kwa hisa.\n\nHupatikana tu unapouza; kabla ya hapo ni faida ya karatasi inayoweza bado kupanda au kushuka.",
  )),
  point("dividend-income", t("Dividend Income", "Kipato cha Gawio"), t(
    "A dividend is a share of a company's profit paid to shareholders, usually once or twice a year.\n\nExample: own 1,000 shares paying a TZS 45 dividend = TZS 45,000 that year, paid to your bank or mobile account.\n\nNot all companies pay dividends; some reinvest profits to grow instead.",
    "Gawio ni sehemu ya faida ya kampuni inayolipwa wanahisa, mara nyingi mara moja au mbili kwa mwaka.\n\nMfano: kumiliki hisa 1,000 zinazolipa gawio TZS 45 = TZS 45,000 mwaka huo, hulipwa benki au kwenye simu.\n\nSi kila kampuni hulipa gawio; baadhi huwekeza tena faida ili kukua.",
  )),
  point("interest-income", t("Interest Income", "Kipato cha Riba"), t(
    "Interest is the income you earn for lending money — for example through Treasury bills, bonds, or a money-market fund.\n\nA TZS 1,000,000 bond at a 12% coupon pays TZS 120,000 a year, usually in two payments.\n\nInterest is more predictable than share returns, which makes it useful for steady income.",
    "Riba ni kipato unachopata kwa kukopesha fedha — mfano kupitia dhamana za serikali au mfuko wa soko la fedha.\n\nHatifungani ya TZS 1,000,000 yenye riba 12% hulipa TZS 120,000 kwa mwaka, mara nyingi kwa malipo mawili.\n\nRiba ni ya uhakika zaidi kuliko faida ya hisa, hivyo ni nzuri kwa kipato cha kudumu.",
  )),
  point("yield", t("Yield", "Mavuno (Yield)"), t(
    "Yield is the income an investment pays each year as a percentage of its price.\n\nExample: a bond paying TZS 120,000 a year, priced at TZS 1,000,000, has a 12% yield.\n\nYield lets you compare income across investments — but a very high 'yield' can be a warning sign of high risk or a scam.",
    "Yield ni kipato uwekezaji hulipa kila mwaka kama asilimia ya bei yake.\n\nMfano: hatifungani inayolipa TZS 120,000 kwa mwaka, bei TZS 1,000,000, ina yield ya 12%.\n\nYield hukuwezesha kulinganisha kipato kati ya uwekezaji — lakini 'yield' kubwa mno yaweza kuwa dalili ya hatari kubwa au ulaghai.",
  )),
  point("nav", t("Net Asset Value (NAV)", "Thamani Halisi (NAV)"), t(
    "NAV (Net Asset Value) is the price of one unit of a fund, like UTT's.\n\nIt is the fund's total value divided by the number of units, published daily.\n\nWhen you invest, your money buys units at that day's NAV; as the fund grows, the NAV — and your holding — rises.",
    "NAV (Thamani Halisi ya Vipande) ni bei ya kipande kimoja cha mfuko, kama wa UTT.\n\nNi thamani jumla ya mfuko kugawanya kwa idadi ya vipande, hutangazwa kila siku.\n\nUnapowekeza, fedha yako hununua vipande kwa NAV ya siku hiyo; mfuko ukikua, NAV — na umiliki wako — hupanda.",
  )),
  point("benchmarking", t("Benchmarking Performance", "Kupima kwa Vigezo"), t(
    "A benchmark is a yardstick to judge your returns against — for example inflation, a bank rate, or a market index like the DSE's.\n\nIf inflation is 4% and your investment earned 10%, you genuinely grew your wealth.\n\nAlways ask: did this beat a fair benchmark, after fees?",
    "Kipimo (benchmark) ni kifaa cha kupima faida yako dhidi yake — mfano mfumuko wa bei, riba ya benki, au kielelezo cha soko kama cha DSE.\n\nMfumuko wa bei ukiwa 4% na uwekezaji wako ukapata 10%, umekuza utajiri kweli.\n\nDaima jiulize: je, hii ilishinda kipimo cha haki, baada ya ada?",
  )),
];

// ─── Intermediate Module 8: Investment Decision Making (5 points) ───────────────

const DECISION_MAKING: Lesson[] = [
  point("fundamental-analysis", t("Fundamental Analysis Basics", "Misingi ya Uchambuzi"), t(
    "Fundamental analysis means judging an investment by its real value, not hype.\n\nFor a company: look at profits, debts, growth, and management. For a bond: the issuer's ability to repay.\n\nRead annual reports (on dse.co.tz for listed firms) and ask whether the price is fair for what you get.",
    "Uchambuzi wa msingi ni kupima uwekezaji kwa thamani yake halisi, si propaganda.\n\nKwa kampuni: angalia faida, madeni, ukuaji, na uongozi. Kwa hatifungani: uwezo wa mtoaji kulipa.\n\nSoma ripoti za mwaka (dse.co.tz kwa kampuni zilizoorodheshwa) na jiulize kama bei ni ya haki kwa unachopata.",
  )),
  point("evaluating-opportunities", t("Evaluating Opportunities", "Kupima Fursa"), t(
    "When an opportunity appears, slow down and check it against your goals and risk tolerance.\n\nAsk: Is it CMSA-licensed? What is the realistic return and the risk? What are the fees? Can I sell when I need to?\n\nIf you can't understand how it makes money, don't invest.",
    "Fursa inapojitokeza, punguza mwendo na ihakiki dhidi ya malengo na uvumilivu wako wa hatari.\n\nJiulize: Ina leseni ya CMSA? Faida halisi na hatari ni zipi? Ada ni zipi? Naweza kuuza nikihitaji?\n\nKama huelewi jinsi inavyozalisha fedha, usiwekeze.",
  )),
  point("comparing-investments", t("Comparing Investments", "Kulinganisha Uwekezaji"), t(
    "Compare investments on the same terms: return, risk, fees, liquidity, and time horizon.\n\nA fund returning 10% with low fees may beat one returning 12% with high fees. Safety and access matter too.\n\nDon't chase the highest headline number — weigh the whole picture.",
    "Linganisha uwekezaji kwa vigezo sawa: faida, hatari, ada, ukwasi, na muda.\n\nMfuko unaopata 10% kwa ada ndogo waweza kushinda unaopata 12% kwa ada kubwa. Usalama na upatikanaji ni muhimu pia.\n\nUsifukuze namba kubwa ya kichwa — pima picha nzima.",
  )),
  point("due-diligence", t("Due Diligence", "Uchunguzi wa Kina"), t(
    "Due diligence is doing your homework before you pay.\n\nVerify the firm's CMSA licence at cmsa.go.tz, read the official documents, check who holds your money (custody), and confirm how to exit.\n\nNever rely on a WhatsApp message or a friend's promise alone.",
    "Uchunguzi wa kina ni kufanya kazi yako ya nyumbani kabla ya kulipa.\n\nThibitisha leseni ya CMSA ya kampuni kwenye cmsa.go.tz, soma nyaraka rasmi, angalia nani hushika fedha yako (uhifadhi), na thibitisha jinsi ya kutoka.\n\nKamwe usitegemee ujumbe wa WhatsApp au ahadi ya rafiki pekee.",
  )),
  point("common-mistakes", t("Common Investment Mistakes", "Makosa ya Kawaida"), t(
    "Avoid the common traps:\n- Chasing 'guaranteed' high returns (often scams)\n- Putting everything in one investment\n- Panic-selling when prices dip\n- Investing borrowed or emergency money\n- Ignoring fees\n\nSlow, diversified, informed investing beats quick bets over time.",
    "Epuka mitego ya kawaida:\n- Kufukuza faida 'ya uhakika' kubwa (mara nyingi ulaghai)\n- Kuweka kila kitu kwenye uwekezaji mmoja\n- Kuuza kwa hofu bei zinaposhuka\n- Kuwekeza fedha ya mkopo au ya dharura\n- Kupuuza ada\n\nUwekezaji wa taratibu, uliosambaa, na wenye taarifa hushinda kamari za haraka kwa muda.",
  )),
];

// ─── Advanced Module 9: Advanced Portfolio Management (4 points) ────────────────

const ADV_PORTFOLIO: Lesson[] = [
  point("strategic-allocation", t("Strategic Asset Allocation", "Mgawanyo wa Kimkakati"), t(
    "Strategic asset allocation is your long-term target mix of assets, based on your goals and risk tolerance — and you stick to it for years.\n\nExample: a long-term investor might set 60% shares/funds, 30% bonds, 10% cash, and hold that through ups and downs.\n\nIt is the anchor of disciplined investing: decide once, review rarely, rebalance back to target.",
    "Mgawanyo wa kimkakati wa mali ni lengo lako la muda mrefu la mchanganyiko wa mali, kulingana na malengo na uvumilivu wa hatari — nawe unaushikilia kwa miaka.\n\nMfano: mwekezaji wa muda mrefu aweza kuweka 60% hisa/mifuko, 30% hatifungani, 10% fedha, na kushikilia hata bei zikipanda na kushuka.\n\nNi nanga ya uwekezaji wa nidhamu: amua mara moja, kagua mara chache, sawazisha kurudi lengoni.",
  )),
  point("tactical-allocation", t("Tactical Asset Allocation", "Mgawanyo wa Kimbinu"), t(
    "Tactical asset allocation is making short-term shifts away from your strategic target to take advantage of conditions — for example holding more cash when shares look expensive.\n\nIt aims to add return or cut risk, but it is harder than it sounds and easy to get wrong.\n\nFor most investors, small tilts beat big bets; the strategic plan stays the foundation.",
    "Mgawanyo wa kimbinu ni kufanya mabadiliko ya muda mfupi kuachana na lengo lako la kimkakati ili kunufaika na hali — mfano kushika fedha zaidi hisa zinapoonekana ghali.\n\nHulenga kuongeza faida au kupunguza hatari, lakini ni vigumu kuliko inavyoonekana na rahisi kukosea.\n\nKwa wawekezaji wengi, mabadiliko madogo ni bora kuliko kamari kubwa; mpango wa kimkakati hubaki msingi.",
  )),
  point("portfolio-optimization", t("Portfolio Optimization", "Uboreshaji wa Portfolio"), t(
    "Optimization means seeking the best expected return for the level of risk you accept — or the lowest risk for a target return.\n\nThe practical idea: combine assets that don't all move together, so the mix is steadier than its parts.\n\nYou don't need complex maths — broad diversification across uncorrelated assets captures most of the benefit.",
    "Uboreshaji ni kutafuta faida bora inayotarajiwa kwa kiwango cha hatari unachokubali — au hatari ndogo zaidi kwa faida unayolenga.\n\nWazo la vitendo: changanya mali zisizotembea pamoja zote, ili mchanganyiko uwe thabiti kuliko sehemu zake.\n\nHuhitaji hesabu ngumu — mseto mpana wa mali zisizohusiana hunasa faida nyingi.",
  )),
  point("managing-volatility", t("Managing Volatility", "Kudhibiti Mtikisiko"), t(
    "Volatility is how much an investment's value swings up and down. High volatility tests your nerves, not just your wallet.\n\nManage it by diversifying, holding enough cash for needs, matching risky assets to long horizons, and avoiding panic-selling.\n\nVolatility is normal — it is the price of long-term growth, not a reason to flee.",
    "Mtikisiko (volatility) ni kiasi thamani ya uwekezaji inavyopanda na kushuka. Mtikisiko mkubwa hujaribu moyo wako, si mfuko tu.\n\nUdhibiti kwa mseto, kushika fedha za kutosha kwa mahitaji, kulinganisha mali hatarishi na muda mrefu, na kuepuka kuuza kwa hofu.\n\nMtikisiko ni wa kawaida — ni bei ya ukuaji wa muda mrefu, si sababu ya kukimbia.",
  )),
];

// ─── Advanced Module 10: Investor Protection (7 points) ─────────────────────────

const INVESTOR_PROTECTION: Lesson[] = [
  point("ponzi-schemes", t("Ponzi Schemes", "Mipango ya Ponzi"), t(
    "A Ponzi scheme pays 'returns' to old investors using money from new investors — not from real profit.\n\nIt looks great until new money slows, then it collapses and most people lose everything.\n\nWarning signs: steady high returns regardless of markets, run by one person or company, and pressure to reinvest. Verify any scheme at cmsa.go.tz.",
    "Mpango wa Ponzi hulipa 'faida' kwa wawekezaji wa zamani kwa kutumia fedha za wapya — si kutoka faida halisi.\n\nHuonekana mzuri hadi fedha mpya zinapopungua, kisha huporomoka na watu wengi hupoteza kila kitu.\n\nDalili: faida kubwa ya uhakika bila kujali soko, huendeshwa na mtu au kampuni moja, na shinikizo la kuwekeza tena. Hakiki cmsa.go.tz.",
  )),
  point("pyramid-schemes", t("Pyramid Schemes", "Mipango ya Piramidi"), t(
    "A pyramid scheme makes money mainly by recruiting new members, not by selling a real product or investment.\n\nEarly joiners are paid from the fees of those they recruit; when recruitment stops, it collapses.\n\nIf the 'returns' depend on bringing in more people, walk away — these are illegal and most members lose.",
    "Mpango wa piramidi hupata fedha hasa kwa kuandikisha wanachama wapya, si kwa kuuza bidhaa au uwekezaji halisi.\n\nWalioingia mapema hulipwa kutoka ada za wanaowaandikisha; uandikishaji ukikoma, huporomoka.\n\nKama 'faida' inategemea kuleta watu zaidi, ondoka — hii ni haramu na wanachama wengi hupoteza.",
  )),
  point("investment-fraud", t("Investment Fraud", "Ulaghai wa Uwekezaji"), t(
    "Investment fraud is any scheme that deceives you to take your money — fake funds, forged documents, or 'managers' who aren't licensed.\n\nProtect yourself: deal only with CMSA-licensed firms, never pay into a personal account, and keep records.\n\nIf returns sound too good to be true, they almost always are.",
    "Ulaghai wa uwekezaji ni mpango wowote unaokudanganya ili kuchukua fedha yako — mifuko bandia, nyaraka za kughushi, au 'wasimamizi' wasio na leseni.\n\nJilinde: shughulika na kampuni zenye leseni ya CMSA pekee, kamwe usilipe kwenye akaunti binafsi, na weka kumbukumbu.\n\nFaida ikionekana nzuri kupita kawaida, karibu kila mara ndivyo ilivyo.",
  )),
  point("digital-scams", t("Digital Scams", "Ulaghai wa Kidijitali"), t(
    "Digital scams reach you by WhatsApp, SMS, social media, fake apps, or 'forex/crypto experts' promising quick riches.\n\nRed flags: unsolicited messages, urgency, requests to pay to a phone number, and links to unofficial apps or sites.\n\nNever share PINs or pay strangers online. Confirm any platform's licence at cmsa.go.tz first.",
    "Ulaghai wa kidijitali hukufikia kwa WhatsApp, SMS, mitandao ya kijamii, app bandia, au 'wataalamu wa forex/crypto' wanaoahidi utajiri wa haraka.\n\nDalili: ujumbe usioombwa, haraka, maombi ya kulipa kwenye namba ya simu, na viungo vya app au tovuti zisizo rasmi.\n\nKamwe usishiriki PIN au kulipa wageni mtandaoni. Thibitisha leseni ya jukwaa kwenye cmsa.go.tz kwanza.",
  )),
  point("red-flags", t("Red Flags in Investments", "Dalili za Hatari"), t(
    "Learn the warning signs that an 'opportunity' is dangerous:\n- 'Guaranteed' high returns (e.g. 30% a month)\n- Pressure to act now or to recruit others\n- No CMSA licence and no physical office\n- Payment to a personal number\n- Vague or secret 'strategies'\n\nAny one of these is reason to stop and verify.",
    "Jifunze dalili kwamba 'fursa' ni hatari:\n- Faida 'ya uhakika' kubwa (mf. 30% kwa mwezi)\n- Shinikizo la kuamua sasa au kuandikisha wengine\n- Hakuna leseni ya CMSA wala ofisi\n- Malipo kwenye namba binafsi\n- 'Mikakati' ya kificho au isiyo wazi\n\nDalili yoyote kati ya hizi ni sababu ya kusimama na kuhakiki.",
  )),
  point("investor-rights", t("Investor Rights", "Haki za Mwekezaji"), t(
    "As an investor in Tanzania you have rights: to clear information, to deal with licensed firms, to have your assets held safely (custody), and to fair treatment.\n\nYou are entitled to statements showing your holdings and to withdraw under the agreed terms.\n\nKnow these rights — they are your protection if something goes wrong.",
    "Kama mwekezaji Tanzania una haki: kupata taarifa wazi, kushughulika na kampuni zenye leseni, kuhifadhiwa mali yako kwa usalama (uhifadhi), na kutendewa haki.\n\nUna haki ya kupata taarifa zinazoonyesha umiliki wako na kutoa fedha kwa masharti yaliyokubaliwa.\n\nJua haki hizi — ndizo ulinzi wako kitu kikienda vibaya.",
  )),
  point("complaints", t("Complaint Handling Mechanisms", "Njia za Kushughulikia Malalamiko"), t(
    "If a licensed firm treats you unfairly, you can complain.\n\nStart in writing with the firm itself. If unresolved, escalate to the regulator — the CMSA (cmsa.go.tz) for capital-market issues, or the Bank of Tanzania for banking.\n\nFor suspected fraud, report to the police too. Keep all records and receipts to support your case.",
    "Kampuni yenye leseni ikikutendea isivyo haki, unaweza kulalamika.\n\nAnza kwa maandishi na kampuni yenyewe. Isipotatuliwa, peleka kwa msimamizi — CMSA (cmsa.go.tz) kwa masuala ya soko la mitaji, au Benki Kuu kwa benki.\n\nKwa ulaghai unaohisiwa, ripoti polisi pia. Weka kumbukumbu na risiti zote kuthibitisha hoja yako.",
  )),
];

// ─── Advanced Module 11: Advanced Investment Strategies (5 points) ──────────────

const ADV_STRATEGIES: Lesson[] = [
  point("income-investing", t("Income Investing", "Uwekezaji wa Kipato"), t(
    "Income investing focuses on investments that pay you regularly — dividends from shares, interest from bonds, or distributions from income funds.\n\nIt suits people who want steady cash flow, such as retirees.\n\nIn Tanzania, Treasury bonds, dividend-paying DSE shares, and UTT's Jikimu Fund are common income choices.",
    "Uwekezaji wa kipato hulenga uwekezaji unaokulipa mara kwa mara — gawio la hisa, riba ya hatifungani, au migao ya mifuko ya kipato.\n\nHufaa watu wanaotaka mtiririko wa fedha wa uhakika, kama wastaafu.\n\nTanzania, hatifungani, hisa za DSE zinazolipa gawio, na Mfuko wa Jikimu wa UTT ni chaguo za kawaida za kipato.",
  )),
  point("growth-investing", t("Growth Investing", "Uwekezaji wa Ukuaji"), t(
    "Growth investing aims for capital gains — buying shares or funds expected to rise in value over time, even if they pay little income now.\n\nIt carries more ups and downs but can build the most wealth over long periods.\n\nIt suits younger or long-term investors who can ride out volatility.",
    "Uwekezaji wa ukuaji hulenga faida ya mtaji — kununua hisa au mifuko inayotarajiwa kupanda thamani kwa muda, hata kama hulipa kipato kidogo sasa.\n\nUna kupanda na kushuka zaidi lakini waweza kujenga utajiri mkubwa kwa vipindi virefu.\n\nHufaa wawekezaji wachanga au wa muda mrefu wanaoweza kuvumilia mtikisiko.",
  )),
  point("value-investing", t("Value Investing", "Uwekezaji wa Thamani"), t(
    "Value investing means buying solid investments that look underpriced — paying less than something is really worth, and waiting for the market to catch up.\n\nIt relies on patience and research into a company's fundamentals.\n\nThe idea, made famous by Warren Buffett: buy good assets on sale, then hold for the long term.",
    "Uwekezaji wa thamani ni kununua uwekezaji imara unaoonekana kuwa na bei ndogo — kulipa chini ya thamani halisi, na kusubiri soko lifikie thamani hiyo.\n\nHutegemea subira na utafiti wa misingi ya kampuni.\n\nWazo, lililofanywa maarufu na Warren Buffett: nunua mali nzuri kwa punguzo, kisha shikilia kwa muda mrefu.",
  )),
  point("retirement-investing", t("Retirement Investing", "Uwekezaji wa Uzeeni"), t(
    "Retirement investing builds a pot to live on when you stop working.\n\nStart early so compounding does the heavy lifting; invest for growth while young, then shift toward safer assets as retirement nears.\n\nIn Tanzania, combine pension schemes (NSSF, PSSSF, NISS) with long-term funds and bonds.",
    "Uwekezaji wa uzeeni hujenga akiba ya kuishi utakapoacha kazi.\n\nAnza mapema ili mkusanyiko ufanye kazi kubwa; wekeza kwa ukuaji ukiwa kijana, kisha elekea mali salama zaidi uzeeni unapokaribia.\n\nTanzania, changanya mifuko ya pensheni (NSSF, PSSSF, NISS) na mifuko ya muda mrefu na hatifungani.",
  )),
  point("wealth-preservation", t("Wealth Preservation", "Kulinda Utajiri"), t(
    "Once you have built wealth, the goal shifts from growing it to protecting it.\n\nPreserve wealth by diversifying, holding some safe assets (bonds, money-market funds), beating inflation, avoiding scams, and planning for inheritance.\n\nThe rich stay rich less by big wins than by avoiding big losses.",
    "Ukishajenga utajiri, lengo huhama kutoka kuukuza hadi kuulinda.\n\nLinda utajiri kwa mseto, kushika mali salama (hatifungani, mifuko ya soko la fedha), kushinda mfumuko wa bei, kuepuka ulaghai, na kupanga urithi.\n\nMatajiri hubaki matajiri si kwa ushindi mkubwa bali kwa kuepuka hasara kubwa.",
  )),
];

// ─── Levels (the "Learn Investment" path) ───────────────────────────────────────

export const LEVELS: Level[] = [
  {
    id: "beginner",
    emoji: "🟢",
    title: t("Beginner Investor", "Mwekezaji wa Mwanzo"),
    short: t("Beginner", "Mwanzo"),
    modules: [
      ready("basic-concepts", t("Definition of Basic Concepts", "Maana ya Dhana za Msingi"), t("Basic Concepts", "Dhana za Msingi"), BASIC_CONCEPTS),
      ready("why-invest", t("Why Invest?", "Kwa Nini Kuwekeza?"), t("Why Invest?", "Kwa Nini?"), WHY_INVEST),
      ready("fundamentals", t("Investment Fundamentals", "Kanuni za Uwekezaji"), t("Fundamentals", "Kanuni"), FUNDAMENTALS),
      ready("ecosystem", t("Investment Ecosystem", "Mfumo wa Uwekezaji"), t("Ecosystem", "Mfumo wa Sekta"), ECOSYSTEM),
    ],
  },
  {
    id: "intermediate",
    emoji: "🟡",
    title: t("Intermediate Investor", "Mwekezaji wa Wastani"),
    short: t("Intermediate", "Wastani"),
    modules: [
      ready("planning", t("Investment Planning", "Mipango ya Uwekezaji"), t("Planning", "Mipango"), PLANNING),
      ready("portfolio-building", t("Portfolio Building", "Kujenga Portfolio"), t("Portfolio", "Portfolio"), PORTFOLIO_BUILDING),
      ready("performance", t("Understanding Investment Performance", "Kuelewa Utendaji wa Uwekezaji"), t("Performance", "Utendaji"), PERFORMANCE),
      ready("decision-making", t("Investment Decision Making", "Kufanya Maamuzi ya Uwekezaji"), t("Decisions", "Maamuzi"), DECISION_MAKING),
    ],
  },
  {
    id: "advanced",
    emoji: "🔴",
    title: t("Advanced Investor", "Mwekezaji wa Juu"),
    short: t("Advanced", "Juu"),
    modules: [
      ready("adv-portfolio", t("Advanced Portfolio Management", "Usimamizi wa Hali ya Juu wa Portfolio"), t("Adv. Portfolio", "Portfolio ya Juu"), ADV_PORTFOLIO),
      ready("investor-protection", t("Investor Protection", "Ulinzi wa Mwekezaji"), t("Protection", "Ulinzi"), INVESTOR_PROTECTION),
      ready("adv-strategies", t("Advanced Investment Strategies", "Mikakati ya Hali ya Juu"), t("Strategies", "Mikakati"), ADV_STRATEGIES),
    ],
  },
];

// ─── Product academies (the "Investment Products in Tanzania" library) ───────────

export const ACADEMIES: Academy[] = [
  {
    id: "utt",
    emoji: "📈",
    title: t("UTT AMIS Academy", "Akademia ya UTT AMIS"),
    short: t("UTT AMIS", "UTT AMIS"),
    modules: [
      soon("utt-basics", t("UTT Basics", "Misingi ya UTT"), t("UTT Basics", "Misingi ya UTT")),
      soon("utt-units", t("Understanding Units", "Kuelewa Vipande"), t("Units", "Vipande")),
      soon("utt-nav", t("Net Asset Value (NAV)", "Thamani ya Vipande (NAV)"), t("NAV", "NAV")),
      soon("utt-umoja", t("Umoja Fund", "Mfuko wa Umoja"), t("Umoja Fund", "Mfuko wa Umoja")),
      soon("utt-liquid", t("Liquid Fund", "Liquid Fund"), t("Liquid Fund", "Liquid Fund")),
      soon("utt-bond", t("Bond Fund", "Mfuko wa Hatifungani"), t("Bond Fund", "Bond Fund")),
      soon("utt-watoto", t("Watoto Fund", "Mfuko wa Watoto"), t("Watoto Fund", "Watoto")),
      soon("utt-jikimu", t("Jikimu Fund", "Mfuko wa Jikimu"), t("Jikimu Fund", "Jikimu")),
      soon("utt-wekeza-maisha", t("Wekeza Maisha", "Wekeza Maisha"), t("Wekeza Maisha", "Wekeza Maisha")),
    ],
  },
  {
    id: "dse",
    emoji: "📊",
    title: t("DSE Academy", "Akademia ya DSE"),
    short: t("DSE", "DSE"),
    modules: [
      soon("dse-shares", t("Shares", "Hisa"), t("Shares", "Hisa")),
      soon("dse-dividends", t("Dividends", "Gawio"), t("Dividends", "Gawio")),
      soon("dse-cds", t("CDS Accounts", "Akaunti za CDS"), t("CDS Accounts", "Akaunti CDS")),
      soon("dse-trading", t("Trading", "Ufanyaji Biashara"), t("Trading", "Biashara")),
      soon("dse-analysis", t("Company Analysis", "Uchambuzi wa Kampuni"), t("Analysis", "Uchambuzi")),
    ],
  },
  {
    id: "govsec",
    emoji: "🏛️",
    title: t("Government Securities Academy", "Akademia ya Dhamana za Serikali"),
    short: t("Govt Securities", "Dhamana"),
    modules: [
      soon("gs-tbills", t("Treasury Bills", "Dhamana za Muda Mfupi"), t("Treasury Bills", "Dhamana Fupi")),
      soon("gs-tbonds", t("Treasury Bonds", "Hatifungani za Serikali"), t("Treasury Bonds", "Hatifungani")),
      soon("gs-auctions", t("Auctions", "Minada"), t("Auctions", "Minada")),
      soon("gs-yields", t("Yields", "Mavuno (Yields)"), t("Yields", "Mavuno")),
      soon("gs-secondary", t("Secondary Markets", "Masoko ya Pili"), t("Secondary Markets", "Soko la Pili")),
    ],
  },
  {
    id: "pension",
    emoji: "👵",
    title: t("Pension Investment Academy", "Akademia ya Pensheni"),
    short: t("Pension", "Pensheni"),
    modules: [
      soon("pen-nssf", t("NSSF", "NSSF"), t("NSSF", "NSSF")),
      soon("pen-psssf", t("PSSSF", "PSSSF"), t("PSSSF", "PSSSF")),
      soon("pen-niss", t("NISS", "NISS"), t("NISS", "NISS")),
      soon("pen-retirement", t("Retirement Planning", "Kupanga kwa Uzeeni"), t("Retirement", "Uzeeni")),
    ],
  },
];

// Convenience lookups.
export const findLevel = (id: string) => LEVELS.find((l) => l.id === id);
export const findAcademy = (id: string) => ACADEMIES.find((a) => a.id === id);
export function findModule(id: string): Module | undefined {
  for (const group of [...LEVELS, ...ACADEMIES]) {
    const m = group.modules.find((mod) => mod.id === id);
    if (m) return m;
  }
  return undefined;
}
