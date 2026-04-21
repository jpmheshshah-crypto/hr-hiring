export type AirtableSyncEvent =
  | "candidate_created"
  | "application_stage_changed"
  | "screening_call_created"
  | "interview_created";

type SyncResult = {
  ok: boolean;
  skipped?: boolean;
  message?: string;
};

export async function syncToAirtable(
  event: AirtableSyncEvent,
  payload: Record<string, unknown>
): Promise<SyncResult> {
  try {
    const response = await fetch("/api/airtable", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ event, payload })
    });

    const data = (await response.json().catch(() => null)) as
      | SyncResult
      | { error?: string }
      | null;

    if (!response.ok) {
      return {
        ok: false,
        message:
          data && "error" in data && data.error
            ? data.error
            : "Unable to sync to Airtable."
      };
    }

    return {
      ok: true,
      skipped: data && "skipped" in data ? data.skipped : false,
      message: data && "message" in data ? data.message : undefined
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to sync to Airtable."
    };
  }
}
