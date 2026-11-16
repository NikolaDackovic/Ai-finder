import path from "node:path";
import fs from "node:fs/promises";
import slugify from "slugify";
import {
  ensureDir,
  writeJson,
  writeText
} from "../utils/fs.js";
import { makePersonalizedPdf } from "./pdfService.js";

export async function saveLead({
  lead,
  analysis,
  email,
  crawl,
  campaign
}) {
  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  const safeName =
    slugify(
      analysis?.businessName ||
        lead?.title ||
        "unknown-business",
      {
        lower: false,
        strict: true
      }
    ) || "unknown-business";

  const base = path.join(
    "data",
    "leads",
    date
  );

  await ensureDir(base);

  const existing = await fs.readdir(
    base,
    { withFileTypes: true }
  );

  const number = String(
    existing.filter(
      (item) => item.isDirectory()
    ).length + 1
  ).padStart(2, "0");

  const folder = path.join(
    base,
    `${number}_${safeName}`
  );

  await ensureDir(folder);

  const leadJson = {
    createdAt:
      new Date().toISOString(),
    status: "READY_FOR_REVIEW",
    outreachStatus: "READY",
    sentAt: null,
    sentTo: null,
    subject: null,
    messageId: null,
    lastActionAt: null,
    followUpAt: null,
    campaign,
    source: lead,
    analysis,
    contact: email,
    website: {
      url: crawl?.startUrl || lead?.url || "",
      pagesCrawled:
        Array.isArray(crawl?.pages)
          ? crawl.pages.map(
              (page) => page.url
            )
          : []
    },
    files: {
      leadJson: true,
      analysisTxt: true,
      contactTxt: true,
      emailTxt: true,
      emailHtml: Boolean(
        email?.generatedHtml
      ),
      sourcesTxt: true,
      pdf: false
    }
  };

  await writeJson(
    path.join(
      folder,
      "lead.json"
    ),
    leadJson
  );

  await writeText(
    path.join(
      folder,
      "analysis.txt"
    ),
    [
      `BUSINESS: ${analysis?.businessName || "N/A"}`,
      `WEBSITE: ${crawl?.startUrl || lead?.url || "N/A"}`,
      `SCORE: ${analysis?.leadScore ?? 0}/100`,
      `STATUS: ${analysis?.qualification?.status || "review"}`,
      "",
      "CHATBOT STATUS",
      analysis?.chatbotStatus || "N/A",
      "",
      "BOOKING STATUS",
      analysis?.bookingStatus || "N/A",
      "",
      "CONTACT STATUS",
      analysis?.contactStatus || "N/A",
      "",
      "OBSERVATIONS",
      ...toTextLines(analysis?.observations),
      "",
      "PROBLEMS",
      ...toTextLines(analysis?.problems),
      "",
      "SOLUTIONS",
      ...toTextLines(analysis?.solutions),
      "",
      "RECOMMENDED FEATURES",
      ...toTextLines(analysis?.recommendedFeatures),
      "",
      "WARNINGS",
      ...toTextLines(analysis?.confidenceWarnings)
    ].join("\n")
  );

  await writeText(
    path.join(
      folder,
      "contact.txt"
    ),
    [
      `Email: ${email?.email || "NOT FOUND"}`,
      `Confidence: ${email?.confidence ?? "N/A"}`,
      `Source: ${email?.source || "N/A"}`,
      `Website: ${crawl?.startUrl || lead?.url || "N/A"}`
    ].join("\n")
  );

  await writeText(
    path.join(
      folder,
      "email.txt"
    ),
    email?.generatedText || ""
  );

  if (email?.generatedHtml) {
    await writeText(
      path.join(
        folder,
        "email.html"
      ),
      email.generatedHtml
    );
  }

  await writeText(
    path.join(
      folder,
      "sources.txt"
    ),
    Array.isArray(crawl?.pages)
      ? crawl.pages
          .map((page) => page.url)
          .join("\n")
      : ""
  );

  try {
    await makePersonalizedPdf({
      destination: path.join(
        folder,
        "offer.pdf"
      )
    });

    leadJson.files.pdf = true;

    await writeJson(
      path.join(
        folder,
        "lead.json"
      ),
      leadJson
    );
  } catch (error) {
    const pdfError =
      error?.message ||
      String(error);

    await writeJson(
      path.join(
        folder,
        "pdf-status.json"
      ),
      {
        ok: false,
        error: pdfError,
        createdAt:
          new Date().toISOString()
      }
    );
  }

  return folder;
}

function toTextLines(value) {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    return ["- Nije pronađeno."];
  }

  return value.map(
    (item) => `- ${String(item)}`
  );
}
