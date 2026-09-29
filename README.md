# 🪐 Rafiki: explore the internet with a friend

**Rafiki** (*"friend"* in Swahili) turns web search into a cozy adventure game. You hatch a plush little companion from a star, dress it up, and head out on **expeditions** across the web together.

Ask out loud or type. Rafiki plans the trip with **NVIDIA Nemotron**, scouts the live web with **Tavily**, and tells you what it found in its own voice. Every source becomes a **mystery world** orbiting its planet: visit them to *discover* them. Then ace the **pop quiz**, follow the **trail** of follow-up questions, finish **daily quests**, earn **XP and stardust**, level up, unlock outfits, and watch your **knowledge galaxy** grow.

> Built for the **Nebius × NVIDIA Global AI Hackathon**, track **Best Apps and Agents**.
> Runs on **NVIDIA Nemotron 3 (Nano · Super · Ultra)** served by **Nebius Token Factory**. Progress is stored in **Supabase**.

---

## ✨ Highlights

| | |
|---|---|
| 🥚 **Hatch your friend** | Onboarding in the style of Tolan: a glowing star in the dark bursts open, the planet rises, and your new friend says hi. |
| 🧸 **A character you design** | Procedural three.js plush with 6 species (bear, bunny, kitty, sprout, alien, unicorn), 8 fur colours, 3 eye styles, patterns, and 10 wearables (scarf, bow, beanie, hibiscus, headphones, top hat, scholar cap, crown, glasses, shades). It breathes, blinks, and follows your cursor; its ears and antennae bounce on springs; it squashes and stretches, hops, spins, and lip-syncs. |
| 🗺️ **Search as expeditions** | Sources launch into orbit as grey **mystery worlds**. Opening one discovers it: the world lights up, you hear a chime, you get XP, and there's a bonus for sites you've never visited. Hover a citation `[3]` and world 3 swells. |
| 📰 **Daily Digest** | Pick your beats (World, Tech & AI, Science, Africa, Money, Sports, Health, Culture). Tavily pulls the day's news, and Nemotron merges it into swipeable story cards with a 2-sentence summary, a "why it matters" line and sources. Listen to any story, turn on auto-narration, or tap **Dig deeper** to start an expedition. |
| 📖 **In-app Reader** | Sources open inside Rafiki. The **Reader** tab shows the clean article (Tavily Extract, works on any site) with a Nemotron **TL;DR** and **Ask this page** Q&A. The **Web page** tab embeds the live site when it allows iframes, checked server-side against `X-Frame-Options` and CSP `frame-ancestors`, with SSRF-safe URL checks. |
| 🪄 **Remix any answer** | Re-tell the same answer from the same sources as **Simpler**, **Key points**, **Go deeper** or **Other views**, streamed by Nemotron. You can switch back to the original at any time. |
| 📱 **Phone-first** | iOS-style tab bar (Home · News · Quests · Closet · More), a draggable answer sheet (peek → full), swipe-to-close sheets, and a compact composer with a Quick/Deep toggle. |
| 🧠 **Pop quizzes** | Nemotron Nano turns each answer into a quick multiple-choice question, so you remember what you learned. |
| 🧭 **Trails** | Follow-up questions chain into trails that pay a combo bonus and draw constellations in your galaxy. |
| 🎯 **Daily quests, streaks, badges, levels** | Three rotating quests a day, a streak flame, 10 badges, 8 level titles from *Stargazer* to *Cosmic Sage*, and a wardrobe shop where you spend stardust. |
| 🌌 **Knowledge galaxy** | A 3D star map of everything you've explored. Deep Dives burn violet and news stories blue, and each trail is a constellation. |
| 🏆 **Leaderboard** | A global ranking of explorers, powered by Supabase. |
| 🗣️ **Voice in, voice out** | Push-to-talk (hold <kbd>Space</kbd>). Default **Cute voice**: open-source Kokoro-82M running in your browser, pitched up a touch and streamed sentence by sentence; while it loads Rafiki speaks soft Animalese-style **Babble**. There's also the system voice or silent. The lips sync to the real audio amplitude. |
| 🔊 **Sound design** | Every sound effect and the ambient music box is synthesized live with the Web Audio API: pops, coins, gem sparkles, discovery chimes, level-up fanfares. No audio files at all. |
| 🎨 **Original sticker icons** | A hand-drawn SVG icon set and character avatars made for Rafiki — no emoji anywhere. |
| 🔌 **MCP server** | Rafiki's research is exposed as MCP tools for Claude Desktop, Cursor, Hermes Agent, NemoClaw, and other MCP clients. |

---

## 🏗️ Architecture

```
 Browser (React 19 + three.js)                     Rafiki agent (Node + Hono)                        Nebius Token Factory
 ┌───────────────────────────────┐   POST /api/ask ┌───────────────────────────────────────────┐   ┌──────────────────────┐
 │ 3D world, Rafiki, worlds      │ ──────────────▶ │ 1 PLAN    Nemotron 3 Nano → queries, mood   │──▶│ nemotron-3-nano      │
 │ Voice: Web Speech STT,        │ ◀── SSE events ─│ 2 SEARCH  Tavily × N in parallel            │   │ nemotron-3-super     │
 │   Kokoro TTS (WebWorker)      │                 │ 2b READ   Tavily Extract (Deep Dive)        │──▶│ nemotron-3-ultra     │
 │ Game engine (local-first)     │                 │ 3 WRITE   Super / Ultra → <say> + cited MD  │   └──────────────────────┘
 │ Web Audio synth               │                 │ 4 QUIZ ∥ FOLLOW-UPS   Nemotron 3 Nano       │
 └──────────────┬────────────────┘                 └───────────────────────────────────────────┘
                │ supabase-js (anon auth + RPC)
                ▼
 Supabase Postgres: profiles, expeditions, discoveries, quizzes, badges, inventory, quest claims
 RLS: players read only their own rows. All rewards are computed in SECURITY DEFINER RPCs.
```

- **Right-sized models.** *Nano* handles the fast, cheap calls: planning, follow-ups, quizzes. *Super* writes the cited answer. *Ultra* reasons through full pages in Deep Dive, and you can watch its reasoning live. Reasoning is turned off (`enable_thinking: false`) where speed matters and on for Deep Dive.
- **Streaming protocol.** Typed SSE events (`stage`, `plan`, `sources`, `images`, `reasoning`, `say`, `token`, `quiz`, `related`, `metrics`). A chunk-boundary-safe splitter (`server/splitter.ts`) routes `<think>` to the reasoning panel, `<say>` to the voice (Rafiki starts talking before the answer finishes), and the rest to markdown.
- **Robust to renames.** At boot the server lists `/v1/models` and fixes any mismatched Nemotron id.
- **Game engine, twice.** `shared/game.ts` holds all the numbers. `src/game/engine.ts` applies them instantly in the browser. `supabase/migrations/*.sql` applies the same rules server-side as the authority. Tests replay the same scenario against both.

## 🔐 Security model (Supabase)

- Anonymous sign-in on first visit (no signup wall). An email can be attached later via magic link.
- Row-level security on every table: players can **read** only their own rows and cannot write any table directly (tested).
- XP, stardust, streaks, badges, quest claims and purchases are **only** changed by `SECURITY DEFINER` RPCs that validate input: rate limit, one quiz per expedition, one discovery per URL, `http(s)` URLs only, level and price checks, today's quests only, and only owned cosmetics can be worn.
- Internal helpers are revoked from `anon` and `authenticated`. The leaderboard exposes names, level and look only.

---

## 🚀 Run it

**Needs:** Node 22+. Keys for [Nebius Token Factory](https://tokenfactory.nebius.com) and [Tavily](https://app.tavily.com). Supabase is optional.

```bash
git clone https://github.com/ErnestKapesa/Rafiki.git && cd Rafiki
npm install
cp .env.example .env        # add NEBIUS_API_KEY + TAVILY_API_KEY (+ Supabase, optional)
npm run dev                 # web :5173 · agent :8787
```

No keys? It starts in **demo mode** with canned results, so the whole game loop still works.

### Supabase (cloud saves and the leaderboard)

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration: `supabase db push` with the CLI, or paste `supabase/migrations/20260929000000_rafiki_game.sql` into the SQL editor.
3. **Authentication → Providers → enable Anonymous sign-ins.**
4. Put the project URL and anon key into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

A green dot next to the counters means progress is syncing.

### Deploy (Nebius Serverless Endpoints / AI Cloud / any container host)

```bash
docker build -t rafiki \
  --build-arg VITE_SUPABASE_URL=https://xyz.supabase.co --build-arg VITE_SUPABASE_ANON_KEY=... .
docker run -p 8787:8787 --env-file .env rafiki
```

The `VITE_*` values are compiled into the web bundle, so they're passed as build args. The API keys stay server-side at runtime.

### Vercel (recommended)

The repo ships ready for Vercel: `vercel.json` builds the static app, and `api/[[...route]].ts` runs the streaming agent as a Vercel Function. Step-by-step instructions, including Supabase, are in **[DEPLOY.md](DEPLOY.md)**:

```bash
vercel link && vercel env add NEBIUS_API_KEY production   # …and the other vars
npm run deploy
```

### Environment

| Var | Purpose |
|---|---|
| `NEBIUS_API_KEY`, `NEBIUS_BASE_URL` | Token Factory (OpenAI-compatible) |
| `MODEL_FAST` / `MODEL_SMART` / `MODEL_DEEP` | Nemotron 3 Nano / Super / Ultra ids |
| `TAVILY_API_KEY` | web search + extract |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | optional cloud saves |
| `RAFIKI_MOCK=1` | canned data |

---

## ✅ Quality assurance

| Command | What it checks |
|---|---|
| `npm run typecheck` | Strict TypeScript across client, server and shared code |
| `npm test` | Unit tests: game rules, level curve, streaks, trail caps, quest claiming, **engine ↔ SQL parity** (scenario and 45 days of quest picks), the stream splitter under every chunk size, and quiz shuffling |
| `npm run test:sql` | Runs the migration on a throwaway Postgres with a stubbed `auth` schema and checks rewards, rate limits, RLS isolation, blocked direct writes, purchases, character validation, quest claims and the leaderboard |
| `npm run e2e` | Plays the game in headless Chromium at desktop and phone sizes: hatch → name → customize → expedition → discover worlds → quiz → trail → quests → badges → wardrobe purchase → galaxy → leaderboard → reload persistence. Asserts exact XP and stardust at each step, plus zero runtime errors (start `RAFIKI_MOCK=1 npm run dev` first) |
| `/#gallery`, `/#icons` | Visual QA sheets: every species/colour/accessory in 3D, and the full sticker icon set |

## 🔌 MCP

```json
{ "mcpServers": { "rafiki": { "command": "npx", "args": ["tsx", "server/mcp.ts"], "cwd": "/abs/path/Rafiki",
  "env": { "NEBIUS_API_KEY": "…", "TAVILY_API_KEY": "…" } } } }
```

The server exposes two tools. `rafiki_research(question, deep?)` returns a cited answer written by Nemotron. `rafiki_search(query, news?)` returns raw Tavily results.

## 📁 Layout

```
server/     agent.ts (plan→search→read→write→quiz), splitter.ts, nebius.ts, tavily.ts, mcp.ts, index.ts
shared/     types.ts (SSE contract), game.ts (rules, badges, quests, shop, palettes)
src/scene/  World.tsx (sky, planet, hatch orb, mystery worlds), Rafiki.tsx (the character)
src/game/   engine.ts (local rules), store.ts (sync + rewards), actions.ts
src/ui/     Hud, Onboarding, Customizer, AnswerPanel, Composer, Sheets, Galaxy, RewardLayer, Icon
src/audio/  sfx.ts (Web Audio synth + music box)      src/voice/  STT, TTS, Kokoro worker, lip-sync
supabase/   migrations/ (schema, RLS, RPCs)             tests/  unit, sql, e2e
```

## 📜 License & credits

[MIT](LICENSE) © Ernest Kapesa. Voice: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0).
