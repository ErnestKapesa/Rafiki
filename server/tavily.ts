export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string | null;
  favicon?: string;
  published_date?: string;
};

export type TavilyImage = { url: string; description?: string };

export type TavilyResponse = {
  query: string;
  answer?: string;
  results: TavilyResult[];
  images: (TavilyImage | string)[];
  response_time?: number;
};

export type SearchOptions = {
  /** fast = low-latency chunks (voice-friendly); advanced = highest relevance. */
  depth?: "ultra-fast" | "fast" | "basic" | "advanced";
  topic?: "general" | "news";
  maxResults?: number;
  timeRange?: "day" | "week" | "month" | "year";
};

const API = process.env.TAVILY_BASE_URL || "https://api.tavily.com";

export async function tavilySearch(query: string, opts: SearchOptions = {}): Promise<TavilyResponse> {
  const res = await fetch(`${API}/search`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query: query.slice(0, 390), // Tavily: keep queries under 400 chars
      search_depth: opts.depth ?? "fast",
      ...(opts.depth === "advanced" || opts.depth === "fast" || !opts.depth ? { chunks_per_source: 3 } : {}),
      topic: opts.topic ?? "general",
      max_results: opts.maxResults ?? 6,
      time_range: opts.timeRange,
      include_images: true,
      include_image_descriptions: true,
      include_favicon: true,
      include_answer: false,
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as TavilyResponse;
}

/**
 * Targeted extraction: with `query` + `chunks_per_source`, Tavily returns only the
 * most relevant passages of each page instead of the whole thing — no context blow-up.
 */
export async function tavilyExtract(urls: string[], query?: string): Promise<{ url: string; raw_content: string }[]> {
  const res = await fetch(`${API}/extract`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      urls: urls.slice(0, 20),
      extract_depth: "basic",
      ...(query ? { query: query.slice(0, 390), chunks_per_source: 5 } : {}),
      timeout: 20,
    }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: { url: string; raw_content: string }[] };
  return json.results ?? [];
}
