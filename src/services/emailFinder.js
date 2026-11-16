const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const GENERIC_LOCAL_PARTS = [
  "info", "kontakt", "contact", "office", "hello", "hi", "booking",
  "rezervacija", "rezervacije", "admin", "support"
];

export function findPublicEmails(crawl) {
  const candidates = new Set();

  for (const e of crawl.signals.emails || []) candidates.add(clean(e));

  for (const page of crawl.pages) {
    for (const match of page.text.match(EMAIL_RE) || []) candidates.add(clean(match));
    for (const match of page.description.match(EMAIL_RE) || []) candidates.add(clean(match));
  }

  const siteHost = safeHost(crawl.origin);

  const ranked = [...candidates]
    .filter(Boolean)
    .map(email => {
      const [local, domain] = email.split("@");
      let score = 0;

      if (domain === siteHost) score += 60;
      if (GENERIC_LOCAL_PARTS.includes(local.toLowerCase())) score += 25;
      if (!email.includes("example.") && !email.includes("test.")) score += 10;

      const source = findSource(email, crawl);
      if (source) score += 5;

      return {
        email,
        score,
        confidence: Math.min(0.99, score / 100),
        source
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked;
}

function findSource(email, crawl) {
  for (const page of crawl.pages) {
    if (page.text.toLowerCase().includes(email.toLowerCase()) ||
        page.description.toLowerCase().includes(email.toLowerCase()) ||
        page.htmlSignals.mailto.some(x => x.toLowerCase().includes(email.toLowerCase()))) {
      return page.url;
    }
  }
  return null;
}

function clean(e) {
  return e.replace(/^mailto:/i, "").trim().replace(/[),.;]+$/, "").toLowerCase();
}

function safeHost(origin) {
  try { return new URL(origin).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}
