// Unit test for SyncEngine.retryFailed() recovery method (UI-01 Finding 13)
import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryOutboxStore } from "@/lib/outbox/outbox-store";
import { SyncEngine } from "@/lib/outbox/sync-engine";

describe("SyncEngine.retryFailed recovery mechanism", () => {
  let store: InMemoryOutboxStore;

  beforeEach(() => {
    store = new InMemoryOutboxStore();
  });

  const sampleRecord = {
    clientIdempotencyKey: "00000000-0000-0000-0000-000000000099",
    taskId: "00000000-0000-4000-a000-000000000300",
    phoneHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    channel: "PWA" as const,
    answers: { q1: true, q2: true, q3: true },
    geoCell: "et-aa-0917",
    msisdnPrefixBucket: "251993",
    submittedAt: "2026-09-17T12:00:00.000Z",
  };

  it("requeues FAILED items and flushes them successfully", async () => {
    await store.enqueue(sampleRecord);
    await store.updateStatus(sampleRecord.clientIdempotencyKey, "FAILED", {
      lastError: "HTTP 400 Bad Request",
      retryCount: 3,
    });

    let summary = await store.getSummary();
    expect(summary.failed).toBe(1);
    expect(summary.queued).toBe(0);

    // Mock fetchFn that succeeds
    const mockFetch = async () =>
      new Response(JSON.stringify({ accepted: true, counted: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const engine = new SyncEngine(store, mockFetch as unknown as typeof fetch);
    const result = await engine.retryFailed();

    expect(result.processed).toBe(1);
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);

    summary = await store.getSummary();
    expect(summary.failed).toBe(0);
    expect(summary.synced).toBe(1);

    const updated = await store.getByKey(sampleRecord.clientIdempotencyKey);
    expect(updated?.status).toBe("SYNCED");
    expect(updated?.lastError).toBeNull();
  });

  it("supports retrying a specific item by idempotency key", async () => {
    const record2 = {
      ...sampleRecord,
      clientIdempotencyKey: "00000000-0000-0000-0000-000000000100",
    };

    await store.enqueue(sampleRecord);
    await store.enqueue(record2);

    await store.updateStatus(sampleRecord.clientIdempotencyKey, "FAILED", { lastError: "Err 1" });
    await store.updateStatus(record2.clientIdempotencyKey, "FAILED", { lastError: "Err 2" });

    const mockFetch = async () =>
      new Response(JSON.stringify({ accepted: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const engine = new SyncEngine(store, mockFetch as unknown as typeof fetch);
    await engine.retryFailed(sampleRecord.clientIdempotencyKey);

    const item1 = await store.getByKey(sampleRecord.clientIdempotencyKey);
    const item2 = await store.getByKey(record2.clientIdempotencyKey);

    expect(item1?.status).toBe("SYNCED");
    expect(item2?.status).toBe("FAILED"); // remains failed
  });
});
