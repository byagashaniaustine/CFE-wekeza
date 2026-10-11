# Consumer-Protection mode — integration guide

A new top-level mode (the scam shield), bilingual EN/SW. Three capabilities:
**Verify a licence**, **Scan a message** (risk scoring), **Spot a scam** (tips).

Files added:
- `src/data/providers.ts` — licensed directory + known-unlicensed list (SEED from
  CMSA/BoT public lists; swap for their register export in production).
- `src/tools/consumer.ts` — menu, `verifyLicence()`, `scanMessage()` scoring, and
  bilingual formatters + `replyVerify()` / `replyScan()` handlers.
- `src/session.ts` — already updated: `Mode` gains `"consumer"`; `BotState` gains
  `consumer_menu | consumer_verify_wait | consumer_scan_wait`.

## Wire into bot.ts

```ts
import {
  sendConsumerMenu, promptVerify, promptScan, sendTips,
  replyVerify, replyScan, CONSUMER_IDS,
} from "./tools/consumer.ts";

// 1) Mode picker — add a row (id e.g. "mode_consumer"). When chosen:
session.mode = "consumer";
session.state = "consumer_menu";
await sendConsumerMenu(user, lang, send);

// 2) Router — handle the consumer mode:
if (session.mode === "consumer") {
  // menu selections (interactive list replies arrive as the row id)
  if (session.state === "consumer_menu") {
    if (input === CONSUMER_IDS.verify) { session.state = "consumer_verify_wait"; await promptVerify(user, lang, send); }
    else if (input === CONSUMER_IDS.scan) { session.state = "consumer_scan_wait"; await promptScan(user, lang, send); }
    else if (input === CONSUMER_IDS.tips) { await sendTips(user, lang, send); await sendConsumerMenu(user, lang, send); }
    else if (input === CONSUMER_IDS.back) { session.mode = null; session.state = "mode_pick"; /* show mode picker */ }
    return;
  }
  // free-text steps
  if (session.state === "consumer_verify_wait") {
    await replyVerify(user, lang, input, send);
    session.state = "consumer_menu"; await sendConsumerMenu(user, lang, send); return;
  }
  if (session.state === "consumer_scan_wait") {
    await replyScan(user, lang, input, send);
    session.state = "consumer_menu"; await sendConsumerMenu(user, lang, send); return;
  }
}
```

## content.ts — mode-picker label

```ts
consumerMode: { en: "Consumer Protection", sw: "Ulinzi wa Mteja" },
```

## Notes
- `scanMessage()` is an **indicative** risk signal (High/Medium/Low), never a
  guarantee; a `not_found` licence is explicitly **not** "safe".
- The bot answers licence questions **only** from `providers.ts` — it never lets
  the LLM assert licence status. (Optional: after the heuristic scan you may pass
  the message to the existing `llm.ts` tutor for an extra explanation, grounded by
  the flags already found — keep the heuristic as the authority.)
- Messages scanned are not retained.
- Refresh `providers.ts` from the official CMSA/BoT lists until the register
  integration (phase 2) is in place.

## Verified
Logic tested (EN + SW): scams → HIGH, benign → LOW, licence lookups →
licensed / flagged / not_found. Run `deno task test` after wiring.
