import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type VapiCallRequest = {
  applicationId?: string;
  candidateName?: string | null;
  candidatePhone?: string | null;
  roleTitle?: string | null;
};

function normalizePhoneNumber(rawPhone: string) {
  const cleaned = rawPhone.replace(/[^\d+]/g, "");

  if (!cleaned) {
    return "";
  }

  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  if (/^91\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return cleaned;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VapiCallRequest;

    if (!body.applicationId) {
      return NextResponse.json(
        { ok: false, error: "Application id is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.VAPI_API_KEY;
    const assistantId = process.env.VAPI_ASSISTANT_ID;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

    if (!apiKey || !assistantId || !phoneNumberId) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          message: "Vapi credentials are not configured yet."
        },
        { status: 202 }
      );
    }

    const supabase = createSupabaseServerClient();
    let candidatePhone = body.candidatePhone?.trim() || "";
    let candidateName = body.candidateName || "";
    let roleTitle = body.roleTitle || "";

    if (!candidatePhone) {
      const { data: applicationLookup } = await supabase
        .from("applications")
        .select(
          `
            id,
            candidates (
              full_name,
              phone
            ),
            hiring_requests (
              role_title
            )
          `
        )
        .eq("id", body.applicationId)
        .single();

      const candidateRow = Array.isArray(applicationLookup?.candidates)
        ? applicationLookup.candidates[0]
        : applicationLookup?.candidates;
      const requestRow = Array.isArray(applicationLookup?.hiring_requests)
        ? applicationLookup.hiring_requests[0]
        : applicationLookup?.hiring_requests;

      candidatePhone = candidateRow?.phone?.trim?.() || candidatePhone;
      candidateName = candidateRow?.full_name || candidateName;
      roleTitle = requestRow?.role_title || roleTitle;
    }

    candidatePhone = normalizePhoneNumber(candidatePhone);

    if (!candidatePhone) {
      return NextResponse.json(
        { ok: false, error: "Application id and candidate phone are required." },
        { status: 400 }
      );
    }

    const vapiResponse = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        assistantId,
        phoneNumberId,
        metadata: {
          applicationId: body.applicationId,
          roleTitle
        },
        customer: {
          number: candidatePhone,
          name: candidateName || undefined
        }
      }),
      cache: "no-store"
    });

    const vapiData = (await vapiResponse.json().catch(() => null)) as
      | { id?: string; message?: string }
      | null;

    if (!vapiResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: vapiData?.message || "Vapi call request failed."
        },
        { status: 502 }
      );
    }

    try {
      const supabase = createSupabaseServerClient();
      await supabase.from("screening_calls").insert({
        application_id: body.applicationId,
        call_status: "pending",
        call_summary: `Vapi call started for ${roleTitle || "candidate screening"}.`,
        next_action: "Awaiting call outcome",
        called_at: new Date().toISOString()
      });
    } catch {
      // Best effort logging only.
    }

    return NextResponse.json({
      ok: true,
      message: "Vapi call started.",
      callId: vapiData?.id
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to process Vapi call request.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
