# Rafiki: hackathon submission kit

## Category
**Best Apps and Agents.** It's an everyday app. Nemotron 3 Nano, Super and Ultra on Token Factory are each routed to the job they're best at.

## One-liner
Rafiki turns web search into a cozy adventure. Your customizable plush friend explores the internet with you: it talks, cites its sources as worlds to discover, quizzes you, and rewards your curiosity with XP, quests and outfits. It's powered by NVIDIA Nemotron on Nebius Token Factory.

## Description (paste into Devpost)

**What.** Search usually means a wall of links or a chatbot that hides where its facts came from. Rafiki makes finding things out feel like a game you want to come back to:

- You **hatch** your friend from a star and design it: species, fur, eyes, scarf.
- You ask a question out loud. Rafiki goes on an **expedition**: it plans with Nemotron, searches with Tavily, and **tells you the answer in its own voice** while a cited answer streams in.
- Every source becomes a **mystery world** orbiting Rafiki's planet. **Visiting** a source discovers it for XP, with a bonus for sites you've never seen. That nudges people to actually read primary sources.
- A **pop quiz** written by Nemotron Nano checks that you understood the answer.
- **Trails** of follow-up questions earn combo bonuses and draw constellations in your **knowledge galaxy**.
- **Daily quests, streaks, 10 badges, levels and a wardrobe shop** keep curiosity a habit. The **leaderboard** runs on Supabase.

**How (Nebius + NVIDIA).** All LLM inference runs on **Nebius Token Factory** through its OpenAI-compatible API, routed by job:

| Step | Model | Why |
|---|---|---|
| Plan queries, mood, topic | Nemotron 3 **Nano** (reasoning off) | Fast and cheap, keeps the app snappy |
| Cited answer + spoken line | Nemotron 3 **Super** | Quality writing with citation discipline |
| Deep Dive over full pages | Nemotron 3 **Ultra** (reasoning on) | Serious reasoning, shown live |
| Pop quiz + follow-up trails | Nemotron 3 **Nano** | Runs in parallel, cheap |

The answer streams over SSE. A chunk-safe parser splits reasoning, speech and markdown, so Rafiki starts talking before the answer has finished writing. The UI shows each step's model, latency and token count. The whole app ships as one Docker container that can run on **Nebius Serverless Endpoints**.

**Open source throughout:** NVIDIA Nemotron, Kokoro-82M TTS running in the browser, three.js / React Three Fiber, an original hand-drawn SVG icon set, the MCP SDK (Rafiki is also an MCP server), and Supabase. MIT licensed.

**Quality:** 12 unit tests (including engine↔SQL parity), a Postgres scenario suite covering RLS and anti-cheat, and a 46-check end-to-end browser test of the full game loop at desktop and phone sizes.

## 3-minute demo video script

| Time | Shot | Voice-over |
|---|---|---|
| 0:00–0:20 | Dark cosmos, glowing star → tap → it bursts, the planet rises, Rafiki hops out and says "Jambo!" | "Meet Rafiki, a friend who explores the internet with you." |
| 0:20–0:40 | Pick bunny, mint, sparkly eyes; scarf on | "You make it yours." |
| 0:40–1:15 | Hold Space: "What happened in AI this week?" Antennae perk up, thought motes, worlds launch, Rafiki talks, +XP toasts | "Nemotron 3 Nano on Nebius Token Factory plans the search, Tavily scouts the web, and Nemotron 3 Super writes a cited answer. Rafiki starts talking before it's done writing." |
| 1:15–1:40 | Click worlds → they light up, chime, "New world discovered!" | "Every source is a world to discover. Actually reading sources earns rewards." |
| 1:40–2:00 | Pop quiz → correct → happy eyes and confetti; badge unlocked | "Nano writes a pop quiz so you remember what you learned." |
| 2:00–2:20 | Deep Dive, "Nemotron is reasoning…", trail chip → combo | "Deep Dive hands whole pages to Nemotron 3 Ultra, and trails chain your curiosity." |
| 2:20–2:40 | Quests → claim; wardrobe → buy a beanie; galaxy constellation | "Quests, streaks, outfits, and a galaxy of everything you've learned, synced with Supabase." |
| 2:40–3:00 | Under-the-hood metrics; MCP call from Claude Desktop | "Every step shows which Nemotron did the work. Rafiki is open source, and it's also an MCP server." |

## Feedback (fill in with your real experience)
- **Token Factory:** OpenAI compatibility meant zero SDK changes; note model-id and region discovery; time-to-first-token for Nano vs Super.
- **Nemotron 3:** Nano's JSON reliability for planning and quizzes; Super's citation discipline; Ultra's reasoning quality vs latency; the `enable_thinking` toggle.
- **Wish list:** a speech model on Token Factory (e.g. Parakeet ASR / Magpie TTS) so voice could run on Nebius too.

## Existing project?
No. Rafiki was built from scratch during the submission period.
