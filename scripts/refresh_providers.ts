// Refresh src/data/providers.generated.ts from the BoT supervised-institutions
// register. Run with `deno task refresh-providers`.
//
// Source: https://www.bot.go.tz/BankSupervision/Institutions?lang=en
//
// The page is a server-rendered Bootstrap page with one <div class="tab-pane"
// id="nav-{CATEGORY}"> per category. Each pane holds a <table> whose rows look
// like `<tr><th>N.</th><td class="text-left">INSTITUTION NAME</td>...</tr>`.
// We split on panes, pull the first <td> from each row, and emit a typed
// Provider[] grouped by category.
//
// The scraper is intentionally plain regex (no DOM dependency). If BoT changes
// the HTML, failure is loud: no rows extracted -> non-zero exit.

const SOURCE_URL = "https://www.bot.go.tz/BankSupervision/Institutions?lang=en";
const OUT = new URL("../src/data/providers.generated.ts", import.meta.url).pathname;

type CatSpec = {
  category: string;
  categorySw: string;
  comment: string; // section comment in the generated file
};

// Map the BoT tab-pane id suffix -> Provider category metadata.
const CATEGORIES: Record<string, CatSpec> = {
  COMMERCIAL_BANK: {
    category: "Licensed commercial bank",
    categorySw: "Benki ya biashara iliyosajiliwa",
    comment: "Commercial banks",
  },
  MICROFINANCE_BANKS: {
    category: "Licensed microfinance bank",
    categorySw: "Benki ya mikopo midogo iliyosajiliwa",
    comment: "Microfinance banks",
  },
  DEVELOPMENT_FINANCE_INSTITUTIONS: {
    category: "Licensed development finance institution",
    categorySw: "Taasisi ya fedha ya maendeleo iliyosajiliwa",
    comment: "Development finance institutions",
  },
  FINANCIAL_LEASING_COMPANY: {
    category: "Licensed financial leasing company",
    categorySw: "Kampuni ya ukodishaji wa fedha iliyosajiliwa",
    comment: "Financial leasing companies",
  },
  REGIONAL_TOWN_MUNICIPAL: {
    category: "Licensed regional town municipal bank",
    categorySw: "Benki ya manispaa iliyosajiliwa",
    comment: "Regional town municipal banks",
  },
  REGIONAL_TOWN_MUNICIPAL_OUTSIDE_REGINAL_CAPITAL: {
    category: "Licensed community / council bank",
    categorySw: "Benki ya jamii / halmashauri iliyosajiliwa",
    comment: "Community / council banks",
  },
  REGIONAL_TOWN_COUNCIL: {
    category: "Licensed community / council bank",
    categorySw: "Benki ya jamii / halmashauri iliyosajiliwa",
    comment: "Regional town council banks",
  },
  HOUSE_FINANCING_COMPANY: {
    category: "Licensed housing finance company",
    categorySw: "Kampuni ya mikopo ya nyumba iliyosajiliwa",
    comment: "Housing finance companies",
  },
  BureauDeChange: {
    category: "Licensed bureau de change",
    categorySw: "Ofisi ya kubadilisha fedha iliyosajiliwa",
    comment: "Bureaux de change",
  },
};

interface Row { name: string; cat: string }

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Words that stay lowercase in prose-style names (connectors / articles).
const LOWER = new Set(["de", "la", "of", "and", "the", "for", "a", "an", "by", "on", "in", "to", "ni"]);

// Title-case a mostly-UPPERCASE institution name, preserving all-caps acronyms
// (CRDB, NMB, DCB, KCB, TPB, PBZ, I&M, NCBA, NBC, UBA, DTB, SCB, SMC, PLC, LTD).
const ACRONYMS = new Set(["CRDB","NMB","NBC","DCB","KCB","TPB","TCB","PBZ","I&M","NCBA","UBA","DTB","SCB","SMC","PLC","LTD","LLC","TMRC","TADB","TIB","T","II","III","&"]);
function titleCase(upper: string): string {
  return upper.split(/\s+/).map((w, i) => {
    const bare = w.replace(/[.,()]/g, "");
    const bareUp = bare.toUpperCase();
    if (ACRONYMS.has(bareUp)) return bareUp;
    if (/^\d/.test(w)) return w;
    if (i > 0 && LOWER.has(bare.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ").replace(/\bLtd\b/g, "Ltd").replace(/\bPlc\b/g, "PLC").replace(/\bBdc\b/g, "BDC");
}

async function scrape(): Promise<Row[]> {
  console.log(`fetching ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL, { headers: { "user-agent": "cfe-invest-bot/refresh-providers" } });
  if (!res.ok) throw new Error(`fetch ${SOURCE_URL} ${res.status}`);
  const html = await res.text();
  const rows: Row[] = [];
  // Match each tab-pane: `id="nav-{KEY}"` ... until the next tab-pane or closing wrapper.
  const paneRe = /id="nav-([A-Za-z_]+)"[\s\S]*?(?=id="nav-[A-Za-z_]+"|<\/div>\s*<\/div>\s*<\/section>)/g;
  let pane: RegExpExecArray | null;
  while ((pane = paneRe.exec(html)) !== null) {
    const key = pane[1];
    const spec = CATEGORIES[key];
    if (!spec) continue;
    const body = pane[0];
    // Each row: `<tr> <th>N.</th> <td class="text-left">NAME</td> ...`
    const rowRe = /<tr>\s*<th>[\s\S]*?<\/th>\s*<td class="text-left">([\s\S]*?)<\/td>/g;
    let row: RegExpExecArray | null;
    while ((row = rowRe.exec(body)) !== null) {
      const name = stripHtml(row[1]);
      if (name && !/^[.,\s-]*$/.test(name)) rows.push({ name, cat: key });
    }
  }
  return rows;
}

function akaFor(name: string): string[] | undefined {
  const lower = name.toLowerCase();
  const aka: string[] = [];
  const hit = (patterns: RegExp[], aliases: string[]) => {
    if (patterns.some((p) => p.test(lower))) aliases.forEach((a) => !aka.includes(a) && aka.push(a));
  };
  // A small, deliberately-conservative alias map for well-known names. Add here
  // when a new acronym is needed; everything else relies on substring matching.
  hit([/\bcrdb\b/], ["crdb", "crdb bank"]);
  hit([/\bnmb\b|national microfinance bank/], ["nmb", "nmb bank", "national microfinance bank"]);
  hit([/national bank of commerce/], ["nbc", "nbc bank"]);
  hit([/\bstanbic\b/], ["stanbic", "stanbic bank"]);
  hit([/standard chartered/], ["standard chartered", "stanchart", "scb"]);
  hit([/diamond trust/], ["dtb", "diamond trust", "diamond trust bank"]);
  hit([/\bexim\b/], ["exim", "exim bank"]);
  hit([/\bi ?& ?m\b|^i & m bank/], ["i&m", "im bank", "i and m bank"]);
  hit([/\bequity bank\b/], ["equity", "equity bank"]);
  hit([/\bkcb\b/], ["kcb", "kcb bank"]);
  hit([/\babsa\b/], ["absa", "absa bank", "barclays"]);
  hit([/\bciti/], ["citi", "citibank"]);
  hit([/bank of africa/], ["boa", "bank of africa"]);
  hit([/united bank for africa/], ["uba", "united bank for africa"]);
  hit([/\bncba\b/], ["ncba", "ncba bank"]);
  hit([/\baccess bank\b/], ["access", "access bank"]);
  hit([/\bcanara\b/], ["canara", "canara bank"]);
  hit([/bank of baroda/], ["baroda", "bank of baroda"]);
  hit([/bank of india/], ["bank of india", "boi"]);
  hit([/china dasheng/], ["china dasheng", "dasheng bank"]);
  hit([/africa and gulf/], ["africa gulf", "gulf bank", "agb"]);
  hit([/ecobank/], ["ecobank"]);
  hit([/guaranty trust/], ["gtb", "guaranty trust", "gt bank"]);
  hit([/international commercial bank/], ["icb", "international commercial bank"]);
  hit([/tanzania commercial bank/], ["tcb", "tpb", "tanzania postal bank", "tanzania commercial bank"]);
  hit([/peoples? bank of zanzibar/], ["pbz", "peoples bank of zanzibar", "people's bank of zanzibar"]);
  hit([/\bazania\b/], ["azania", "azania bank"]);
  hit([/\bakiba\b/], ["akiba", "akiba commercial"]);
  hit([/\bmkombozi\b/], ["mkombozi", "mkombozi bank"]);
  hit([/\bdcb\b|dar es salaam community bank/], ["dcb", "dcb bank", "dar es salaam community bank"]);
  hit([/\bamana\b/], ["amana", "amana bank"]);
  hit([/\bletshego\b/], ["letshego", "letshego bank", "letshego faidika"]);
  hit([/\bmaendeleo bank\b/], ["maendeleo", "maendeleo bank"]);
  hit([/\bmwalimu\b/], ["mwalimu", "mwalimu bank"]);
  hit([/mwanga hakika/], ["mwanga hakika", "mwanga", "hakika", "mwanga bank"]);
  hit([/\bfinca\b/], ["finca", "finca microfinance", "finca bank"]);
  hit([/visionfund/], ["visionfund", "vision fund", "vision fund tanzania"]);
  hit([/\bselcom\b/], ["selcom", "selcom microfinance", "selcom bank"]);
  hit([/\blolc\b/], ["lolc", "lolc tanzania", "lolc microfinance"]);
  hit([/\bradiance\b/], ["radiance", "radiance microfinance"]);
  hit([/tanzania agricultural development/], ["tadb", "tanzania agricultural development bank", "agricultural development bank"]);
  hit([/\btib development/], ["tib", "tib development", "tib development bank"]);
  hit([/\balios\b/], ["alios", "alios finance"]);
  hit([/\buchumi\b/], ["uchumi", "uchumi commercial bank"]);
  hit([/\bco-?operative bank\b/], ["cooperative bank", "co-operative bank", "cbt"]);
  hit([/\bmucoba\b/], ["mucoba", "mufindi community bank"]);
  hit([/\btandahimba\b/], ["tandahimba", "tandahimba community bank"]);
  hit([/tanzania mortgage refinance/], ["tmrc", "tanzania mortgage refinance"]);
  hit([/first housing/], ["first housing", "first housing finance"]);
  return aka.length ? aka : undefined;
}

// ── Emit ───────────────────────────────────────────────────────────────────

function emit(rows: Row[]): string {
  const byCat = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byCat.has(r.cat)) byCat.set(r.cat, []);
    byCat.get(r.cat)!.push(r);
  }
  const lines: string[] = [];
  lines.push("// AUTO-GENERATED. Do not edit by hand.");
  lines.push("//");
  lines.push(`// Source : ${SOURCE_URL}`);
  lines.push("// Refresh: deno task refresh-providers");
  lines.push("//");
  lines.push(`// ${rows.length} entries scraped from the Bank of Tanzania supervised-institutions`);
  lines.push("// page, grouped by regulator-published category. Hand-maintained additions");
  lines.push("// (CMSA fund managers, mobile-money PSPs, credit reference bureaus) live in");
  lines.push("// providers.ts and are merged with this list at import time.");
  lines.push("");
  lines.push(`import type { Provider } from "./providers.ts";`);
  lines.push("");
  lines.push("const BoT = \"BoT\" as const;");
  lines.push("");
  lines.push("export const BOT_LICENSED: Provider[] = [");
  for (const [catKey, catRows] of byCat) {
    const spec = CATEGORIES[catKey];
    lines.push(`  // ─ ${spec.comment} (${catRows.length}) ─`);
    for (const r of catRows) {
      const name = titleCase(r.name);
      const aka = akaFor(name);
      const akaLit = aka ? `aka: ${JSON.stringify(aka)}, ` : "";
      lines.push(`  { name: ${JSON.stringify(name)}, ${akaLit}category: ${JSON.stringify(spec.category)}, categorySw: ${JSON.stringify(spec.categorySw)}, regulator: BoT },`);
    }
  }
  lines.push("];");
  lines.push("");
  return lines.join("\n");
}

if (import.meta.main) {
  const rows = await scrape();
  if (rows.length < 50) throw new Error(`scrape returned ${rows.length} rows, expected > 50 . HTML structure may have changed`);
  const src = emit(rows);
  await Deno.writeTextFile(OUT, src);
  console.log(`wrote ${rows.length} entries to ${OUT}`);
}
