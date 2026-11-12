// Licensed-provider directory + known-unlicensed list for the Consumer-Protection
// mode. The directory is assembled from two sources:
//
//   1. providers.generated.ts . scraped from the BoT supervised-institutions
//      page (bot.go.tz/BankSupervision/Institutions?lang=en). Covers commercial
//      banks, microfinance banks, DFIs, leasing, community banks, mortgage /
//      housing finance, and bureaux de change. Refresh with
//      `deno task refresh-providers`.
//
//   2. The hand-curated block below . entries the BoT institutions page does
//      not expose: CMSA market intermediaries (brokers / fund managers /
//      advisers / schemes), BoT-licensed mobile-money payment service
//      providers, and BoT-licensed credit reference bureaus. These need to be
//      refreshed manually against the authoritative registers.
//
// The bot never guesses a licence status; it only answers from this directory.

import { BOT_LICENSED } from "./providers.generated.ts";

export interface Provider {
  name: string;
  aka?: string[]; // common short forms / aliases to match on
  category: string; // English
  categorySw: string; // Swahili
  regulator: "CMSA" | "BoT";
}

export interface Flagged {
  name: string;
  aka?: string[];
  reasonEn: string;
  reasonSw: string;
}

// ── Hand-curated additions (CMSA + mobile-money PSPs + credit bureaus) ──────
const MANUAL: Provider[] = [
  // ─ CMSA: securities exchange, collective investment schemes ──────────────
  { name: "UTT AMIS", aka: ["utt", "utt amis", "uttamis", "umoja fund", "watoto fund", "wekeza maisha"], category: "Fund manager / collective investment schemes", categorySw: "Msimamizi wa mifuko / mifuko ya pamoja", regulator: "CMSA" },
  { name: "Dar es Salaam Stock Exchange", aka: ["dse"], category: "Securities exchange", categorySw: "Soko la hisa", regulator: "CMSA" },

  // ─ CMSA: broker-dealers / investment advisers ────────────────────────────
  { name: "Tanzania Securities Limited", aka: ["tsl", "tanzania securities"], category: "Broker-dealer & investment adviser", categorySw: "Dalali & mshauri wa uwekezaji", regulator: "CMSA" },
  { name: "Orbit Securities Company Limited", aka: ["orbit securities", "orbit"], category: "Broker-dealer", categorySw: "Dalali wa hisa", regulator: "CMSA" },
  { name: "Zan Securities Limited", aka: ["zan securities", "zan"], category: "Broker-dealer & investment adviser", categorySw: "Dalali & mshauri wa uwekezaji", regulator: "CMSA" },
  { name: "Core Securities Limited", aka: ["core securities"], category: "Broker-dealer", categorySw: "Dalali wa hisa", regulator: "CMSA" },
  { name: "Solomon Stockbrokers Limited", aka: ["solomon stockbrokers", "solomon"], category: "Broker-dealer", categorySw: "Dalali wa hisa", regulator: "CMSA" },
  { name: "Vertex International Securities Limited", aka: ["vertex securities", "vertex"], category: "Broker-dealer", categorySw: "Dalali wa hisa", regulator: "CMSA" },
  { name: "Victory Financial Services Limited", aka: ["victory financial", "vfs"], category: "Broker-dealer & investment adviser", categorySw: "Dalali & mshauri wa uwekezaji", regulator: "CMSA" },
  { name: "Smart Stock Brokers Limited", aka: ["smart stock brokers"], category: "Broker-dealer", categorySw: "Dalali wa hisa", regulator: "CMSA" },

  // ─ CMSA: fund managers / investment advisers ─────────────────────────────
  { name: "Sanlam Investments East Africa (Tanzania) Limited", aka: ["sanlam", "sanlam investments", "sanlam tanzania"], category: "Fund manager", categorySw: "Msimamizi wa mifuko", regulator: "CMSA" },
  { name: "ICEA LION Asset Management (Tanzania) Limited", aka: ["icea", "icea lion", "icea lion asset management"], category: "Fund manager", categorySw: "Msimamizi wa mifuko", regulator: "CMSA" },
  { name: "Alpha Capital Management Limited", aka: ["alpha capital", "alpha capital management"], category: "Investment adviser", categorySw: "Mshauri wa uwekezaji", regulator: "CMSA" },
  { name: "Watumishi Investment Management Limited", aka: ["watumishi investment", "wumm"], category: "Fund manager", categorySw: "Msimamizi wa mifuko", regulator: "CMSA" },

  // ─ BoT: payment service providers (mobile money under the NPS Act) ───────
  { name: "Vodacom M-Pesa (Tanzania)", aka: ["mpesa", "m-pesa", "m pesa", "vodacom", "vodacom mpesa"], category: "Licensed payment service provider (mobile money)", categorySw: "Mtoa huduma za malipo aliyesajiliwa (pesa za simu)", regulator: "BoT" },
  { name: "Airtel Money Tanzania", aka: ["airtel money", "airtel", "airtel pesa"], category: "Licensed payment service provider (mobile money)", categorySw: "Mtoa huduma za malipo aliyesajiliwa (pesa za simu)", regulator: "BoT" },
  { name: "Mixx by Yas (Tigo Pesa)", aka: ["mixx", "mixx by yas", "tigo pesa", "tigo", "yas"], category: "Licensed payment service provider (mobile money)", categorySw: "Mtoa huduma za malipo aliyesajiliwa (pesa za simu)", regulator: "BoT" },
  { name: "HaloPesa (Halotel)", aka: ["halopesa", "halo pesa", "halotel"], category: "Licensed payment service provider (mobile money)", categorySw: "Mtoa huduma za malipo aliyesajiliwa (pesa za simu)", regulator: "BoT" },
  { name: "Ezy Pesa (Zantel)", aka: ["ezy pesa", "ezypesa", "zantel"], category: "Licensed payment service provider (mobile money)", categorySw: "Mtoa huduma za malipo aliyesajiliwa (pesa za simu)", regulator: "BoT" },
  { name: "TTCL T-Pesa", aka: ["t-pesa", "ttcl pesa", "ttcl"], category: "Licensed payment service provider (mobile money)", categorySw: "Mtoa huduma za malipo aliyesajiliwa (pesa za simu)", regulator: "BoT" },

  // ─ BoT: credit reference bureaus ─────────────────────────────────────────
  { name: "Creditinfo Tanzania Limited", aka: ["creditinfo", "creditinfo tanzania"], category: "Licensed credit reference bureau", categorySw: "Ofisi ya kumbukumbu za mikopo iliyosajiliwa", regulator: "BoT" },
  { name: "Dun & Bradstreet Credit Bureau Tanzania", aka: ["dun bradstreet", "dun and bradstreet", "d&b", "dnb credit bureau"], category: "Licensed credit reference bureau", categorySw: "Ofisi ya kumbukumbu za mikopo iliyosajiliwa", regulator: "BoT" },
];

export const LICENSED: Provider[] = [...BOT_LICENSED, ...MANUAL];

// ── Known unlicensed / flagged (BoT public notices + unapproved digital
//    lending platform list) ────────────────────────────────────────────────
export const FLAGGED: Flagged[] = [
  {
    name: "Leo Beneath London",
    aka: ["leo beneath london"],
    reasonEn: "Never licensed by BoT; subject of legal action for unlicensed deposit-taking (reported Ponzi scheme).",
    reasonSw: "Haikuwahi kupewa leseni na BoT; ilichukuliwa hatua za kisheria kwa kukusanya fedha bila leseni (iliripotiwa kama mpango wa Ponzi).",
  },
];

export const LICENCE_SOURCE_NOTE_EN =
  "Scraped from BoT supervised-institutions register plus hand-curated CMSA / mobile-money / credit-bureau entries. Not exhaustive. If a name is not found, verify on cmsa.go.tz or bot.go.tz.";
export const LICENCE_SOURCE_NOTE_SW =
  "Imetolewa kutoka daftari la BoT la taasisi zilizosajiliwa, pamoja na orodha ya CMSA / pesa za simu / ofisi za kumbukumbu za mikopo. Si kamili. Jina lisipopatikana, thibitisha kwenye cmsa.go.tz au bot.go.tz.";
