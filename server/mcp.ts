/**
 * Rafiki as an MCP server (stdio). Plug it into Claude Desktop, Cursor, Hermes
 * Agent, NemoClaw/OpenShell or any MCP client and they get Rafiki's
 * Nemotron-powered, cited web research as a tool.
 *
 *   { "mcpServers": { "rafiki": { "command": "npx", "args": ["tsx", "server/mcp.ts"], "cwd": "/path/to/Rafiki" } } }
 */
import "./env.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { Source } from "../shared/types.js";
import { runAgent } from "./agent.js";
import { resolveModels } from "./nebius.js";
import { tavilySearch } from "./tavily.js";

const server = new McpServer({ name: "rafiki", version: "0.1.0" });

server.registerTool(
  "rafiki_research",
  {
    title: "Rafiki research",
    description:
      "Research a question on the live web. NVIDIA Nemotron plans the queries, Tavily searches, and Nemotron writes a cited markdown answer.",
    inputSchema: {
      question: z.string().describe("What to research"),
      deep: z.boolean().optional().describe("Deep Dive: more queries, full-page reading, Nemotron Ultra reasoning"),
    },
  },
  async ({ question, deep }) => {
    let say = "";
    let answer = "";
    let sources: Source[] = [];
    let error = "";
    for await (const ev of runAgent({ question, mode: deep ? "deep" : "quick" })) {
      if (ev.type === "say") say = ev.text;
      else if (ev.type === "token") answer += ev.text;
      else if (ev.type === "sources") sources = ev.sources;
      else if (ev.type === "error") error = ev.message;
    }
    if (error && !answer) return { content: [{ type: "text", text: `Rafiki hit a snag: ${error}` }], isError: true };
    const refs = sources.map((s) => `[${s.id}] ${s.title} — ${s.url}`).join("\n");
    return { content: [{ type: "text", text: `${say}\n\n${answer}\n\nSources:\n${refs}` }] };
  },
);

server.registerTool(
  "rafiki_search",
  {
    title: "Raw web search",
    description: "Fast raw web search via Tavily. Returns titles, URLs and snippets without LLM synthesis.",
    inputSchema: {
      query: z.string(),
      news: z.boolean().optional().describe("Search recent news instead of the general web"),
    },
  },
  async ({ query, news }) => {
    const res = await tavilySearch(query, { topic: news ? "news" : "general", maxResults: 8 });
    const text = res.results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content}`).join("\n\n");
    return { content: [{ type: "text", text: text || "No results." }] };
  },
);

await resolveModels(console.error);
await server.connect(new StdioServerTransport());
