type VapiCallResult = {
  ok: boolean;
  skipped?: boolean;
  message?: string;
  callId?: string;
};

export async function triggerVapiCall(payload: {
  applicationId: string;
  candidateName: string | null;
  candidatePhone: string | null;
  roleTitle: string | null;
}): Promise<VapiCallResult> {
  try {
    const response = await fetch("/api/vapi/call", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = (await response.json().catch(() => null)) as
      | (VapiCallResult & { error?: string })
      | null;

    if (!response.ok) {
      return {
        ok: false,
        message: data?.error || "Unable to start the Vapi call."
      };
    }

    return {
      ok: Boolean(data?.ok),
      skipped: data?.skipped,
      message: data?.message,
      callId: data?.callId
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to start the Vapi call."
    };
  }
}
