# 🪐 Rafiki — your little alien friend who explores the web for you

**Rafiki** (*"friend"* in Swahili) is a talking 3D companion that lives on a tiny planet. Ask it anything, out loud or by typing. It **plans** a research trail with **NVIDIA Nemotron**, **searches** the live web with **Tavily**, and **tells you** the answer with its own voice while a cited briefing streams in next to it. The sources it found become little **moons** that orbit its planet.

> Built for the **Nebius × NVIDIA Global AI Hackathon** — track: **Best Apps and Agents**.
> Runs on **NVIDIA Nemotron 3 (Nano · Super · Ultra)** served by **Nebius Token Factory**.

---

## ✨ What makes it different

| | |
|---|---|
| 🧸 **A character, not a chatbot** | Rafiki is fully procedural three.js (no model files). It breathes, blinks, follows your cursor with its eyes, perks its antennae when listening, hops with joy when results land, and lip-syncs to its own voice. |
| 🗣️ **Voice in, voice out** | Push-to-talk (hold <kbd>Space</kbd> or tap the mic). Rafiki starts speaking its answer **before the written answer has finished streaming**. Voice runs on the open-source **Kokoro-82M** neural TTS *inside your browser*, with Web Speech as a fallback. |
| 🌙 **Search results as a world** | Every source becomes a glowing moon orbiting Rafiki's planet. Hover a citation `[3]` in the answer and moon 3 swells. Click a moon to open the page. The sky shifts color with the mood of the topic. |
| 🧠 **Right-sized Nemotron routing** | *Nano* plans queries and follow-ups (fast, cheap). *Super* writes cited answers. *Ultra* takes over in **Deep Dive**, reading full pages and reasoning, and you can watch its thinking live. |
| 🔍 **Transparent agent** | A live journey (Plan → Search → Read → Write), the exact queries it ran, and a per-step latency and token breakdown showing which model did what. |
| 🔌 **MCP server included** | Rafiki's research skills are exposed over the **Model Context Protocol**, so Claude Desktop, Cursor, Hermes Agent, NemoClaw/OpenShell, or any MCP client can use them. |
| 📓 **Journal** | Past explorations are stored locally in your browser. Conversation context carries over, so follow-ups like *"what about the second one?"* just work. |

---

## 🏗️ How it works

```
 ┌──────────── Browser ────────────┐          ┌──────────────── Rafiki agent (Node + Hono) ───────────────┐
 │ three.js / R3F world + Rafiki   │  POST    │ 1. PLAN   Nemotron 3 Nano  → JSON: queries, mood, emoji     │
 │ Web Speech STT (push-to-talk)   │ /api/ask │ 2. SEARCH Tavily ×N in parallel (+images, favicons)         │
 │ Kokoro-82M TTS (WebWorker/ONNX) │ ───────▶ │ 2b.READ   Tavily Extract full pages   (Deep Dive only)      │
 │ lip-sync via Web Audio analyser │ ◀─ SSE ─ │ 3. WRITE  Nemotron 3 Super / Ultra → <say>…</say> + cited MD │
 │ motion (Framer) UI              │  events  │    ∥     Nemotron 3 Nano → 3 follow-up questions            │
 └─────────────────────────────────┘          └───────────────── Nebius Token Factory ─────────────────────┘
```

* **Streaming protocol.** The server streams typed events (`stage`, `plan`, `sources`, `images`, `reasoning`, `say`, `token`, `related`, `metrics`) over Server-Sent Events. A small state machine splits Nemotron's output into *reasoning* (`<think>` or `reasoning_content`), the *spoken line* (`<say>`), and the *markdown answer*, so each part goes to the right place: the thought bubble, the voice, or the panel.
* **Reasoning control.** Nemotron's `enable_thinking` chat-template flag is turned off for the fast planning calls and on for Deep Dive. If an endpoint rejects the flag, Rafiki drops it automatically.
* **Model auto-resolve.** At boot Rafiki lists `GET /v1/models` on Token Factory and fixes any mismatched Nemotron id (case, version), so a renamed model doesn't break the demo.

## 🧰 Stack

- **Models:** NVIDIA Nemotron 3 Nano / Super / Ultra via **Nebius Token Factory** (OpenAI-compatible API)
- **Search:** Tavily Search + Extract
- **3D:** three.js, @react-three/fiber, @react-three/drei, @react-three/postprocessing (bloom)
- **UI:** React 19, Vite, motion (Framer Motion), zustand, react-markdown
- **Voice:** Kokoro-82M (Apache-2.0) via `kokoro-js` / ONNX Runtime Web; Web Speech API for speech-to-text
- **Agent server:** Node 22, Hono, `openai` SDK
- **Interop:** `@modelcontextprotocol/sdk` (stdio MCP server)

---

## 🚀 Run it

**Requirements:** Node 22+. A [Nebius Token Factory](https://tokenfactory.nebius.com) API key and a [Tavily](https://app.tavily.com) API key.

```bash
git clone https://github.com/ErnestKapesa/Rafiki.git
cd Rafiki
npm install
cp .env.example .env     # add NEBIUS_API_KEY and TAVILY_API_KEY
npm run dev              # web on http://localhost:5173, agent on :8787
```

Without keys, Rafiki starts in **demo mode** with canned results, so you can explore the UI offline.

Use Chrome or Edge for speech recognition. Click **✨ HD voice** to download the ~90 MB Kokoro voice once; after that it runs locally.

### Production / Nebius deployment

```bash
npm run build && npm start          # serves dist/ + API on :8787
# or
docker build -t rafiki . && docker run -p 8787:8787 --env-file .env rafiki
```

The Docker image is a single stateless container. It can run on **Nebius Serverless Endpoints** (expose port 8787 and set the two API keys as env vars), on a Nebius AI Cloud VM, or on any container host.

### Environment

| Var | Default | Purpose |
|---|---|---|
| `NEBIUS_API_KEY` | — | Token Factory key |
| `NEBIUS_BASE_URL` | `https://api.tokenfactory.us-central1.nebius.com/v1/` | Token Factory endpoint (use your region's URL if it differs) |
| `MODEL_FAST` | `nvidia/nvidia-nemotron-3-nano-30b-a3b` | planner + follow-ups |
| `MODEL_SMART` | `nvidia/nemotron-3-super-120b-a12b` | Quick answers |
| `MODEL_DEEP` | `nvidia/Nemotron-3-Ultra-550b-a55b` | Deep Dive reasoning |
| `TAVILY_API_KEY` | — | web search |
| `RAFIKI_MOCK` | `0` | `1` = canned data |

## 🔌 Use Rafiki from any MCP client

```json
{
  "mcpServers": {
    "rafiki": {
      "command": "npx",
      "args": ["tsx", "server/mcp.ts"],
      "cwd": "/absolute/path/to/Rafiki",
      "env": { "NEBIUS_API_KEY": "…", "TAVILY_API_KEY": "…" }
    }
  }
}
```

Tools:
- `rafiki_research(question, deep?)` returns a cited answer written by Nemotron.
- `rafiki_search(query, news?)` returns raw Tavily results.

## ⌨️ Controls

| | |
|---|---|
| Hold <kbd>Space</kbd> | talk to Rafiki |
| <kbd>/</kbd> | focus the text box |
| ⚡ / 🌌 | Quick vs Deep Dive |
| Hover a `[n]` citation | highlights that source's moon |
| 📓 | journal of past explorations |

## 📁 Layout

```
server/   agent.ts (plan→search→read→write pipeline) · nebius.ts · tavily.ts · mcp.ts · index.ts
shared/   types.ts (SSE event contract)
src/      scene/ (World, Rafiki) · ui/ (AnswerPanel, Composer) · voice/ (Kokoro worker, STT, lip-sync) · lib/
```

## 📜 License

[MIT](LICENSE) © Ernest Kapesa
