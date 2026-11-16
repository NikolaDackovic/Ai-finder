import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runCampaign } from "./services/pipelineService.js";
import { verifyMailTransport } from "./services/mailService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: "1mb" }));

app.use(
express.static(
path.join(__dirname, "../public")
)
);

let running = false;
let lastRun = null;

// ==================================================
// STATUS
// ==================================================

app.get("/api/status", (req, res) => {
const provider =
(process.env.AI_PROVIDER || "openai")
.trim()
.toLowerCase();

res.json({
running,
lastRun,

configured: {
  openai: Boolean(
    process.env.OPENAI_API_KEY?.trim()
  ),

  gemini: Boolean(
    process.env.GEMINI_API_KEY?.trim()
  ),

  provider,

  model:
    provider === "gemini"
      ? process.env.GEMINI_MODEL ||
        "gemini-3.5-flash"
      : process.env.OPENAI_MODEL ||
        "gpt-5-mini",

  search: Boolean(
    process.env.SERPER_API_KEY?.trim()
  ),

  identity: Boolean(
    process.env.YOUR_COMPANY?.trim() &&
    process.env.YOUR_WEBSITE?.trim()
  )
}

});
});
app.get("/api/mail-status", async (req, res) => {
try {
const result = await verifyMailTransport();

res.json({
  ok: true,
  message: "SMTP konekcija je uspešna.",
  ...result
});

} catch (error) {
console.error(
"[SMTP ERROR]",
error
);

res.status(500).json({
  ok: false,
  error:
    error?.message ||
    "SMTP konekcija nije uspela."
});

}
});
// ==================================================
// GET FULL LEAD
// ==================================================

app.get("/api/lead", async (req, res) => {
try {
const folder = String(
req.query.folder || ""
).trim();

if (!folder) {
  return res.status(400).json({
    error: "Folder je obavezan."
  });
}

/*
 * Frontend šalje samo relativnu putanju koju je
 * saveLead već vratio.
 *
 * Dozvoljavamo samo putanje unutar data/leads.
 */

const normalizedFolder =
  folder
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

if (
  !normalizedFolder.startsWith(
    "data/leads/"
  )
) {
  return res.status(400).json({
    error: "Neispravna putanja leada."
  });
}

const leadPath = path.resolve(
  process.cwd(),
  normalizedFolder,
  "lead.json"
);

const leadsRoot = path.resolve(
  process.cwd(),
  "data",
  "leads"
);

/*
 * Security check:
 * lead.json mora zaista biti unutar
 * data/leads direktorijuma.
 */

if (
  leadPath !== leadsRoot &&
  !leadPath.startsWith(
    leadsRoot + path.sep
  )
) {
  return res.status(400).json({
    error: "Nedozvoljena putanja."
  });
}

const raw = await fs.readFile(
  leadPath,
  "utf8"
);

const lead = JSON.parse(raw);

res.json({
  success: true,
  lead
});

} catch (error) {
if (
error?.code === "ENOENT"
) {
return res.status(404).json({
error: "Lead nije pronađen."
});
}

console.error(
  "[LEAD API ERROR]",
  error
);

return res.status(500).json({
  error:
    error?.message ||
    "Greška prilikom učitavanja leada."
});

}
});

// ==================================================
// DOWNLOAD LEAD FILE
// ==================================================

app.get("/api/lead-file", async (req, res) => {
try {
const folder = String(
req.query.folder || ""
).trim();

const file = String(
  req.query.file || ""
).trim();

if (!folder || !file) {
  return res.status(400).json({
    error:
      "Folder i file su obavezni."
  });
}

const allowedFiles = [
"lead.json",
"analysis.txt",
"contact.txt",
"email.txt",
"email.html",
"sources.txt",
"offer.pdf",
"send.json"
];

if (!allowedFiles.includes(file)) {
  return res.status(400).json({
    error:
      "Ovaj fajl nije dozvoljen."
  });
}

const normalizedFolder =
  folder
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

if (
  !normalizedFolder.startsWith(
    "data/leads/"
  )
) {
  return res.status(400).json({
    error:
      "Neispravna putanja leada."
  });
}

const filePath = path.resolve(
  process.cwd(),
  normalizedFolder,
  file
);

const leadsRoot = path.resolve(
  process.cwd(),
  "data",
  "leads"
);

if (
  filePath !== leadsRoot &&
  !filePath.startsWith(
    leadsRoot + path.sep
  )
) {
  return res.status(400).json({
    error:
      "Nedozvoljena putanja."
  });
}

await fs.access(filePath);

res.sendFile(
  filePath
);

} catch (error) {
if (
error?.code === "ENOENT"
) {
return res.status(404).json({
error:
"Fajl nije pronađen."
});
}

console.error(
  "[FILE API ERROR]",
  error
);

return res.status(500).json({
  error:
    error?.message ||
    "Greška prilikom učitavanja fajla."
});

}
});


function normalizeLeadOutreachStatus(lead) {
  return String(
    lead?.outreachStatus ||
    lead?.send?.status ||
    lead?.status || "READY"
  ).trim().toUpperCase();
}

const VALID_LEAD_TRANSITIONS = {
  READY: new Set(["TEST_SENT", "SENT"]),
  TEST_SENT: new Set(["SENT", "FOLLOW-UP", "REPLIED", "CLOSED"]),
  SENT: new Set(["FOLLOW-UP", "REPLIED", "CLOSED"]),
  "FOLLOW-UP": new Set(["SENT", "REPLIED", "CLOSED"]),
  REPLIED: new Set(["FOLLOW-UP", "CLOSED"]),
  CLOSED: new Set([])
};

function canTransitionLeadStatus(currentStatus, nextStatus) {
  if (!currentStatus || !nextStatus) {
    return false;
  }

  if (currentStatus === nextStatus) {
    return true;
  }

  return Boolean(
    VALID_LEAD_TRANSITIONS[currentStatus]?.has(nextStatus)
  );
}

app.post("/api/lead-status", async (req, res) => {
  try {
    const folder = String(
      req.body?.folder || ""
    ).trim();

    if (!folder) {
      return res.status(400).json({
        error: "Folder leada je obavezan."
      });
    }

    const normalizedFolder =
      folder
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");

    if (!normalizedFolder.startsWith("data/leads/")) {
      return res.status(400).json({
        error: "Neispravna putanja leada."
      });
    }

    const leadsRoot = path.resolve(
      process.cwd(),
      "data",
      "leads"
    );

    const leadPath = path.resolve(
      process.cwd(),
      normalizedFolder,
      "lead.json"
    );

    if (!leadPath.startsWith(leadsRoot + path.sep)) {
      return res.status(400).json({
        error: "Nedozvoljena putanja."
      });
    }

    const raw = await fs.readFile(leadPath, "utf8");
    const lead = JSON.parse(raw);

    const requestedStatus = String(
      req.body?.status || req.body?.action || ""
    ).trim().toLowerCase();

    const statusMap = {
      ready: "READY",
      "test-sent": "TEST_SENT",
      test_sent: "TEST_SENT",
      sent: "SENT",
      "follow-up": "FOLLOW-UP",
      follow_up: "FOLLOW-UP",
      followup: "FOLLOW-UP",
      replied: "REPLIED",
      closed: "CLOSED"
    };

    const nextStatus = statusMap[requestedStatus];

    if (!nextStatus) {
      return res.status(400).json({
        error: "Nedozvoljen status tranzicije."
      });
    }

    const currentStatus = normalizeLeadOutreachStatus(lead);

    if (!canTransitionLeadStatus(currentStatus, nextStatus)) {
      return res.status(409).json({
        error: `Neispravna tranzicija: ${currentStatus} -> ${nextStatus}.`
      });
    }

    const now = new Date().toISOString();
    const followUpAtRaw = req.body?.followUpAt;
    let followUpAt = lead.followUpAt || null;

    if (nextStatus === "FOLLOW-UP") {
      followUpAt = followUpAtRaw
        ? new Date(followUpAtRaw).toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    lead.outreachStatus = nextStatus;
    lead.status = nextStatus;
    lead.lastActionAt = now;
    lead.followUpAt = nextStatus === "FOLLOW-UP" ? followUpAt : lead.followUpAt || null;

    if (["TEST_SENT", "SENT"].includes(nextStatus)) {
      lead.sentAt = lead.sentAt || now;
      lead.sentTo = lead.sentTo || String(lead.contact?.email || "").trim() || null;
      lead.subject = lead.subject || String(req.body?.subject || process.env.DEFAULT_EMAIL_SUBJECT || "Personalizovana analiza sajta i predlog unapređenja").trim();
      lead.messageId = lead.messageId || null;
    }

    if (lead.send && typeof lead.send === "object") {
      lead.send.status = nextStatus;
      lead.send.sentAt = lead.send.sentAt || lead.sentAt || now;
      lead.send.sentTo = lead.send.sentTo || lead.sentTo || String(lead.contact?.email || "").trim() || null;
      lead.send.subject = lead.send.subject || lead.subject || null;
      lead.send.messageId = lead.send.messageId || lead.messageId || null;
      lead.send.testMode = Boolean(
        lead.send.testMode ??
        String(process.env.EMAIL_TEST_MODE || "true").trim().toLowerCase() === "true"
      );
    }

    await fs.writeFile(
      leadPath,
      JSON.stringify(lead, null, 2),
      "utf8"
    );

    return res.json({
      ok: true,
      changed: true,
      lead,
      status: nextStatus,
      followUpAt: lead.followUpAt || null
    });
  } catch (error) {
    console.error("[LEAD STATUS ERROR]", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Nije moguće izmeniti status leada."
    });
  }
});

//=================================================
app.post("/api/send-email", async (req, res) => {
try {
const folder = String(
req.body?.folder || ""
).trim();

if (!folder) {
  return res.status(400).json({
    error: "Folder leada je obavezan."
  });
}

const normalizedFolder =
  folder
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

if (
  !normalizedFolder.startsWith(
    "data/leads/"
  )
) {
  return res.status(400).json({
    error: "Neispravna putanja leada."
  });
}

const leadsRoot = path.resolve(
  process.cwd(),
  "data",
  "leads"
);

const leadPath = path.resolve(
  process.cwd(),
  normalizedFolder,
  "lead.json"
);

if (
  !leadPath.startsWith(
    leadsRoot + path.sep
  )
) {
  return res.status(400).json({
    error: "Nedozvoljena putanja."
  });
}

const raw = await fs.readFile(
  leadPath,
  "utf8"
);

const lead = JSON.parse(raw);

const contact =
  lead.contact || {};

const to = String(
  contact.email || ""
).trim();

if (!to) {
  return res.status(400).json({
    error: "Lead nema validan email."
  });
}

const currentStatus = String(
  lead.outreachStatus ||
  lead.send?.status ||
  lead.status || ""
).trim().toUpperCase();

if (
  [
    "TEST_SENT",
    "SENT",
    "REPLIED",
    "FOLLOW-UP",
    "CLOSED"
  ].includes(currentStatus)
) {
  return res.status(409).json({
    error:
      `Lead je već u statusu ${currentStatus || "TEST_SENT"}.`
  });
}

const text =
  contact.generatedText || "";

const html =
  contact.generatedHtml || "";

if (!text && !html) {
  return res.status(400).json({
    error:
      "Lead nema generisan email."
  });
}

const subject =
  String(
    req.body?.subject ||
      process.env.DEFAULT_EMAIL_SUBJECT ||
      "Personalizovana analiza sajta i predlog unapređenja"
  ).trim();

const { sendLeadEmail, getBlockedSendStatuses, resolveOutreachStatus } = await import("./services/mailService.js");

const normalizedCurrentStatus = String(
  lead.outreachStatus ||
  lead.send?.status ||
  lead.status || ""
).trim().toUpperCase();

if (
  getBlockedSendStatuses().has(normalizedCurrentStatus)
) {
  return res.status(409).json({
    error:
      `Lead je već u statusu ${normalizedCurrentStatus || "READY"}.`
  });
}

const isTestMode =
  String(
    process.env.EMAIL_TEST_MODE || "true"
  )
    .trim()
    .toLowerCase() === "true";

const result =
  await sendLeadEmail({
    to,
    subject,
    text,
    html,
    replyTo:
      process.env.SMTP_REPLY_TO ||
      process.env.SMTP_USER,
    testMode: isTestMode
  });

const sentAt =
  result.sentAt ||
  new Date().toISOString();

const outreachStatus =
  result.outreachStatus ||
  resolveOutreachStatus({
    testMode: isTestMode
  });

lead.outreachStatus =
outreachStatus;
lead.sentAt = sentAt;
lead.sentTo =
  result.actualRecipient ||
  to;
lead.subject = subject;
lead.messageId =
  result.messageId || null;
lead.lastActionAt = sentAt;
lead.followUpAt =
  lead.followUpAt || null;
lead.status =
outreachStatus;

lead.send = {
  status: outreachStatus,
  sentAt,
  sentTo:
    result.actualRecipient ||
    to,
  subject,
  messageId:
    result.messageId || null,
  provider: "smtp",
  testMode: isTestMode,
  requestedRecipient: to,
  actualRecipient:
    result.actualRecipient || to
};

await fs.writeFile(
  leadPath,
  JSON.stringify(
    lead,
    null,
    2
  ),
  "utf8"
);

await fs.writeFile(
  path.join(
    process.cwd(),
    normalizedFolder,
    "send.json"
  ),
  JSON.stringify(
    lead.send,
    null,
    2
  ),
  "utf8"
);

return res.json({
  ok: true,
  message:
    "Email je uspešno poslat.",
  send: lead.send
});

} catch (error) {
console.error(
"[SEND EMAIL ERROR]",
error
);

return res.status(500).json({
  ok: false,
  error:
    error?.message ||
    "Slanje emaila nije uspelo."
});

}
});
// ==================================================
// START CAMPAIGN
// ==================================================

app.post("/api/campaign", async (req, res) => {
if (running) {
return res.status(409).json({
error:
"Campaign već radi."
});
}

const {
category,
location,
limit = 20,
minScore = 70
} = req.body || {};

if (
!category ||
!location
) {
return res.status(400).json({
error:
"Category i location su obavezni."
});
}

const safeLimit = Math.min(
100,
Math.max(
1,
Number(limit) || 20
)
);

const safeMinScore = Math.min(
100,
Math.max(
0,
Number(minScore) || 0
)
);

running = true;

res.status(202).json({
accepted: true,
message:
"Campaign started."
});

try {
lastRun =
await runCampaign({
category:
String(category).trim(),

    location:
      String(location).trim(),

    limit:
      safeLimit,

    minScore:
      safeMinScore
  });

} catch (error) {
console.error(
"[CAMPAIGN ERROR]",
error
);

lastRun = {
  error:
    error?.message ||
    String(error)
};

} finally {
running = false;
}
});

// ==================================================
// FRONTEND FALLBACK
// ==================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    ok: false,
    error: `API route nije pronađena: ${req.method} ${req.originalUrl}`
  });
});

app.use((req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "../public/index.html"
    )
  );
});

// ==================================================
// SERVER
// ==================================================

const port = Number(
process.env.PORT || 3030
);

app.listen(
port,
() => {
console.log(
"AI Prospect Finder: http://localhost:" +
port
);
}
);