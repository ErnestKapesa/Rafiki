# Shipping Rafiki to production

Three pieces: **Supabase** (game backend), **Vercel** (web app + agent API), and your **API keys**.

> 🔐 Real keys go in `.env` (git-ignored) locally and in **Vercel → Settings → Environment Variables** in production.
> Never put them in `.env.example`: it's committed, and the hackathon requires a public repo.

## 1. Supabase

Project ref: `xjceyeqsqrorjyyuhcnx`. `.mcp.json` already points Claude Code at its MCP server.

**Option A: through Claude Code (MCP)**
```bash
claude /mcp          # pick "supabase" → Authenticate → finish in the browser
```
Then ask Claude to *"apply supabase/migrations/20260929000000_rafiki_game.sql and run get_advisors"*.

**Option B: Supabase CLI**
```bash
npx supabase login
npx supabase link --project-ref xjceyeqsqrorjyyuhcnx
npm run db:push
```

**Option C: dashboard.** Paste the migration file into the **SQL Editor** and run it.

Then:
1. **Authentication → Sign In / Providers → enable "Allow anonymous sign-ins".**
2. **Project Settings → API**: copy the **Project URL** and the **publishable** (or legacy `anon`) key. Never use the `service_role` or secret key in the browser.
3. Optional: **Advisors → Security / Performance** should show no errors.

## 2. Vercel

`vercel.json` is set up. Vite builds the static app into `dist/`, and `api/[[...route]].ts` serves the streaming agent API as a Vercel Function (max duration 300 s for Deep Dives).

```bash
npm i -g vercel        # or use npx vercel
vercel login
vercel link            # create / link the project
```

Add the environment variables to **Production** (dashboard, or the CLI prompts):
```bash
vercel env add NEBIUS_API_KEY production
vercel env add TAVILY_API_KEY production
vercel env add NEBIUS_BASE_URL production     # e.g. https://api.tokenfactory.us-central1.nebius.com/v1/
vercel env add VITE_SUPABASE_URL production   # https://xjceyeqsqrorjyyuhcnx.supabase.co
vercel env add VITE_SUPABASE_ANON_KEY production
# optional: MODEL_FAST / MODEL_SMART / MODEL_DEEP
```

Or do everything in one go (reads `.env`, pushes the vars to Vercel Production, deploys):
```bash
bash scripts/deploy.sh
```

Deploy:
```bash
npm run deploy         # = vercel --prod
```

## 3. Verify in the browser

1. Open the production URL. The **star → hatch → name → customize** onboarding should play.
2. Check `https://<your-app>.vercel.app/api/health`. It should report `"mock": false` and list the three resolved Nemotron model ids.
3. Ask *"What happened in AI this week?"* You should see the plan, worlds launching, Rafiki speaking, a cited answer and a pop quiz.
4. A **green dot** next to the XP counters means Supabase sync is on. In Supabase, **Table Editor → profiles** should show your row.
5. Open **Leaders**. You should appear on the global leaderboard.

If the answer panel says "demo mode", the API keys aren't set for the Production environment. Redeploy after adding them.
