import type { PublicationSink } from "../index";

export interface SupabasePublicationSinkOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchImplementation?: typeof fetch;
}

export class PublicationSinkError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Content publication request failed with HTTP ${status}.`);
    this.name = "PublicationSinkError";
    this.status = status;
  }
}

export function createSupabasePublicationSink(
  options: SupabasePublicationSinkOptions,
): PublicationSink {
  const url = options.supabaseUrl.replace(/\/$/u, "");
  const serviceRoleKey = options.serviceRoleKey.trim();
  if (!url) throw new Error("Supabase URL is required.");
  if (!serviceRoleKey) throw new Error("Supabase service-role key is required.");
  const request = options.fetchImplementation ?? fetch;

  async function submit(body: Record<string, unknown>): Promise<void> {
    const response = await request(`${url}/rest/v1/rpc/submit_generated_story`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new PublicationSinkError(response.status);
  }

  return {
    publish: ({ requestId, story, contentVersion }) =>
      submit({
        source_request_id: requestId,
        generated_story: story,
        generated_content_version: contentVersion,
        confidence: 1,
        suspicion_reasons: [],
      }),
    enqueueReview: ({ requestId, story, contentVersion, suspicionReasons, expiresAt }) =>
      submit({
        source_request_id: requestId,
        generated_story: story,
        generated_content_version: contentVersion,
        confidence: 0,
        suspicion_reasons: suspicionReasons,
        review_expires_at: expiresAt,
      }),
  };
}
