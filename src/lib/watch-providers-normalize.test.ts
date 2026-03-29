import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWhereToWatch } from "@/lib/watch-providers-normalize";

test("normalizeWhereToWatch empty results", () => {
  const r = normalizeWhereToWatch({}, "GB");
  assert.equal(r.region, "GB");
  assert.deepEqual(r.subscription, []);
  assert.deepEqual(r.rent, []);
  assert.deepEqual(r.buy, []);
  assert.equal(r.countryListLink, null);
});

test("normalizeWhereToWatch maps GB flatrate rent buy and country link", () => {
  const r = normalizeWhereToWatch(
    {
      results: {
        GB: {
          link: "https://www.themoviedb.org/movie/550-fight-club/watch?locale=GB",
          flatrate: [
            {
              provider_id: 8,
              provider_name: "Netflix",
              logo_path: "/logo.png"
            }
          ],
          rent: [
            { provider_id: 2, provider_name: "Apple", logo_path: null }
          ],
          buy: []
        }
      }
    },
    "GB"
  );
  assert.equal(r.subscription.length, 1);
  assert.equal(r.subscription[0]?.providerName, "Netflix");
  assert.equal(
    r.subscription[0]?.logoUrl,
    "https://image.tmdb.org/t/p/w45/logo.png"
  );
  assert.equal(r.rent.length, 1);
  assert.equal(r.rent[0]?.providerName, "Apple");
  assert.equal(r.rent[0]?.logoUrl, null);
  assert.ok(r.countryListLink?.includes("themoviedb.org"));
});

test("normalizeWhereToWatch missing region key yields empty groups", () => {
  const r = normalizeWhereToWatch(
    { results: { US: { flatrate: [] } } },
    "GB"
  );
  assert.deepEqual(r.subscription, []);
});

test("normalizeWhereToWatch dedupes provider_id in same group", () => {
  const r = normalizeWhereToWatch(
    {
      results: {
        GB: {
          flatrate: [
            { provider_id: 1, provider_name: "A", logo_path: "/a.png" },
            { provider_id: 1, provider_name: "A", logo_path: "/b.png" }
          ]
        }
      }
    },
    "GB"
  );
  assert.equal(r.subscription.length, 1);
});
