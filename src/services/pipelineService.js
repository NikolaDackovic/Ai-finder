import { discoverBusinesses } from "./searchService.js";
import { crawlWebsite } from "./crawlerService.js";
import { findPublicEmails } from "./emailFinder.js";
import { analyzeLead } from "./aiService.js";
import { deterministicChecks } from "./leadScoring.js";
import {
generateEmail,
generateHtmlEmail
} from "./templateService.js";
import { saveLead } from "./leadStorage.js";
import { markLeadAnalyzed } from "./historyService.js";
import {
log,
warn
} from "../utils/logger.js";

export async function runCampaign({
category,
location,
limit = 20,
minScore = 70,
onProgress = null
}) {
const campaign = {
category,
location,
limit,
minScore,
startedAt: new Date().toISOString()
};

log(
"CAMPAIGN START:",
`${category} | ${location} | limit=${limit} | minScore=${minScore}`
);

const candidates = await discoverBusinesses({
category,
location,
limit
});

const results = [];
const seen = new Set();
const errors = [];

let analyzed = 0;
let qualified = 0;
let review = 0;
let skipped = 0;
let failed = 0;
let processed = 0;

async function reportProgress(extra = {}) {
if (typeof onProgress !== "function") {
return;
}

const snapshot = buildCampaignResult({
  campaign,
  candidates,
  results,
  errors,
  analyzed,
  qualified,
  review,
  skipped,
  failed,
  processed,
  finishedAt: null
});

await onProgress({
  ...snapshot,
  ...extra
});

}

await reportProgress();

for (const candidate of candidates) {
if (results.length >= limit) {
break;
}

processed++;

const url = candidate?.url;

if (!url) {
  skipped++;

  await reportProgress({
    latestError: {
      url: null,
      message: "Kandidat nema URL."
    }
  });

  continue;
}

const domain = safeDomain(url);

if (!domain) {
  warn(
    "Invalid URL:",
    url
  );

  skipped++;

  await reportProgress({
    latestError: {
      url,
      message: "Neispravan URL."
    }
  });

  continue;
}

if (seen.has(domain)) {
  continue;
}

seen.add(domain);

log(
  "Analyzing:",
  url
);

try {
  // ==================================================
  // CRAWL
  // ==================================================

  const crawl =
    await crawlWebsite(url);

  if (
    !crawl ||
    !Array.isArray(crawl.pages) ||
    crawl.pages.length === 0
  ) {
    warn(
      "No crawlable pages:",
      url
    );

    skipped++;

    await reportProgress({
      latestError: {
        url,
        message: "Nema crawlable stranica."
      }
    });

    continue;
  }

  log(
    "Crawled:",
    url,
    `pages=${crawl.pages.length}`
  );

  // ==================================================
  // EMAIL DISCOVERY
  // ==================================================

  const emailCandidates =
    findPublicEmails(crawl);

  const checks =
    deterministicChecks({
      crawl,
      emailCandidates
    });

  if (
    !checks?.hasEmail
  ) {
    warn(
      "No public email:",
      url
    );

    skipped++;

    await reportProgress({
      latestError: {
        url,
        message: "Nema javnog emaila."
      }
    });

    continue;
  }

  log(
    "Public email found:",
    url,
    `count=${emailCandidates.length}`
  );

  // ==================================================
  // AI ANALYSIS
  // ==================================================

  const analysis =
    await analyzeLead({
      business: candidate,
      crawl,
      emailCandidates,
      campaign
    });

  analyzed++;

  // ==================================================
  // SCORE
  // ==================================================

  let score =
    Number(
      analysis?.leadScore
    );

  if (
    !Number.isFinite(score)
  ) {
    warn(
      "Invalid AI score:",
      url,
      analysis?.leadScore
    );

    score = 0;
  }

  score =
    Math.max(
      0,
      Math.min(
        100,
        score
      )
    );

  const isQualified =
    score >= minScore;

  if (isQualified) {
    qualified++;

    log(
      "QUALIFIED:",
      url,
      `score=${score}`
    );
  } else {
    review++;

    log(
      "REVIEW:",
      url,
      `score=${score}`
    );
  }

  // ==================================================
  // PRIMARY EMAIL
  // ==================================================

  const primaryEmail =
    emailCandidates[0];

  if (
    !primaryEmail?.email
  ) {
    skipped++;

    await reportProgress({
      latestError: {
        url,
        message:
          "Primarni email kandidat nije validan."
      }
    });

    continue;
  }

  // ==================================================
  // IDENTITY
  // ==================================================

  const identity = {
    yourName:
      process.env.YOUR_NAME || "",

    yourCompany:
      process.env.YOUR_COMPANY || "",

    yourWebsite:
      process.env.YOUR_WEBSITE || "",

    yourEmail:
      process.env.YOUR_EMAIL || "",

    yourPhone:
      process.env.YOUR_PHONE || ""
  };

  // ==================================================
  // PLAIN TEXT EMAIL
  // ==================================================

  log(
    "EMAIL TEXT START:",
    url
  );

  const generatedText =
    await generateEmail({
      analysis,
      campaign,
      identity
    });

  log(
    "EMAIL TEXT OK:",
    url
  );

  // ==================================================
  // HTML EMAIL
  // ==================================================

  log(
    "EMAIL HTML START:",
    url
  );

  const generatedHtml =
    generateHtmlEmail({
      analysis,
      campaign,
      identity
    });

  if (
    typeof generatedHtml !== "string" ||
    !generatedHtml.trim()
  ) {
    throw new Error(
      "HTML email nije generisan."
    );
  }

  log(
    "EMAIL HTML OK:",
    url
  );

  // ==================================================
  // ENRICHED ANALYSIS
  // ==================================================

  const enrichedAnalysis = {
    ...analysis,

    leadScore:
      score,

    qualification: {
      status:
        isQualified
          ? "qualified"
          : "review",

      minScore,

      score
    }
  };

  // ==================================================
  // SAVE LEAD
  // ==================================================

  log(
    "SAVE LEAD START:",
    url
  );

  const folder =
    await saveLead({
      lead: candidate,

      analysis:
        enrichedAnalysis,

      email: {
        ...primaryEmail,

        generatedText,

        generatedHtml
      },

      crawl,

      campaign
    });

  log(
    "SAVE LEAD OK:",
    url,
    `folder=${folder}`
  );

  // ==================================================
  // HISTORY
  // ==================================================

  await markLeadAnalyzed({
    domain,

    businessName:
      analysis?.businessName ||
      candidate?.title ||
      "",

    url,
    lastStatus:
      isQualified
        ? "qualified"
        : "review",
    lastScore:
      score,
    campaignCategory:
      category,
    email:
      primaryEmail?.email || ""
  });

  // ==================================================
  // RESULT
  // ==================================================

  const result = {
    businessName:
      analysis?.businessName ||
      candidate?.title ||
      "Unknown business",

    url,

    score,

    status:
      isQualified
        ? "qualified"
        : "review",

    email:
      primaryEmail.email,

    folder
  };

  results.push(
    result
  );

  log(
    "SAVED:",
    url,
    `score=${score}`,
    `status=${result.status}`
  );

  // ==================================================
  // PROGRESS
  // ==================================================

  await reportProgress({
    latestLead:
      result
  });

} catch (error) {
  failed++;

  const message =
    error?.message ||
    String(error);

  errors.push({
    url,
    message,
    at:
      new Date().toISOString()
  });

  console.error("");
  console.error(
    "========================================"
  );
  console.error(
    "LEAD FAILED"
  );
  console.error(
    "URL:",
    url
  );
  console.error(
    "MESSAGE:",
    message
  );
  console.error(
    "STACK:",
    error?.stack ||
      "No stack available"
  );
  console.error(
    "========================================"
  );
  console.error("");

  warn(
    "Lead failed:",
    url,
    message
  );

  await reportProgress({
    latestError: {
      url,
      message
    }
  });
}

}

// ==================================================
// FINAL RESULT
// ==================================================

const finishedAt =
new Date().toISOString();

const campaignResult =
buildCampaignResult({
campaign,
candidates,
results,
errors,
analyzed,
qualified,
review,
skipped,
failed,
processed,
finishedAt
});

log(
"CAMPAIGN FINISHED:",
`discovered=${candidates.length},
processed=${processed},
analyzed=${analyzed},
qualified=${qualified},
review=${review},
skipped=${skipped},
failed=${failed},
saved=${results.length}`
);

return campaignResult;
}

function buildCampaignResult({
campaign,
candidates,
results,
errors,
analyzed,
qualified,
review,
skipped,
failed,
processed,
finishedAt
}) {
return {
campaign: {
...campaign,

  ...(finishedAt
    ? {
        finishedAt
      }
    : {})
},

running:
  !finishedAt,

discovered:
  candidates.length,

processed,

analyzed,

qualified,

review,

skipped,

failed,

saved:
  results.length,

errors:
  errors.slice(-20),

results:
  [...results]

};
}

function safeDomain(url) {
try {
return new URL(url)
.hostname
.replace(
/^www./,
""
)
.toLowerCase();
} catch {
return null;
}
}