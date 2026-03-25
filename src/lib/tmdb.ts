const TMDB_BASE_URL = "https://api.themoviedb.org/3";

function getApiKey() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDB_API_KEY is not set.");
  }
  return apiKey;
}

type TmdbFetchOptions = {
  revalidate?: number;
};

function isV3ApiKey(value: string) {
  return /^[a-f0-9]{32}$/i.test(value);
}

export async function tmdbFetch<T>(
  path: string,
  searchParams: Record<string, string | number | undefined> = {},
  options: TmdbFetchOptions = {}
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${TMDB_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: HeadersInit = {
    Accept: "application/json"
  };

  // Support both TMDB credential formats:
  // - v3 API key: query param api_key
  // - v4 read access token: Bearer header
  if (isV3ApiKey(apiKey)) {
    url.searchParams.set("api_key", apiKey);
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    headers,
    next: options.revalidate ? { revalidate: options.revalidate } : undefined
  });

  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
