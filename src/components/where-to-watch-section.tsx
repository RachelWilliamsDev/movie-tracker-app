import Image from "next/image";
import { loadWhereToWatch } from "@/lib/watch-providers-load";
import type { NormalizedWatchProvider } from "@/lib/watch-providers-normalize";

const chipClass =
  "inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900";

function ProviderChip({ provider }: { provider: NormalizedWatchProvider }) {
  const face = (
    <>
      {provider.logoUrl ? (
        <Image
          alt=""
          aria-hidden
          className="h-9 w-9 shrink-0 object-contain"
          height={36}
          src={provider.logoUrl}
          unoptimized
          width={36}
        />
      ) : (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gray-200 text-xs font-medium text-gray-600"
          aria-hidden
        >
          ?
        </div>
      )}
      <span className="min-w-0 truncate font-medium">{provider.providerName}</span>
    </>
  );

  if (provider.link) {
    return (
      <a
        className={`${chipClass} outline-none ring-gray-900 transition-colors hover:bg-white hover:ring-2 focus-visible:ring-2 focus-visible:ring-offset-2`}
        href={provider.link}
        rel="noopener noreferrer"
        target="_blank"
      >
        {face}
      </a>
    );
  }

  return <div className={chipClass}>{face}</div>;
}

function Group({
  title,
  providers
}: {
  title: string;
  providers: NormalizedWatchProvider[];
}) {
  if (providers.length === 0) {
    return null;
  }
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {providers.map((p) => (
          <li key={p.providerId}>
            <ProviderChip provider={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Suspense fallback for `WhereToWatchSection` (MEM-102). */
export function WhereToWatchSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading where to watch"
      className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="h-5 w-44 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-12 w-28 animate-pulse rounded-lg bg-gray-100"
          />
        ))}
      </div>
    </section>
  );
}

export async function WhereToWatchSection({
  mediaType,
  tmdbId
}: {
  mediaType: "movie" | "tv";
  tmdbId: number;
}) {
  let data: Awaited<ReturnType<typeof loadWhereToWatch>>;
  try {
    data = await loadWhereToWatch(mediaType, tmdbId);
  } catch {
    return (
      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-medium text-gray-900">Where to Watch</h2>
        <p className="mt-2 text-sm text-gray-600">
          Couldn’t load watch options. Try again later.
        </p>
      </section>
    );
  }

  const count =
    data.subscription.length + data.rent.length + data.buy.length;
  const hasAny = count > 0 || data.countryListLink != null;

  if (!hasAny) {
    return (
      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-medium text-gray-900">Where to Watch</h2>
        <p className="mt-2 text-sm text-gray-600">
          No streaming options available for your region.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-medium text-gray-900">Where to Watch</h2>
      <p className="mt-1 text-xs text-gray-500">
        Availability varies by region (TMDB).
      </p>

      <Group title="Included with subscription" providers={data.subscription} />
      <Group title="Rent" providers={data.rent} />
      <Group title="Buy" providers={data.buy} />

      {data.countryListLink ? (
        <p className="mt-4 text-sm">
          <a
            className="font-medium text-gray-900 underline underline-offset-4 outline-none hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
            href={data.countryListLink}
            rel="noopener noreferrer"
            target="_blank"
          >
            More watch options
          </a>
        </p>
      ) : null}
    </section>
  );
}
