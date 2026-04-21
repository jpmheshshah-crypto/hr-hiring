export type EmailEvent =
  | "interview_invite"
  | "candidate_selected"
  | "candidate_rejected";

type EmailResult = {
  ok: boolean;
  skipped?: boolean;
  message?: string;
};

export async function triggerEmail(
  type: EmailEvent,
  payload: Record<string, unknown>
): Promise<EmailResult> {
  try {
    const response = await fetch("/api/email", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ type, payload })
    });

    const data = (await response.json().catch(() => null)) as
      | EmailResult
      | { error?: string }
      | null;

    if (!response.ok) {
      return {
        ok: false,
        message:
          data && "error" in data && data.error
            ? data.error
            : "Unable to send email."
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
      message: error instanceof Error ? error.message : "Unable to send email."
    };
  }
}
