const TEMPLATE = "./templates/outreach-template.txt";

// ==================================================
// EMAIL DESIGN
// ==================================================

const EMAIL_COLORS = {
primary: "#7C3AED",
primaryLight: "#A855F7",
primaryDark: "#5B21B6",

background: "#F4F1F9",
white: "#FFFFFF",

text: "#181321",
textSecondary: "#4B4658",
textMuted: "#777181",

border: "#E8E2F0",

analysisBackground: "#FAF8FD",
analysisBorder: "#E9E1F4",

solutionBackground: "#F6F0FF",
solutionBorder: "#DFD0F5",

footerBackground: "#F9F7FC"
};

// ==================================================
// PLAIN TEXT EMAIL
// ==================================================

export async function generateEmail({
analysis,
campaign,
identity
}) {
if (!analysis) {
throw new Error(
"Analysis nije prosleđen template servisu."
);
}

const template =
await fs.readFile(
TEMPLATE,
"utf8"
);

const values =
buildTemplateValues({
analysis,
campaign,
identity
});

return template.replace(
/{{([A-Z0-9_]+)}}/g,
function (_, key) {
return values[key] ?? "";
}
);
}

// ==================================================
// HTML EMAIL
// ==================================================

export function generateHtmlEmail({
analysis,
campaign,
identity
}) {
if (!analysis) {
throw new Error(
"Analysis nije prosleđen HTML template servisu."
);
}

const colors =
EMAIL_COLORS;

const fields =
analysis.emailDraftFields || {};

const businessName =
cleanText(
analysis.businessName
) ||
cleanText(
analysis.nazivFirme
) ||
cleanText(
analysis?.source?.title
) ||
cleanText(
analysis?.business?.name
) ||
"Vaš biznis";

const extractCategory = (category) => {
  if (!category) return "";
  const match = category.match(/\(([^)]+)\)/);
  if (match) {
    return match[1].split(",")[0].trim();
  }
  return category.split(",")[0].trim();
};

const extractCity = (location) => {
  if (!location) return "";
  const parts = location.split(",");
  return parts[0]?.trim() || "";
};

const categoryValue =
resolveAnalysisText(
analysis,
["category", "kategorija"]
) || extractCategory(analysis?.business?.category);

const cityValue =
resolveAnalysisText(
analysis,
["city", "grad", "lokacija"]
) || extractCity(analysis?.business?.location);

const subjectLine =
cleanText(
fields.subject
) ||
buildEmailSubject({
  businessName,
  category: categoryValue,
  city: cityValue
});

const preheaderText =
cleanText(
fields.preheader
) ||
buildEmailPreheader({
  businessName,
  category: categoryValue,
  city: cityValue
});

const website =
cleanText(
identity?.yourWebsite
) ||
"https://plomo.rs";

const email =
cleanText(
identity?.yourEmail
);

const scoreValue =
Number(
analysis.leadScore ??
analysis.score ?? 0
);

const chatbotValue =
resolveAnalysisText(
analysis,
["chatbotStatus", "chatbot"]
) ||
"nije utvrđeno";

const bookingValue =
resolveAnalysisText(
analysis,
["bookingStatus", "booking", "onlineBooking"]
) ||
"nije utvrđeno";

const contactValue =
resolveAnalysisText(
analysis,
["contactStatus", "kontakt", "contact"]
) ||
"nije utvrđeno";

const phone =
cleanText(
identity?.yourPhone
);

const yourName =
cleanText(
identity?.yourName
);

const yourCompany =
cleanText(
identity?.yourCompany
);

const greeting =
cleanText(
fields.greeting
) ||
"Poštovani,";

const businessIntro =
cleanText(
fields.businessIntro
) ||
buildBusinessIntro({
analysis: {
...analysis,
category: categoryValue,
city: cityValue
},
businessName
}) ||
`Analizirali smo javno dostupne informacije na sajtu ${businessName} i uočili konkretne prilike za poboljšanje procesa zakazivanja termina i komunikacije sa klijentima.`;

const observations =
uniqueStrings(
[
...(analysis.observations || []),
...(analysis?.websiteAnalysis?.ctaElements ? [analysis.websiteAnalysis.ctaElements] : [])
]
);

const problems =
uniqueStrings(
[
...(analysis.problems || []),
...(analysis?.websiteAnalysis?.problems || [])
]
);

const solutions =
uniqueStrings(
[
...(analysis.solutions || []),
...(analysis?.websiteAnalysis?.opportunities || [])
]
);

const recommendedFeatures =
uniqueStrings(
analysis.recommendedFeatures
) ||
uniqueStrings(
[
"AI chatbot za automatsku trijažu pacijenata",
"Online booking widget integrisan u sajt",
"Centralizovan sistem zakazivanja za sve lokacije"
]
);

const analysisItems =
buildAnalysisItems({
emailAnalysisFields: fields,
observations,
problems
});

const solutionItems =
buildSolutionItems({
solutions,
recommendedFeatures
});

const additionalPoint =
cleanText(
fields.additionalPoint
) ||
buildAdditionalPoint(
recommendedFeatures
);

const cta =
cleanText(
fields.cta
) ||
`Zapošljavanje zahteva da Vaš tim potroši vreme na rutinske pozive i emails od pacijenata. Pokazaćemo Vam kako naš AI chatbot preuzima taj posao, automatski zakazuje termine i šalje obaveštenja - sve bez dodatnog angažovanja osoblja.`;

const scoreReasons =
uniqueStrings(
analysis.scoreReasons
);

const productBenefits = [
  "Automatski prima zahteve za zakazivanje iz svih kanala (web, email, chat)",
  "Uvek dostupan - odgovara na poruke čak i van radnog vremena",
  "Integrisan sa vašim kalendarom - direktno pronalazi slobodne termine",
  "Šalje automatske potvrde, podsetnike i obaveštenja pacijentima",
  "Smanjuje broj neuspešnih zakazivanja i 'no-show' slučajeva",
  "Vaš tim se fokusira na pacijente, ne na administraciju"
];

const warningItems =
uniqueStrings(
analysis.confidenceWarnings
);

const html = `

<!DOCTYPE html> <html lang="sr"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0" > <title>${escapeHtml(subjectLine)}</title> </head> <body style=" margin:0; padding:0; background:${colors.background}; color:${colors.text}; font-family:Arial,Helvetica,sans-serif; " > <div style=" display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; " >${escapeHtml(preheaderText)}</div> <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style=" width:100%; margin:0; padding:0; background:${colors.background}; " > <tr> <td align="center" style=" padding:34px 14px; " >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="
        width:100%;
        max-width:700px;
        background:${colors.white};
        border:1px solid ${colors.border};
        border-radius:20px;
        overflow:hidden;
      "
    >

      <!-- HEADER -->

      <tr>
        <td
          style="
            padding:34px 34px 32px 34px;
            background:
              linear-gradient(
                145deg,
                ${colors.primary},
                ${colors.primaryLight} 52%,
                ${colors.primaryDark}
              );
          "
        >

          <div
            style="
              display:inline-block;
              padding:7px 10px;
              border:1px solid rgba(255,255,255,.20);
              border-radius:999px;
              background:rgba(255,255,255,.09);
              color:rgba(255,255,255,.88);
              font-size:10px;
              line-height:1;
              font-weight:700;
              letter-spacing:1.3px;
              text-transform:uppercase;
            "
          >
            Personalizovana analiza
          </div>

          <div
            style="
              margin-top:17px;
              color:#ffffff;
              font-size:29px;
              line-height:1.22;
              font-weight:700;
              letter-spacing:-.4px;
            "
          >
            ${escapeHtml(
              businessName
            )}
          </div>

          <div
            style="
              margin-top:9px;
              max-width:520px;
              color:rgba(255,255,255,.78);
              font-size:14px;
              line-height:1.7;
            "
          >
            Analiza javno dostupnih informacija sa sajta i izdvojene
            konkretne prilike za unapređenje.
          </div>

        </td>
      </tr>

      <!-- INTRO -->

      <tr>
        <td
          style="
            padding:31px 34px 10px 34px;
          "
        >

          <div
            style="
              color:${colors.text};
              font-size:15px;
              line-height:1.75;
            "
          >
            ${paragraph(
              greeting
            )}
          </div>

          <div
            style="
              margin-top:13px;
              color:${colors.textSecondary};
              font-size:14px;
              line-height:1.8;
            "
          >
            ${paragraph(
              businessIntro
            )}
          </div>

          <div
            style="
              margin-top:18px;
              padding:18px 18px 10px 18px;
              border:1px solid ${colors.analysisBorder};
              border-radius:14px;
              background:${colors.analysisBackground};
            "
          >
            <div
              style="
                margin-bottom:10px;
                color:${colors.text};
                font-size:11px;
                line-height:1.2;
                font-weight:800;
                letter-spacing:1.15px;
                text-transform:uppercase;
              "
            >
              Analiza poslovnog profila
            </div>

            ${[
              ["Kategorija", categoryValue || "Nije utvrđeno"],
              ["Grad", cityValue || "Nije utvrđeno"],
              ["Score", `${Math.max(0, Math.min(100, Math.round(scoreValue)))}/100`],
              ["Chatbot", chatbotValue || "nije utvrđeno"],
              ["Booking", bookingValue || "nije utvrđeno"],
              ["Kontakt", contactValue || "nije utvrđeno"]
            ].map(([label, value]) => `
              <div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid ${colors.border};">
                <div style="color:${colors.textSecondary};font-size:12px;font-weight:700;">${escapeHtml(label)}</div>
                <div style="color:${colors.text};font-size:12px;line-height:1.5;text-align:right;">${escapeHtml(String(value))}</div>
              </div>
            `).join("")}
          </div>

        </td>
      </tr>

      <!-- PRODUCT BENEFITS -->

      <tr>
        <td
          style="
            padding:22px 34px 8px 34px;
          "
        >

          ${sectionLabel(
            "Kako chatbot pomaže vašem biznisu",
            colors.primary
          )}

          <div
            style="
              margin-top:13px;
            "
          >

            ${productBenefits
              .map(
                (benefit, index) =>
                  solutionCardHtml(
                    String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    ),
                    benefit,
                    colors
                  )
              )
              .join("")}

          </div>

        </td>
      </tr>

      <!-- ANALYSIS -->

      ${
        analysisItems.length
          ? `
      <tr>
        <td
          style="
            padding:24px 34px 8px 34px;
          "
        >

          ${sectionLabel(
            "Analiza Vašeg sajta",
            colors.primary
          )}

          <div
            style="
              margin-top:13px;
            "
          >

            ${analysisItems
              .map(
                (item, index) =>
                  analysisCardHtml(
                    String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    ),
                    item,
                    colors
                  )
              )
              .join("")}

          </div>

        </td>
      </tr>
      `
          : ""
      }

      <!-- PROBLEMS -->

      ${
        problems.length
          ? `
      <tr>
        <td
          style="
            padding:14px 34px 8px 34px;
          "
        >

          ${sectionLabel(
            "Uočene prilike",
            colors.primaryLight
          )}

          <div
            style="
              margin-top:13px;
            "
          >

            ${problems
              .map(
                (problem, index) =>
                  problemCardHtml(
                    String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    ),
                    problem,
                    colors
                  )
              )
              .join("")}

          </div>

        </td>
      </tr>
      `
          : ""
      }

      <!-- SOLUTIONS -->

      ${
        solutionItems.length
          ? `
      <tr>
        <td
          style="
            padding:24px 34px 8px 34px;
          "
        >

          ${sectionLabel(
            "Predloženo rešenje",
            colors.primary
          )}

          <div
            style="
              margin-top:13px;
              padding:21px 20px;
              border:1px solid ${colors.solutionBorder};
              border-radius:15px;
              background:
                linear-gradient(
                  145deg,
                  #FBF8FF,
                  ${colors.solutionBackground}
                );
            "
          >

            <div
              style="
                color:${colors.textSecondary};
                font-size:14px;
                line-height:1.8;
              "
            >
              Na osnovu uočenih prilika, predlažemo konkretna unapređenja
              koja su direktno povezana sa načinom na koji korisnici
              trenutno koriste Vaš sajt.
            </div>

          </div>

          <div
            style="
              margin-top:13px;
            "
          >

            ${solutionItems
              .map(
                (solution, index) =>
                  solutionCardHtml(
                    String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    ),
                    solution,
                    colors
                  )
              )
              .join("")}

          </div>

        </td>
      </tr>
      `
          : ""
      }

      <!-- ADDITIONAL POINT -->

      ${
        additionalPoint
          ? `
      <tr>
        <td
          style="
            padding:14px 34px 8px 34px;
          "
        >

          <div
            style="
              padding:16px 18px;
              border-left:3px solid ${colors.primary};
              background:${colors.analysisBackground};
              color:${colors.textSecondary};
              font-size:13px;
              line-height:1.8;
            "
          >
            ${paragraph(
              additionalPoint
            )}
          </div>

        </td>
      </tr>
      `
          : ""
      }

      <!-- SCORE REASONS -->

      ${
        scoreReasons.length
          ? `
      <tr>
        <td
          style="
            padding:22px 34px 8px 34px;
          "
        >

          ${sectionLabel(
            "Kratko obrazloženje pristupa",
            colors.primary
          )}

          <div
            style="
              margin-top:11px;
              color:${colors.textSecondary};
              font-size:13px;
              line-height:1.8;
            "
          >

            ${scoreReasons
              .map(
                (reason) =>
                  bulletParagraph(
                    reason,
                    colors.primary
                  )
              )
              .join("")}

          </div>

        </td>
      </tr>
      `
          : ""
      }

      <!-- CTA -->

      <tr>
        <td
          style="
            padding:27px 34px 28px 34px;
          "
        >

          ${sectionLabel(
            "Sledeći korak",
            colors.primary
          )}

          <div
            style="
              margin-top:10px;
              color:${colors.textSecondary};
              font-size:14px;
              line-height:1.8;
            "
          >
            ${paragraph(
              cta
            )}
          </div>

          ${
            website
              ? `
          <div
            style="
              margin-top:18px;
            "
          >

            <a
              href="${escapeAttribute(
                "https://plomo.rs/"
              )}"
              target="_blank"
              style="
                display:inline-block;
                padding:14px 22px;
                border-radius:11px;
                background:
                  linear-gradient(
                    145deg,
                    ${colors.primaryLight},
                    ${colors.primary}
                  );
                border:1px solid rgba(255,255,255,.16);
                color:#ffffff;
                text-decoration:none;
                font-size:13px;
                font-weight:700;
                box-shadow:
                  inset 0 1px 1px rgba(255,255,255,.20),
                  0 8px 22px rgba(124,58,237,.23);
              "
            >
              Zatražite demo
            </a>

          </div>
          `
              : `
          <div
            style="
              margin-top:18px;
            "
          >

            <a
              href="https://plomo.rs/"
              target="_blank"
              style="
                display:inline-block;
                padding:14px 22px;
                border-radius:11px;
                background:
                  linear-gradient(
                    145deg,
                    ${colors.primaryLight},
                    ${colors.primary}
                  );
                border:1px solid rgba(255,255,255,.16);
                color:#ffffff;
                text-decoration:none;
                font-size:13px;
                font-weight:700;
                box-shadow:
                  inset 0 1px 1px rgba(255,255,255,.20),
                  0 8px 22px rgba(124,58,237,.23);
              "
            >
              Zatražite demo
            </a>

          </div>
          `
          }

        </td>
      </tr>

      <!-- PDF -->

      <tr>
        <td
          style="
            padding:0 34px 28px 34px;
          "
        >

          <div
            style="
              padding:18px 20px;
              border:1px solid ${colors.border};
              border-radius:14px;
              background:${colors.footerBackground};
            "
          >

            <div
              style="
                color:${colors.text};
                font-size:13px;
                font-weight:700;
              "
            >
              Detaljniji pregled rešenja
            </div>

            <div
              style="
                margin-top:7px;
                color:${colors.textMuted};
                font-size:12px;
                line-height:1.7;
              "
            >
              Detaljan pregled funkcionalnosti i mogućnosti rešenja
              nalazi se u priloženom PDF dokumentu.
            </div>

          </div>

        </td>
      </tr>

      <!-- FOOTER -->

      <tr>
        <td
          style="
            padding:24px 34px;
            border-top:1px solid ${colors.border};
            background:${colors.footerBackground};
          "
        >

          ${
            yourName || yourCompany
              ? `
          <div
            style="
              color:${colors.text};
              font-size:14px;
              line-height:1.8;
              font-weight:700;
            "
          >
            ${escapeHtml(
              yourName ||
              yourCompany
            )}
          </div>
          `
              : ""
          }

          ${
            yourCompany &&
            yourName
              ? `
          <div
            style="
              margin-top:1px;
              color:${colors.textSecondary};
              font-size:12px;
            "
          >
            ${escapeHtml(
              yourCompany
            )}
          </div>
          `
              : ""
          }

          <div
            style="
              margin-top:5px;
              font-size:12px;
            "
          >
            <a
              href="https://plomo.rs/"
              target="_blank"
              style="
                color:${colors.primary};
                text-decoration:none;
              "
            >
              Plomo.rs
            </a>
          </div>

          ${
            phone
              ? `
          <div
            style="
              margin-top:3px;
              color:${colors.textMuted};
              font-size:12px;
            "
          >
            ${escapeHtml(
              phone
            )}
          </div>
          `
              : ""
          }

        </td>
      </tr>

      <!-- WARNINGS -->

      ${
        warningItems.length
          ? `
      <tr>
        <td
          style="
            padding:20px 34px;
            border-top:1px solid ${colors.border};
            background:#FFFBF3;
          "
        >

          <div
            style="
              color:#8A641A;
              font-size:11px;
              font-weight:700;
              letter-spacing:.06em;
              text-transform:uppercase;
            "
          >
            Napomena
          </div>

          <div
            style="
              margin-top:7px;
              color:#8B7750;
              font-size:11px;
              line-height:1.7;
            "
          >

            ${warningItems
              .map(
                (warning) =>
                  paragraph(
                    warning
                  )
              )
              .join("<br>")}

          </div>

        </td>
      </tr>
      `
          : ""
      }

    </table>

  </td>
</tr>
</table> </body> </html> `;

return html.trim();
}

// ==================================================
// TEMPLATE VALUES
// ==================================================

function buildTemplateValues({
analysis,
campaign,
identity
}) {
const fields =
analysis.emailDraftFields ||
{};

const observations =
uniqueStrings(
analysis.observations
);

const problems =
uniqueStrings(
analysis.problems
);

const solutions =
uniqueStrings(
analysis.solutions
);

const recommendedFeatures =
uniqueStrings(
analysis.recommendedFeatures
);

const businessName =
cleanText(
analysis.businessName
) ||
cleanText(
analysis.nazivFirme
) ||
cleanText(
analysis?.source?.title
) ||
"Vaš biznis";

const greeting =
cleanText(
fields.greeting
) ||
"";

const businessIntro =
cleanText(
fields.businessIntro
) ||
"Analizirali smo vaš biznis i uočili smo konkretan prostor za bržu komunikaciju, automatizovane odgovore i jednostavnije zakazivanje termina bez dodatnog angažovanja osoblja.";

const analysisItems =
buildAnalysisItems({
emailAnalysisFields:
fields,
observations,
problems
});

const solutionItems =
buildSolutionItems({
solutions,
recommendedFeatures
});

const analysis1 =
analysisItems[0] ||
"Na sajtu smo uočili konkretnu priliku za unapređenje korisničkog iskustva.";

const analysis2 =
analysisItems[1] ||
"Postoji prostor za jednostavniji i brži način komunikacije sa potencijalnim klijentima.";

const analysis3 =
analysisItems[2] ||
"Određeni procesi mogu biti dodatno pojednostavljeni i automatizovani.";

const solution1 =
solutionItems[0] ||
"Predlažemo rešenje koje bi omogućilo bržu komunikaciju sa posetiocima sajta.";

const solution2 =
solutionItems[1] ||
"Predlažemo rešenje koje bi omogućilo lakši pristup relevantnim informacijama.";

const solution3 =
solutionItems[2] ||
"Predlažemo rešenje koje bi omogućilo smanjenje ručnog rada oko ponavljajućih upita.";

const additionalPoint =
cleanText(
fields.additionalPoint
) ||
buildAdditionalPoint(
recommendedFeatures
);

const cta =
cleanText(
fields.cta
) ||
"Ukoliko smatrate da bi ovakvo rešenje moglo biti korisno za Vaš biznis, rado bismo Vam pokazali kako bi konkretno moglo izgledati na Vašem sajtu.";

const signatureLines = [
identity?.yourName,
identity?.yourCompany,
"Plomo.rs",
identity?.yourPhone
]
.filter(Boolean)
.map(
(item) =>
String(item).trim()
);

return {
GREETING:
greeting,

BUSINESS_INTRO:
  businessIntro,

ANALYSIS_1:
  analysis1,

ANALYSIS_2:
  analysis2,

ANALYSIS_3:
  analysis3,

SOLUTION_1:
  solution1,

SOLUTION_2:
  solution2,

SOLUTION_3:
  solution3,

ADDITIONAL_POINT:
  additionalPoint,

CTA:
  cta,

YOUR_WEBSITE:
  "https://plomo.rs/",

SIGNATURE:
  signatureLines.join("\n")

};
}

// ==================================================
// ANALYSIS ITEMS
// ==================================================

function buildAnalysisItems({
emailAnalysisFields,
observations,
problems
}) {
const items = [];

const explicit = [
emailAnalysisFields.analysis1,
emailAnalysisFields.analysis2,
emailAnalysisFields.analysis3
];

for (const value of explicit) {
const text =
cleanText(value);

if (text) {
  items.push(text);
}

}

for (const value of observations) {
if (
!containsText(
items,
value
)
) {
items.push(value);
}
}

for (const value of problems) {
if (
!containsText(
items,
value
)
) {
items.push(value);
}
}

return uniqueStrings(
items
);
}

// ==================================================
// SOLUTION ITEMS
// ==================================================

function buildSolutionItems({
solutions,
recommendedFeatures
}) {
const items = [];

for (const value of solutions) {
const text =
cleanText(value);

if (text) {
  items.push(text);
}

}

for (const feature of recommendedFeatures) {
const text =
cleanText(feature);

if (!text) {
  continue;
}

const generated =
  "Mogućnost uvođenja " +
  text +
  " kako bi se unapredio korisnički proces i smanjio deo ručnog rada.";

if (
  !containsText(
    items,
    generated
  )
) {
  items.push(
    generated
  );
}

}

return uniqueStrings(
items
);
}

// ==================================================
// BUSINESS INTRO
// ==================================================

function buildBusinessIntro({
analysis,
businessName
}) {
const category =
resolveAnalysisText(
analysis,
["category", "kategorija"]
);

const city =
resolveAnalysisText(
analysis,
["city", "grad", "lokacija"]
);

if (
category &&
city
) {
return (
"Analizirali smo javno dostupne informacije na sajtu " +
businessName +
" i, imajući u vidu da se radi o " +
grammarCategory(
category
) +
" u " +
city +
", izdvojili nekoliko konkretnih prilika za unapređenje komunikacije sa potencijalnim klijentima."
);
}

if (category) {
return (
"Analizirali smo javno dostupne informacije na sajtu " +
businessName +
" i, imajući u vidu Vašu delatnost (" +
category +
"), izdvojili nekoliko konkretnih prilika za unapređenje komunikacije sa potencijalnim klijentima."
);
}

if (city) {
return (
"Analizirali smo javno dostupne informacije na sajtu " +
businessName +
" i izdvojili nekoliko konkretnih prilika za unapređenje komunikacije sa potencijalnim klijentima."
);
}

return (
"Analizirali smo javno dostupne informacije na sajtu " +
businessName +
" i izdvojili nekoliko konkretnih prilika za unapređenje komunikacije sa potencijalnim klijentima."
);
}

// ==================================================
// CATEGORY GRAMMAR
// ==================================================

function grammarCategory(
category
) {
const normalized =
category
.toLowerCase()
.trim();

const map = {
"stomatološke ordinacije":
"stomatološkoj ordinaciji",

"stomatološka ordinacija":
  "stomatološkoj ordinaciji",

"saloni lepote":
  "salonu lepote",

"kozmetički saloni":
  "kozmetičkom salonu",

"auto servisi":
  "auto servisu",

"restorani":
  "restoranu",

"hoteli":
  "hotelu",

"privatne klinike":
  "privatnoj klinici",

"teretane":
  "teretani"

};

return (
map[normalized] ||
category
);
}

// ==================================================
// ADDITIONAL POINT
// ==================================================

function buildAdditionalPoint(
features
) {
const unique =
uniqueStrings(
features
);

if (!unique.length) {
return "";
}

const limited =
unique
.slice(0, 5)
.join(", ");

return (
"Dodatno, rešenje se može proširiti funkcionalnostima kao što su " +
limited +
"."
);
}

function buildEmailSubject({
  businessName,
  category,
  city
}) {
  const categoryPart =
    category ? ` • ${category}` : "";
  const cityPart =
    city ? ` • ${city}` : "";

  return `AI chatbot za ${businessName}${categoryPart}${cityPart}`.trim();
}

function buildEmailPreheader({
  businessName,
  category,
  city
}) {
  const categoryPart =
    category ? ` ${category}` : "";
  const cityPart =
    city ? ` u ${city}` : "";

  return `Pogledajte kako chatbot može da odgovara na poruke, prihvata termine i povećava prodaju za ${businessName}${categoryPart}${cityPart}.`;
}

function resolveAnalysisText(
analysis,
keys
) {
for (const key of keys) {
  const value =
    cleanText(
      analysis?.[key]
    );

  if (value) {
    return value;
  }
}

return "";
}

// ==================================================
// HTML HELPERS
// ==================================================

function sectionLabel(
label,
color
) {
return `
<div style="color:${color}; font-size:11px; line-height:1.2; font-weight:800; letter-spacing:1.15px; text-transform:uppercase;">${escapeHtml(label)}</div>
`;
}

function analysisCardHtml(
number,
text,
colors
) {
return `
<div style=" margin-bottom:10px; padding:17px 18px; border:1px solid ${colors.analysisBorder}; border-radius:13px; background:${colors.analysisBackground}; " >

  <div
    style="
      width:28px;
      height:28px;
      line-height:28px;
      border-radius:8px;
      background:
        linear-gradient(
          145deg,
          ${colors.primaryLight},
          ${colors.primary}
        );
      color:#ffffff;
      text-align:center;
      font-size:10px;
      font-weight:800;
    "
  >
    ${escapeHtml(number)}
  </div>

  <div
    style="
      margin-top:11px;
      color:${colors.textSecondary};
      font-size:13px;
      line-height:1.8;
    "
  >
    ${paragraph(text)}
  </div>

</div>

`;
}

function problemCardHtml(
number,
text,
colors
) {
return `
<div style=" margin-bottom:9px; padding:15px 17px; border:1px solid ${colors.border}; border-radius:12px; background:${colors.white}; " >

  <table
    role="presentation"
    cellspacing="0"
    cellpadding="0"
    border="0"
    width="100%"
  >
    <tr>

      <td
        valign="top"
        style="
          width:30px;
          padding-right:11px;
        "
      >

        <div
          style="
            width:25px;
            height:25px;
            line-height:25px;
            border-radius:50%;
            background:#F1E8FF;
            color:${colors.primary};
            text-align:center;
            font-size:9px;
            font-weight:800;
          "
        >
          ${escapeHtml(number)}
        </div>

      </td>

      <td
        valign="top"
        style="
          color:${colors.textSecondary};
          font-size:13px;
          line-height:1.75;
        "
      >
        ${paragraph(text)}
      </td>

    </tr>
  </table>

</div>

`;
}

function solutionCardHtml(
number,
text,
colors
) {
return `
<div style=" margin-bottom:10px; padding:16px 17px; border:1px solid ${colors.solutionBorder}; border-radius:13px; background:${colors.white}; " >

  <table
    role="presentation"
    cellspacing="0"
    cellpadding="0"
    border="0"
    width="100%"
  >
    <tr>

      <td
        valign="top"
        style="
          width:34px;
          padding-right:11px;
        "
      >

        <div
          style="
            width:30px;
            height:30px;
            line-height:30px;
            border-radius:9px;
            background:
              linear-gradient(
                145deg,
                ${colors.primaryLight},
                ${colors.primary}
              );
            color:#ffffff;
            text-align:center;
            font-size:9px;
            font-weight:800;
          "
        >
          ${escapeHtml(number)}
        </div>

      </td>

      <td
        valign="top"
        style="
          color:${colors.textSecondary};
          font-size:13px;
          line-height:1.8;
        "
      >
        ${paragraph(text)}
      </td>

    </tr>
  </table>

</div>

`;
}

function miniInfoCell(
label,
value
) {
return `
<td valign="top" width="33.33%" style="padding:4px;" >
<div style=" padding:11px 12px; border:1px solid #E9E3EF; border-radius:10px; background:#FCFAFE; " >

    <div
      style="
        color:#847D8D;
        font-size:8px;
        line-height:1.2;
        font-weight:700;
        letter-spacing:.07em;
        text-transform:uppercase;
      "
    >
      ${escapeHtml(label)}
    </div>

    <div
      style="
        margin-top:5px;
        color:#2C2635;
        font-size:11px;
        line-height:1.45;
        font-weight:700;
      "
    >
      ${escapeHtml(value)}
    </div>

  </div>
</td>

`;
}

function bulletParagraph(
value,
color
) {
return `
<div style=" margin-bottom:7px; " >

  <span
    style="
      display:inline-block;
      width:5px;
      height:5px;
      margin:0 7px 1px 1px;
      border-radius:50%;
      background:${color};
    "
  ></span>

  ${paragraph(value)}

</div>

`;
}

function paragraph(
value
) {
if (!value) {
return "";
}

return escapeHtml(
String(value)
).replace(
/\n/g,
"<br>"
);
}

// ==================================================
// UTILS
// ==================================================

function cleanText(
value
) {
if (
typeof value !== "string"
) {
return "";
}

return value
.replace(
/\s+/g,
" "
)
.trim();
}

function uniqueStrings(
value
) {
if (
!Array.isArray(value)
) {
return [];
}

const result = [];

for (
const item of value
) {
const text =
cleanText(item);

if (!text) {
  continue;
}

if (
  result.some(
    (existing) =>
      existing.toLowerCase() ===
      text.toLowerCase()
  )
) {
  continue;
}

result.push(text);

}

return result;
}

function containsText(
items,
value
) {
const target =
cleanText(
value
).toLowerCase();

if (!target) {
return true;
}

return items.some(
(item) =>
cleanText(
item
).toLowerCase() ===
target
);
}

function escapeHtml(
value
) {
return String(
value ?? ""
).replace(
/[&<>"']/g,
function (
character
) {
const map = {
"&": "&amp;",
"<": "&lt;",
">": "&gt;",
'"': "&quot;",
"'": "&#39;"
};

  return map[
    character
  ];
}

);
}

function escapeAttribute(
value
) {
return escapeHtml(
String(
value ?? ""
).replace(
/[\r\n]/g,
""
)
);
}