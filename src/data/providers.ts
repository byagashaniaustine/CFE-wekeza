// Licensed-provider directory + known-unlicensed list for the Consumer-Protection
// mode. This is a SEED, built from the public lists the regulators publish:
//   • CMSA — licensed market intermediaries (brokers/dealers, investment
//     advisers, fund managers, collective investment schemes, custodians).
//   • BoT — list of licensed banks & financial institutions, and the list of
//     UNAPPROVED digital lending platforms.
//
// It is intentionally swappable: in production this file is replaced by (or
// generated from) BoT / CMSA's own register export, so verification is their
// authoritative, always-current data. Entries below are labelled as a seed and
// must be refreshed against the official lists — the bot never guesses a
// licence status; it only answers from this directory.

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

// ── Licensed (SEED — verify against the current CMSA/BoT lists) ───────────────
export const LICENSED: Provider[] = [
  { name: "UTT AMIS", aka: ["utt", "utt amis", "uttamis", "umoja fund", "watoto fund", "wekeza maisha"], category: "Fund manager / collective investment schemes", categorySw: "Msimamizi wa mifuko / mifuko ya pamoja", regulator: "CMSA" },
  { name: "Dar es Salaam Stock Exchange", aka: ["dse"], category: "Securities exchange", categorySw: "Soko la hisa", regulator: "CMSA" },
  { name: "Tanzania Securities Limited", aka: ["tsl", "tanzania securities"], category: "Broker-dealer & investment adviser", categorySw: "Dalali & mshauri wa uwekezaji", regulator: "CMSA" },
  { name: "Orbit Securities Company Limited", aka: ["orbit securities", "orbit"], category: "Broker-dealer", categorySw: "Dalali wa hisa", regulator: "CMSA" },
  { name: "Zan Securities Limited", aka: ["zan securities", "zan"], category: "Broker-dealer & investment adviser", categorySw: "Dalali & mshauri wa uwekezaji", regulator: "CMSA" },
  { name: "Core Securities Limited", aka: ["core securities"], category: "Broker-dealer", categorySw: "Dalali wa hisa", regulator: "CMSA" },
  { name: "Solomon Stockbrokers Limited", aka: ["solomon stockbrokers", "solomon"], category: "Broker-dealer", categorySw: "Dalali wa hisa", regulator: "CMSA" },
  { name: "Vertex International Securities Limited", aka: ["vertex securities", "vertex"], category: "Broker-dealer", categorySw: "Dalali wa hisa", regulator: "CMSA" },
  { name: "Victory Financial Services Limited", aka: ["victory financial", "vfs"], category: "Broker-dealer & investment adviser", categorySw: "Dalali & mshauri wa uwekezaji", regulator: "CMSA" },
  { name: "Smart Stock Brokers Limited", aka: ["smart stock brokers"], category: "Broker-dealer", categorySw: "Dalali wa hisa", regulator: "CMSA" },
  { name: "CRDB Bank PLC", aka: ["crdb"], category: "Licensed bank", categorySw: "Benki iliyosajiliwa", regulator: "BoT" },
  { name: "National Microfinance Bank", aka: ["nmb", "nmb bank"], category: "Licensed bank", categorySw: "Benki iliyosajiliwa", regulator: "BoT" },
  { name: "National Bank of Commerce", aka: ["nbc"], category: "Licensed bank", categorySw: "Benki iliyosajiliwa", regulator: "BoT" },
];

// ── Known unlicensed / flagged (SEED — feeds from BoT public notices &
//    the BoT list of unapproved digital lending platforms) ────────────────────
export const FLAGGED: Flagged[] = [
  {
    name: "Leo Beneath London",
    aka: ["leo beneath london"],
    reasonEn: "Never licensed by BoT; subject of legal action for unlicensed deposit-taking (reported Ponzi scheme).",
    reasonSw: "Haikuwahi kupewa leseni na BoT; ilichukuliwa hatua za kisheria kwa kukusanya fedha bila leseni (iliripotiwa kama mpango wa Ponzi).",
  },
];

export const LICENCE_SOURCE_NOTE_EN =
  "Seed directory from CMSA & BoT public lists. Not exhaustive — if a name is not found, verify on cmsa.go.tz or bot.go.tz. Production source: BoT/CMSA register.";
export const LICENCE_SOURCE_NOTE_SW =
  "Orodha ya awali kutoka CMSA & BoT. Si kamili — jina lisipopatikana, thibitisha kwenye cmsa.go.tz au bot.go.tz. Chanzo cha uzalishaji: daftari la BoT/CMSA.";
