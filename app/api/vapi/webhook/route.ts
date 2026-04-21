import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type VapiWebhookBody = {
  type?: string;
  message?: {
    type?: string;
    call?: Record<string, unknown>;
    artifact?: Record<string, unknown>;
    analysis?: Record<string, unknown>;
  };
  call?: Record<string, unknown>;
  artifact?: Record<string, unknown>;
  analysis?: Record<string, unknown>;
};

function getNestedValue(record: Record<string, unknown> | undefined, path: string[]) {
  let current: unknown = record;

  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function mapCallStatus(rawStatus: string | undefined) {
  const status = rawStatus?.toLowerCase() ?? "";

  if (status.includes("no-answer") || status.includes("no_answer")) {
    return "no_answer";
  }

  if (
    status.includes("failed") ||
    status.includes("error") ||
    status.includes("busy") ||
    status.includes("canceled") ||
    status.includes("cancelled")
  ) {
    return "failed";
  }

  return "completed";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VapiWebhookBody;
    const messageType = body.message?.type || body.type || "unknown";
    const call =
      (body.message?.call as Record<string, unknown> | undefined) ||
      (body.call as Record<string, unknown> | undefined);
    const artifact =
      (body.message?.artifact as Record<string, unknown> | undefined) ||
      (body.artifact as Record<string, unknown> | undefined);
    const analysis =
      (body.message?.analysis as Record<string, unknown> | undefined) ||
      (body.analysis as Record<string, unknown> | undefined);

    const applicationId =
      String(getNestedValue(call, ["metadata", "applicationId"]) ?? "").trim() || "";

    if (!applicationId) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          message: "Webhook received without applicationId metadata."
        },
        { status: 202 }
      );
    }

    const callStatus = mapCallStatus(
      String(getNestedValue(call, ["status"]) ?? messageType).trim()
    );
    const callSummary =
      String(
        getNestedValue(analysis, ["summary"]) ??
          getNestedValue(call, ["summary"]) ??
          getNestedValue(artifact, ["summary"]) ??
          `Vapi webhook received: ${messageType}`
      ).trim() || `Vapi webhook received: ${messageType}`;
    const transcript =
      String(
        getNestedValue(artifact, ["transcript"]) ??
          getNestedValue(call, ["transcript"]) ??
          ""
      ).trim() || null;
    const recordingUrl =
      String(
        getNestedValue(artifact, ["recordingUrl"]) ??
          getNestedValue(call, ["recordingUrl"]) ??
          ""
      ).trim() || null;

    const supabase = createSupabaseServerClient();
    const { data: latestCall } = await supabase
      .from("screening_calls")
      .select("id")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = {
      application_id: applicationId,
      call_status: callStatus,
      call_summary: callSummary,
      transcript_url: transcript,
      recording_url: recordingUrl,
      next_action: callStatus === "completed" ? "Review completed call" : "Retry or review failure",
      called_at: new Date().toISOString()
    };

    if (latestCall?.id) {
      await supabase.from("screening_calls").update(payload).eq("id", latestCall.id);
    } else {
      await supabase.from("screening_calls").insert(payload);
    }

    return NextResponse.json({
      ok: true,
      message: "Vapi webhook processed."
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to process Vapi webhook.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
