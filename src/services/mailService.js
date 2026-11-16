import nodemailer from "nodemailer";
import path from "node:path";
import fs from "node:fs/promises";

let transporter;

function getTransporter() {
if (transporter) {
return transporter;
}

const host =
process.env.SMTP_HOST?.trim();

const port =
Number(
process.env.SMTP_PORT || 587
);

const user =
process.env.SMTP_USER?.trim();

const pass =
process.env.SMTP_PASS?.trim();

if (!host) {
throw new Error(
"SMTP_HOST nije podešen u .env fajlu."
);
}

if (!user) {
throw new Error(
"SMTP_USER nije podešen u .env fajlu."
);
}

if (!pass) {
throw new Error(
"SMTP_PASS nije podešen u .env fajlu."
);
}

transporter =
nodemailer.createTransport({
host,
port,
secure:
String(
process.env.SMTP_SECURE || "false"
)
.trim()
.toLowerCase() === "true",

  auth: {
    user,
    pass
  },

  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000
});

return transporter;
}

function isTestMode() {
return (
String(
process.env.EMAIL_TEST_MODE ||
"true"
)
.trim()
.toLowerCase() === "true"
);
}

function getTestRecipient() {
return (
process.env.EMAIL_TEST_TO?.trim() ||
""
);
}

function getDefaultReplyTo() {
return (
process.env.SMTP_REPLY_TO?.trim() ||
process.env.SMTP_USER?.trim() ||
""
);
}

async function getAttachment() {
const attachmentPath =
path.resolve(
process.cwd(),
"src",
"resenje.pdf"
);

try {
await fs.access(
attachmentPath
);
} catch {
throw new Error(
"PDF attachment nije pronađen: src/resenje.pdf"
);
}

return {
filename:
"resenje.pdf",

path:
  attachmentPath,

contentType:
  "application/pdf"

};
}

export function resolveOutreachStatus({
  testMode = isTestMode()
} = {}) {
  return testMode ? "TEST_SENT" : "SENT";
}

export function getBlockedSendStatuses() {
  return new Set([
    "TEST_SENT",
    "SENT",
    "REPLIED",
    "FOLLOW-UP",
    "CLOSED"
  ]);
}

export async function verifyMailTransport() {
await getTransporter().verify();

return {
ok: true
};
}

export async function sendLeadEmail({
to,
subject,
text,
html,
replyTo,
testMode = isTestMode()
}) {
if (!to) {
throw new Error(
"Primaoc email nije prosleđen."
);
}

if (!subject) {
throw new Error(
"Subject nije prosleđen."
);
}

if (!text && !html) {
throw new Error(
"Email nema sadržaj."
);
}

const from =
process.env.SMTP_FROM?.trim() ||
process.env.SMTP_USER?.trim() ||
"";

if (!from) {
throw new Error(
"SMTP_FROM ili SMTP_USER mora biti podešen."
);
}

const effectiveTestMode =
Boolean(testMode);

const requestedRecipient =
String(to).trim();

let actualRecipient =
requestedRecipient;

if (effectiveTestMode) {
actualRecipient =
getTestRecipient();

if (!actualRecipient) {
  throw new Error(
    "EMAIL_TEST_MODE je uključen, ali EMAIL_TEST_TO nije podešen."
  );
}

console.log(
  "[SMTP TEST MODE]"
);

console.log(
  "Requested recipient:",
  requestedRecipient
);

console.log(
  "Actual recipient:",
  actualRecipient
);

console.log(
  "Mode:",
  effectiveTestMode ? "TEST" : "REAL"
);

}

const attachment =
await getAttachment();

const message = {
from,

to:
  actualRecipient,

subject:
  String(subject).trim(),

text:
  text || undefined,

html:
  html || undefined,

replyTo:
  replyTo?.trim() ||
  getDefaultReplyTo() ||
  undefined,

attachments: [
  attachment
]

};

console.log(
"[SMTP SEND]"
);

console.log(
"To:",
actualRecipient
);

console.log(
"Subject:",
message.subject
);

console.log(
"Attachment:",
attachment.path
);

const info =
await getTransporter()
.sendMail(message);

const accepted =
Array.isArray(
info.accepted
)
? info.accepted
: [];

const rejected =
Array.isArray(
info.rejected
)
? info.rejected
: [];

if (
rejected.length > 0
) {
throw new Error(
"SMTP je odbio primaoca: " +
rejected.join(", ")
);
}

if (
accepted.length === 0
) {
throw new Error(
"SMTP nije prihvatio nijednog primaoca."
);
}

return {
ok: true,

testMode: effectiveTestMode,

requestedRecipient,

actualRecipient,

messageId:
  info.messageId ||
  null,

accepted,

rejected,

response:
  info.response ||
  "",

sentAt:
  new Date().toISOString(),

outreachStatus:
  resolveOutreachStatus({
    testMode: effectiveTestMode
  }),

attachment: {
  filename:
    attachment.filename,

  path:
    attachment.path
}

};
}