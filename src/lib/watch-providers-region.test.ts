import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_WATCH_PROVIDERS_REGION,
  getWatchProvidersRegion
} from "@/lib/watch-providers-region";

test("getWatchProvidersRegion defaults to GB when env unset", () => {
  const prev = process.env.WATCH_PROVIDERS_REGION;
  delete process.env.WATCH_PROVIDERS_REGION;
  try {
    assert.equal(getWatchProvidersRegion(), "GB");
    assert.equal(DEFAULT_WATCH_PROVIDERS_REGION, "GB");
  } finally {
    if (prev === undefined) {
      delete process.env.WATCH_PROVIDERS_REGION;
    } else {
      process.env.WATCH_PROVIDERS_REGION = prev;
    }
  }
});

test("getWatchProvidersRegion reads WATCH_PROVIDERS_REGION (normalized to uppercase)", () => {
  const prev = process.env.WATCH_PROVIDERS_REGION;
  process.env.WATCH_PROVIDERS_REGION = "us";
  try {
    assert.equal(getWatchProvidersRegion(), "US");
  } finally {
    if (prev === undefined) {
      delete process.env.WATCH_PROVIDERS_REGION;
    } else {
      process.env.WATCH_PROVIDERS_REGION = prev;
    }
  }
});

test("getWatchProvidersRegion falls back to GB for invalid env value", () => {
  const prev = process.env.WATCH_PROVIDERS_REGION;
  process.env.WATCH_PROVIDERS_REGION = "GBR";
  try {
    assert.equal(getWatchProvidersRegion(), "GB");
  } finally {
    if (prev === undefined) {
      delete process.env.WATCH_PROVIDERS_REGION;
    } else {
      process.env.WATCH_PROVIDERS_REGION = prev;
    }
  }
});
