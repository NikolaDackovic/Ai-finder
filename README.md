# AI Prospect Finder

AI Prospect Finder is a local web app for finding and reviewing business leads. It searches for businesses by category and location, crawls their public websites, gathers publicly listed contact details, analyzes website signals, scores each lead, and prepares a personalized outreach draft.

## Features

- Discover prospects with the Serper search API.
- Crawl public website pages and collect source URLs and public email addresses.
- Analyze website content with OpenAI or Gemini and score leads.
- Review lead evidence, qualification, and generated outreach drafts in a web dashboard.
- Track outreach status and follow-up dates.
- Optionally generate a personalized offer PDF from a supplied master PDF.
- Send email through SMTP. Test mode is enabled by default and redirects messages to a test recipient.

## Requirements

- Node.js 20 or newer
- npm
- A Serper API key
- An OpenAI or Gemini API key
- SMTP credentials only if you want to test or send emails

## Setup

Install dependencies:

```bash
npm install
```

Copy `.env.example` to `.env` (PowerShell):

```powershell
Copy-Item .env.example .env
```

Then edit `.env` and add the credentials and business details you need. Keep `.env` private; it is ignored by Git.

At minimum, configure:

- `SERPER_API_KEY`
- `OPENAI_API_KEY`, or set `AI_PROVIDER=gemini` and configure `GEMINI_API_KEY`
- `YOUR_NAME`, `YOUR_COMPANY`, and your preferred contact details for outreach drafts

To use the optional PDF features:

- Set `MASTER_PDF` to your master offer PDF (defaults to `./templates/master-offer.pdf`) for personalized PDF generation.
- Place the PDF attachment used by the email sender at `src/resenje.pdf`.

These PDFs are intentionally excluded from Git. Add your own files locally.

## Run

Start the development server:

```bash
npm run dev
```

Or run without watch mode:

```bash
npm start
```

Open [http://localhost:3030](http://localhost:3030) (or the port configured in `PORT`). The app has no authentication; keep it on a trusted local machine and do not expose it directly to the public internet.

## Using the app

1. Enter a business category and location.
2. Choose the maximum number of leads and minimum score.
3. Start a campaign and review the evidence and generated draft for each lead.
4. Update lead status as you manage outreach.
5. If email is configured, verify SMTP and test delivery before using live mode.

The app only uses public website information, but generated analysis and contact details can be incomplete or incorrect. Review all evidence and drafts before contacting anyone.

## Email safety

Email is not sent by lead discovery. If you configure SMTP and use the explicit send action, `EMAIL_TEST_MODE=true` (the default) redirects the message to `EMAIL_TEST_TO` instead of the prospect. Configure both SMTP settings and a test recipient before testing.

Only set `EMAIL_TEST_MODE=false` after checking the recipient, message, attachment, and applicable email/privacy rules. Live sending will deliver to the selected prospect.

## Generated and private files

The following local data is excluded from Git:

- `.env` credentials
- `data/leads/` prospect records and generated drafts
- `data/lead-history.json`
- PDFs containing offer or business-specific material
- generated files under `output/`

Each saved lead is stored under `data/leads/YYYY-MM-DD/` with its analysis, contact details, outreach draft, and source URLs.

## Configuration

See `.env.example` for the supported environment variables, including search locale, crawl limits, AI provider/model, SMTP, test mode, and PDF paths.
