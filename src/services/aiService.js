import OpenAI from "openai";

let openaiClient = null;
let geminiClient = null;

const MAX_RETRIES = 4;

const RETRY_DELAYS = [
5000,
12000,
25000,
45000
];

function getOpenAIClient() {
const apiKey =
process.env.OPENAI_API_KEY?.trim();

if (!apiKey) {
throw new Error(
"OPENAI_API_KEY nije podešen u .env fajlu."
);
}

if (!openaiClient) {
openaiClient = new OpenAI({
apiKey
});
}

return openaiClient;
}

function getGeminiClient() {
const apiKey =
process.env.GEMINI_API_KEY?.trim();

if (!apiKey) {
throw new Error(
"GEMINI_API_KEY nije podešen u .env fajlu."
);
}

if (!geminiClient) {
geminiClient = new OpenAI({
apiKey,
baseURL:
"https://generativelanguage.googleapis.com/v1beta/openai/"
});
}

return geminiClient;
}

function getProvider() {
return (
process.env.AI_PROVIDER ||
"openai"
)
.trim()
.toLowerCase();
}

function getModel() {
const provider =
getProvider();

if (provider === "gemini") {
return (
process.env.GEMINI_MODEL ||
"gemini-3.5-flash-lite"
);
}

return (
process.env.OPENAI_MODEL ||
"gpt-5-mini"
);
}

function buildSystemPrompt() {
return `
Ti si B2B prospecting analitičar.

Radiš analizu javno dostupnog poslovnog sajta.

NAJVAŽNIJE PRAVILO:
NE SMEŠ da izmišljaš činjenice.

Svaka tvrdnja o firmi mora biti podržana prosleđenim evidence podacima.

Ako nešto ne možeš pouzdano da utvrdiš:

koristi null kada je dozvoljeno
ili napiši "nije utvrđeno"

Ne tvrdi da firma NEMA određenu funkcionalnost samo zato što je nisi pronašao.

Umesto:
"Firma nema chatbot."

koristi:
"Nije pronađen jasan dokaz o chatbot funkcionalnosti u analiziranim stranicama."

Isto pravilo važi za:

booking
kontakt formu
online zakazivanje
automatizaciju
druge funkcionalnosti.

POSEBNO ANALIZIRAJ:

naziv firme
kategoriju
grad
usluge
kontakt informacije
javni email
chatbot
online booking
kontakt formu
način zakazivanja
CTA elemente
korisnički proces
konkretne probleme na sajtu
konkretne poslovne prilike
konkretna potencijalna rešenja

Nemoj davati generičke marketinške tvrdnje.

Ako navodiš problem:

objasni šta si konkretno primetio
oslanjaj se na evidence

Ako predlažeš rešenje:

mora biti povezano sa identifikovanim problemom

LEAD SCORE:

Dodeli leadScore od 0 do 100.

Score predstavlja koliko je firma dobar potencijalni B2B prospect za digitalne i AI usluge.

Viši score može dobiti firma ako evidence pokazuje:

relevantan tip biznisa
aktivan sajt
konkretne UX probleme
slabiji kontakt proces
manuelne procese
potencijal za chatbot
potencijal za online booking
konkretne mogućnosti automatizacije

Nemoj davati visok score bez razloga.

scoreReasons mora objasniti score.

EMAIL:

emailDraftFields mora biti zasnovan na stvarnim observation/problem podacima.

Email mora zvučati kao da je ručno napravljen baš za tu firmu.

Ne koristi generičke tvrdnje poput:
"Vaš sajt može biti unapređen."

Umesto toga koristi konkretna zapažanja iz evidence.

Vrati ISKLJUČIVO validan JSON.

Nemoj uključivati markdown.

Nemoj uključivati objašnjenje van JSON-a.
`;
}

function buildEvidence({
business,
crawl,
emailCandidates,
campaign
}) {
const pages =
Array.isArray(crawl?.pages)
? crawl.pages
: [];

const signals =
crawl?.signals || {};

const rankedPages =
[...pages]
.sort(
(a, b) =>
pagePriority(b) -
pagePriority(a)
)
.slice(0, 6);

return {
business: {
title:
business?.title || "",
url:
business?.url || "",
snippet:
business?.snippet || "",
sourceQuery:
business?.sourceQuery || ""
},

campaign: {
  category:
    campaign?.category || "",
  location:
    campaign?.location || "",
  limit:
    campaign?.limit || 0,
  minScore:
    campaign?.minScore || 0
},

contactCandidates:
  Array.isArray(emailCandidates)
    ? emailCandidates.slice(0, 5)
    : [],

websiteSignals: signals,

pages:
  rankedPages.map(
    (page) => ({
      url:
        page?.url || "",
      title:
        page?.title || "",
      description:
        page?.description || "",
      text:
        String(
          page?.text || ""
        ).slice(0, 5000)
    })
  )

};
}

function pagePriority(page) {
const url =
String(
page?.url || ""
).toLowerCase();

const title =
String(
page?.title || ""
).toLowerCase();

const text =
String(
page?.text || ""
).toLowerCase();

const combined =
url +
" " +
title +
" " +
text.slice(0, 1500);

let score = 0;

if (
/kontakt|contact/.test(
combined
)
) {
score += 10;
}

if (
/cenovnik|cjenovnik|price|pricing/.test(
combined
)
) {
score += 9;
}

if (
/zakazivanje|zakazati|booking|appointment/.test(
combined
)
) {
score += 9;
}

if (
/usluge|services/.test(
combined
)
) {
score += 7;
}

if (
/o nama|about/.test(
combined
)
) {
score += 6;
}

if (
/email|e-mail|telefon|phone/.test(
combined
)
) {
score += 4;
}

return score;
}

function getLeadAnalysisSchema() {
return {
type: "object",

additionalProperties: false,

properties: {
  businessName: {
    type: [
      "string",
      "null"
    ]
  },

  category: {
    type: [
      "string",
      "null"
    ]
  },

  city: {
    type: [
      "string",
      "null"
    ]
  },

  websiteSummary: {
    type: "string"
  },

  chatbotStatus: {
    type: "string"
  },

  bookingStatus: {
    type: "string"
  },

  contactStatus: {
    type: "string"
  },

  leadScore: {
    type: "number"
  },

  scoreReasons: {
    type: "array",
    items: {
      type: "string"
    }
  },

  observations: {
    type: "array",
    items: {
      type: "string"
    }
  },

  problems: {
    type: "array",
    items: {
      type: "string"
    }
  },

  solutions: {
    type: "array",
    items: {
      type: "string"
    }
  },

  recommendedFeatures: {
    type: "array",
    items: {
      type: "string"
    }
  },

  emailReason: {
    type: "string"
  },

  emailDraftFields: {
    type: "object",

    additionalProperties: false,

    properties: {
      greeting: {
        type: "string"
      },

      businessIntro: {
        type: "string"
      },

      analysis1: {
        type: "string"
      },

      analysis2: {
        type: "string"
      },

      analysis3: {
        type: "string"
      },

      solution1: {
        type: "string"
      },

      solution2: {
        type: "string"
      },

      solution3: {
        type: "string"
      },

      additionalPoint: {
        type: "string"
      },

      cta: {
        type: "string"
      }
    },

    required: [
      "greeting",
      "businessIntro",
      "analysis1",
      "analysis2",
      "analysis3",
      "solution1",
      "solution2",
      "solution3",
      "additionalPoint",
      "cta"
    ]
  },

  confidenceWarnings: {
    type: "array",
    items: {
      type: "string"
    }
  }
},

required: [
  "businessName",
  "category",
  "city",
  "websiteSummary",
  "chatbotStatus",
  "bookingStatus",
  "contactStatus",
  "leadScore",
  "scoreReasons",
  "observations",
  "problems",
  "solutions",
  "recommendedFeatures",
  "emailReason",
  "emailDraftFields",
  "confidenceWarnings"
]

};
}

function normalizeAnalysis(
analysis,
fallback = {}
) {
if (
!analysis ||
typeof analysis !== "object"
) {
throw new Error(
"AI je vratio neispravan analysis objekat."
);
}

const fallbackBusinessName =
  toStringValue(
    analysis.businessName
  ) ||
  toStringValue(
    fallback.businessName
  ) ||
  toStringValue(
    fallback.title
  ) ||
  deriveBusinessNameFromUrl(
    fallback.url
  ) ||
  deriveBusinessNameFromDomain(
    fallback.domain
  );

const fallbackCategory =
  toStringValue(
    analysis.category
  ) ||
  toStringValue(
    fallback.category
  );

const fallbackCity =
  toStringValue(
    analysis.city
  ) ||
  toStringValue(
    fallback.city
  ) ||
  getLocationLikeValue(
    fallback.location
  );

const evidenceConfidence =
  computeEvidenceConfidence(
    fallback.crawl
  );

let score =
Number(
analysis.leadScore
);

if (
!Number.isFinite(score)
) {
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

const fields =
analysis.emailDraftFields &&
typeof analysis.emailDraftFields === "object"
? analysis.emailDraftFields
: {};

return {
...analysis,

businessName:
  fallbackBusinessName ||
  null,

category:
  fallbackCategory ||
  null,

city:
  fallbackCity ||
  null,

evidenceConfidence,

websiteSummary:
  typeof analysis.websiteSummary === "string"
    ? analysis.websiteSummary
    : "",

chatbotStatus:
  typeof analysis.chatbotStatus === "string"
    ? analysis.chatbotStatus
    : "nije utvrđeno",

bookingStatus:
  typeof analysis.bookingStatus === "string"
    ? analysis.bookingStatus
    : "nije utvrđeno",

contactStatus:
  typeof analysis.contactStatus === "string"
    ? analysis.contactStatus
    : "nije utvrđeno",

leadScore:
  score,

scoreReasons:
  toStringArray(
    analysis.scoreReasons
  ),

observations:
  toStringArray(
    analysis.observations
  ),

problems:
  toStringArray(
    analysis.problems
  ),

solutions:
  toStringArray(
    analysis.solutions
  ),

recommendedFeatures:
  toStringArray(
    analysis.recommendedFeatures
  ),

emailReason:
  typeof analysis.emailReason === "string"
    ? analysis.emailReason
    : "",

emailDraftFields: {
  greeting:
    toStringValue(
      fields.greeting
    ),

  businessIntro:
    toStringValue(
      fields.businessIntro
    ),

  analysis1:
    toStringValue(
      fields.analysis1
    ),

  analysis2:
    toStringValue(
      fields.analysis2
    ),

  analysis3:
    toStringValue(
      fields.analysis3
    ),

  solution1:
    toStringValue(
      fields.solution1
    ),

  solution2:
    toStringValue(
      fields.solution2
    ),

  solution3:
    toStringValue(
      fields.solution3
    ),

  additionalPoint:
    toStringValue(
      fields.additionalPoint
    ),

  cta:
    toStringValue(
      fields.cta
    )
},

confidenceWarnings:
  toStringArray(
    analysis.confidenceWarnings
  )

};
}

function toStringArray(
value
) {
if (
!Array.isArray(value)
) {
return [];
}

return value
.filter(
(item) =>
typeof item === "string"
)
.map(
(item) =>
item.trim()
)
.filter(Boolean);
}

function toStringValue(
value
) {
return typeof value === "string"
? value.trim()
: "";
}

function getDomainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function deriveBusinessNameFromUrl(value) {
  const domain = getDomainFromUrl(value);
  if (!domain) {
    return "";
  }

  const parts = domain.split(".");
  const name = parts[0] || "";
  if (!name) {
    return "";
  }

  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function deriveBusinessNameFromDomain(value) {
  if (!value) {
    return "";
  }

  const cleaned = String(value).replace(/^www\./i, "").split(".")[0] || "";
  if (!cleaned) {
    return "";
  }

  return cleaned
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function getLocationLikeValue(value) {
  return toStringValue(value);
}

function computeEvidenceConfidence(crawl) {
  if (!crawl || typeof crawl !== "object") {
    return 0.35;
  }

  const pages = Array.isArray(crawl.pages) ? crawl.pages : [];
  const signals = crawl.signals || {};
  const text = JSON.stringify({
    pages,
    signals
  }).toLowerCase();

  let score = 0;

  if (pages.length > 0) score += 0.2;
  if (signals.contact || /kontakt|contact/.test(text)) score += 0.2;
  if (signals.services || /usluge|services/.test(text)) score += 0.2;
  if (signals.pricing || /cenovnik|price|pricing/.test(text)) score += 0.15;
  if (signals.booking || /zakazivanje|booking|appointment/.test(text)) score += 0.15;
  if (signals.about || /o nama|about/.test(text)) score += 0.1;

  return Number(Math.min(1, Math.max(0, score)).toFixed(2));
}

function extractRetryDelay(
error,
attempt
) {
const headers =
error?.headers ||
error?.response?.headers ||
{};

const retryAfter =
headers[
"retry-after"
] ||
headers[
"Retry-After"
];

if (retryAfter) {
const seconds =
Number(
retryAfter
);

if (
  Number.isFinite(seconds) &&
  seconds > 0
) {
  return Math.min(
    seconds * 1000,
    120000
  );
}

}

return (
RETRY_DELAYS[
attempt - 1
] ||
45000
);
}

function isRetryableError(
error
) {
const status =
error?.status ||
error?.response?.status;

return (
status === 429 ||
status === 500 ||
status === 502 ||
status === 503 ||
status === 504
);
}

function getErrorMessage(
error
) {
const status =
error?.status ||
error?.response?.status ||
"";

const message =
error?.message ||
error?.response?.data?.error?.message ||
error?.response?.data?.message ||
"Nepoznata AI greška.";

return (
status
? `${status} ${message}`
: message
);
}

async function analyzeWithGemini({
systemPrompt,
evidence
}) {
const model =
process.env.GEMINI_MODEL ||
"gemini-3.5-flash-lite";

let lastError =
null;

for (
let attempt = 1;
attempt <= MAX_RETRIES;
attempt++
) {
try {
console.log(
`[AI REQUEST] provider=gemini model=${model} attempt=${attempt}/${MAX_RETRIES}`
);

  const response =
    await getGeminiClient()
      .chat
      .completions
      .create({
        model,

        messages: [
          {
            role: "system",
            content:
              systemPrompt
          },

          {
            role: "user",
            content:
              JSON.stringify(
                evidence
              )
          }
        ],

        response_format: {
          type: "json_object"
        },

        stream: false
      });

  const content =
    response
      ?.choices?.[0]
      ?.message?.content;

  if (!content) {
    throw new Error(
      "Gemini je vratio prazan odgovor."
    );
  }

  let parsed;

  try {
    parsed =
      typeof content === "string"
        ? JSON.parse(
            content
          )
        : content;
  } catch {
    console.error(
      "[GEMINI INVALID JSON]",
      content
    );

    throw new Error(
      "Gemini je vratio nevalidan JSON."
    );
  }

  return normalizeAnalysis(
    parsed,
    {
      businessName:
        evidence?.business?.title || "",
      category:
        evidence?.campaign?.category || "",
      city:
        evidence?.campaign?.location || "",
      location:
        evidence?.campaign?.location || "",
      url:
        evidence?.business?.url || "",
      domain:
        getDomainFromUrl(
          evidence?.business?.url || ""
        ),
      crawl:
        evidence?.websiteSignals
          ? { pages: evidence?.pages || [], signals: evidence?.websiteSignals }
          : null
    }
  );

} catch (error) {
  lastError =
    error;

  const status =
    error?.status ||
    error?.response?.status;

  const message =
    getErrorMessage(
      error
    );

  console.error(
    `[GEMINI ERROR] attempt=${attempt}/${MAX_RETRIES} status=${status || "unknown"} message=${message}`
  );

  if (
    !isRetryableError(
      error
    ) ||
    attempt === MAX_RETRIES
  ) {
    break;
  }

  const delay =
    extractRetryDelay(
      error,
      attempt
    );

  console.log(
    `[GEMINI] retrying in ${Math.round(delay / 1000)}s...`
  );

  await sleep(
    delay
  );
}

}

throw new Error(
  `Gemini analiza nije uspela nakon ${MAX_RETRIES} pokušaja. ${getErrorMessage(lastError)}`
);
}

async function analyzeWithOpenAI({
systemPrompt,
evidence
}) {
const model =
process.env.OPENAI_MODEL ||
"gpt-5-mini";

console.log(
  `[AI REQUEST] provider=openai model=${model}`
);

const response =
await getOpenAIClient()
.responses
.create({
model,

    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              systemPrompt
          }
        ]
      },

      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              JSON.stringify(
                evidence
              )
          }
        ]
      }
    ],

    text: {
      format: {
        type: "json_schema",
        name: "lead_analysis",
        strict: true,
        schema:
          getLeadAnalysisSchema()
      }
    }
  });

if (
!response?.output_text
) {
throw new Error(
"OpenAI je vratio prazan odgovor."
);
}

let parsed;

try {
parsed =
JSON.parse(
response.output_text
);
} catch {
throw new Error(
"OpenAI je vratio nevalidan JSON."
);
}

return normalizeAnalysis(
parsed,
{
  businessName:
    evidence?.business?.title || "",
  category:
    evidence?.campaign?.category || "",
  city:
    evidence?.campaign?.location || "",
  location:
    evidence?.campaign?.location || "",
  url:
    evidence?.business?.url || "",
  domain:
    getDomainFromUrl(
      evidence?.business?.url || ""
    ),
  crawl:
    evidence?.websiteSignals
      ? { pages: evidence?.pages || [], signals: evidence?.websiteSignals }
      : null
}
);
}

export async function analyzeLead({
business,
crawl,
emailCandidates,
campaign
}) {
const provider =
getProvider();

const model =
getModel();

const evidence =
buildEvidence({
business,
crawl,
emailCandidates,
campaign
});

const systemPrompt =
buildSystemPrompt();

const pageCount =
Array.isArray(
evidence.pages
)
? evidence.pages.length
: 0;

const totalChars =
JSON.stringify(
evidence
).length;

console.log(
`[AI] provider=${provider} model=${model} business=${ business?.title || business?.name || "unknown" }`
);

console.log(
`[AI EVIDENCE] pages=${pageCount} chars=${totalChars}`
);

if (
provider === "gemini"
) {
return analyzeWithGemini({
systemPrompt,
evidence
});
}

if (
provider === "openai"
) {
return analyzeWithOpenAI({
systemPrompt,
evidence
});
}

throw new Error(
`Nepoznat AI_PROVIDER "${provider}". Koristi "openai" ili "gemini".`
);
}

function sleep(
milliseconds
) {
return new Promise(
(resolve) =>
setTimeout(
resolve,
milliseconds
)
);
}