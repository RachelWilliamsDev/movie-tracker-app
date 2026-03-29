import type { WatchProvidersRegionCode } from "@/lib/watch-providers-region";

/** Raw TMDB watch/provider row (subset we read). */
export type TmdbWatchProviderRow = {
  logo_path?: string | null;
  provider_id?: number;
  provider_name?: string;
  display_priority?: number;
  link?: string | null;
};

export type TmdbCountryWatchProviders = {
  link?: string | null;
  flatrate?: TmdbWatchProviderRow[] | null;
  rent?: TmdbWatchProviderRow[] | null;
  buy?: TmdbWatchProviderRow[] | null;
};

export type TmdbWatchProvidersResponse = {
  id?: number;
  results?: Record<string, TmdbCountryWatchProviders> | null;
};

const LOGO_BASE = "https://image.tmdb.org/t/p/w45";

export type NormalizedWatchProvider = {
  providerId: number;
  providerName: string;
  logoUrl: string | null;
  /** Present only when TMDB includes a per-provider URL (often absent). */
  link: string | null;
};

export type WhereToWatchPayload = {
  region: WatchProvidersRegionCode;
  subscription: NormalizedWatchProvider[];
  rent: NormalizedWatchProvider[];
  buy: NormalizedWatchProvider[];
  /** Region-level JustWatch-style link when TMDB provides it. */
  countryListLink: string | null;
};

function safeHttpUrl(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") {
    return null;
  }
  const t = raw.trim();
  if (t.startsWith("https://") || t.startsWith("http://")) {
    return t;
  }
  return null;
}

function mapRow(row: TmdbWatchProviderRow): NormalizedWatchProvider | null {
  const id = row.provider_id;
  if (typeof id !== "number" || !Number.isFinite(id)) {
    return null;
  }
  const nameRaw = row.provider_name;
  const providerName =
    typeof nameRaw === "string" && nameRaw.trim().length > 0
      ? nameRaw.trim()
      : "Unknown";
  const lp = row.logo_path;
  const logoUrl =
    typeof lp === "string" && lp.length > 0 ? `${LOGO_BASE}${lp}` : null;
  return {
    providerId: id,
    providerName,
    logoUrl,
    link: safeHttpUrl(row.link ?? undefined)
  };
}

function dedupeByProviderId(
  rows: NormalizedWatchProvider[]
): NormalizedWatchProvider[] {
  const seen = new Set<number>();
  const out: NormalizedWatchProvider[] = [];
  for (const r of rows) {
    if (seen.has(r.providerId)) {
      continue;
    }
    seen.add(r.providerId);
    out.push(r);
  }
  return out;
}

function normalizeGroup(
  raw: TmdbWatchProviderRow[] | null | undefined
): NormalizedWatchProvider[] {
  if (raw == null || !Array.isArray(raw)) {
    return [];
  }
  const mapped = raw.map(mapRow).filter((x): x is NormalizedWatchProvider => x != null);
  return dedupeByProviderId(mapped);
}

/**
 * Pick TMDB `results[region]` and map to app-friendly groups.
 * Missing region or empty `results` yields empty groups (no throw).
 */
export function normalizeWhereToWatch(
  body: TmdbWatchProvidersResponse,
  region: WatchProvidersRegionCode
): WhereToWatchPayload {
  const results = body.results;
  if (results == null || typeof results !== "object") {
    return {
      region,
      subscription: [],
      rent: [],
      buy: [],
      countryListLink: null
    };
  }

  const country = results[region];
  if (country == null || typeof country !== "object") {
    return {
      region,
      subscription: [],
      rent: [],
      buy: [],
      countryListLink: null
    };
  }

  return {
    region,
    subscription: normalizeGroup(country.flatrate),
    rent: normalizeGroup(country.rent),
    buy: normalizeGroup(country.buy),
    countryListLink: safeHttpUrl(country.link ?? undefined)
  };
}
