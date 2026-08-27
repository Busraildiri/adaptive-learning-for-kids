import { describe, expect, it, vi } from "vitest";
import { createSupabasePublicationSink, PublicationSinkError } from "./supabase";

describe("Supabase publication sink", () => {
  it("routes suspicious content through the service-only RPC without leaking its key", async () => {
    const fetchImplementation = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer service-secret");
      expect(String(init?.body)).not.toContain("service-secret");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        source_request_id: "request-1",
        confidence: 0,
        suspicion_reasons: ["low_confidence"],
      });
      return new Response(JSON.stringify("queued_for_review"), { status: 200 });
    });
    const sink = createSupabasePublicationSink({
      supabaseUrl: "http://127.0.0.1:54321/",
      serviceRoleKey: "service-secret",
      fetchImplementation,
    });
    await sink.enqueueReview({
      requestId: "request-1",
      story: { id: "story" } as never,
      contentVersion: "1.1.0",
      suspicionReasons: ["low_confidence"],
      expiresAt: "2026-09-11T00:00:00.000Z",
    });
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it("sanitizes database response errors", async () => {
    const sink = createSupabasePublicationSink({
      supabaseUrl: "http://localhost",
      serviceRoleKey: "service-secret",
      fetchImplementation: async () => new Response("sensitive database detail", { status: 403 }),
    });
    const error = await sink
      .publish({
        requestId: "request-1",
        story: { id: "story" } as never,
        contentVersion: "1.1.0",
      })
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(PublicationSinkError);
    expect(String(error)).not.toContain("sensitive database detail");
    expect(String(error)).not.toContain("service-secret");
  });
});
