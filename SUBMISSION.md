# Rafiki: hackathon submission kit

## Category
**Best Apps and Agents.** Rafiki is an app people would actually use every day. It runs on Nemotron via Token Factory and uses Nano, Super, and Ultra, each for the kind of call it's best at.

## One-liner
Rafiki is a talking 3D alien friend. It researches the live web with NVIDIA Nemotron on Nebius Token Factory and answers out loud, and the sources it cites orbit its planet as moons.

## Description (paste into Devpost)

**What.** Rafiki (Swahili for *friend*) turns web search into a conversation with a character. Hold Space and ask a question. Rafiki perks up its antennae and listens. It thinks, with thought-motes swirling around it. It sends its searches out across the web, and the pages it finds launch into orbit as glowing moons. Then it tells you the answer in its own voice, while a cited briefing streams in beside it. Hover any citation and its moon lights up.

**Why.** Search today means a wall of blue links, or a chatbot that hides where its facts came from. We wanted search to feel warm, fast, and trustworthy: something you'd talk to on the couch, that a kid could use, and that is still honest about its sources. We also wanted to prove that open NVIDIA models on independent infrastructure can power a consumer-grade experience.

**How.**
1. **Plan:** *Nemotron 3 Nano* (reasoning off, for speed) turns the question plus conversation history into 1–4 targeted search queries. It also picks the topic's mood, which recolors the sky, and an emoji.
2. **Search:** the queries fan out to **Tavily** in parallel. Results are deduplicated and ranked, and images and favicons are collected.
3. **Read (Deep Dive only):** Tavily Extract pulls the full text of the top pages.
4. **Write:** *Nemotron 3 Super* (Quick) or *Nemotron 3 Ultra* (Deep Dive, reasoning on) streams a `<say>` line for the voice, followed by a markdown answer with `[n]` citations. A streaming parser routes reasoning, speech, and answer text to different parts of the UI. Rafiki starts talking before the answer has finished writing.
5. In parallel, *Nano* generates "wander further" follow-up questions.

Everything streams over SSE, and the UI shows which Nemotron model handled each step, how long it took, and how many tokens it used.

**Open source everywhere:** NVIDIA Nemotron models; Kokoro-82M neural TTS running in the browser via ONNX; three.js / React Three Fiber; the MCP SDK, so Rafiki's research tools can plug into any MCP agent (Hermes, NemoClaw, Claude Desktop, Cursor). MIT licensed.

**Nebius:** all LLM inference runs on **Nebius Token Factory** through its OpenAI-compatible API. The app ships as a single Docker container, ready for **Nebius Serverless Endpoints**.

## 3-minute demo video script

| Time | Shot | Voice-over |
|---|---|---|
| 0:00–0:15 | Rafiki idling on its planet, eyes following the cursor | "This is Rafiki, my little alien friend who explores the internet for me." |
| 0:15–0:50 | Hold Space: "What happened in AI this week?" Antennae perk, sky turns teal, thought motes, moons launch, Rafiki hops and starts talking | "I just talk to it. Nemotron 3 Nano on Nebius Token Factory plans the searches, Tavily searches in parallel, and every source becomes a moon." |
| 0:50–1:20 | Hover citations → moons glow; scroll the answer, images, metrics bar | "Every claim is cited. Hover one and its moon lights up. This panel shows exactly which Nemotron model did each step, and how fast." |
| 1:20–1:55 | Switch to 🌌 Deep Dive, ask a hard question; show "Nemotron is reasoning…" live | "For hard questions, Deep Dive reads full pages and hands them to Nemotron 3 Ultra. You can watch it reason." |
| 1:55–2:15 | Click a follow-up chip; then ask "what about the second one?" | "It remembers the conversation, and suggests where to wander next." |
| 2:15–2:35 | Toggle ✨ HD voice | "The voice is Kokoro, an open-source neural TTS running entirely in my browser." |
| 2:35–2:50 | Claude Desktop / Cursor calling `rafiki_research` via MCP | "And Rafiki is an MCP server, so any agent can borrow its research skills." |
| 2:50–3:00 | Rafiki waves | "Rafiki: open models, open infrastructure, and a friend who searches for you." |

## Feedback template (fill in with your real experience)
- **Token Factory:** OpenAI compatibility meant zero SDK changes; time-to-first-token for Nano vs Super; anything confusing about model ids or regions.
- **Nemotron 3:** how well Nano follows JSON-only prompts; Super's citation discipline; Ultra reasoning quality versus latency; the `enable_thinking` toggle.
- **What we'd love:** a TTS/ASR model on Token Factory (e.g. NVIDIA Riva/Parakeet/Magpie), so voice could run on Nebius too.

## If the project existed before
It didn't. Rafiki was built from scratch during the submission period.
