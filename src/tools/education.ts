// State 1 — Education tool surface.
//
// Wraps the education-state utilities the bot dispatches to when the user picks
// "Education" from the top-level state picker. Nothing here is new behavior;
// this file exists so bot.ts can call one coherent tool surface per state.
//
// Tools:
//   • detectLang            — language identification (re-exported from lang_detect.ts)
//   • sendEducationMenu     — the 4-row learn/products/quiz/ask sub-menu
//   • sendBackToModesRow    — reusable row builder for "Back to modes" navigation

import type { Lang } from "../content.ts";
import { UI } from "../content.ts";
import type { ListRow, Sender } from "../whatsapp.ts";
import { detectLang } from "../lang_detect.ts";

export { detectLang };
export type { LangDetectResult } from "../lang_detect.ts";

const L = (en: string, sw: string): Record<Lang, string> => ({ en, sw });

const T = {
  open: L("Open", "Fungua"),
  learn: L("Learn Investment", "Jifunze Uwekezaji"),
  products: L("Investment Products", "Bidhaa za Uwekezaji"),
  quiz: L("General Quiz", "Jaribio la Jumla"),
  ask: L("Ask a Question", "Uliza Swali"),
  backModes: L("Back to modes", "Rudi kwenye hali"),
};

export function backToModesRow(lang: Lang): ListRow {
  return { id: "go_modes", title: T.backModes[lang] };
}

export async function sendEducationMenu(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({
    to,
    kind: "list",
    body: UI.welcome[lang],
    listButton: T.open[lang],
    rows: [
      { id: "j_learn", title: T.learn[lang] },
      { id: "j_products", title: T.products[lang] },
      { id: "j_quiz", title: T.quiz[lang] },
      { id: "j_ask", title: T.ask[lang] },
      backToModesRow(lang),
    ],
  });
}
