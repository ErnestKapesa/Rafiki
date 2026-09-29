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
  depth?: "basic" | "advanced";
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
      query,
      search_depth: opts.depth ?? "basic",
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

export async function tavilyExtract(urls: string[]): Promise<{ url: string; raw_content: string }[]> {
  const res = await fetch(`${API}/extract`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({ urls, extract_depth: "basic" }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: { url: string; raw_content: string }[] };
  return json.results ?? [];
}
