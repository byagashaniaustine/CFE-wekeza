# Wekeza Bot 🪙 — WhatsApp Financial Literacy Chatbot (Tanzania)

A bilingual (Kiswahili/English) WhatsApp chatbot built with **Deno + Hono** that
teaches everyday Tanzanians how to invest, grounded in the **Curriculum for
Certified Financial Educators (CFE)** issued by the Tanzania National Council
for Financial Inclusion (2023).

## What it teaches

| Topic | Source |
|---|---|
| 📘 Investment basics (saving vs investing, risk/return, goals) | CFE03 Money Management |
| 🪙 UTT AMIS unit trusts (Umoja, Liquid, Bond, Watoto, Jikimu, Wekeza Maisha) | uttamis.co.tz |
| 📈 Buying shares on the DSE (CDS account, brokers, Hisa Kiganjani app, ~2.38% fees) | dse.co.tz |
| 🏛️ Government securities (T-bills from TZS 500k, T-bonds from TZS 1M) | bot.go.tz |
| 👵 Pensions & NSSF voluntary scheme (NISS, ~TZS 1,000/day) | nssf.go.tz |
| 🛡️ Scam awareness & CMSA investor protection | cmsa.go.tz, CFE05 |
| 🧠 5-question quiz with explanations | CFE assessment approach |

Users navigate with WhatsApp interactive lists and buttons. Sessions (language,
lesson progress, quiz score) persist in **Deno KV** for 30 days.

## Project structure

```
src/main.ts      Hono server + WhatsApp webhook (GET verify, POST receive)
src/whatsapp.ts  Cloud API client (text / buttons / lists) + webhook parser
src/bot.ts       Conversation engine (language → menu → lessons → quiz)
src/session.ts   Deno KV session store (in-memory store for tests)
src/content.ts   All bilingual lessons + quiz (edit this to update content)
test/bot_test.ts Conversation-flow and content-integrity tests
```

## Setup

### 1. WhatsApp Cloud API
1. Create an app at [developers.facebook.com](https://developers.facebook.com) → type *Business* → add the **WhatsApp** product.
2. From *WhatsApp → API Setup* copy the **Phone Number ID** and generate a **permanent access token** (via a System User in Business Settings).
3. Copy `.env.example` to `.env` and fill in the values.

### 2. Run locally
```bash
deno task dev          # starts on :8000
deno task test         # run the test suite
```
Expose your local server with `cloudflared tunnel` or `ngrok http 8000`, then in
Meta's webhook config set:
- Callback URL: `https://<your-tunnel>/webhook`
- Verify token: value of `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the `messages` webhook field.

### 3. Deploy (Deno Deploy — free tier works)
```bash
deployctl deploy --project=wekeza-bot src/main.ts
```
Set the three env vars in the Deno Deploy dashboard. Deno KV works natively
there. Point the Meta webhook at `https://wekeza-bot.deno.dev/webhook`.

## Using the bot

Send any message (e.g. *habari*) → choose Kiswahili or English → pick topics
from the menu. Commands: `menyu`/`menu`, `jaribio`/`quiz`, `lugha`/`lang`.

## Updating content

All lessons, quiz questions and UI strings live in `src/content.ts`. Keep:
- list-row titles ≤ 24 characters (WhatsApp limit, enforced by tests)
- button titles ≤ 20 characters, max 3 buttons per message
- equal chunk counts in `en` and `sw` (enforced by tests)

Figures (minimums, fees, returns) were researched June 2026 — re-verify
periodically against UTT AMIS, DSE, BoT and CMSA.

## Disclaimer

The bot delivers education, not financial advice, and says so at the end of
every topic. It promotes only CMSA/BoT-regulated channels.
