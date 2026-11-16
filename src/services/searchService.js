import axios from "axios";
import { getRecentlyAnalyzedDomains } from "./historyService.js";

const SERPER_URL = "https://google.serper.dev/search";

const BLOCKED_DOMAINS = new Set([
  "google.com",
  "google.rs",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "wikipedia.org",
  "011info.com",
  "planplus.rs",
  "drbook.rs",
  "booking.dentist",
  "stomatoloskeordinacije.rs",
  "ordinacije.rs",
  "apartmani-u-beogradu.com"
]);

export async function discoverBusinesses({
  category,
  location,
  limit = 20
}) {
  const apiKey = process.env.SERPER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "SERPER_API_KEY nije podešen u .env fajlu."
    );
  }

  const queries = buildQueries({
    category,
    location
  });

  const history =
    await getRecentlyAnalyzedDomains();

  const all = [];

  for (const query of queries) {
    const q = query.q;
    const page = query.page;

    console.log(`[SEARCH] ${q} page=${page}`);

    let response;

    try {
      response = await axios.post(
        SERPER_URL,
        {
          q,
          gl: process.env.SEARCH_COUNTRY || "rs",
          hl: process.env.SEARCH_LANGUAGE || "sr",
          num: 10,
          page
        },
        {
          timeout: 15000,
          headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json"
          }
        }
      );
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;

      console.error("[SEARCH ERROR]");
      console.error("Status:", status);
      console.error("Response:", data);

      if (status === 401) {
        throw new Error(
          "Serper API key nije validan ili nije autorizovan (401)."
        );
      }

      if (status === 403) {
        throw new Error(
          "Serper je odbio zahtev (403). Proveri Serper API key i balance."
        );
      }

      if (status === 429) {
        throw new Error(
          "Serper API rate limit je dostignut (429)."
        );
      }

      throw new Error(
        `Serper request failed${status ? ` (${status})` : ""}: ${
          data?.message ||
          data?.error ||
          error.message
        }`
      );
    }

    for (const item of response.data?.organic || []) {
      if (!item.link) {
        continue;
      }

      const url = normalizeUrl(item.link);
      const domain = getDomain(url);

      if (!domain) {
        continue;
      }

      if (isBlockedDomain(domain)) {
        continue;
      }

      if (history[domain]) {
        console.log(
          `[SEARCH SKIP] recently analyzed: ${domain}`
        );
        continue;
      }

      all.push({
        title: item.title || "",
        url,
        snippet: item.snippet || "",
        sourceQuery: q
      });
    }
  }

  const unique = new Map();

  for (const item of all) {
    const domain = getDomain(item.url);

    if (!domain) {
      continue;
    }

    if (!unique.has(domain)) {
      unique.set(domain, item);
    }
  }

  const candidates = [
    ...unique.values()
  ];

  console.log(
    `[SEARCH RESULT] freshCandidates=${candidates.length} trackedRecently=${Object.keys(history).length}`
  );

  return candidates.slice(
    0,
    Math.max(limit * 5, 30)
  );
}

function buildQueries({
  category,
  location
}) {
  const base = `${category} ${location}`.trim();
  const normalizedCategory = String(category || "").trim();
  const normalizedLocation = String(location || "").trim();

  const querySet = new Set([
    base,
    `${base} kontakt`,
    `${base} email`,
    `${base} cenovnik`,
    `${base} zakazivanje`,
    `${base} usluge`,
    `${base} pregled`,
    `${base} website`,
    `${normalizedCategory} ${normalizedLocation} najbolji`,
    `${normalizedCategory} ${normalizedLocation} ordinacije`,
    `${normalizedCategory} ${normalizedLocation} klinika`,
    `${normalizedCategory} ${normalizedLocation} firma`,
    `${normalizedCategory} ${normalizedLocation} usluge`
  ]);

  const items = [];

  for (const q of querySet) {
    if (!q.trim()) {
      continue;
    }

    items.push({ q, page: 1 });
    items.push({ q, page: 2 });
  }

  return items;
}

function normalizeUrl(raw) {
  try {
    const url = new URL(raw);

    url.hash = "";
    url.search = "";

    return url
      .toString()
      .replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function getDomain(raw) {
  try {
    return new URL(raw)
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

function isBlockedDomain(domain) {
  if (BLOCKED_DOMAINS.has(domain)) {
    return true;
  }

  for (const blocked of BLOCKED_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) {
      return true;
    }
  }

  return false;
}
