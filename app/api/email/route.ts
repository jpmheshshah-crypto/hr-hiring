import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EmailEvent =
  | "interview_invite"
  | "candidate_selected"
  | "candidate_rejected";

type EmailPayload = {
  applicationId?: string;
  candidateEmail?: string | null;
  candidateName?: string | null;
  roleTitle?: string | null;
  scheduledAt?: string | null;
  meetingLink?: string | null;
  rejectionReason?: string | null;
};

function buildEmailCopy(type: EmailEvent, payload: EmailPayload) {
  const candidateName = payload.candidateName || "Candidate";
  const roleTitle = payload.roleTitle || "the role";

  if (type === "interview_invite") {
    return {
      emailType: "interview_invite",
      subject: `Interview scheduled for ${roleTitle}`,
      body: `Hi ${candidateName},

Your interview for ${roleTitle} has been scheduled.

Time: ${payload.scheduledAt || "To be confirmed"}
Meeting link: ${payload.meetingLink || "Will be shared separately"}

Please join on time and reply if you need any support.

Regards,
Hiring Team`
    };
  }

  if (type === "candidate_selected") {
    return {
      emailType: "selection",
      subject: `Congratulations on your selection for ${roleTitle}`,
      body: `Hi ${candidateName},

Congratulations. You have been selected for ${roleTitle}.

Our team will reach out with the next steps shortly.

Regards,
Hiring Team`
    };
  }

  return {
    emailType: "rejection",
    subject: `Update on your application for ${roleTitle}`,
    body: `Hi ${candidateName},

Thank you for your time and interest in ${roleTitle}.

We are moving ahead with other candidates for now.
Reason: ${payload.rejectionReason || "Not the best fit for this role at the moment"}

We appreciate your interest and wish you the very best.

Regards,
Hiring Team`
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      type?: EmailEvent;
      payload?: EmailPayload;
    };

    if (!body.type || !body.payload) {
      return NextResponse.json(
        { ok: false, error: "Unsupported email request." },
        { status: 400 }
      );
    }

    const smtpUser = process.env.GMAIL_SMTP_USER;
    const smtpPass = process.env.GMAIL_SMTP_APP_PASSWORD;
    const fromEmail = process.env.EMAIL_FROM_ADDRESS || process.env.GMAIL_SMTP_USER;
    const supabase = createSupabaseServerClient();
    let candidateEmail = body.payload.candidateEmail?.trim() || "";
    let candidateName = body.payload.candidateName || "Candidate";
    let roleTitle = body.payload.roleTitle || "the role";

    if (!candidateEmail && body.payload.applicationId) {
      const { data: applicationLookup } = await supabase
        .from("applications")
        .select(
          `
            id,
            candidates (
              full_name,
              email
            ),
            hiring_requests (
              role_title
            )
          `
        )
        .eq("id", body.payload.applicationId)
        .single();

      const candidateRow = Array.isArray(applicationLookup?.candidates)
        ? applicationLookup.candidates[0]
        : applicationLookup?.candidates;
      const requestRow = Array.isArray(applicationLookup?.hiring_requests)
        ? applicationLookup.hiring_requests[0]
        : applicationLookup?.hiring_requests;

      candidateEmail = candidateRow?.email?.trim?.() || candidateEmail;
      candidateName = candidateRow?.full_name || candidateName;
      roleTitle = requestRow?.role_title || roleTitle;
    }

    if (!candidateEmail) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          message: "Candidate email is missing, so no email was sent."
        },
        { status: 202 }
      );
    }

    const emailCopy = buildEmailCopy(body.type, {
      ...body.payload,
      candidateEmail,
      candidateName,
      roleTitle
    });
    let sendStatus = "pending";
    let sendMessage = "Email prepared but not sent.";

    if (!smtpUser || !smtpPass || !fromEmail) {
      sendStatus = "failed";
      sendMessage = "Email provider is not configured yet.";
    } else {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      try {
        await transporter.sendMail({
          from: fromEmail,
          to: candidateEmail,
          subject: emailCopy.subject,
          text: emailCopy.body
        });

        sendStatus = "sent";
        sendMessage = "Email sent successfully.";
      } catch (error) {
        sendStatus = "failed";
        sendMessage =
          error instanceof Error ? error.message : "Email send failed.";
      }
    }

    if (body.payload.applicationId) {
      try {
        await supabase.from("email_logs").insert({
          application_id: body.payload.applicationId,
          email_type: emailCopy.emailType,
          recipient_email: candidateEmail,
          subject: emailCopy.subject,
          body: emailCopy.body,
          send_status: sendStatus
        });
      } catch {
        // Best effort only. Email send should not fail because logging failed.
      }
    }

    if (sendStatus !== "sent") {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          message: sendMessage
        },
        { status: 202 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: sendMessage
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to process email request.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
