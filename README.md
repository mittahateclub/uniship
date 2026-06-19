# UniShip

UniShip is a university placement and testing platform for students,
university administrators, and super administrators. It combines assessments,
proctoring, internships, event management, and career tools in one application.

## Features

- **Multi-tier roles:** Dedicated student, university administrator, and super
  administrator experiences.
- **Test portal:** Monaco-powered coding assessments with real-time
  proctoring.
- **AI analysis:** Test generation and evaluation powered by Groq and
  LlamaParse.
- **Resume builder:** Create, tailor, store, and export professional resumes.
- **Placement management:** Publish events and internships, manage students,
  and review applications.

## Technology

- **Framework:** Next.js 16 with the App Router
- **Frontend:** React 19, Tailwind CSS 4, and Phosphor Icons
- **Backend:** Next.js Route Handlers and Server Actions
- **Database:** Firebase Authentication, Firestore, and Cloud Storage
- **Artificial intelligence:** Groq SDK and LlamaParse
- **Development:** TypeScript, ESLint, and Monaco Editor

## Local setup

1. Clone the repository.

   ```bash
   git clone https://github.com/your-username/uniship.git
   cd uniship
   ```

1. Install dependencies.

   Node.js 22 LTS is required. See `.nvmrc`.

   ```bash
   npm ci
   ```

1. Create `.env.local` in the project root.

   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_CLIENT_EMAIL=your_service_account_email
   FIREBASE_PRIVATE_KEY="your_service_account_private_key"

   GROQ_API_KEY=your_groq_key
   LLAMA_CLOUD_API_KEY=your_llamaparse_key
   CRON_SECRET=your_random_secret
   ```

1. Start the development server.

   ```bash
   npm run dev
   ```

1. Run all verification checks.

   ```bash
   npm run ci
   ```

## Cron worker setup

The test-document processor uses a durable Firestore queue. The browser starts
new jobs immediately. Vercel Cron also calls `/api/jobs/process-tests` as a
recovery mechanism for jobs that were queued while the browser disconnected.

`CRON_SECRET` is a private random password used only to prove that the scheduled
request came from Vercel. Vercel automatically sends it in the request's
`Authorization` header.

Generate a secret in PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Then:

1. Copy the generated value.
1. Open the project in the Vercel dashboard.
1. Go to **Settings**, then **Environment Variables**.
1. Add `CRON_SECRET` with the generated value.
1. Enable it for **Production**. You may also enable Preview and Development.
1. Redeploy the project.

For local testing, add the same variable to `.env.local`. Do not put the actual
secret in this README or commit it to Git.

The schedule is configured in `vercel.json`. The default is once per day at
03:00 UTC so it works on Vercel Hobby:

```json
"schedule": "0 3 * * *"
```

Vercel Hobby only supports daily cron jobs. On Vercel Pro, change the schedule
to the following if you want recovery checks every minute:

```json
"schedule": "* * * * *"
```

## Firebase deployment

The queue, notification summaries, chat pagination, and aggregate queries need
the repository's current Firestore and Storage rules and indexes.

```bash
firebase deploy --only "firestore,storage" --project uniship-4c1a1
```

## Verification and performance budgets

```bash
npm run lint
npm run typecheck
npm audit
npm run build
npm run check:perf
```

`npm run ci` runs all of these commands. GitHub Actions runs the same checks on
pushes and pull requests.

The application also reports Core Web Vitals to
`/api/metrics/web-vitals`. Production logs contain structured `web_vital`
events for LCP, INP, CLS, FCP, and TTFB.

## Project structure

```text
├── app/
│   ├── (protected)/     # Role-based application routes
│   ├── actions/         # Server actions and queue creation
│   └── api/             # API routes, workers, and metrics
├── components/          # Shared UI components
├── contexts/            # Authentication context
├── lib/                 # Firebase, AI, compiler, and domain utilities
├── scripts/             # Build and performance checks
└── public/              # Static assets
```
