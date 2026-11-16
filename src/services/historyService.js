import fs from "node:fs/promises";
import path from "node:path";

const HISTORY_FILE = path.join(
  process.cwd(),
  "data",
  "lead-history.json"
);

const COOLDOWN_DAYS = Math.max(
  1,
  Number(process.env.LEAD_COOLDOWN_DAYS || 30)
);

async function ensureHistoryFile() {
  await fs.mkdir(
    path.dirname(HISTORY_FILE),
    { recursive: true }
  );

  try {
    await fs.access(HISTORY_FILE);
  } catch {
    await fs.writeFile(
      HISTORY_FILE,
      JSON.stringify({ version: 1, domains: {} }, null, 2),
      "utf8"
    );
  }
}

async function readHistory() {
  await ensureHistoryFile();

  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return { version: 1, domains: {} };
    }

    if (!parsed.domains || typeof parsed.domains !== "object") {
      parsed.domains = {};
    }

    return parsed;
  } catch {
    return { version: 1, domains: {} };
  }
}

async function writeHistory(history) {
  await ensureHistoryFile();

  const tempFile = `${HISTORY_FILE}.tmp`;

  await fs.writeFile(
    tempFile,
    JSON.stringify(history, null, 2),
    "utf8"
  );

  await fs.rename(tempFile, HISTORY_FILE);
}

function normalizeDomain(domain) {
  return String(domain || "")
    .replace(/^www\./i, "")
    .trim()
    .toLowerCase();
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getRecentlyAnalyzedDomains() {
  const history = await readHistory();
  const now = Date.now();
  const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  const freshDomains = {};

  for (const [rawDomain, entry] of Object.entries(history.domains)) {
    const domain = normalizeDomain(rawDomain);
    const lastAnalyzedAt = parseDate(entry?.lastAnalyzedAt);

    if (!domain || !lastAnalyzedAt) {
      continue;
    }

    if (now - lastAnalyzedAt.getTime() < cooldownMs) {
      freshDomains[domain] = {
        lastAnalyzedAt: lastAnalyzedAt.toISOString(),
        businessName: entry?.businessName || "",
        url: entry?.url || "",
        lastStatus: entry?.lastStatus || "",
        lastScore: Number(entry?.lastScore) || null,
        campaignCategory: entry?.campaignCategory || "",
        email: entry?.email || ""
      };
    }
  }

  if (
    Object.keys(freshDomains).length !==
    Object.keys(history.domains).length
  ) {
    await writeHistory({
      ...history,
      domains: freshDomains
    });
  }

  return freshDomains;
}

export async function wasRecentlyAnalyzed(domain) {
  const domains = await getRecentlyAnalyzedDomains();
  return Boolean(domains[normalizeDomain(domain)]);
}

export async function markLeadAnalyzed({
  domain,
  businessName = "",
  url = "",
  lastStatus = "",
  lastScore = null,
  campaignCategory = "",
  email = ""
}) {
  const normalized = normalizeDomain(domain);

  if (!normalized) {
    return;
  }

  const history = await readHistory();

  history.domains[normalized] = {
    lastAnalyzedAt: new Date().toISOString(),
    businessName: String(businessName || ""),
    url: String(url || ""),
    lastStatus: String(lastStatus || ""),
    lastScore: Number.isFinite(Number(lastScore)) ? Number(lastScore) : null,
    campaignCategory: String(campaignCategory || ""),
    email: String(email || "")
  };

  await writeHistory(history);
}

export async function getHistoryStats() {
  const domains = await getRecentlyAnalyzedDomains();

  return {
    cooldownDays: COOLDOWN_DAYS,
    trackedDomains: Object.keys(domains).length
  };
}
