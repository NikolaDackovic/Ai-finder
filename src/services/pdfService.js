import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { exists } from "../utils/fs.js";

export async function copyMasterPdf(destination) {
  const source = process.env.MASTER_PDF || "./templates/master-offer.pdf";
  if (!(await exists(source))) return false;

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
  return true;
}

// Later we can add a personalized cover page to the master PDF.
// The current MVP deliberately preserves your existing PDF unchanged.
export async function makePersonalizedPdf({ destination }) {
  return copyMasterPdf(destination);
}
