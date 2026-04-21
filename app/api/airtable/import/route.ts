import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AirtableRecord = {
  id: string;
  fields: {
    candidate_id?: string;
    application_id?: string;
    hiring_request_id?: string;
    candidate_name?: string;
    phone?: string;
    email?: string;
    city?: string;
    experience?: string | number;
    english_level?: string;
    source?: string;
    fit_summary?: string;
    status?: string;
  };
};

const defaultAirtableTableId = "Candidates";

export async function POST() {
  try {
    const token = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableId = process.env.AIRTABLE_TABLE_ID || defaultAirtableTableId;

    if (!token || !baseId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Airtable credentials are not configured."
        },
        { status: 400 }
      );
    }

    const listResponse = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: "no-store"
      }
    );

    if (!listResponse.ok) {
      const text = await listResponse.text();
      return NextResponse.json(
        { ok: false, error: text || "Unable to read Airtable records." },
        { status: 502 }
      );
    }

    const listData = (await listResponse.json()) as { records?: AirtableRecord[] };
    const records = listData.records ?? [];
    const pendingRecords = records.filter((record) => {
      return !record.fields.candidate_id && !record.fields.application_id;
    });

    if (pendingRecords.length === 0) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        skipped: records.length,
        failed: 0,
        message: "No new Airtable rows were waiting for import."
      });
    }

    const supabase = createSupabaseServerClient();
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const issues: string[] = [];

    for (const record of pendingRecords) {
      const fields = record.fields;
      const hiringRequestId = fields.hiring_request_id?.trim();
      const candidateName = fields.candidate_name?.trim();
      const phone = fields.phone?.trim();

      if (!hiringRequestId || !candidateName || !phone) {
        skipped += 1;
        issues.push(
          `Skipped Airtable row ${record.id}: hiring_request_id, candidate_name, and phone are required.`
        );
        continue;
      }

      const totalExperience =
        fields.experience != null && fields.experience !== ""
          ? Number.parseFloat(String(fields.experience))
          : null;

      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .insert({
          full_name: candidateName,
          phone,
          email: fields.email || null,
          city: fields.city || null,
          total_experience: Number.isFinite(totalExperience) ? totalExperience : null,
          english_level: fields.english_level || null,
          source: fields.source || "Airtable"
        })
        .select("id")
        .single();

      if (candidateError) {
        failed += 1;
        issues.push(`Candidate insert failed for Airtable row ${record.id}: ${candidateError.message}`);
        continue;
      }

      const { data: application, error: applicationError } = await supabase
        .from("applications")
        .insert({
          candidate_id: candidate.id,
          hiring_request_id: hiringRequestId,
          application_status: "applied",
          fit_summary: fields.fit_summary || null
        })
        .select("id")
        .single();

      if (applicationError) {
        failed += 1;
        issues.push(
          `Application insert failed for Airtable row ${record.id}: ${applicationError.message}`
        );
        continue;
      }

      const patchResponse = await fetch(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}/${record.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fields: {
              candidate_id: candidate.id,
              application_id: application.id,
              status: fields.status || "applied"
            }
          }),
          cache: "no-store"
        }
      );

      if (!patchResponse.ok) {
        const text = await patchResponse.text();
        issues.push(
          `Imported Airtable row ${record.id}, but Airtable update failed: ${
            text || patchResponse.status
          }`
        );
      }

      imported += 1;
    }

    return NextResponse.json({
      ok: true,
      imported,
      skipped,
      failed,
      message:
        imported > 0
          ? `Imported ${imported} Airtable candidate${imported === 1 ? "" : "s"} into Supabase.`
          : "No Airtable rows were imported.",
      issues
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to import Airtable rows.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
