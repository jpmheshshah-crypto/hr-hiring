"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { triggerEmail } from "@/lib/email/trigger";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { triggerVapiCall } from "@/lib/vapi/trigger";

type CandidateDetail = {
  id: string;
  candidate_id: string;
  application_status: string;
  screening_score: number | null;
  fit_summary: string | null;
  rejection_reason: string | null;
  applied_at: string;
  candidates: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    city: string | null;
    total_experience: number | null;
    english_level: string | null;
    source: string | null;
  } | null;
  hiring_requests: {
    role_title: string;
    location: string | null;
    shift_type: string | null;
  } | null;
  screening_calls:
    | {
        id: string;
        call_status: string;
        call_summary: string | null;
        next_action: string | null;
        recording_url: string | null;
        transcript_url: string | null;
        called_at: string | null;
      }[]
    | null;
  interviews:
    | {
        id: string;
        interviewer_name: string | null;
        interviewer_email: string | null;
        scheduled_at: string | null;
        meeting_link: string | null;
        interview_status: string;
        result: string | null;
        feedback: string | null;
      }[]
    | null;
};

type CandidateDetailRow = Omit<CandidateDetail, "candidates" | "hiring_requests"> & {
  candidates:
    | {
        id: string;
        full_name: string;
        phone: string;
        email: string | null;
        city: string | null;
        total_experience: number | null;
        english_level: string | null;
        source: string | null;
      }[]
    | null;
  hiring_requests:
    | {
        role_title: string;
        location: string | null;
        shift_type: string | null;
      }[]
    | null;
};

type SummaryForm = {
  fitSummary: string;
  screeningScore: string;
};

type CandidateForm = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  totalExperience: string;
  englishLevel: string;
  source: string;
};

type CallForm = {
  callStatus: string;
  callSummary: string;
  nextAction: string;
};

type InterviewForm = {
  interviewerName: string;
  interviewerEmail: string;
  scheduledAt: string;
  meetingLink: string;
  feedback: string;
};

function normalizeDetail(row: CandidateDetailRow): CandidateDetail {
  return {
    ...row,
    candidates: row.candidates?.[0] ?? null,
    hiring_requests: row.hiring_requests?.[0] ?? null
  };
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleString();
}

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;

  const [application, setApplication] = useState<CandidateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCandidateProfile, setIsSavingCandidateProfile] = useState(false);
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [isSavingCall, setIsSavingCall] = useState(false);
  const [isSavingInterview, setIsSavingInterview] = useState(false);
  const [isStartingAiCall, setIsStartingAiCall] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [summaryForm, setSummaryForm] = useState<SummaryForm>({
    fitSummary: "",
    screeningScore: ""
  });
  const [candidateForm, setCandidateForm] = useState<CandidateForm>({
    fullName: "",
    phone: "",
    email: "",
    city: "",
    totalExperience: "",
    englishLevel: "",
    source: ""
  });
  const [callForm, setCallForm] = useState<CallForm>({
    callStatus: "completed",
    callSummary: "",
    nextAction: ""
  });
  const [interviewForm, setInterviewForm] = useState<InterviewForm>({
    interviewerName: "",
    interviewerEmail: "",
    scheduledAt: "",
    meetingLink: "",
    feedback: ""
  });

  useEffect(() => {
    if (applicationId) {
      void loadApplication();
    }
  }, [applicationId]);

  async function loadApplication() {
    setIsLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("applications")
        .select(
          `
            id,
            candidate_id,
            application_status,
            screening_score,
            fit_summary,
            rejection_reason,
            applied_at,
            candidates (
              id,
              full_name,
              phone,
              email,
              city,
              total_experience,
              english_level,
              source
            ),
            hiring_requests (
              role_title,
              location,
              shift_type
            ),
            screening_calls (
              id,
              call_status,
              call_summary,
              next_action,
              recording_url,
              transcript_url,
              called_at
            ),
            interviews (
              id,
              interviewer_name,
              interviewer_email,
              scheduled_at,
              meeting_link,
              interview_status,
              result,
              feedback
            )
          `
        )
        .eq("id", applicationId)
        .single();

      if (error) {
        throw error;
      }

      const normalized = normalizeDetail(data as CandidateDetailRow);
      const sortedCalls = [...(normalized.screening_calls ?? [])].sort((a, b) =>
        (b.called_at ?? "").localeCompare(a.called_at ?? "")
      );
      const sortedInterviews = [...(normalized.interviews ?? [])].sort((a, b) =>
        (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? "")
      );

      setApplication({
        ...normalized,
        screening_calls: sortedCalls,
        interviews: sortedInterviews
      });
      setSummaryForm({
        fitSummary: normalized.fit_summary ?? "",
        screeningScore:
          normalized.screening_score != null ? String(normalized.screening_score) : ""
      });
      setCandidateForm({
        fullName: normalized.candidates?.full_name ?? "",
        phone: normalized.candidates?.phone ?? "",
        email: normalized.candidates?.email ?? "",
        city: normalized.candidates?.city ?? "",
        totalExperience:
          normalized.candidates?.total_experience != null
            ? String(normalized.candidates.total_experience)
            : "",
        englishLevel: normalized.candidates?.english_level ?? "",
        source: normalized.candidates?.source ?? ""
      });
      setErrorMessage(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load candidate details.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSummaryChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { id, value } = event.target;
    setSummaryForm((current) => ({
      ...current,
      [id]: value
    }));
  }

  function handleCandidateChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { id, value } = event.target;
    setCandidateForm((current) => ({
      ...current,
      [id]: value
    }));
  }

  function handleCallChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { id, value } = event.target;
    setCallForm((current) => ({
      ...current,
      [id]: value
    }));
  }

  function handleInterviewChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { id, value } = event.target;
    setInterviewForm((current) => ({
      ...current,
      [id]: value
    }));
  }

  async function saveSummary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingSummary(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const screeningScore = summaryForm.screeningScore
        ? Number.parseFloat(summaryForm.screeningScore)
        : null;

      const { error } = await supabase
        .from("applications")
        .update({
          fit_summary: summaryForm.fitSummary || null,
          screening_score: screeningScore
        })
        .eq("id", applicationId);

      if (error) {
        throw error;
      }

      setSuccessMessage("Recruiter summary updated.");
      await loadApplication();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save recruiter summary.";
      setErrorMessage(message);
    } finally {
      setIsSavingSummary(false);
    }
  }

  async function saveCandidateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingCandidateProfile(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (!application?.candidate_id) {
        throw new Error("Candidate profile is not linked yet.");
      }

      const supabase = createSupabaseBrowserClient();
      const totalExperience = candidateForm.totalExperience
        ? Number.parseFloat(candidateForm.totalExperience)
        : null;

      const { error } = await supabase
        .from("candidates")
        .update({
          full_name: candidateForm.fullName || null,
          phone: candidateForm.phone || null,
          email: candidateForm.email || null,
          city: candidateForm.city || null,
          total_experience: Number.isFinite(totalExperience) ? totalExperience : null,
          english_level: candidateForm.englishLevel || null,
          source: candidateForm.source || null
        })
        .eq("id", application.candidate_id);

      if (error) {
        throw error;
      }

      setSuccessMessage("Candidate profile updated.");
      await loadApplication();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save candidate profile.";
      setErrorMessage(message);
    } finally {
      setIsSavingCandidateProfile(false);
    }
  }

  async function saveCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingCall(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("screening_calls").insert({
        application_id: applicationId,
        call_status: callForm.callStatus,
        call_summary: callForm.callSummary || null,
        next_action: callForm.nextAction || null,
        called_at: new Date().toISOString()
      });

      if (error) {
        throw error;
      }

      setCallForm({
        callStatus: "completed",
        callSummary: "",
        nextAction: ""
      });
      setSuccessMessage("Call log added.");
      await loadApplication();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save call log.";
      setErrorMessage(message);
    } finally {
      setIsSavingCall(false);
    }
  }

  async function saveInterview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingInterview(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("interviews").insert({
        application_id: applicationId,
        interviewer_name: interviewForm.interviewerName || null,
        interviewer_email: interviewForm.interviewerEmail || null,
        scheduled_at: interviewForm.scheduledAt || null,
        meeting_link: interviewForm.meetingLink || null,
        interview_status: "scheduled",
        feedback: interviewForm.feedback || null
      });

      if (error) {
        throw error;
      }

      const { error: applicationError } = await supabase
        .from("applications")
        .update({ application_status: "interview_scheduled" })
        .eq("id", applicationId);

      if (applicationError) {
        throw applicationError;
      }

      const emailResult = await triggerEmail("interview_invite", {
        applicationId,
        candidateEmail: candidateForm.email || application?.candidates?.email || null,
        candidateName: candidateForm.fullName || application?.candidates?.full_name || null,
        roleTitle: application?.hiring_requests?.role_title ?? null,
        scheduledAt: interviewForm.scheduledAt || null,
        meetingLink: interviewForm.meetingLink || null
      });

      setInterviewForm({
        interviewerName: "",
        interviewerEmail: "",
        scheduledAt: "",
        meetingLink: "",
        feedback: ""
      });
      setSuccessMessage(
        emailResult.ok
          ? emailResult.skipped
            ? `Interview entry added. ${emailResult.message}`
            : `Interview entry added. ${emailResult.message}`
          : `Interview entry added, but email failed: ${emailResult.message}`
      );
      await loadApplication();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save interview entry.";
      setErrorMessage(message);
    } finally {
      setIsSavingInterview(false);
    }
  }

  async function startAiCall() {
    setIsStartingAiCall(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await triggerVapiCall({
        applicationId: application?.id || applicationId,
        candidateName: candidateForm.fullName || application?.candidates?.full_name || null,
        candidatePhone: candidateForm.phone || application?.candidates?.phone || null,
        roleTitle: application?.hiring_requests?.role_title ?? null
      });

      setSuccessMessage(
        result.ok
          ? result.skipped
            ? result.message || "Vapi is not configured yet."
            : result.callId
              ? `Vapi call started. Call ID: ${result.callId}`
              : result.message || "Vapi call started."
          : `Unable to start Vapi call: ${result.message}`
      );

      await loadApplication();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start the AI call.";
      setErrorMessage(message);
    } finally {
      setIsStartingAiCall(false);
    }
  }

  const candidate = application?.candidates;
  const request = application?.hiring_requests;

  return (
    <main className="page-shell">
      <DashboardHeader
        current="candidates"
        title="Candidate detail and recruiter actions."
        description="Use this screen to maintain the recruiter summary, save AI call notes, and schedule interviews for a single application."
      />

      <div className="button-row" style={{ marginBottom: 18 }}>
        <Link className="secondary-link-button" href="/candidates">
          Back to pipeline
        </Link>
      </div>

      {errorMessage ? <div className="status-error">{errorMessage}</div> : null}
      {successMessage ? <div className="status-success">{successMessage}</div> : null}
      {isLoading ? <div className="status-success">Loading candidate detail...</div> : null}

      {application ? (
        <>
          <section className="hero">
            <div className="eyebrow">Application Detail</div>
            <h1>{candidate?.full_name ?? "Candidate"}</h1>
            <p>
              {request?.role_title ?? "No role linked"} | {candidate?.city ?? "No city"} |{" "}
              {application.application_status}
            </p>
            <div className="hero-stats">
              <article className="stat-card">
                <span className="mini-label">Phone</span>
                <strong>{candidate?.phone ?? "NA"}</strong>
                <div className="muted">Primary contact</div>
              </article>
              <article className="stat-card">
                <span className="mini-label">Experience</span>
                <strong>
                  {candidate?.total_experience != null
                    ? `${candidate.total_experience}y`
                    : "NA"}
                </strong>
                <div className="muted">Customer support experience</div>
              </article>
              <article className="stat-card">
                <span className="mini-label">English level</span>
                <strong>{candidate?.english_level ?? "NA"}</strong>
                <div className="muted">Communication quality</div>
              </article>
              <article className="stat-card">
                <span className="mini-label">Applied</span>
                <strong>{formatDateTime(application.applied_at)}</strong>
                <div className="muted">Application timestamp</div>
              </article>
            </div>
          </section>

          <section className="detail-grid">
            <article className="panel">
              <div className="section-header">
                <div>
                  <div className="eyebrow">Candidate Profile</div>
                  <h2 className="section-title">Contact and profile details</h2>
                </div>
              </div>
              <form onSubmit={saveCandidateProfile}>
                <div className="form-grid" style={{ marginTop: 20 }}>
                  <div className="field">
                    <label htmlFor="fullName">Full name</label>
                    <input id="fullName" value={candidateForm.fullName} onChange={handleCandidateChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="phone">Phone</label>
                    <input id="phone" value={candidateForm.phone} onChange={handleCandidateChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="email">Email</label>
                    <input id="email" value={candidateForm.email} onChange={handleCandidateChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="city">City</label>
                    <input id="city" value={candidateForm.city} onChange={handleCandidateChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="totalExperience">Experience in years</label>
                    <input
                      id="totalExperience"
                      value={candidateForm.totalExperience}
                      onChange={handleCandidateChange}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="englishLevel">English level</label>
                    <select
                      id="englishLevel"
                      value={candidateForm.englishLevel}
                      onChange={handleCandidateChange}
                    >
                      <option value="">Select level</option>
                      <option value="Basic">Basic</option>
                      <option value="Good">Good</option>
                      <option value="Excellent">Excellent</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="source">Source</label>
                    <select id="source" value={candidateForm.source} onChange={handleCandidateChange}>
                      <option value="">Select source</option>
                      <option value="Naukri">Naukri</option>
                      <option value="Referral">Referral</option>
                      <option value="Indeed">Indeed</option>
                      <option value="Walk-in">Walk-in</option>
                    </select>
                  </div>
                </div>
                <div className="form-footer">
                  <div className="muted">
                    Use this section to fix missing phone or email before sending calls or emails.
                  </div>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={isSavingCandidateProfile}
                  >
                    {isSavingCandidateProfile ? "Saving..." : "Save profile"}
                  </button>
                </div>
              </form>
            </article>

            <article className="panel">
              <div className="section-header">
                <div>
                  <div className="eyebrow">Recruiter Summary</div>
                  <h2 className="section-title">Fit and scoring</h2>
                </div>
              </div>
              <form onSubmit={saveSummary}>
                <div className="form-grid" style={{ marginTop: 20 }}>
                  <div className="field">
                    <label htmlFor="screeningScore">Screening score</label>
                    <input
                      id="screeningScore"
                      value={summaryForm.screeningScore}
                      onChange={handleSummaryChange}
                    />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="fitSummary">Fit summary</label>
                    <textarea
                      id="fitSummary"
                      value={summaryForm.fitSummary}
                      onChange={handleSummaryChange}
                    />
                  </div>
                </div>
                <div className="form-footer">
                  <div className="muted">
                    Role: {request?.role_title ?? "Not linked"} | Shift:{" "}
                    {request?.shift_type ?? "Not set"}
                  </div>
                  <button className="primary-button" type="submit" disabled={isSavingSummary}>
                    {isSavingSummary ? "Saving..." : "Save summary"}
                  </button>
                </div>
              </form>
            </article>

            <article className="panel">
              <div className="section-header">
                <div>
                  <div className="eyebrow">Call Log</div>
                  <h2 className="section-title">Add latest recruiter or AI call</h2>
                </div>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void startAiCall()}
                    disabled={isStartingAiCall}
                  >
                    {isStartingAiCall ? "Starting AI call..." : "Start AI call"}
                  </button>
                </div>
              </div>
              <form onSubmit={saveCall}>
                <div className="form-grid" style={{ marginTop: 20 }}>
                  <div className="field">
                    <label htmlFor="callStatus">Call status</label>
                    <select id="callStatus" value={callForm.callStatus} onChange={handleCallChange}>
                      <option value="completed">completed</option>
                      <option value="pending">pending</option>
                      <option value="failed">failed</option>
                      <option value="no_answer">no_answer</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="nextAction">Next action</label>
                    <input id="nextAction" value={callForm.nextAction} onChange={handleCallChange} />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="callSummary">Call summary</label>
                    <textarea
                      id="callSummary"
                      value={callForm.callSummary}
                      onChange={handleCallChange}
                    />
                  </div>
                </div>
                <div className="form-footer">
                  <div className="muted">This creates a new row in `screening_calls`.</div>
                  <button className="primary-button" type="submit" disabled={isSavingCall}>
                    {isSavingCall ? "Saving..." : "Add call log"}
                  </button>
                </div>
              </form>
            </article>

            <article className="panel">
              <div className="section-header">
                <div>
                  <div className="eyebrow">Interview</div>
                  <h2 className="section-title">Schedule the next interview</h2>
                </div>
              </div>
              <form onSubmit={saveInterview}>
                <div className="form-grid" style={{ marginTop: 20 }}>
                  <div className="field">
                    <label htmlFor="interviewerName">Interviewer name</label>
                    <input
                      id="interviewerName"
                      value={interviewForm.interviewerName}
                      onChange={handleInterviewChange}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="interviewerEmail">Interviewer email</label>
                    <input
                      id="interviewerEmail"
                      value={interviewForm.interviewerEmail}
                      onChange={handleInterviewChange}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="scheduledAt">Scheduled at</label>
                    <input
                      id="scheduledAt"
                      type="datetime-local"
                      value={interviewForm.scheduledAt}
                      onChange={handleInterviewChange}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="meetingLink">Meeting link</label>
                    <input
                      id="meetingLink"
                      value={interviewForm.meetingLink}
                      onChange={handleInterviewChange}
                    />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="feedback">Notes</label>
                    <textarea
                      id="feedback"
                      value={interviewForm.feedback}
                      onChange={handleInterviewChange}
                    />
                  </div>
                </div>
                <div className="form-footer">
                  <div className="muted">This creates a new row in `interviews`.</div>
                  <button className="primary-button" type="submit" disabled={isSavingInterview}>
                    {isSavingInterview ? "Saving..." : "Schedule interview"}
                  </button>
                </div>
              </form>
            </article>

            <article className="panel">
              <div className="section-header">
                <div>
                  <div className="eyebrow">Timeline</div>
                  <h2 className="section-title">Latest activity</h2>
                </div>
              </div>
              <div className="section-stack">
                <div className="card" style={{ padding: 18 }}>
                  <span className="mini-label">Call history</span>
                  {(application.screening_calls ?? []).length === 0 ? (
                    <p>No call logs yet.</p>
                  ) : (
                    (application.screening_calls ?? []).map((call) => (
                      <div className="timeline-item call-history-card" key={call.id}>
                        <div className="call-history-header">
                          <strong>{call.call_status}</strong>
                          <span>{formatDateTime(call.called_at)}</span>
                        </div>
                        <div className="call-history-section">
                          <span className="mini-label">Summary</span>
                          <p>{call.call_summary ?? "No summary yet."}</p>
                        </div>
                        {call.next_action ? (
                          <div className="call-history-section">
                            <span className="mini-label">Next action</span>
                            <p>{call.next_action}</p>
                          </div>
                        ) : null}
                        {call.recording_url ? (
                          <a
                            className="secondary-link-button compact-link-button"
                            href={call.recording_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open recording
                          </a>
                        ) : null}
                        {call.transcript_url ? (
                          <details className="transcript-box">
                            <summary>View transcript</summary>
                            <pre>{call.transcript_url}</pre>
                          </details>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
                <div className="card" style={{ padding: 18 }}>
                  <span className="mini-label">Interview history</span>
                  {(application.interviews ?? []).length === 0 ? (
                    <p>No interviews yet.</p>
                  ) : (
                    (application.interviews ?? []).map((interview) => (
                      <div className="timeline-item" key={interview.id}>
                        <strong>{interview.interview_status}</strong>
                        <div className="muted">{formatDateTime(interview.scheduled_at)}</div>
                        <p>
                          {interview.interviewer_name ?? "No interviewer"} |{" "}
                          {interview.result ?? "pending"}
                        </p>
                        <p>{interview.feedback ?? "No notes."}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </main>
  );
}
