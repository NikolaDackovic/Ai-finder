import axios from "axios";
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { URL } from "node:url";

const TIMEOUT = Number(process.env.REQUEST_TIMEOUT_MS || 12000);
const MAX_PAGES = Number(process.env.MAX_PAGES_PER_SITE || 10);

const COMMON_PATHS = [
  "/kontakt",
  "/contact",
  "/o-nama",
  "/about",
  "/usluge",
  "/services",
  "/cenovnik",
  "/cjenovnik",
  "/zakazivanje",
  "/booking",
  "/faq"
];

export async function crawlWebsite(startUrl) {
  const origin = new URL(startUrl).origin;
  const visited = new Set();
  const queue = [normalize(startUrl), ...COMMON_PATHS.map(p => origin + p)];
  const pages = [];
  let robots = null;

  try {
    const robotsUrl = new URL("/robots.txt", origin).toString();
    const robotsResponse = await axios.get(robotsUrl, { timeout: 7000, validateStatus: () => true });
    robots = robotsParser(robotsUrl, robotsResponse.data || "");
  } catch {}

  while (queue.length && pages.length < MAX_PAGES) {
    const url = normalize(queue.shift());
    if (!url || visited.has(url)) continue;
    visited.add(url);

    if (robots && !robots.isAllowed(url, "AI-Prospect-Finder")) continue;

    try {
      const response = await axios.get(url, {
        timeout: TIMEOUT,
        maxContentLength: 3_000_000,
        responseType: "text",
        validateStatus: s => s >= 200 && s < 400,
        headers: {
          "User-Agent": "AI-Prospect-Finder/1.0 (+local human-reviewed prospecting tool)"
        }
      });

      const contentType = String(response.headers["content-type"] || "");
      if (!contentType.includes("text/html")) continue;

      const $ = cheerio.load(response.data);
      $("script,style,noscript,svg").remove();

      const title = $("title").first().text().trim();
      const description = $('meta[name="description"]').attr("content")?.trim() || "";
      const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 30000);

      const links = [];
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        const absolute = toSameOriginUrl(url, href, origin);
        if (absolute && !visited.has(absolute)) links.push(absolute);
      });

      pages.push({
        url,
        title,
        description,
        text,
        htmlSignals: extractHtmlSignals($, response.data),
        links: [...new Set(links)].slice(0, 50)
      });

      for (const link of links) {
        if (queue.length + pages.length >= MAX_PAGES * 3) break;
        if (!queue.includes(link)) queue.push(link);
      }
    } catch {
      // Individual pages are allowed to fail.
    }
  }

  return {
    startUrl,
    origin,
    pages,
    combinedText: pages.map(p => `URL: ${p.url}\nTITLE: ${p.title}\n${p.text}`).join("\n\n").slice(0, 120000),
    signals: mergeSignals(pages)
  };
}

function extractHtmlSignals($, html) {
  const allText = $.root().text().toLowerCase();
  const htmlLower = html.toLowerCase();

  return {
    mailto: $('a[href^="mailto:"]').map((_, e) => $(e).attr("href")).get(),
    tel: $('a[href^="tel:"]').map((_, e) => $(e).attr("href")).get(),
    forms: $("form").length,
    iframeCount: $("iframe").length,
    chatKeywords: [
      "chatwoot", "intercom", "tawk.to", "tidio", "crisp", "zendesk",
      "drift", "livechat", "messenger", "whatsapp", "chatbot"
    ].filter(x => htmlLower.includes(x) || allText.includes(x)),
    bookingKeywords: [
      "booking", "rezerv", "zakaz", "zakazi", "appointment", "termin"
    ].filter(x => allText.includes(x)),
    cms: detectCms(htmlLower)
  };
}

function detectCms(html) {
  const result = [];
  if (html.includes("wp-content") || html.includes("wordpress")) result.push("WordPress");
  if (html.includes("wixstatic") || html.includes("wix.com")) result.push("Wix");
  if (html.includes("webflow")) result.push("Webflow");
  if (html.includes("cdn.shopify.com") || html.includes("shopify")) result.push("Shopify");
  return result;
}

function mergeSignals(pages) {
  const out = {
    emails: [],
    phones: [],
    forms: 0,
    chatKeywords: [],
    bookingKeywords: [],
    cms: []
  };

  for (const p of pages) {
    out.emails.push(...p.htmlSignals.mailto);
    out.phones.push(...p.htmlSignals.tel);
    out.forms += p.htmlSignals.forms;
    out.chatKeywords.push(...p.htmlSignals.chatKeywords);
    out.bookingKeywords.push(...p.htmlSignals.bookingKeywords);
    out.cms.push(...p.htmlSignals.cms);
  }

  return {
    emails: [...new Set(out.emails.map(x => x.replace(/^mailto:/i, "").split("?")[0]))],
    phones: [...new Set(out.phones)],
    forms: out.forms,
    chatKeywords: [...new Set(out.chatKeywords)],
    bookingKeywords: [...new Set(out.bookingKeywords)],
    cms: [...new Set(out.cms)]
  };
}

function toSameOriginUrl(current, href, origin) {
  try {
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return null;
    const u = new URL(href, current);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    if (u.origin !== origin) return null;
    u.hash = "";
    u.search = "";
    return normalize(u.toString());
  } catch {
    return null;
  }
}

function normalize(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
