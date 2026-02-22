const SEARXNG_URL = process.env.SEARXNG_URL || 'http://localhost:8080';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  engine: string;
}

export async function webSearch(
  query: string,
  category: string = 'general',
  limit: number = 10,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    categories: category,
  });

  const response = await fetch(`${SEARXNG_URL}/search?${params}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    return [{ title: 'Search error', url: '', snippet: `SearXNG returned HTTP ${response.status}`, engine: 'error' }];
  }

  const data = await response.json();
  return (data.results || []).slice(0, limit).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
    engine: r.engine || '',
  }));
}
