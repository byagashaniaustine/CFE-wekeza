# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
deno task dev      # Development with hot reload on :8000
deno task start    # Production run
deno task test     # Run all tests
deno task check    # Type-check only
```

To run a single test file: `deno test --allow-env --unstable-kv test/bot_test.ts`

## Architecture

**Wekeza Bot** is a bilingual (Swahili/English) WhatsApp chatbot teaching financial literacy. Built with Deno + Hono, using Meta WhatsApp Cloud API v21.0.

The bot has four journeys from the main menu: (1) Learn Investment → level → module → lesson screens; (2) Investment Products → academy → module → lesson screens; (3) General Quiz; (4) Ask a Question (AI tutor).

### Module responsibilities

| File | Purpose |
|------|---------|
| `src/main.ts` | Hono server; `GET/POST /webhook` (Meta) and `POST /flow` (encrypted WhatsApp Flows data-exchange). Per-user queue serialises handling. Builds the card-media + flow launchers and injects them into the bot. |
| `src/bot.ts` | Conversation router/state machine over the curriculum. `createBot(store, send, { cardMediaId?, launchFlow? })`. |
| `src/curriculum.ts` | Bilingual content model: `LEVELS` (Beginner/Intermediate/Advanced) and `ACADEMIES` (UTT, DSE, Govt Securities, Pension). Hierarchy: Level/Academy → Module → Lesson → Screen. Each module has a `short` title (≤20) for buttons/rows and a `status` (`ready`/`coming_soon`). |
| `src/quiz.ts` | `QUIZ_BANK` (bilingual, topic-tagged) + `quizResult()` (score, weak areas, recommended module). |
| `src/flow.ts` | WhatsApp Flows: RSA+AES-GCM `createFlowEndpoint()`, the `processFlow()` screen navigator, and `MODULE_FLOW_JSON` to publish in Meta. |
| `src/whatsapp.ts` | Meta Graph client + `parseWebhook`. Message kinds: text, buttons (optional image header), list, image, flow. `createMediaUploader()` uploads card PNGs → reusable media ids. |
| `src/session.ts` | `createKvStore()` (Deno KV, 30-day TTL) and `createMemoryStore()` (tests). |
| `src/content.ts` | Legacy flat lessons (superseded by `curriculum.ts`) plus shared UI strings (`UI`, `DISCLAIMER`) still used by the bot. |

### Data flow

```
WhatsApp user → Meta Cloud API webhook POST /webhook
  → parseWebhook() → bot.handle(userId, text)   (per-user queue)
  → session lookup/update (Deno KV)
  → curriculum/quiz lookup → response message → Meta Graph API POST /messages
WhatsApp Flow (if enabled) → POST /flow → decrypt → processFlow() → encrypt → reply
```

### Session shape

```typescript
{ lang: "en" | "sw" | null,
  state: "new" | "menu" | "learn_levels" | "learn_modules" |
         "products" | "products_modules" | "module" | "quiz" | "ask",
  levelId, academyId, moduleId: string | null,
  lessonIdx, screenIdx, quizIdx, score: number,
  quizWrong: string[], history: {role, content}[] }
```

### Content constraints (enforced by tests)

- Module/level/academy `short` titles ≤ 20 characters (button/row safe)
- Lesson screen bodies < 1024 characters (interactive body limit)
- Every bilingual field has both `en` and `sw`
- `ready` modules must have at least one lesson

When modifying `curriculum.ts` or `quiz.ts`, run `deno task test` to verify these constraints pass.

## Environment

Copy `.env.example` to `.env` and fill in:
- `WHATSAPP_TOKEN` — permanent Meta access token
- `WHATSAPP_PHONE_ID` — WhatsApp business phone number ID
- `WHATSAPP_VERIFY_TOKEN` — arbitrary secret for webhook verification

For local testing, expose port 8000 with `cloudflared tunnel http 8000` or `ngrok http 8000`, then set the callback URL in Meta's webhook settings to `https://<tunnel>/webhook`.
