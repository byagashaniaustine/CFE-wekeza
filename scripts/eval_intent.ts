// Evaluates src/tools/intent.ts against 500 hand-labeled EN/SW messages
// spanning direct/indirect phrasings, code-switching, typos, and 125 fully
// off-topic messages (weather, sports, greetings, small talk, nonsense).
//
// Run with:
//   deno run --allow-env --allow-net --env scripts/eval_intent.ts
//
// ~30-60s at concurrency 8; ~$0.50 in Haiku tokens. Prints per-bucket
// accuracy, a confusion matrix, and every mismatch so the system prompt in
// src/tools/intent.ts can be tuned. Add real-world misclassifications from
// production logs (grep INTENT_CLASSIFIED in Streamlogia) and re-run.

import { classifyIntent, type Intent } from "../src/tools/intent.ts";

type Lang = "en" | "sw";
interface Case { text: string; expected: Intent; lang: Lang }

const cases: Case[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // ONBOARD (125) — user wants to start investing / sign up / register
  // ─────────────────────────────────────────────────────────────────────────
  // Direct English
  { text: "I want to invest", expected: "onboard", lang: "en" },
  { text: "I'd like to start investing", expected: "onboard", lang: "en" },
  { text: "Let me invest", expected: "onboard", lang: "en" },
  { text: "I'm ready to invest", expected: "onboard", lang: "en" },
  { text: "Sign me up", expected: "onboard", lang: "en" },
  { text: "Enroll me please", expected: "onboard", lang: "en" },
  { text: "Register me for UTT", expected: "onboard", lang: "en" },
  { text: "Open an account for me", expected: "onboard", lang: "en" },
  { text: "How do I start investing?", expected: "onboard", lang: "en" },
  { text: "How do I open an investment account?", expected: "onboard", lang: "en" },
  { text: "Where do I sign up?", expected: "onboard", lang: "en" },
  { text: "What's the process to invest?", expected: "onboard", lang: "en" },
  { text: "How can I begin?", expected: "onboard", lang: "en" },
  { text: "Where can I register?", expected: "onboard", lang: "en" },
  { text: "I'm ready now", expected: "onboard", lang: "en" },
  { text: "Let's do this", expected: "onboard", lang: "en" },
  { text: "Ok I'm convinced, sign me up", expected: "onboard", lang: "en" },
  { text: "Alright, let me invest", expected: "onboard", lang: "en" },
  { text: "I trust it now — how do I start?", expected: "onboard", lang: "en" },
  { text: "I've decided to invest", expected: "onboard", lang: "en" },
  // With platform
  { text: "I want to buy DSE shares", expected: "onboard", lang: "en" },
  { text: "Sign me up for UTT", expected: "onboard", lang: "en" },
  { text: "I want to open a UTT account", expected: "onboard", lang: "en" },
  { text: "Help me buy treasury bonds", expected: "onboard", lang: "en" },
  { text: "Register me with UTT AMIS", expected: "onboard", lang: "en" },
  { text: "I want to start with the Umoja Fund", expected: "onboard", lang: "en" },
  { text: "Enroll me in DSE", expected: "onboard", lang: "en" },
  { text: "I need a CDS account", expected: "onboard", lang: "en" },
  { text: "Get me a broker", expected: "onboard", lang: "en" },
  { text: "Start me off with T-bills", expected: "onboard", lang: "en" },
  // Beginner framing
  { text: "I've never invested before, help me start", expected: "onboard", lang: "en" },
  { text: "First-time investor, where do I begin?", expected: "onboard", lang: "en" },
  { text: "New to this — how do I get in?", expected: "onboard", lang: "en" },
  { text: "Total beginner, want to invest", expected: "onboard", lang: "en" },
  { text: "I have savings and want to invest them", expected: "onboard", lang: "en" },
  // Question-form
  { text: "How do I get started?", expected: "onboard", lang: "en" },
  { text: "What's the first step to invest?", expected: "onboard", lang: "en" },
  { text: "How much do I need to start?", expected: "onboard", lang: "en" },
  { text: "Can you help me open an account?", expected: "onboard", lang: "en" },
  { text: "What paperwork do I need to invest?", expected: "onboard", lang: "en" },
  // Direct Swahili
  { text: "Nataka kuwekeza", expected: "onboard", lang: "sw" },
  { text: "Nataka kuanza kuwekeza", expected: "onboard", lang: "sw" },
  { text: "Nisaidie kuanza kuwekeza", expected: "onboard", lang: "sw" },
  { text: "Naomba unisajili", expected: "onboard", lang: "sw" },
  { text: "Nataka kufungua akaunti ya uwekezaji", expected: "onboard", lang: "sw" },
  { text: "Nianze usajili", expected: "onboard", lang: "sw" },
  { text: "Nianze vipi kuwekeza?", expected: "onboard", lang: "sw" },
  { text: "Nataka kuweka pesa kwenye UTT", expected: "onboard", lang: "sw" },
  { text: "Nataka kununua hisa", expected: "onboard", lang: "sw" },
  { text: "Nataka kununua bond", expected: "onboard", lang: "sw" },
  { text: "Nataka DSE", expected: "onboard", lang: "sw" },
  { text: "Nataka UTT", expected: "onboard", lang: "sw" },
  { text: "Fungulia akaunti ya uwekezaji", expected: "onboard", lang: "sw" },
  { text: "Vipi kuanza kuwekeza?", expected: "onboard", lang: "sw" },
  { text: "Wapi ninasajili?", expected: "onboard", lang: "sw" },
  { text: "Nianze na UTT tafadhali", expected: "onboard", lang: "sw" },
  { text: "Ninataka kuanza haraka", expected: "onboard", lang: "sw" },
  { text: "Niko tayari kuwekeza", expected: "onboard", lang: "sw" },
  { text: "Nimeamua kuwekeza", expected: "onboard", lang: "sw" },
  { text: "Naomba msaada wa kuanza kuwekeza", expected: "onboard", lang: "sw" },
  // Swahili with intent variations
  { text: "Ninataka kuwa mwekezaji", expected: "onboard", lang: "sw" },
  { text: "Naomba nifungulie akaunti ya DSE", expected: "onboard", lang: "sw" },
  { text: "Nataka kuanza hatifungani", expected: "onboard", lang: "sw" },
  { text: "Ninaomba nianze kuwekeza leo", expected: "onboard", lang: "sw" },
  { text: "Fungua akaunti yangu ya UTT", expected: "onboard", lang: "sw" },
  { text: "Nataka kuwa mmiliki wa hisa", expected: "onboard", lang: "sw" },
  { text: "Ninaomba mchakato wa kuwekeza", expected: "onboard", lang: "sw" },
  { text: "Nataka kujiunga na UTT AMIS", expected: "onboard", lang: "sw" },
  { text: "Nianze kununua hisa za CRDB", expected: "onboard", lang: "sw" },
  { text: "Naomba nianze na T-bills", expected: "onboard", lang: "sw" },
  // Verbose / hesitant → still wants to onboard
  { text: "I've been reading about investing and I think I'm ready to actually try it", expected: "onboard", lang: "en" },
  { text: "After all this info I want to sign up finally", expected: "onboard", lang: "en" },
  { text: "You've convinced me, how do I proceed?", expected: "onboard", lang: "en" },
  { text: "Baada ya kuelewa, ninataka kuanza", expected: "onboard", lang: "sw" },
  { text: "Kwa kuwa nimeelewa, naomba nianze", expected: "onboard", lang: "sw" },
  { text: "I have 500k I want to invest, help", expected: "onboard", lang: "en" },
  { text: "Nina milioni moja, nianze vipi?", expected: "onboard", lang: "sw" },
  { text: "Money saved, ready to invest — walk me through", expected: "onboard", lang: "en" },
  { text: "My salary just came in, I want to invest part of it", expected: "onboard", lang: "en" },
  { text: "Mshahara umeingia, nataka kuwekeza sehemu", expected: "onboard", lang: "sw" },
  // Code-switching
  { text: "Nataka to invest kwenye UTT", expected: "onboard", lang: "sw" },
  { text: "Sign me up kwa DSE tafadhali", expected: "onboard", lang: "en" },
  { text: "How do I anza kuwekeza?", expected: "onboard", lang: "en" },
  { text: "I want kufungua akaunti", expected: "onboard", lang: "en" },
  { text: "Nataka registration", expected: "onboard", lang: "sw" },
  // Typos and informal
  { text: "Nataka kuwkza", expected: "onboard", lang: "sw" },
  { text: "how do i strart investing", expected: "onboard", lang: "en" },
  { text: "wanna invest", expected: "onboard", lang: "en" },
  { text: "let me in", expected: "onboard", lang: "en" },
  { text: "im in, sign me up", expected: "onboard", lang: "en" },
  { text: "naomba nsaidiwe kwnza", expected: "onboard", lang: "sw" },
  { text: "helppp me invest", expected: "onboard", lang: "en" },
  { text: "Take my money — I want to invest", expected: "onboard", lang: "en" },
  { text: "Chukua pesa yangu, nataka kuwekeza", expected: "onboard", lang: "sw" },
  { text: "Where's the form?", expected: "onboard", lang: "en" },
  // Product-specific decision
  { text: "I'll go with UTT", expected: "onboard", lang: "en" },
  { text: "I want the Liquid Fund", expected: "onboard", lang: "en" },
  { text: "DSE for me — sign up", expected: "onboard", lang: "en" },
  { text: "Bonds please", expected: "onboard", lang: "en" },
  { text: "Nachagua UTT — nianze", expected: "onboard", lang: "sw" },
  { text: "Nimechagua DSE", expected: "onboard", lang: "sw" },
  { text: "Umoja Fund iwe njia yangu", expected: "onboard", lang: "sw" },
  { text: "Pension scheme sign up", expected: "onboard", lang: "en" },
  { text: "NSSF voluntary — how?", expected: "onboard", lang: "en" },
  { text: "NISS — nianze vipi?", expected: "onboard", lang: "sw" },
  // Urgent / confident
  { text: "Now — how do I invest?", expected: "onboard", lang: "en" },
  { text: "Right now, get me started", expected: "onboard", lang: "en" },
  { text: "Sasa hivi, nianze", expected: "onboard", lang: "sw" },
  { text: "No more waiting, invest", expected: "onboard", lang: "en" },
  { text: "Kesho asubuhi nianze kuwekeza", expected: "onboard", lang: "sw" },
  { text: "Enroll me today", expected: "onboard", lang: "en" },
  { text: "Book me in for UTT registration", expected: "onboard", lang: "en" },
  { text: "Nisajili leo", expected: "onboard", lang: "sw" },
  { text: "Weka fedha kwenye Umoja Fund", expected: "onboard", lang: "sw" },
  // Family / group
  { text: "I want to invest for my kids", expected: "onboard", lang: "en" },
  { text: "Watoto Fund — sign us up", expected: "onboard", lang: "en" },
  { text: "Nataka kuwekeza kwa ajili ya watoto wangu", expected: "onboard", lang: "sw" },
  { text: "Family fund — how do I set up?", expected: "onboard", lang: "en" },
  { text: "Nataka kufungua akaunti ya mtoto wangu", expected: "onboard", lang: "sw" },
  { text: "Retirement account please", expected: "onboard", lang: "en" },
  { text: "Nataka kuwekeza kwa uzeeni", expected: "onboard", lang: "sw" },
  // Employer-linked
  { text: "My company doesn't have pension — I want NSSF voluntarily", expected: "onboard", lang: "en" },
  { text: "Self-employed — how do I invest?", expected: "onboard", lang: "en" },
  { text: "Mjasiriamali — nianze uwekezaji", expected: "onboard", lang: "sw" },

  // ─────────────────────────────────────────────────────────────────────────
  // SIMULATION (125) — safety / assurance / past growth / demo / challenge
  // ─────────────────────────────────────────────────────────────────────────
  // Safety concerns EN
  { text: "Is my money safe?", expected: "simulation", lang: "en" },
  { text: "Will I lose my money?", expected: "simulation", lang: "en" },
  { text: "Will I lose everything?", expected: "simulation", lang: "en" },
  { text: "What if I lose it all?", expected: "simulation", lang: "en" },
  { text: "How safe is investing here?", expected: "simulation", lang: "en" },
  { text: "How safe is DSE?", expected: "simulation", lang: "en" },
  { text: "Is UTT actually safe?", expected: "simulation", lang: "en" },
  { text: "Can I trust this?", expected: "simulation", lang: "en" },
  { text: "What's the guarantee?", expected: "simulation", lang: "en" },
  { text: "Prove it's safe", expected: "simulation", lang: "en" },
  { text: "I'm scared of losing money", expected: "simulation", lang: "en" },
  { text: "I'm worried about losing my savings", expected: "simulation", lang: "en" },
  { text: "What if the market crashes?", expected: "simulation", lang: "en" },
  { text: "What happens if it goes wrong?", expected: "simulation", lang: "en" },
  { text: "Convince me it's not a scam", expected: "simulation", lang: "en" },
  // Safety concerns SW
  { text: "Pesa zangu ni salama?", expected: "simulation", lang: "sw" },
  { text: "Nitapoteza pesa zangu?", expected: "simulation", lang: "sw" },
  { text: "Najuaje sitopata hasara?", expected: "simulation", lang: "sw" },
  { text: "Naogopa kupoteza pesa", expected: "simulation", lang: "sw" },
  { text: "Naogopa kuwekeza", expected: "simulation", lang: "sw" },
  { text: "DSE ni salama?", expected: "simulation", lang: "sw" },
  { text: "UTT ni salama?", expected: "simulation", lang: "sw" },
  { text: "Kama soko litashuka je?", expected: "simulation", lang: "sw" },
  { text: "Ninajuaje kama ni salama?", expected: "simulation", lang: "sw" },
  { text: "Nionyeshe hii sio ulaghai", expected: "simulation", lang: "sw" },
  { text: "Ni salama kabisa?", expected: "simulation", lang: "sw" },
  { text: "Kama nitawekeza na kupoteza?", expected: "simulation", lang: "sw" },
  { text: "Naogopa hii", expected: "simulation", lang: "sw" },
  { text: "Nataka uhakika", expected: "simulation", lang: "sw" },
  { text: "Ninaogopa hasara", expected: "simulation", lang: "sw" },
  // Past performance / proof EN
  { text: "How has UTT performed?", expected: "simulation", lang: "en" },
  { text: "How has DSE done historically?", expected: "simulation", lang: "en" },
  { text: "Show me past returns", expected: "simulation", lang: "en" },
  { text: "Prove that this works", expected: "simulation", lang: "en" },
  { text: "Give me evidence", expected: "simulation", lang: "en" },
  { text: "Historical returns please", expected: "simulation", lang: "en" },
  { text: "Show me the growth chart", expected: "simulation", lang: "en" },
  { text: "Show me the past prices", expected: "simulation", lang: "en" },
  { text: "What has CRDB done over 10 years?", expected: "simulation", lang: "en" },
  { text: "5-year performance of Umoja Fund", expected: "simulation", lang: "en" },
  { text: "Track record of DSE brokers", expected: "simulation", lang: "en" },
  { text: "Show me proof of growth", expected: "simulation", lang: "en" },
  { text: "Actual returns from last year", expected: "simulation", lang: "en" },
  { text: "How much did people make in UTT last year?", expected: "simulation", lang: "en" },
  { text: "Real numbers, not promises", expected: "simulation", lang: "en" },
  // Past performance / proof SW
  { text: "UTT imefanya vipi?", expected: "simulation", lang: "sw" },
  { text: "DSE imefanyaje kihistoria?", expected: "simulation", lang: "sw" },
  { text: "Onyesha ukuaji wa hisa", expected: "simulation", lang: "sw" },
  { text: "Onyesha faida za zamani", expected: "simulation", lang: "sw" },
  { text: "Onyesha ushahidi wa ukuaji", expected: "simulation", lang: "sw" },
  { text: "Onyesha mifano ya faida halisi", expected: "simulation", lang: "sw" },
  { text: "Nionyeshe bei za nyuma", expected: "simulation", lang: "sw" },
  { text: "Mfuko wa Umoja ulikua vipi mwaka jana?", expected: "simulation", lang: "sw" },
  { text: "Watu walipata kiasi gani UTT mwaka jana?", expected: "simulation", lang: "sw" },
  { text: "Nataka nambari halisi", expected: "simulation", lang: "sw" },
  { text: "Bei za CRDB miaka 5 iliyopita", expected: "simulation", lang: "sw" },
  { text: "Historia ya faida ya DSE", expected: "simulation", lang: "sw" },
  { text: "Onyesha grafu ya ukuaji", expected: "simulation", lang: "sw" },
  { text: "Ninaomba kuona historia", expected: "simulation", lang: "sw" },
  { text: "Rekodi ya utendaji ya UTT", expected: "simulation", lang: "sw" },
  // What-if scenarios
  { text: "What if I'd bought CRDB in 2018?", expected: "simulation", lang: "en" },
  { text: "How much would I have if I'd invested 5 years ago?", expected: "simulation", lang: "en" },
  { text: "If I had put 100k in UTT in 2020, what would I have now?", expected: "simulation", lang: "en" },
  { text: "What if I'd invested my whole salary?", expected: "simulation", lang: "en" },
  { text: "Simulate 1 million shillings over 10 years", expected: "simulation", lang: "en" },
  { text: "Kama ningewekeza mwaka jana, ningepata nini?", expected: "simulation", lang: "sw" },
  { text: "Kama ningeweka 500k UTT 2019 sasa ningepata nini?", expected: "simulation", lang: "sw" },
  { text: "Fanya simulation ya milioni moja kwa miaka 5", expected: "simulation", lang: "sw" },
  { text: "Kama ningenunua Vodacom mwaka 2017?", expected: "simulation", lang: "sw" },
  { text: "Kama ningewekeza mshahara wangu wote?", expected: "simulation", lang: "sw" },
  // Demo / try-before-you-buy
  { text: "Give me a demo first", expected: "simulation", lang: "en" },
  { text: "I want to try before real money", expected: "simulation", lang: "en" },
  { text: "Can I test without real cash?", expected: "simulation", lang: "en" },
  { text: "Practice mode?", expected: "simulation", lang: "en" },
  { text: "Is there a simulator?", expected: "simulation", lang: "en" },
  { text: "Let me play with fake money first", expected: "simulation", lang: "en" },
  { text: "Ninataka kujaribu bila hatari", expected: "simulation", lang: "sw" },
  { text: "Nataka simulation kwanza", expected: "simulation", lang: "sw" },
  { text: "Kuna simulation ninaweza kucheza?", expected: "simulation", lang: "sw" },
  { text: "Nataka kujaribu na pesa za kubuni", expected: "simulation", lang: "sw" },
  // Risk questions (assurance-flavored)
  { text: "Kuna hatari gani?", expected: "simulation", lang: "sw" },
  { text: "Hatari ya kuwekeza DSE ni nini?", expected: "simulation", lang: "sw" },
  { text: "What's the worst that can happen?", expected: "simulation", lang: "en" },
  { text: "Worst-case scenario for UTT?", expected: "simulation", lang: "en" },
  { text: "Mbaya zaidi ni nini kwa UTT?", expected: "simulation", lang: "sw" },
  { text: "Downside of DSE?", expected: "simulation", lang: "en" },
  // Comparison-based assurance
  { text: "Which is safest — UTT or DSE?", expected: "simulation", lang: "en" },
  { text: "Salama zaidi kati ya UTT na DSE?", expected: "simulation", lang: "sw" },
  { text: "Where's the lowest risk?", expected: "simulation", lang: "en" },
  { text: "Wapi hatari ni ndogo zaidi?", expected: "simulation", lang: "sw" },
  { text: "Comparison of returns UTT vs DSE last 5 years", expected: "simulation", lang: "en" },
  // Challenge / DSE Scholar
  { text: "What's the DSE Scholar Challenge?", expected: "simulation", lang: "en" },
  { text: "DSE Scholar ni nini?", expected: "simulation", lang: "sw" },
  { text: "Can I compete in a live-market challenge?", expected: "simulation", lang: "en" },
  { text: "Investment competition?", expected: "simulation", lang: "en" },
  { text: "Kuna shindano la uwekezaji?", expected: "simulation", lang: "sw" },
  { text: "How do I join the DSE challenge?", expected: "simulation", lang: "en" },
  { text: "Nijiunge vipi na shindano la DSE?", expected: "simulation", lang: "sw" },
  { text: "Live market competition sign-up", expected: "simulation", lang: "en" },
  { text: "Trading challenge participation", expected: "simulation", lang: "en" },
  { text: "DSE Scholar registration", expected: "simulation", lang: "en" },
  // Hesitation / needing convincing
  { text: "I'm not sure — show me it works", expected: "simulation", lang: "en" },
  { text: "Convince me before I invest", expected: "simulation", lang: "en" },
  { text: "Sina uhakika — nithibitishie", expected: "simulation", lang: "sw" },
  { text: "Nithibitishie kwanza", expected: "simulation", lang: "sw" },
  { text: "I hesitate — show past performance", expected: "simulation", lang: "en" },
  { text: "Show growth first, then I'll decide", expected: "simulation", lang: "en" },
  { text: "Onyesha kwanza faida, kisha nitaamua", expected: "simulation", lang: "sw" },
  // Volatility / market fears
  { text: "What if the shilling drops?", expected: "simulation", lang: "en" },
  { text: "What about inflation eating my returns?", expected: "simulation", lang: "en" },
  { text: "Mfumuko ukiathiri je?", expected: "simulation", lang: "sw" },
  { text: "Kama shilingi ikishuka?", expected: "simulation", lang: "sw" },
  { text: "Election year — is investing safe?", expected: "simulation", lang: "en" },
  { text: "Mwaka wa uchaguzi — salama?", expected: "simulation", lang: "sw" },
  // Specific past-price queries
  { text: "CRDB price in 2015?", expected: "simulation", lang: "en" },
  { text: "Vodacom share price history", expected: "simulation", lang: "en" },
  { text: "NMB stock past 3 years", expected: "simulation", lang: "en" },
  { text: "Bei ya CRDB 2015?", expected: "simulation", lang: "sw" },
  { text: "Historia ya bei ya Vodacom", expected: "simulation", lang: "sw" },
  // Regret / FOMO framing
  { text: "Wish I had invested earlier — show me what I missed", expected: "simulation", lang: "en" },
  { text: "Late to the party — historical returns?", expected: "simulation", lang: "en" },
  { text: "Nimechelewa — onyesha nilichokosa", expected: "simulation", lang: "sw" },

  // ─────────────────────────────────────────────────────────────────────────
  // ASK (125) — factual / conceptual investing questions
  // ─────────────────────────────────────────────────────────────────────────
  // What is X — English
  { text: "What is UTT?", expected: "ask", lang: "en" },
  { text: "What is DSE?", expected: "ask", lang: "en" },
  { text: "What is CMSA?", expected: "ask", lang: "en" },
  { text: "What is BoT?", expected: "ask", lang: "en" },
  { text: "What is NSSF?", expected: "ask", lang: "en" },
  { text: "What is a unit trust?", expected: "ask", lang: "en" },
  { text: "What is a treasury bond?", expected: "ask", lang: "en" },
  { text: "What is a treasury bill?", expected: "ask", lang: "en" },
  { text: "What is a stock?", expected: "ask", lang: "en" },
  { text: "What is a share?", expected: "ask", lang: "en" },
  { text: "What is a dividend?", expected: "ask", lang: "en" },
  { text: "What is a CDS account?", expected: "ask", lang: "en" },
  { text: "What is NAV?", expected: "ask", lang: "en" },
  { text: "What is IPO?", expected: "ask", lang: "en" },
  { text: "What is a broker?", expected: "ask", lang: "en" },
  { text: "What is diversification?", expected: "ask", lang: "en" },
  { text: "What is compound interest?", expected: "ask", lang: "en" },
  { text: "What is the P/E ratio?", expected: "ask", lang: "en" },
  { text: "What is dividend yield?", expected: "ask", lang: "en" },
  { text: "What is asset allocation?", expected: "ask", lang: "en" },
  { text: "What is a mutual fund?", expected: "ask", lang: "en" },
  { text: "What is a bond coupon?", expected: "ask", lang: "en" },
  { text: "What is market capitalization?", expected: "ask", lang: "en" },
  { text: "What is inflation?", expected: "ask", lang: "en" },
  { text: "What is the yield curve?", expected: "ask", lang: "en" },
  // What is X — Swahili
  { text: "UTT ni nini?", expected: "ask", lang: "sw" },
  { text: "DSE ni nini?", expected: "ask", lang: "sw" },
  { text: "CMSA ni nini?", expected: "ask", lang: "sw" },
  { text: "NSSF ni nini?", expected: "ask", lang: "sw" },
  { text: "Hatifungani ni nini?", expected: "ask", lang: "sw" },
  { text: "Hisa ni nini?", expected: "ask", lang: "sw" },
  { text: "Gawio ni nini?", expected: "ask", lang: "sw" },
  { text: "Mfuko wa pamoja ni nini?", expected: "ask", lang: "sw" },
  { text: "Mseto (diversification) ni nini?", expected: "ask", lang: "sw" },
  { text: "Riba ya jumla ni nini?", expected: "ask", lang: "sw" },
  { text: "P/E ratio ni nini?", expected: "ask", lang: "sw" },
  { text: "IPO ni nini?", expected: "ask", lang: "sw" },
  { text: "Dalali wa hisa ni nani?", expected: "ask", lang: "sw" },
  { text: "Akaunti ya CDS ni nini?", expected: "ask", lang: "sw" },
  { text: "NAV ni nini?", expected: "ask", lang: "sw" },
  // How does X work
  { text: "How does UTT work?", expected: "ask", lang: "en" },
  { text: "How does the DSE actually work?", expected: "ask", lang: "en" },
  { text: "How are dividends paid?", expected: "ask", lang: "en" },
  { text: "How do bond coupons work?", expected: "ask", lang: "en" },
  { text: "How does compound interest work?", expected: "ask", lang: "en" },
  { text: "How are shares priced?", expected: "ask", lang: "en" },
  { text: "How is NAV calculated?", expected: "ask", lang: "en" },
  { text: "How do IPOs work?", expected: "ask", lang: "en" },
  { text: "How do brokers make money?", expected: "ask", lang: "en" },
  { text: "How does the BoT auction work?", expected: "ask", lang: "en" },
  { text: "UTT inafanyaje kazi?", expected: "ask", lang: "sw" },
  { text: "Hatifungani hufanyaje kazi?", expected: "ask", lang: "sw" },
  { text: "Gawio linalipwaje?", expected: "ask", lang: "sw" },
  { text: "Bei ya hisa hupangwaje?", expected: "ask", lang: "sw" },
  { text: "Riba ya jumla hufanyaje kazi?", expected: "ask", lang: "sw" },
  { text: "Minada ya BoT hufanyaje kazi?", expected: "ask", lang: "sw" },
  { text: "Madalali hupata pesa vipi?", expected: "ask", lang: "sw" },
  // Differences / comparisons (conceptual, not safety-framed)
  { text: "What's the difference between shares and bonds?", expected: "ask", lang: "en" },
  { text: "Difference between saving and investing?", expected: "ask", lang: "en" },
  { text: "Bonds vs bills — what's the difference?", expected: "ask", lang: "en" },
  { text: "T-bills vs bonds explained", expected: "ask", lang: "en" },
  { text: "Diff between UTT Liquid and Umoja Fund?", expected: "ask", lang: "en" },
  { text: "What separates a mutual fund from a unit trust?", expected: "ask", lang: "en" },
  { text: "Stocks vs equities — same thing?", expected: "ask", lang: "en" },
  { text: "Tofauti ya hisa na hatifungani ni nini?", expected: "ask", lang: "sw" },
  { text: "Kuweka akiba na kuwekeza tofauti ni nini?", expected: "ask", lang: "sw" },
  { text: "Tofauti ya Liquid Fund na Umoja Fund?", expected: "ask", lang: "sw" },
  { text: "Dhamana fupi na hatifungani tofauti?", expected: "ask", lang: "sw" },
  // Explain / define
  { text: "Explain unit trusts", expected: "ask", lang: "en" },
  { text: "Explain diversification", expected: "ask", lang: "en" },
  { text: "Explain compounding", expected: "ask", lang: "en" },
  { text: "Define IPO", expected: "ask", lang: "en" },
  { text: "Define dividend", expected: "ask", lang: "en" },
  { text: "Define asset class", expected: "ask", lang: "en" },
  { text: "Nielezee mfuko wa pamoja", expected: "ask", lang: "sw" },
  { text: "Nielezee mseto", expected: "ask", lang: "sw" },
  { text: "Nielezee IPO", expected: "ask", lang: "sw" },
  { text: "Nielezee riba ya jumla", expected: "ask", lang: "sw" },
  // Regulatory
  { text: "Who regulates DSE?", expected: "ask", lang: "en" },
  { text: "Who oversees UTT?", expected: "ask", lang: "en" },
  { text: "Is CMSA a government body?", expected: "ask", lang: "en" },
  { text: "What does BoT do?", expected: "ask", lang: "en" },
  { text: "Nani anasimamia DSE?", expected: "ask", lang: "sw" },
  { text: "CMSA ni chombo cha serikali?", expected: "ask", lang: "sw" },
  { text: "BoT hufanya nini?", expected: "ask", lang: "sw" },
  // History / context
  { text: "When was DSE founded?", expected: "ask", lang: "en" },
  { text: "History of UTT AMIS", expected: "ask", lang: "en" },
  { text: "When did Tanzania start unit trusts?", expected: "ask", lang: "en" },
  { text: "DSE ilianzishwa lini?", expected: "ask", lang: "sw" },
  { text: "Historia ya UTT AMIS?", expected: "ask", lang: "sw" },
  // Products / funds specifics
  { text: "Tell me about the Umoja Fund", expected: "ask", lang: "en" },
  { text: "What is the Watoto Fund for?", expected: "ask", lang: "en" },
  { text: "Jikimu Fund — what's it about?", expected: "ask", lang: "en" },
  { text: "Wekeza Maisha explained", expected: "ask", lang: "en" },
  { text: "Umoja Fund inakuwaje?", expected: "ask", lang: "sw" },
  { text: "Watoto Fund ni ya nini?", expected: "ask", lang: "sw" },
  // Fees / taxes / rules
  { text: "What are the fees on DSE trades?", expected: "ask", lang: "en" },
  { text: "Are dividends taxed?", expected: "ask", lang: "en" },
  { text: "Any fees on Umoja Fund?", expected: "ask", lang: "en" },
  { text: "What's the minimum for T-bills?", expected: "ask", lang: "en" },
  { text: "Ada za DSE ni ngapi?", expected: "ask", lang: "sw" },
  { text: "Gawio hutozwa kodi?", expected: "ask", lang: "sw" },
  { text: "Kima cha chini cha T-bills?", expected: "ask", lang: "sw" },
  { text: "Ada za Umoja Fund?", expected: "ask", lang: "sw" },
  // Concept extensions
  { text: "What's a portfolio?", expected: "ask", lang: "en" },
  { text: "What does 'blue chip' mean?", expected: "ask", lang: "en" },
  { text: "What is a bear market?", expected: "ask", lang: "en" },
  { text: "What is a bull market?", expected: "ask", lang: "en" },
  { text: "What is a stop-loss?", expected: "ask", lang: "en" },
  { text: "What is dollar-cost averaging?", expected: "ask", lang: "en" },
  { text: "What is rebalancing?", expected: "ask", lang: "en" },
  { text: "Portfolio ni nini?", expected: "ask", lang: "sw" },
  { text: "Blue chip maana yake?", expected: "ask", lang: "sw" },
  { text: "Soko la kubeba ni nini?", expected: "ask", lang: "sw" },
  { text: "Soko la fahali ni nini?", expected: "ask", lang: "sw" },
  { text: "Rebalancing ni nini?", expected: "ask", lang: "sw" },
  { text: "What does liquidity mean?", expected: "ask", lang: "en" },
  { text: "Ukwasi (liquidity) ni nini?", expected: "ask", lang: "sw" },
  { text: "What is capital gain?", expected: "ask", lang: "en" },
  { text: "Faida ya mtaji ni nini?", expected: "ask", lang: "sw" },
  { text: "What is a maturity date?", expected: "ask", lang: "en" },

  // ─────────────────────────────────────────────────────────────────────────
  // UNKNOWN (125) — off-topic, greetings, tiny replies, chit-chat, other
  // ─────────────────────────────────────────────────────────────────────────
  // Greetings
  { text: "hi", expected: "unknown", lang: "en" },
  { text: "hello", expected: "unknown", lang: "en" },
  { text: "hey there", expected: "unknown", lang: "en" },
  { text: "good morning", expected: "unknown", lang: "en" },
  { text: "good evening", expected: "unknown", lang: "en" },
  { text: "habari", expected: "unknown", lang: "sw" },
  { text: "habari yako", expected: "unknown", lang: "sw" },
  { text: "mambo", expected: "unknown", lang: "sw" },
  { text: "hujambo", expected: "unknown", lang: "sw" },
  { text: "jambo", expected: "unknown", lang: "sw" },
  { text: "shikamoo", expected: "unknown", lang: "sw" },
  { text: "salama", expected: "unknown", lang: "sw" },
  { text: "vipi", expected: "unknown", lang: "sw" },
  // Thanks
  { text: "thanks", expected: "unknown", lang: "en" },
  { text: "thank you", expected: "unknown", lang: "en" },
  { text: "cheers", expected: "unknown", lang: "en" },
  { text: "asante", expected: "unknown", lang: "sw" },
  { text: "asante sana", expected: "unknown", lang: "sw" },
  // Yes / no / short
  { text: "yes", expected: "unknown", lang: "en" },
  { text: "no", expected: "unknown", lang: "en" },
  { text: "ok", expected: "unknown", lang: "en" },
  { text: "alright", expected: "unknown", lang: "en" },
  { text: "sure", expected: "unknown", lang: "en" },
  { text: "nope", expected: "unknown", lang: "en" },
  { text: "ndiyo", expected: "unknown", lang: "sw" },
  { text: "hapana", expected: "unknown", lang: "sw" },
  { text: "sawa", expected: "unknown", lang: "sw" },
  { text: "sawasawa", expected: "unknown", lang: "sw" },
  // Fillers / confusion
  { text: "hmm", expected: "unknown", lang: "en" },
  { text: "uhh", expected: "unknown", lang: "en" },
  { text: "?", expected: "unknown", lang: "en" },
  { text: "???", expected: "unknown", lang: "en" },
  { text: "…", expected: "unknown", lang: "en" },
  { text: "wait", expected: "unknown", lang: "en" },
  { text: "hold on", expected: "unknown", lang: "en" },
  { text: "subiri", expected: "unknown", lang: "sw" },
  { text: "I don't know", expected: "unknown", lang: "en" },
  { text: "sijui", expected: "unknown", lang: "sw" },
  { text: "never mind", expected: "unknown", lang: "en" },
  { text: "not sure", expected: "unknown", lang: "en" },
  { text: "nothing", expected: "unknown", lang: "en" },
  { text: "hakuna", expected: "unknown", lang: "sw" },
  { text: "what?", expected: "unknown", lang: "en" },
  { text: "nini?", expected: "unknown", lang: "sw" },
  // Bye / see you
  { text: "bye", expected: "unknown", lang: "en" },
  { text: "goodbye", expected: "unknown", lang: "en" },
  { text: "kwaheri", expected: "unknown", lang: "sw" },
  { text: "later", expected: "unknown", lang: "en" },
  { text: "see you", expected: "unknown", lang: "en" },
  { text: "tutaonana", expected: "unknown", lang: "sw" },
  // Weather / small talk
  { text: "what's the weather?", expected: "unknown", lang: "en" },
  { text: "will it rain today?", expected: "unknown", lang: "en" },
  { text: "hali ya hewa?", expected: "unknown", lang: "sw" },
  { text: "mvua leo?", expected: "unknown", lang: "sw" },
  { text: "it's hot today", expected: "unknown", lang: "en" },
  { text: "jua kali sana", expected: "unknown", lang: "sw" },
  // Time
  { text: "what time is it?", expected: "unknown", lang: "en" },
  { text: "saa ngapi?", expected: "unknown", lang: "sw" },
  { text: "leo tarehe ngapi?", expected: "unknown", lang: "sw" },
  { text: "date today?", expected: "unknown", lang: "en" },
  // Sports
  { text: "who won the match?", expected: "unknown", lang: "en" },
  { text: "premier league score?", expected: "unknown", lang: "en" },
  { text: "Simba au Yanga?", expected: "unknown", lang: "sw" },
  { text: "football score today", expected: "unknown", lang: "en" },
  // Food
  { text: "what's for dinner?", expected: "unknown", lang: "en" },
  { text: "chakula gani?", expected: "unknown", lang: "sw" },
  { text: "I'm hungry", expected: "unknown", lang: "en" },
  { text: "nina njaa", expected: "unknown", lang: "sw" },
  // Random questions off-topic
  { text: "capital of Kenya?", expected: "unknown", lang: "en" },
  { text: "population of Tanzania?", expected: "unknown", lang: "en" },
  { text: "who is the president?", expected: "unknown", lang: "en" },
  { text: "who wrote Hamlet?", expected: "unknown", lang: "en" },
  { text: "how to bake bread?", expected: "unknown", lang: "en" },
  { text: "cure for headache?", expected: "unknown", lang: "en" },
  { text: "translate this to French", expected: "unknown", lang: "en" },
  { text: "solve 2+2", expected: "unknown", lang: "en" },
  { text: "tell me a joke", expected: "unknown", lang: "en" },
  { text: "sing a song", expected: "unknown", lang: "en" },
  { text: "nini kinyume cha nyeupe?", expected: "unknown", lang: "sw" },
  { text: "rangi za bendera ya Tanzania?", expected: "unknown", lang: "sw" },
  { text: "mji mkuu wa Kenya?", expected: "unknown", lang: "sw" },
  // Personal / meta
  { text: "who are you?", expected: "unknown", lang: "en" },
  { text: "what's your name?", expected: "unknown", lang: "en" },
  { text: "are you a bot?", expected: "unknown", lang: "en" },
  { text: "how are you?", expected: "unknown", lang: "en" },
  { text: "u ok?", expected: "unknown", lang: "en" },
  { text: "jina lako nani?", expected: "unknown", lang: "sw" },
  { text: "wewe ni nani?", expected: "unknown", lang: "sw" },
  { text: "hujambo?", expected: "unknown", lang: "sw" },
  // Complaints / feedback
  { text: "this doesn't work", expected: "unknown", lang: "en" },
  { text: "you're not helpful", expected: "unknown", lang: "en" },
  { text: "bad bot", expected: "unknown", lang: "en" },
  { text: "hii haifanyi kazi", expected: "unknown", lang: "sw" },
  { text: "bot mbovu", expected: "unknown", lang: "sw" },
  // Nonsense / typos
  { text: "asdfghjkl", expected: "unknown", lang: "en" },
  { text: "qwerty", expected: "unknown", lang: "en" },
  { text: "1234567", expected: "unknown", lang: "en" },
  { text: "aaaaaa", expected: "unknown", lang: "en" },
  { text: "test test test", expected: "unknown", lang: "en" },
  { text: "😊", expected: "unknown", lang: "en" },
  { text: "🙏🙏", expected: "unknown", lang: "en" },
  { text: "👍", expected: "unknown", lang: "en" },
  { text: "..:.:", expected: "unknown", lang: "en" },
  { text: "gibberish input", expected: "unknown", lang: "en" },
  // Language switching
  { text: "in English please", expected: "unknown", lang: "en" },
  { text: "kiswahili tafadhali", expected: "unknown", lang: "sw" },
  { text: "translate to Arabic", expected: "unknown", lang: "en" },
  // General life questions off-topic
  { text: "should I get married?", expected: "unknown", lang: "en" },
  { text: "how to lose weight?", expected: "unknown", lang: "en" },
  { text: "best gym in Dar?", expected: "unknown", lang: "en" },
  { text: "recipe for pilau", expected: "unknown", lang: "en" },
  { text: "mchanganyiko wa pilau?", expected: "unknown", lang: "sw" },
  { text: "hospital nearby?", expected: "unknown", lang: "en" },
  { text: "hospitali karibu?", expected: "unknown", lang: "sw" },
  { text: "traffic on Bagamoyo road?", expected: "unknown", lang: "en" },
  { text: "msongamano barabara ya Bagamoyo?", expected: "unknown", lang: "sw" },
  // Bot navigation hints (not full nav words)
  { text: "help", expected: "unknown", lang: "en" },
  { text: "msaada", expected: "unknown", lang: "sw" },
  { text: "options", expected: "unknown", lang: "en" },
  { text: "chaguo", expected: "unknown", lang: "sw" },
  // Requests that don't fit
  { text: "call me", expected: "unknown", lang: "en" },
  { text: "email me the details", expected: "unknown", lang: "en" },
  { text: "send me a PDF", expected: "unknown", lang: "en" },
  { text: "nitumie PDF", expected: "unknown", lang: "sw" },
  { text: "add me to WhatsApp group", expected: "unknown", lang: "en" },
  { text: "nichukue kwenye group", expected: "unknown", lang: "sw" },
  { text: "give me your number", expected: "unknown", lang: "en" },
  // Emotion / one-word reactions
  { text: "wow", expected: "unknown", lang: "en" },
  { text: "cool", expected: "unknown", lang: "en" },
  { text: "nice", expected: "unknown", lang: "en" },
  { text: "great", expected: "unknown", lang: "en" },
  { text: "amazing", expected: "unknown", lang: "en" },
  { text: "nzuri", expected: "unknown", lang: "sw" },
  { text: "poa", expected: "unknown", lang: "sw" },
];

// ─── Runner ────────────────────────────────────────────────────────────────
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// Silence classifier's per-call JSON log lines during the eval — only the
// summary matters. Non-JSON output still passes through.
const origLog = console.log;
console.log = (...args: unknown[]) => {
  const s = args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
  if (s.startsWith("{") && s.includes('"category"')) return;
  origLog(...args);
};

origLog(`Running intent classifier over ${cases.length} cases…`);
const started = performance.now();

const outcomes = await runWithConcurrency(cases, 8, async (c, i) => {
  const r = await classifyIntent(c.text, c.lang);
  if ((i + 1) % 50 === 0) origLog(`  ${i + 1}/${cases.length}`);
  return { ...c, got: r.intent, confident: r.confident };
});

console.log = origLog;
const ms = Math.round(performance.now() - started);

// ─── Report ────────────────────────────────────────────────────────────────
const buckets: Intent[] = ["onboard", "simulation", "ask", "unknown"];
const total = outcomes.length;
const correct = outcomes.filter((o) => o.got === o.expected).length;

console.log(`\nCompleted in ${(ms / 1000).toFixed(1)}s`);
console.log(`Overall accuracy: ${correct}/${total} (${((100 * correct) / total).toFixed(1)}%)\n`);

console.log("Per-bucket accuracy:");
for (const b of buckets) {
  const bucket = outcomes.filter((o) => o.expected === b);
  const hit = bucket.filter((o) => o.got === b).length;
  const pct = bucket.length ? ((100 * hit) / bucket.length).toFixed(1) : "—";
  console.log(`  ${b.padEnd(11)} ${hit}/${bucket.length} (${pct}%)`);
}

console.log("\nPer-language accuracy:");
for (const lang of ["en", "sw"] as const) {
  const bucket = outcomes.filter((o) => o.lang === lang);
  const hit = bucket.filter((o) => o.got === o.expected).length;
  const pct = bucket.length ? ((100 * hit) / bucket.length).toFixed(1) : "—";
  console.log(`  ${lang}          ${hit}/${bucket.length} (${pct}%)`);
}

console.log("\nConfusion matrix (rows = expected, cols = got):");
const header = "expected \\ got".padEnd(16) + buckets.map((b) => b.padEnd(11)).join("");
console.log("  " + header);
for (const exp of buckets) {
  const row = exp.padEnd(16) + buckets.map((got) => {
    const n = outcomes.filter((o) => o.expected === exp && o.got === got).length;
    return String(n).padEnd(11);
  }).join("");
  console.log("  " + row);
}

const mismatches = outcomes.filter((o) => o.got !== o.expected);
if (mismatches.length) {
  console.log(`\nMismatches (${mismatches.length}):`);
  for (const m of mismatches) {
    console.log(`  [expected=${m.expected.padEnd(10)} got=${m.got.padEnd(10)}] (${m.lang}) "${m.text}"`);
  }
}
