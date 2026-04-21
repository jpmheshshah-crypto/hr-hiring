import { NextResponse } from "next/server";

type AirtableSyncEvent =
  | "candidate_created"
  | "application_stage_changed"
  | "screening_call_created"
  | "interview_created";

const airtableTableName = "Candidates";
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      event?: AirtableSyncEvent;
      payload?: Record<string, unknown>;
    };

    if (!body.event || !body.payload) {
      return NextResponse.json(
        { ok: false, error: "Unsupported Airtable sync request." },
        { status: 400 }
      );
    }

    const token = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableId = process.env.AIRTABLE_TABLE_ID || airtableTableName;

    if (!token || !baseId) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          message: "Airtable credentials are not configured yet."
        },
        { status: 202 }
      );
    }

    if (body.event === "candidate_created") {
      const rawExperience = body.payload.totalExperience;
      const parsedExperience =
        rawExperience != null && rawExperience !== ""
          ? Number.parseFloat(String(rawExperience))
          : null;

      const fields = Object.fromEntries(
        Object.entries({
          candidate_id: body.payload.candidateId ?? "",
          application_id: body.payload.applicationId ?? "",
          candidate_name: body.payload.candidateName ?? "",
          phone: body.payload.phone ?? "",
          email: body.payload.email ?? "",
          city: body.payload.city ?? "",
          experience: Number.isFinite(parsedExperience) ? parsedExperience : undefined,
          english_level: body.payload.englishLevel ?? "",
          role_title: body.payload.roleTitle ?? "",
          fit_summary: body.payload.fitSummary ?? "",
          created_at: new Date().toISOString()
        }).filter(([, value]) => value !== "" && value !== null && value !== undefined)
      );

      const response = await fetch(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ fields }),
          cache: "no-store"
        }
      );

      if (!response.ok) {
        const text = await response.text();
        return NextResponse.json(
          {
            ok: false,
            error: text || `Airtable create failed with ${response.status}.`
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: "Candidate synced to Airtable."
      });
    }

    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        message: `${body.event} Airtable sync is not wired yet.`
      },
      { status: 202 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to sync with Airtable.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
