// Conversation engine for CFE.Wekeza.
//
// Top-level state machine (the "modes" the user picks up front):
//   1. Education  → the existing Learn / Products / Quiz / Ask sub-menu
//   2. Onboarding → collect data via WhatsApp Flow, submit lead, route to platform URL
//   3. Simulation → deliver growth-simulation or DSE Scholar challenge template
//   4. Ask AI     → free-text tutor grounded in the investment curriculum (Claude)
//
// Each mode has a dedicated tool surface under src/tools/. This file is the
// dispatcher — it does not itself know how a Flow is encrypted or how a template
// is composed, only which tool to call for the current session state.
import { DISCLAIMER, type Lang } from "./content.ts";
import { ACADEMIES, findAcademy, findLevel, findModule, LEVELS, type Loc, type Module } from "./curriculum.ts";
import { QUIZ_BANK, quizResult } from "./quiz.ts";
import { askClaude, claudeEnabled } from "./llm.ts";
import { log } from "./logger.ts";
import type { Session, SessionStore } from "./session.ts";
import type { Sender } from "./whatsapp.ts";
import { backToModesRow, detectLang, sendEducationMenu } from "./tools/education.ts";
import {
  captureFeedback,
  handleFailure as handleOnboardingFailure,
  resolveOnboardingUrl,
  submitLead,
} from "./tools/onboarding.ts";
import {
  sendChallengeTemplate,
  sendNotReadyFallback,
  sendSimulationPicker,
  sendSimulationTemplate,
} from "./tools/simulation.ts";

const L = (en: string, sw: string): Loc => ({ en, sw });

// Copy — no markdown/emoji in body copy.
const S = {
  // Top-level 3-state picker
  modePickTitle: L(
    "Karibu CFE.Wekeza. Chagua unavyotaka kuendelea:",
    "Karibu CFE.Wekeza. Chagua unavyotaka kuendelea:",
  ),
  modePickBody: L(
    "Welcome to CFE.Wekeza. How would you like to proceed?\n\n• Education — read lessons on investing schemes\n• Invest now — start onboarding to a real platform\n• See it grow — try the growth simulation or the DSE Scholar Challenge\n• Ask AI — free-text tutor on any investing question",
    "Karibu CFE.Wekeza. Ungependa kuendelea vipi?\n\n• Elimu — soma masomo ya uwekezaji\n• Anza kuwekeza — jisajili kwenye jukwaa halisi\n• Ona ukuaji — jaribu simuleshi au shindano la DSE Scholar\n• Uliza AI — mwalimu wa maswali yoyote ya uwekezaji",
  ),
  open: L("Open", "Fungua"),
  modeEducation: L("Education", "Elimu"),
  modeOnboarding: L("Invest now", "Anza kuwekeza"),
  modeSimulation: L("See it grow", "Ona ukuaji"),
  modeAsk: L("Ask AI", "Uliza AI"),
  modeEducationDesc: L("Lessons, products, quiz, tutor", "Masomo, bidhaa, jaribio, mwalimu"),
  modeOnboardingDesc: L("Sign up for a real platform", "Jisajili kwa jukwaa halisi"),
  modeSimulationDesc: L("Simulation + DSE Scholar", "Simuleshi + DSE Scholar"),
  modeAskDesc: L("Any investing question, free text", "Swali lolote la uwekezaji, andika"),

  // Education sub-menu labels are owned by tools/education.ts.
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
  backModes: L("Back to modes", "Rudi kwenye hali"),
  educationMenu: L("Education menu", "Menyu ya elimu"),
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
  quizIntro: L("General Quiz — reply A, B or C.", "Jaribio — jibu A, B au C."),
  correct: L("Correct.", "Sahihi."),
  wrong: L("Not quite.", "Sio sahihi."),
  askIntro: L(
    "Ask any question about investing in Tanzania. Type your question, or type 'menu' to go back.\n\nExamples:\n- What is UTT?\n- How do Treasury bonds work?\n- Is the DSE risky?",
    "Uliza swali lolote kuhusu uwekezaji Tanzania. Andika swali lako, au andika 'menyu' kurudi.\n\nMifano:\n- UTT ni nini?\n- Hatifungani hufanyaje kazi?\n- DSE ina hatari?",
  ),
  hint: L("Please choose from the menu, or type 'menu'.", "Tafadhali chagua kwenye menyu, au andika 'menyu'."),
  onboardingThanks: L(
    "Thank you. We have received your details and will help you get started — you'll get a message shortly.",
    "Asante. Tumepokea taarifa zako na tutakusaidia kuanza — utapokea ujumbe hivi karibuni.",
  ),
  continueHere: L("Continue your registration here:", "Endelea usajili wako hapa:"),
  feedbackAsk: L("How was that experience?", "Uzoefu ulikuwaje?"),
  feedbackUp: L("Good", "Nzuri"),
  feedbackDown: L("Not good", "Sio nzuri"),
  feedbackThanks: L("Thanks for the feedback.", "Asante kwa maoni yako."),
  pickLang: L(
    "Chagua lugha / Choose your language:",
    "Chagua lugha / Choose your language:",
  ),
  langSet: L("Language set to English", "Lugha imewekwa: Kiswahili"),
};

const NAV_WORDS = ["menu", "menyu", "main", "start", "anza"];
const EN_GREET = ["hi","what's up", "hello", "hey", "good morning", "good afternoon", "good evening"];
const SW_GREET = ["habari", "Niambie","Nambie","vp","vipi", "kwema","mambo", "jambo", "salama", "niaje", "shikamoo", "hujambo"];
const QUIZ_WORDS = ["quiz", "jaribio"];
const LANG_WORDS = ["lang", "lugha", "language"];

export interface BotOptions {
  launchFlow?: (to: string, moduleId: string, lang: Lang) => Promise<boolean>;
  sendModuleEntry?: (to: string, moduleId: string, lang: Lang) => Promise<boolean>;
  sendAcademyEntry?: (to: string, academyId: string, lang: Lang) => Promise<boolean>;
  // Onboarding: fires the "Invest now" Flow template (CHOOSE → UTT/DSE/coming-soon).
  sendOnboardingEntry?: (to: string, lang: Lang) => Promise<boolean>;
}

export function createBot(store: SessionStore, send: Sender, opts: BotOptions = {}) {
  const { launchFlow, sendModuleEntry, sendAcademyEntry, sendOnboardingEntry } = opts;

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
    btns.push({ id: "go_modes", title: S.backModes[lang] });
    return btns.slice(0, 3);
  }

  // ── mode picker (top-level 3-state chooser) ─────────────────────────────────
  async function sendModePicker(to: string, lang: Lang): Promise<void> {
    await loggedSend({
      to,
      kind: "list",
      body: S.modePickBody[lang],
      listButton: S.open[lang],
      rows: [
        { id: "mode_education", title: S.modeEducation[lang], description: S.modeEducationDesc[lang] },
        { id: "mode_onboarding", title: S.modeOnboarding[lang], description: S.modeOnboardingDesc[lang] },
        { id: "mode_simulation", title: S.modeSimulation[lang], description: S.modeSimulationDesc[lang] },
        { id: "mode_ask", title: S.modeAsk[lang], description: S.modeAskDesc[lang] },
      ],
    });
  }

  async function sendLangPicker(to: string): Promise<void> {
    await loggedSend({
      to,
      kind: "buttons",
      body: S.pickLang.en,
      buttons: [{ id: "lang_sw", title: "Kiswahili" }, { id: "lang_en", title: "English" }],
    });
  }

  // ── education sub-menus ─────────────────────────────────────────────────────
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
        { id: "go_education", title: S.educationMenu[lang] },
        backToModesRow(lang),
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
        { id: "go_education", title: S.educationMenu[lang] },
        backToModesRow(lang),
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
        backToModesRow(lang),
      ].slice(0, 10),
    });
  }

  // ── module screen delivery (message engine) ─────────────────────────────────
  async function sendScreen(to: string, s: Session, lang: Lang): Promise<void> {
    const m = findModule(s.moduleId ?? "");
    if (!m) return await sendEducationMenu(to, lang, loggedSend);
    const lesson = m.lessons[s.lessonIdx];
    const screen = lesson.screens[s.screenIdx];
    const total = m.lessons.reduce((n, l) => n + l.screens.length, 0);
    const pos = m.lessons.slice(0, s.lessonIdx).reduce((n, l) => n + l.screens.length, 0) + s.screenIdx + 1;
    const first = s.lessonIdx === 0 && s.screenIdx === 0;

    const body = `${lesson.title[lang]}  (${pos}/${total})\n\n${screen.body[lang]}`;
    const buttons = first
      ? [{ id: "scr_next", title: S.next[lang] }, { id: "go_modes", title: S.menu[lang] }]
      : [
        { id: "scr_prev", title: S.prev[lang] },
        { id: "scr_next", title: S.next[lang] },
        { id: "go_modes", title: S.menu[lang] },
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

  async function presentModule(to: string, s: Session, id: string, lang: Lang): Promise<void> {
    const m = findModule(id);
    if (!m) return await sendEducationMenu(to, lang, loggedSend);
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
    if (sendModuleEntry && await sendModuleEntry(to, id, lang)) return;
    if (launchFlow && await launchFlow(to, id, lang)) return;
    await sendScreen(to, s, lang);
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
    s.mode = "education";
    s.quizIdx = 0;
    s.score = 0;
    s.quizWrong = [];
    await say(to, S.quizIntro[lang]);
    await sendQuizQuestion(to, s, lang);
  }

  // ── main handler ──────────────────────────────────────────────────────────
  async function handle(from: string, raw: string, meta: { flowData?: Record<string, unknown> } = {}): Promise<void> {
    log("INCOMING", { from, text: raw.slice(0, 300) });
    const s = await store.get(from);
    const text = raw.trim().toLowerCase();
    const save = () => store.set(from, s);

    // ── language commands work anywhere ──
    if (text === "lang_sw" || text === "lang_en") {
      s.lang = text === "lang_sw" ? "sw" : "en";
      s.state = "mode_pick";
      s.mode = null;
      log("ROUTE", { branch: "lang_pick", lang: s.lang, from });
      await save();
      await say(from, S.langSet[s.lang]);
      await sendModePicker(from, s.lang);
      return;
    }
    if (LANG_WORDS.includes(text)) return await sendLangPicker(from);

    // ── greeting: detect language, reset to mode picker ──
    const isSw = SW_GREET.includes(text);
    const isEn = EN_GREET.includes(text);
    if (isSw || isEn) {
      s.lang = isSw ? "sw" : "en";
      s.state = "mode_pick";
      s.mode = null;
      await save();
      await sendModePicker(from, s.lang);
      return;
    }

    // ── first contact, no language set yet ──
    if (!s.lang) {
      const { lang: detected, confident } = await detectLang(raw);
      if (confident) {
        s.lang = detected;
        s.state = "mode_pick";
        s.mode = null;
        await save();
        await sendModePicker(from, s.lang);
        return;
      }
      await sendLangPicker(from);
      await save();
      return;
    }
    const lang = s.lang;

    // ── global nav ──
    if (NAV_WORDS.includes(text) || text === "go_modes") {
      s.state = "mode_pick";
      s.mode = null;
      log("ROUTE", { branch: "mode_pick", from });
      await save();
      return await sendModePicker(from, lang);
    }
    if (QUIZ_WORDS.includes(text)) {
      await startQuiz(from, s, lang);
      await save();
      return;
    }

    // ── mode selection (top-level) ──
    if (text === "mode_education") {
      s.mode = "education";
      s.state = "menu";
      log("ROUTE", { branch: "mode_education", from });
      await save();
      return await sendEducationMenu(from, lang, loggedSend);
    }
    if (text === "mode_onboarding") {
      s.mode = "onboarding";
      s.state = "menu";
      log("ROUTE", { branch: "mode_onboarding", from });
      await save();
      if (sendOnboardingEntry) {
        try {
          const ok = await sendOnboardingEntry(from, lang);
          if (ok) return;
        } catch (err) {
          log("ONBOARDING_SEND_ERROR", { to: from, lang, error: String(err) });
        }
      }
      // Onboarding template not configured — surface a graceful failure.
      return await handleOnboardingFailure(from, "no_template", lang, loggedSend);
    }
    if (text === "mode_simulation") {
      s.mode = "simulation";
      s.state = "simulation_pick";
      log("ROUTE", { branch: "mode_simulation", from });
      await save();
      return await sendSimulationPicker(from, lang, loggedSend);
    }
    if (text === "mode_ask") {
      s.mode = "ask";
      s.state = "ask";
      log("ROUTE", { branch: "mode_ask", from });
      await save();
      return await say(from, S.askIntro[lang]);
    }

    // ── education navigation ──
    if (text === "go_education") {
      s.mode = "education";
      s.state = "menu";
      await save();
      return await sendEducationMenu(from, lang, loggedSend);
    }
    if (text === "j_learn" || text === "go_learn") {
      s.mode = "education";
      s.state = "learn_levels";
      log("ROUTE", { branch: "learn_levels", from });
      await save();
      return await sendLevels(from, lang);
    }
    if (text === "j_products" || text === "go_products") {
      s.mode = "education";
      s.state = "products";
      log("ROUTE", { branch: "products", from });
      await save();
      return await sendAcademies(from, lang);
    }
    if (text === "j_quiz" || text === "go_quiz") {
      log("ROUTE", { branch: "quiz_start", from });
      await startQuiz(from, s, lang);
      await save();
      return;
    }
    if (text === "j_ask") {
      s.mode = "education";
      s.state = "ask";
      log("ROUTE", { branch: "ask_intro", from });
      await save();
      return await say(from, S.askIntro[lang]);
    }

    // ── flow completions ──
    if (text === "flow_complete") {
      log("ROUTE", { branch: "flow_complete", from, moduleId: s.moduleId });
      if (s.moduleId) await sendCompletion(from, s, lang);
      else await sendModePicker(from, lang);
      await save();
      return;
    }
    if (text === "onboarding_done") {
      log("ROUTE", { branch: "onboarding_done", from });
      const raw = meta.flowData ?? {};
      const result = await submitLead(from, raw, lang);
      if (!result.ok) {
        await save();
        return await handleOnboardingFailure(from, result.error ?? "submit_failed", lang, loggedSend);
      }
      s.lastLeadScheme = result.lead.scheme;
      s.state = "onboarding_done";
      await save();
      await say(from, S.onboardingThanks[lang]);
      const url = resolveOnboardingUrl(result.lead.scheme);
      if (url) {
        await say(from, `${S.continueHere[lang]} ${url}`);
        log("ONBOARDING_URL_SENT", { user: from, scheme: result.lead.scheme, url });
      }
      await loggedSend({
        to: from,
        kind: "buttons",
        body: S.feedbackAsk[lang],
        buttons: [
          { id: "fb_up", title: S.feedbackUp[lang] },
          { id: "fb_down", title: S.feedbackDown[lang] },
          { id: "go_modes", title: S.backModes[lang] },
        ],
      });
      return;
    }
    if (text === "fb_up" || text === "fb_down") {
      captureFeedback(from, text === "fb_up" ? "up" : "down");
      await say(from, S.feedbackThanks[lang]);
      s.state = "mode_pick";
      s.mode = null;
      await save();
      return await sendModePicker(from, lang);
    }

    // ── simulation buttons ──
    if (text === "sim_growth") {
      const ok = await sendSimulationTemplate(from, lang);
      if (!ok) await sendNotReadyFallback(from, lang, loggedSend);
      await save();
      return;
    }
    if (text === "sim_challenge") {
      const ok = await sendChallengeTemplate(from, lang);
      if (!ok) await sendNotReadyFallback(from, lang, loggedSend);
      await save();
      return;
    }

    // ── level / academy / module routing ──
    if (text.startsWith("lvl_")) {
      const lv = findLevel(text.slice(4));
      if (lv && lv.modules.length) {
        await presentModule(from, s, lv.modules[0].id, lang);
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
          buttons: [{ id: "go_quiz", title: S.takeQuiz[lang] }, { id: "go_modes", title: S.backModes[lang] }],
        });
      }
      await save();
      return;
    }
    if (text.startsWith("mod_")) {
      const moduleId = text.slice(4);
      log("ROUTE", { branch: "module_open", from, moduleId });
      await presentModule(from, s, moduleId, lang);
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
        log("ROUTE", {
          branch: "quiz_answer",
          from,
          questionIdx: s.quizIdx,
          topic: q.topic,
          picked: idx,
          correct: right,
        });
        await say(from, right ? S.correct[lang] : S.wrong[lang]);
        s.quizIdx += 1;
        if (s.quizIdx >= QUIZ_BANK.length) {
          log("ROUTE", {
            branch: "quiz_complete",
            from,
            score: s.score,
            outOf: QUIZ_BANK.length,
            wrongTopics: s.quizWrong,
          });
          await say(from, quizResult(s.score, s.quizWrong, lang));
          await loggedSend({
            to: from,
            kind: "buttons",
            body: S.moduleDone[lang],
            buttons: [
              { id: "mode_education", title: S.modeEducation[lang] },
              { id: "go_modes", title: S.backModes[lang] },
            ],
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
      log("ROUTE", { branch: "llm_tutor", from, state: s.state, chars: raw.length });
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
