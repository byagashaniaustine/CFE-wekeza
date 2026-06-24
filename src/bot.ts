// Conversation engine for CFE.Wekeza.
//
// Four journeys from the main menu:
//   1. Learn Investment      → level → module → lesson screens
//   2. Investment Products   → academy → module → lesson screens
//   3. General Quiz          → scored questions + recommendation
//   4. Ask a Question        → free-text AI tutor (claude.ts)
import { DISCLAIMER, type Lang, UI } from "./content.ts";
import { ACADEMIES, findAcademy, findLevel, findModule, LEVELS, type Loc, type Module } from "./curriculum.ts";
import { QUIZ_BANK, quizResult } from "./quiz.ts";
import { askClaude, claudeEnabled, probeLang } from "./claude.ts";
import { detectLang } from "./lang_detect.ts";
import { log } from "./logger.ts";
import type { Session, SessionStore } from "./session.ts";
import type { Sender } from "./whatsapp.ts";

const L = (en: string, sw: string): Loc => ({ en, sw });

// New navigation strings (plain text — no markdown/emoji in body copy).
const S = {
  mainTitle: L("Welcome to CFE.Wekeza. What would you like to do?", "Karibu CFE.Wekeza. Ungependa kufanya nini?"),
  open: L("Open", "Fungua"),
  learn: L("Learn Investment", "Jifunze Uwekezaji"),
  products: L("Investment Products", "Bidhaa za Uwekezaji"),
  quiz: L("General Quiz", "Jaribio la Jumla"),
  ask: L("Ask a Question", "Uliza Swali"),
  chooseLevel: L(
    "Each level guides you through structured lessons. Start at Beginner and progress at your own pace.",
    "Kila kiwango kinakupeleka kupitia masomo yaliyopangwa. Anza Mwanzo na upige hatua kwa kasi yako.",
  ),
  chooseModule: L(
    "Each module covers one focused topic. Tap to open it — lessons take just a few minutes.",
    "Kila moduli inashughulikia mada moja kwa kina. Gusa kuifungua — masomo huchukua dakika chache.",
  ),
  chooseAcademy: L(
    "Learn how each investment product works in Tanzania — from unit trusts to pensions. Pick one.",
    "Jifunza jinsi kila bidhaa ya uwekezaji inavyofanya kazi Tanzania — kuanzia mifuko hadi pensheni. Chagua moja.",
  ),
  back: L("Back", "Rudi"),
  mainMenu: L("Main menu", "Menyu kuu"),
  comingSoon: L(
    "This module is coming soon — more lessons are on the way. Meanwhile, explore the modules that are ready, or ask the tutor a question.",
    "Moduli hii inakuja hivi karibuni — masomo zaidi yanakuja. Kwa sasa, jaribu moduli zilizopo, au uliza mwalimu swali.",
  ),
  next: L("Next", "Endelea"),
  prev: L("Back", "Rudi"),
  menu: L("Menu", "Menyu"),
  moduleDone: L("Module complete. What next?", "Moduli imekamilika. Nini sasa?"),
  whatNext: L("What next?", "Nini sasa?"),
  nextModule: L("Next module", "Moduli ifuatayo"),
  levelDone: L("You have completed this level. Well done!", "Umekamilisha kiwango hiki. Hongera!"),
  takeQuiz: L("Take quiz", "Fanya jaribio"),
  moreModules: L("More modules", "Moduli zaidi"),
  quizIntro: L("General Quiz — reply A, B or C.", "Jaribio — jibu A, B au C."),
  correct: L("Correct.", "Sahihi."),
  wrong: L("Not quite.", "Sio sahihi."),
  askIntro: L(
    "Ask any question about investing in Tanzania. Type your question, or type 'menu' to go back.\n\nExamples:\n- What is UTT?\n- How do Treasury bonds work?\n- Is the DSE risky?",
    "Uliza swali lolote kuhusu uwekezaji Tanzania. Andika swali lako, au andika 'menyu' kurudi.\n\nMifano:\n- UTT ni nini?\n- Hatifungani hufanyaje kazi?\n- DSE ina hatari?",
  ),
  hint: L("Please choose from the menu, or type 'menu'.", "Tafadhali chagua kwenye menyu, au andika 'menyu'."),
};

const NAV_WORDS = ["menu", "menyu", "main", "start", "anza"];
const EN_GREET = ["hi","what's up", "hello", "hey", "good morning", "good afternoon", "good evening"];
const SW_GREET = ["habari", "Niambie","Nambie","vp","vipi", "kwema","mambo", "jambo", "salama", "niaje", "shikamoo", "hujambo"];
const QUIZ_WORDS = ["quiz", "jaribio"];
const LANG_WORDS = ["lang", "lugha", "language"];

export interface BotOptions {
  // Resolve an uploaded WhatsApp media id for a card image (e.g. the menu ad).
  cardMediaId?: (id: string, lang: Lang) => Promise<string | null>;
  // Open a module as a native WhatsApp Flow. Returns true if launched, false to
  // fall back to message screens (e.g. no published Flow id for this module).
  launchFlow?: (to: string, moduleId: string, lang: Lang) => Promise<boolean>;
  // Send a module as a pre-approved WhatsApp template (Flow button + Next quick-reply).
  // Returns true if a template was sent, false to fall back to Flow/message screens.
  sendModuleEntry?: (to: string, moduleId: string, lang: Lang) => Promise<boolean>;
  // Send a product-academy as its approved template. Returns true if sent.
  sendAcademyEntry?: (to: string, academyId: string, lang: Lang) => Promise<boolean>;
}

export function createBot(store: SessionStore, send: Sender, opts: BotOptions = {}) {
  const { cardMediaId, launchFlow, sendModuleEntry, sendAcademyEntry } = opts;

  const loggedSend: Sender = async (msg) => {
    log("REPLY", {
      to: msg.to,
      kind: msg.kind,
      preview: msg.body.slice(0, 120),
      ...(msg.kind === "buttons" && { buttons: msg.buttons?.map((b) => b.title) }),
      ...(msg.kind === "list" && { rows: msg.rows?.map((r) => r.title) }),
    });
    await send(msg);
  };

  const say = (to: string, body: string) => loggedSend({ to, kind: "text", body });

  // ── module sequencing for the linear level/academy walk ─────────────────────
  function currentGroup(s: Session) {
    if (s.academyId) return findAcademy(s.academyId);
    if (s.levelId) return findLevel(s.levelId);
    return undefined;
  } 
  function setGroupFor(s: Session, moduleId: string): void {
    for (const lv of LEVELS) {
      if (lv.modules.some((m) => m.id === moduleId)) { s.levelId = lv.id; s.academyId = null; return; }
    }
    for (const a of ACADEMIES) {
      if (a.modules.some((m) => m.id === moduleId)) { s.academyId = a.id; s.levelId = null; return; }
    }
  }
  function nextModuleId(s: Session): string | null {
    const g = currentGroup(s);
    if (!g || !s.moduleId) return null;
    const i = g.modules.findIndex((m) => m.id === s.moduleId);
    return i >= 0 && i + 1 < g.modules.length ? g.modules[i + 1].id : null;
  }
  function moduleNavButtons(s: Session, lang: Lang) {
    const btns: { id: string; title: string }[] = [];
    if (nextModuleId(s)) btns.push({ id: "nextmod", title: S.nextModule[lang] });
    btns.push({ id: "go_quiz", title: S.takeQuiz[lang] });
    btns.push({ id: "go_main", title: S.mainMenu[lang] });
    return btns.slice(0, 3);
  }

  // ── menu senders ──────────────────────────────────────────────────────────
  async function sendLangPicker(to: string): Promise<void> {
    await loggedSend({
      to,
      kind: "buttons",
      body: `${UI.welcome.sw.split("\n")[0]}\n\n${UI.pickLang.en}`,
      buttons: [{ id: "lang_sw", title: "Kiswahili" }, { id: "lang_en", title: "English" }],
    });
  }

  async function sendMainMenu(to: string, lang: Lang): Promise<void> {
    if (cardMediaId) {
      const id = await cardMediaId("menu", lang);
      if (id) await loggedSend({ to, kind: "image", mediaId: id, body: "CFE.Wekeza" });
    }
    await loggedSend({
      to,
      kind: "list",
      body: UI.welcome[lang],
      listButton: S.open[lang],
      rows: [
        { id: "j_learn", title: S.learn[lang] },
        { id: "j_products", title: S.products[lang] },
        { id: "j_quiz", title: S.quiz[lang] },
        { id: "j_ask", title: S.ask[lang] },
      ],
    });
  }

  async function sendLevels(to: string, lang: Lang): Promise<void> {
    const desc: Record<string, Loc> = {
      beginner:     L("First steps — what investing is and why it matters", "Hatua za kwanza — uwekezaji ni nini na kwa nini"),
      intermediate: L("Build a plan, grow a portfolio, read performance",   "Jenga mpango, kuza mkoba wa uwekezaji, soma utendaji"),
      advanced:     L("Strategies, protection and smart decision-making",   "Mikakati, ulinzi na maamuzi bora ya uwekezaji"),
    };
    await loggedSend({
      to,
      kind: "list",
      body: S.chooseLevel[lang],
      listButton: S.open[lang],
      rows: [
        ...LEVELS.map((lv) => ({ id: `lvl_${lv.id}`, title: lv.short[lang], description: desc[lv.id]?.[lang] })),
        { id: "go_main", title: S.mainMenu[lang] },
      ],
    });
  }

  async function sendAcademies(to: string, lang: Lang): Promise<void> {
    const desc: Record<string, Loc> = {
      utt:    L("Unit trusts from TZS 10,000 — pooled managed funds", "Mifuko ya pamoja kuanzia TZS 10,000"),
      dse:    L("Buy shares in Tanzanian listed companies",            "Nunua hisa za kampuni zilizoorodheshwa DSE"),
      govsec: L("Safe T-bills & bonds backed by the government",      "Dhamana na hatifungani salama za serikali"),
      pension: L("NSSF, PSSSF & retirement saving for all workers",   "NSSF, PSSSF na akiba ya uzeeni kwa wafanyakazi"),
    };
    await loggedSend({
      to,
      kind: "list",
      body: S.chooseAcademy[lang],
      listButton: S.open[lang],
      rows: [
        ...ACADEMIES.map((a) => ({ id: `aca_${a.id}`, title: a.short[lang], description: desc[a.id]?.[lang] })),
        { id: "go_main", title: S.mainMenu[lang] },
      ],
    });
  }

  async function sendModuleList(to: string, lang: Lang, modules: Module[], backId: string): Promise<void> {
    await loggedSend({
      to,
      kind: "list",
      body: S.chooseModule[lang],
      listButton: S.open[lang],
      rows: [
        ...modules.map((m) => ({ id: `mod_${m.id}`, title: m.short[lang] })),
        { id: backId, title: S.back[lang] },
        { id: "go_main", title: S.mainMenu[lang] },
      ].slice(0, 10),
    });
  }

  async function reshowModules(to: string, s: Session, lang: Lang): Promise<void> {
    if (s.academyId) {
      const a = findAcademy(s.academyId);
      if (a) return await sendModuleList(to, lang, a.modules, "go_products");
    }
    if (s.levelId) {
      const lv = findLevel(s.levelId);
      if (lv) return await sendModuleList(to, lang, lv.modules, "go_learn");
    }
    await sendMainMenu(to, lang);
  }

  // ── module screen delivery (message engine) ─────────────────────────────────
  async function sendScreen(to: string, s: Session, lang: Lang): Promise<void> {
    const m = findModule(s.moduleId ?? "");
    if (!m) return await sendMainMenu(to, lang);
    const lesson = m.lessons[s.lessonIdx];
    const screen = lesson.screens[s.screenIdx];
    const total = m.lessons.reduce((n, l) => n + l.screens.length, 0);
    const pos = m.lessons.slice(0, s.lessonIdx).reduce((n, l) => n + l.screens.length, 0) + s.screenIdx + 1;
    const first = s.lessonIdx === 0 && s.screenIdx === 0;

    const body = `${lesson.title[lang]}  (${pos}/${total})\n\n${screen.body[lang]}`;
    const buttons = first
      ? [{ id: "scr_next", title: S.next[lang] }, { id: "go_main", title: S.menu[lang] }]
      : [
        { id: "scr_prev", title: S.prev[lang] },
        { id: "scr_next", title: S.next[lang] },
        { id: "go_main", title: S.menu[lang] },
      ];
    await loggedSend({ to, kind: "buttons", body, buttons });
  }

  async function sendCompletion(to: string, s: Session, lang: Lang): Promise<void> {
    const m = findModule(s.moduleId ?? "");
    const head = m ? `${m.title[lang]}\n\n` : "";
    await loggedSend({
      to,
      kind: "buttons",
      body: `${head}${S.moduleDone[lang]}\n\n${DISCLAIMER[lang]}`,
      buttons: moduleNavButtons(s, lang),
    });
  }

  // Present a module: approved template (Flow + Next) if available, else native
  // Flow, else walk its screens as messages. Drives both direct opens and the walk.
  async function presentModule(to: string, s: Session, id: string, lang: Lang): Promise<void> {
    const m = findModule(id);
    if (!m) return await sendMainMenu(to, lang);
    setGroupFor(s, id);
    s.state = "module";
    s.moduleId = id;
    s.lessonIdx = 0;
    s.screenIdx = 0;
    if (m.status !== "ready" || m.lessons.length === 0) {
      await say(to, S.comingSoon[lang]);
      await loggedSend({ to, kind: "buttons", body: S.whatNext[lang], buttons: moduleNavButtons(s, lang) });
      return;
    }
    if (sendModuleEntry && await sendModuleEntry(to, id, lang)) return; // approved template (Flow + Next baked in)
    if (launchFlow && await launchFlow(to, id, lang)) return; // native Flow fallback
    await sendScreen(to, s, lang); // message-screen fallback
  }

  function advance(s: Session, dir: 1 | -1): "screen" | "done" | "first" {
    const m = findModule(s.moduleId ?? "");
    if (!m) return "done";
    if (dir === 1) {
      const lesson = m.lessons[s.lessonIdx];
      if (s.screenIdx + 1 < lesson.screens.length) s.screenIdx += 1;
      else if (s.lessonIdx + 1 < m.lessons.length) {
        s.lessonIdx += 1;
        s.screenIdx = 0;
      } else return "done";
      return "screen";
    }
    if (s.screenIdx > 0) s.screenIdx -= 1;
    else if (s.lessonIdx > 0) {
      s.lessonIdx -= 1;
      s.screenIdx = m.lessons[s.lessonIdx].screens.length - 1;
    } else return "first";
    return "screen";
  }

  // ── quiz ────────────────────────────────────────────────────────────────────
  async function sendQuizQuestion(to: string, s: Session, lang: Lang): Promise<void> {
    const q = QUIZ_BANK[s.quizIdx];
    const letters = ["A", "B", "C"];
    await loggedSend({
      to,
      kind: "buttons",
      body: `${s.quizIdx + 1}/${QUIZ_BANK.length}  ${q.q[lang]}\n\n` +
        q.options.map((o, i) => `${letters[i]}) ${o[lang]}`).join("\n"),
      buttons: letters.map((ltr, i) => ({ id: `ans_${i}`, title: ltr })),
    });
  }

  async function startQuiz(to: string, s: Session, lang: Lang): Promise<void> {
    s.state = "quiz";
    s.quizIdx = 0;
    s.score = 0;
    s.quizWrong = [];
    await say(to, S.quizIntro[lang]);
    await sendQuizQuestion(to, s, lang);
  }

  // ── main handler ──────────────────────────────────────────────────────────
  async function handle(from: string, raw: string): Promise<void> {
    log("INCOMING", { from, text: raw.slice(0, 300) });
    const s = await store.get(from);
    const text = raw.trim().toLowerCase();
    const save = () => store.set(from, s);

    // Language commands work anywhere.
    if (text === "lang_sw" || text === "lang_en") {
      s.lang = text === "lang_sw" ? "sw" : "en";
      s.state = "menu";
      await save();
      await say(from, UI.langSet[s.lang]);
      await sendMainMenu(from, s.lang);
      return;
    }
    if (LANG_WORDS.includes(text)) return await sendLangPicker(from);

    // Greeting detects language and resets to the main menu.
    const isSw = SW_GREET.includes(text);
    const isEn = EN_GREET.includes(text);
    if (isSw || isEn) {
      s.lang = isSw ? "sw" : "en";
      s.state = "menu";
      await save();
      await sendMainMenu(from, s.lang);
      return;
    }

    // First contact, no language set yet.
    // Tool 1: detect language from user's message.
    // Tool 2: if detection is confident, respond in that language immediately;
    //         otherwise fall back to the manual language picker.
    if (!s.lang) {
      const { lang: detected, confident } = await detectLang(raw);
      if (confident) {
        s.lang = detected;
        s.state = "menu";
        await save();
        await sendMainMenu(from, s.lang);
        return;
      }
      // Ambiguous input — ask explicitly.
      await sendLangPicker(from);
      await save();
      return;
    }
    const lang = s.lang;

    // Global: back to main menu.
    if (NAV_WORDS.includes(text)) {
      s.state = "menu";
      await save();
      await sendMainMenu(from, lang);
      return;
    }
    if (QUIZ_WORDS.includes(text)) {
      await startQuiz(from, s, lang);
      await save();
      return;
    }

    // ── id-based routing (buttons / list rows) ──
    if (text === "j_learn" || text === "go_learn") {
      s.state = "learn_levels";
      await save();
      return await sendLevels(from, lang);
    }
    if (text === "j_products" || text === "go_products") {
      s.state = "products";
      await save();
      return await sendAcademies(from, lang);
    }
    if (text === "j_quiz" || text === "go_quiz") {
      await startQuiz(from, s, lang);
      await save();
      return;
    }
    if (text === "j_ask") {
      s.state = "ask";
      await save();
      return await say(from, S.askIntro[lang]);
    }
    if (text === "go_main") {
      s.state = "menu";
      await save();
      return await sendMainMenu(from, lang);
    }
    // WhatsApp Flow completion — nfm_reply arrives as "flow_complete".
    // The session already has moduleId/levelId set from when the Flow was launched,
    // so surface the post-module navigation (next module / quiz / menu).
    if (text === "flow_complete") {
      if (s.moduleId) {
        await sendCompletion(from, s, lang);
      } else {
        await sendMainMenu(from, lang);
      }
      await save();
      return;
    }
    if (text.startsWith("lvl_")) {
      const lv = findLevel(text.slice(4));
      if (lv && lv.modules.length) {
        await presentModule(from, s, lv.modules[0].id, lang); // start the level walk at module 1
        await save();
        return;
      }
    }
    if (text.startsWith("aca_")) {
      const a = findAcademy(text.slice(4));
      if (a) {
        s.academyId = a.id;
        s.levelId = null;
        s.state = "module";
        s.moduleId = null;
        if (sendAcademyEntry && await sendAcademyEntry(from, a.id, lang)) {
          await save();
          return;
        }
        if (a.modules.length) {
          await presentModule(from, s, a.modules[0].id, lang);
          await save();
          return;
        }
      }
    }
    // Next module in the current level/academy (template Next quick-reply payload, or message button).
    if (text === "nextmod" || text === "go_nextmod") {
      const nid = nextModuleId(s);
      if (nid) {
        await presentModule(from, s, nid, lang);
      } else {
        await say(from, S.levelDone[lang]);
        await loggedSend({
          to: from,
          kind: "buttons",
          body: S.whatNext[lang],
          buttons: [{ id: "go_quiz", title: S.takeQuiz[lang] }, { id: "go_main", title: S.mainMenu[lang] }],
        });
      }
      await save();
      return;
    }
    if (text.startsWith("mod_")) {
      await presentModule(from, s, text.slice(4), lang);
      await save();
      return;
    }

    // ── in-module screen navigation ──
    if (s.state === "module" && (text === "scr_next" || text === "next" || text === "endelea")) {
      const r = advance(s, 1);
      if (r === "done") await sendCompletion(from, s, lang);
      else await sendScreen(from, s, lang);
      await save();
      return;
    }
    if (s.state === "module" && (text === "scr_prev" || text === "back" || text === "rudi")) {
      advance(s, -1);
      await sendScreen(from, s, lang);
      await save();
      return;
    }

    // ── quiz answers ──
    if (s.state === "quiz") {
      let idx = -1;
      if (text.startsWith("ans_")) idx = Number(text.slice(4));
      else if (["a", "b", "c"].includes(text)) idx = "abc".indexOf(text);
      if (idx >= 0 && idx <= 2) {
        const q = QUIZ_BANK[s.quizIdx];
        const right = idx === q.answer;
        if (right) s.score += 1;
        else s.quizWrong.push(q.topic);
        await say(from, right ? S.correct[lang] : S.wrong[lang]);
        s.quizIdx += 1;
        if (s.quizIdx >= QUIZ_BANK.length) {
          await say(from, quizResult(s.score, s.quizWrong, lang));
          await loggedSend({
            to: from,
            kind: "buttons",
            body: S.moduleDone[lang],
            buttons: [{ id: "j_learn", title: S.learn[lang] }, { id: "go_main", title: S.mainMenu[lang] }],
          });
          s.state = "menu";
        } else {
          await sendQuizQuestion(from, s, lang);
        }
        await save();
        return;
      }
    }

    // ── free-text tutor (Ask journey, or any unmatched text) ──
    if (claudeEnabled) {
      const answer = await askClaude(raw.trim(), lang, s.history ?? []);
      if (answer) {
        s.history = [
          ...(s.history ?? []),
          { role: "user" as const, content: raw.trim() },
          { role: "assistant" as const, content: answer },
        ].slice(-20);
        await say(from, answer);
      } else {
        await say(from, S.hint[lang]);
      }
      await save();
      return;
    }

    await say(from, S.hint[lang]);
    await save();
  }

  return { handle };
}

export type Bot = ReturnType<typeof createBot>;
