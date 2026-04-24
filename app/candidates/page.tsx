"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { syncToAirtable } from "@/lib/airtable/sync";
import { triggerEmail } from "@/lib/email/trigger";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const stageOrder = [
  "applied",
  "screened",
  "shortlisted",
  "interview_scheduled",
  "selected",
  "rejected"
] as const;

type StageName = (typeof stageOrder)[number];

type CandidateForm = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  totalExperience: string;
  englishLevel: string;
  source: string;
  hiringRequestId: string;
  fitSummary: string;
};

type CandidateRecord = {
  id: string;
  application_status: StageName;
  screening_score: number | null;
  fit_summary: string | null;
  rejection_reason: string | null;
  applied_at: string;
  candidates: {
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
  } | null;
  screening_calls:
    | {
        call_status: string;
        call_summary: string | null;
        next_action: string | null;
        called_at: string | null;
      }[]
    | null;
  interviews:
    | {
        interview_status: string;
        scheduled_at: string | null;
        result: string | null;
      }[]
    | null;
};

type CandidateRecordRow = Omit<CandidateRecord, "candidates" | "hiring_requests"> & {
  candidates:
    | {
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
      }[]
    | null;
};

type HiringRequestOption = {
  id: string;
  role_title: string;
  location: string | null;
  status: string;
};

const initialCandidateForm: CandidateForm = {
  fullName: "",
  phone: "",
  email: "",
  city: "",
  totalExperience: "",
  englishLevel: "Basic",
  source: "Naukri",
  hiringRequestId: "",
  fitSummary: ""
};

const stageTitles: Record<StageName, string> = {
  applied: "New Lead",
  screened: "AI Screened",
  shortlisted: "Qualified",
  interview_scheduled: "Interview Scheduled",
  selected: "Selected",
  rejected: "Rejected"
};

function normalizeApplication(row: CandidateRecordRow): CandidateRecord {
  return {
    ...row,
    candidates: row.candidates?.[0] ?? null,
    hiring_requests: row.hiring_requests?.[0] ?? null
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const message = "message" in error && typeof error.message === "string" ? error.message : null;
    const details = "details" in error && typeof error.details === "string" ? error.details : null;
    const hint = "hint" in error && typeof error.hint === "string" ? error.hint : null;

    return [message, details, hint].filter(Boolean).join(" | ") || fallback;
  }

  return fallback;
}

export default function CandidatesPage() {
  const [applications, setApplications] = useState<CandidateRecord[]>([]);
  const [hiringRequests, setHiringRequests] = useState<HiringRequestOption[]>([]);
  const [candidateForm, setCandidateForm] = useState<CandidateForm>(initialCandidateForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportingFromAirtable, setIsImportingFromAirtable] = useState(false);
  const [isSavingCandidate, setIsSavingCandidate] = useState(false);
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [pipelineMessage, setPipelineMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadApplications();
    void loadHiringRequests();
  }, []);

  async function loadApplications() {
    setIsLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("applications")
        .select(
          `
            id,
            application_status,
            screening_score,
            fit_summary,
            rejection_reason,
            applied_at,
            candidates (
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
              location
            ),
            screening_calls (
              call_status,
              call_summary,
              next_action,
              called_at
            ),
            interviews (
              interview_status,
              scheduled_at,
              result
            )
          `
        )
        .order("applied_at", { ascending: false });

      if (error) {
        throw error;
      }

      const normalizedApplications = ((data as CandidateRecordRow[] | null) ?? []).map(
        normalizeApplication
      );

      setApplications(normalizedApplications);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to load candidate pipeline."));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadHiringRequests() {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("hiring_requests")
        .select("id, role_title, location, status")
        .in("status", ["draft", "approved", "posted"])
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const options = (data as HiringRequestOption[] | null) ?? [];
      setHiringRequests(options);
      setCandidateForm((current) => ({
        ...current,
        hiringRequestId: current.hiringRequestId || options[0]?.id || ""
      }));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to load hiring requests."));
    }
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { id, value } = event.target;

    setCandidateForm((current) => ({
      ...current,
      [id]: value
    }));
  }

  async function importFromAirtable() {
    setIsImportingFromAirtable(true);
    setErrorMessage(null);
    setFormMessage(null);
    setPipelineMessage(null);

    try {
      const response = await fetch("/api/airtable/import", {
        method: "POST"
      });
      const data = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            error?: string;
            imported?: number;
            skipped?: number;
            failed?: number;
            issues?: string[];
          }
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Unable to import Airtable candidates.");
      }

      const summary = [
        data.message,
        `Imported: ${data.imported ?? 0}`,
        `Skipped: ${data.skipped ?? 0}`,
        `Failed: ${data.failed ?? 0}`
      ].join(" | ");

      setPipelineMessage(summary);

      if (data.issues?.length) {
        setFormMessage(data.issues[0]);
      }

      await loadApplications();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to import Airtable candidates."));
    } finally {
      setIsImportingFromAirtable(false);
    }
  }

  async function handleCreateCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingCandidate(true);
    setFormMessage(null);
    setErrorMessage(null);
    setPipelineMessage(null);

    try {
      if (!candidateForm.hiringRequestId) {
        throw new Error("Select a hiring request first.");
      }

      if (!candidateForm.fullName.trim() || !candidateForm.phone.trim()) {
        throw new Error("Candidate name and phone are required.");
      }

      const supabase = createSupabaseBrowserClient();
      const fullName = candidateForm.fullName.trim();
      const phone = candidateForm.phone.trim();
      const email = candidateForm.email.trim();
      const city = candidateForm.city.trim();
      const fitSummary = candidateForm.fitSummary.trim();
      const totalExperienceValue = candidateForm.totalExperience.trim();
      const totalExperience = totalExperienceValue
        ? Number.parseFloat(totalExperienceValue)
        : null;

      if (totalExperienceValue && !Number.isFinite(totalExperience)) {
        throw new Error("Experience in years must be a valid number.");
      }

      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .insert({
          full_name: fullName,
          phone,
          email: email || null,
          city: city || null,
          total_experience: totalExperience,
          english_level: candidateForm.englishLevel || null,
          source: candidateForm.source || null
        })
        .select("id")
        .single();

      if (candidateError) {
        throw candidateError;
      }

      const { data: application, error: applicationError } = await supabase
        .from("applications")
        .insert({
          candidate_id: candidate.id,
          hiring_request_id: candidateForm.hiringRequestId,
          application_status: "applied",
          fit_summary: fitSummary || null
        })
        .select("id")
        .single();

      if (applicationError) {
        throw applicationError;
      }

      const selectedRequest = hiringRequests.find(
        (request) => request.id === candidateForm.hiringRequestId
      );
      const airtableResult = await syncToAirtable("candidate_created", {
        candidateId: candidate.id,
        applicationId: application.id,
        hiringRequestId: candidateForm.hiringRequestId,
        candidateName: fullName,
        phone,
        email: email || null,
        city: city || null,
        totalExperience,
        englishLevel: candidateForm.englishLevel || null,
        source: candidateForm.source || null,
        fitSummary: fitSummary || null,
        roleTitle: selectedRequest?.role_title ?? null
      });

      setCandidateForm({
        ...initialCandidateForm,
        hiringRequestId: candidateForm.hiringRequestId
      });
      setFormMessage(
        airtableResult.ok
          ? airtableResult.skipped
            ? "Candidate added. Airtable sync is not configured yet."
            : "Candidate added and synced to Airtable."
          : `Candidate added, but Airtable sync failed: ${airtableResult.message}`
      );
      await loadApplications();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to create candidate."));
    } finally {
      setIsSavingCandidate(false);
    }
  }

  async function updateApplicationStage(
    applicationId: string,
    nextStatus: StageName,
    currentRejectionReason: string | null,
    previousStatus: StageName,
    candidateName: string | null,
    candidateEmail: string | null,
    roleTitle: string | null
  ) {
    setUpdatingApplicationId(applicationId);
    setErrorMessage(null);
    setPipelineMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const rejectionReason =
        nextStatus === "rejected"
          ? window.prompt(
              "Enter a rejection reason for this candidate:",
              currentRejectionReason ?? "Not a fit for this role"
            )
          : null;

      if (nextStatus === "rejected" && !rejectionReason) {
        setUpdatingApplicationId(null);
        return;
      }

      const payload =
        nextStatus === "rejected"
          ? {
              application_status: nextStatus,
              rejection_reason: rejectionReason
            }
          : {
              application_status: nextStatus,
              rejection_reason: null
            };

      const { error } = await supabase
        .from("applications")
        .update(payload)
        .eq("id", applicationId);

      if (error) {
        throw error;
      }

      if (nextStatus === "selected" || nextStatus === "rejected") {
        const emailResult = await triggerEmail(
          nextStatus === "selected" ? "candidate_selected" : "candidate_rejected",
          {
            applicationId,
            candidateEmail,
            candidateName,
            roleTitle,
            rejectionReason: nextStatus === "rejected" ? rejectionReason : null
          }
        );

        setPipelineMessage(
          emailResult.ok
            ? emailResult.skipped
              ? `Candidate moved to ${stageTitles[nextStatus]}. ${emailResult.message}`
              : `Candidate moved to ${stageTitles[nextStatus]}. ${emailResult.message}`
            : `Candidate moved to ${stageTitles[nextStatus]}, but email failed: ${emailResult.message}`
        );
      } else {
        setPipelineMessage(`Candidate moved to ${stageTitles[nextStatus]}.`);
      }

      await loadApplications();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to update candidate stage."));
    } finally {
      setUpdatingApplicationId(null);
    }
  }

  const groupedApplications = useMemo(() => {
    return stageOrder.reduce<Record<StageName, CandidateRecord[]>>((accumulator, stage) => {
      accumulator[stage] = applications.filter(
        (application) => application.application_status === stage
      );
      return accumulator;
    }, {} as Record<StageName, CandidateRecord[]>);
  }, [applications]);

  const stats = useMemo(() => {
    const selected = applications.filter(
      (application) => application.application_status === "selected"
    ).length;
    const interviews = applications.filter(
      (application) => application.application_status === "interview_scheduled"
    ).length;
    const pendingCalls = applications.filter((application) => {
      const latestCall = application.screening_calls?.[0];
      return !latestCall || latestCall.call_status === "pending";
    }).length;

    return {
      total: applications.length,
      selected,
      interviews,
      pendingCalls
    };
  }, [applications]);

  return (
    <main className="page-shell">
      <DashboardHeader
        current="candidates"
        title="Track every candidate from lead to final decision."
        description="This board shows the complete candidate journey: imported leads, AI screening, interview scheduling, and final selected or rejected outcomes."
      />

      <section className="hero">
        <div className="eyebrow">Advanced Client Demo</div>
        <h1>Advanced BPO talent pipeline for recruiters, managers, and client demos.</h1>
        <div className="chip-row">
          <div className="chip">Live candidate data</div>
          <div className="chip">AI call summaries</div>
          <div className="chip">Interview tracking</div>
          <div className="chip">Final selection flow</div>
        </div>
        <div className="hero-stats">
          <article className="stat-card">
            <span className="mini-label">Total candidates</span>
            <strong>{stats.total}</strong>
            <div className="muted">Across all hiring requests</div>
          </article>
          <article className="stat-card">
            <span className="mini-label">Pending call action</span>
            <strong>{stats.pendingCalls}</strong>
            <div className="muted">Need screening or call follow-up</div>
          </article>
          <article className="stat-card">
            <span className="mini-label">Interviews live</span>
            <strong>{stats.interviews}</strong>
            <div className="muted">Currently in interview stage</div>
          </article>
          <article className="stat-card">
            <span className="mini-label">Selected</span>
            <strong>{stats.selected}</strong>
            <div className="muted">Ready for final confirmation</div>
          </article>
        </div>
      </section>

      <section className="panel demo-panel">
        <div className="section-header">
          <div>
            <div className="eyebrow">What Client Sees</div>
            <h2 className="section-title">Why this page feels like an advanced hiring product</h2>
          </div>
        </div>
        <div className="steps-grid" style={{ marginTop: 20 }}>
          <article className="step-card">
            <span>01</span>
            <h3>Lead intake</h3>
            <p>New candidates enter from Airtable, portals, or manual recruiter entry.</p>
          </article>
          <article className="step-card">
            <span>02</span>
            <h3>AI + recruiter screening</h3>
            <p>Each person can be called by AI, reviewed by recruiter, and moved forward quickly.</p>
          </article>
          <article className="step-card">
            <span>03</span>
            <h3>Decision pipeline</h3>
            <p>Interview, selection, rejection, and communication all happen from one board.</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <div className="eyebrow">Airtable Intake</div>
            <h2 className="section-title">Import candidates from Airtable</h2>
          </div>
          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              onClick={() => void importFromAirtable()}
              disabled={isImportingFromAirtable}
            >
              {isImportingFromAirtable ? "Importing..." : "Import from Airtable"}
            </button>
          </div>
        </div>

      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <div className="eyebrow">Add Candidate</div>
            <h2 className="section-title">Manual fallback entry</h2>
          </div>
          <div className="muted">Use this only if a candidate does not come through Airtable.</div>
        </div>

        <form className="candidate-form" onSubmit={handleCreateCandidate}>
          <div className="form-grid" style={{ marginTop: 20 }}>
            <div className="field">
              <label htmlFor="fullName">Full name</label>
              <input id="fullName" value={candidateForm.fullName} onChange={handleInputChange} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" type="tel" value={candidateForm.phone} onChange={handleInputChange} />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={candidateForm.email} onChange={handleInputChange} />
            </div>
            <div className="field">
              <label htmlFor="city">City</label>
              <input id="city" value={candidateForm.city} onChange={handleInputChange} />
            </div>
            <div className="field">
              <label htmlFor="totalExperience">Experience in years</label>
              <input
                id="totalExperience"
                type="number"
                min="0"
                step="0.1"
                value={candidateForm.totalExperience}
                onChange={handleInputChange}
              />
            </div>
            <div className="field">
              <label htmlFor="englishLevel">English level</label>
              <select
                id="englishLevel"
                value={candidateForm.englishLevel}
                onChange={handleInputChange}
              >
                <option>Basic</option>
                <option>Good</option>
                <option>Excellent</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="source">Source</label>
              <select id="source" value={candidateForm.source} onChange={handleInputChange}>
                <option>Naukri</option>
                <option>Referral</option>
                <option>Indeed</option>
                <option>Walk-in</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="hiringRequestId">Hiring request</label>
              <select
                id="hiringRequestId"
                value={candidateForm.hiringRequestId}
                onChange={handleInputChange}
              >
                <option value="">Select request</option>
                {hiringRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.role_title} | {request.location ?? "No location"} | {request.status}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="fitSummary">Initial recruiter note</label>
              <textarea
                id="fitSummary"
                value={candidateForm.fitSummary}
                onChange={handleInputChange}
                placeholder="Add a short screening note or candidate summary."
              />
            </div>
          </div>

          <div className="form-footer">
            <div>
              <div className="chip-row">
                <div className="chip">Creates candidate row</div>
                <div className="chip">Creates pipeline record</div>
                <div className="chip">Initial stage: new lead</div>
              </div>
              {formMessage ? <div className="status-success">{formMessage}</div> : null}
            </div>
            <div className="button-row">
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  setCandidateForm({
                    ...initialCandidateForm,
                    hiringRequestId: candidateForm.hiringRequestId
                  })
                }
              >
                Reset
              </button>
              <button className="primary-button" type="submit" disabled={isSavingCandidate}>
                {isSavingCandidate ? "Saving..." : "Add candidate"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <div className="eyebrow">Live Board</div>
            <h2 className="section-title">Candidate journey</h2>
          </div>
          <div className="button-row">
            <button className="secondary-button" onClick={() => void loadApplications()} type="button">
              Refresh data
            </button>
          </div>
        </div>

        {errorMessage ? <div className="status-error">{errorMessage}</div> : null}
        {pipelineMessage ? <div className="status-success">{pipelineMessage}</div> : null}
        {isLoading ? <div className="status-success">Loading candidate pipeline from Supabase...</div> : null}

        {!isLoading && applications.length === 0 ? (
          <div className="empty-state">
            No candidates found yet. Once candidates are imported or added, they
            will appear here automatically.
          </div>
        ) : null}

        <div className="kanban-grid">
          {stageOrder.map((stage) => (
            <article className="kanban-column" key={stage}>
              <div className="kanban-column-header">
                <div>
                  <span className="mini-label">{stageTitles[stage]}</span>
                  <h3>{groupedApplications[stage].length}</h3>
                </div>
              </div>

              <div className="kanban-card-list">
                {groupedApplications[stage].length === 0 ? (
                  <div className="kanban-empty">No candidates in this stage.</div>
                ) : null}

                {groupedApplications[stage].map((application) => {
                  const candidate = application.candidates;
                  const request = application.hiring_requests;
                  const latestCall = application.screening_calls?.[0];
                  const latestInterview = application.interviews?.[0];

                  return (
                    <article className="candidate-card" key={application.id}>
                      <div className="candidate-card-header">
                        <div>
                          <strong>{candidate?.full_name ?? "Unnamed candidate"}</strong>
                          <div className="muted">
                            {request?.role_title ?? "No linked role"} | {candidate?.city ?? "No city"}
                          </div>
                        </div>
                        <div className="candidate-badge">{stageTitles[application.application_status]}</div>
                      </div>

                      <div className="candidate-meta">
                        <div>
                          <span className="mini-label">Phone</span>
                          <p>{candidate?.phone ?? "Not available"}</p>
                        </div>
                        <div>
                          <span className="mini-label">Experience</span>
                          <p>
                            {candidate?.total_experience != null
                              ? `${candidate.total_experience} years`
                              : "Not set"}
                          </p>
                        </div>
                        <div>
                          <span className="mini-label">English</span>
                          <p>{candidate?.english_level ?? "Not set"}</p>
                        </div>
                        <div>
                          <span className="mini-label">Source</span>
                          <p>{candidate?.source ?? "Not set"}</p>
                        </div>
                      </div>

                      <div className="candidate-note-block">
                        <span className="mini-label">Move stage</span>
                        <div className="stage-actions">
                          <select
                            aria-label={`Update stage for ${candidate?.full_name ?? "candidate"}`}
                            className="stage-select"
                            defaultValue={application.application_status}
                            disabled={updatingApplicationId === application.id}
                            onChange={(event) => {
                              const nextStatus = event.target.value as StageName;
                              if (nextStatus === application.application_status) {
                                return;
                              }

                              void updateApplicationStage(
                                application.id,
                                nextStatus,
                                application.rejection_reason,
                                application.application_status,
                                candidate?.full_name ?? null,
                                candidate?.email ?? null,
                                request?.role_title ?? null
                              );
                            }}
                          >
                            {stageOrder.map((stageOption) => (
                              <option key={stageOption} value={stageOption}>
                                {stageTitles[stageOption]}
                              </option>
                            ))}
                          </select>
                          {updatingApplicationId === application.id ? (
                            <div className="muted">Updating stage...</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="candidate-note-block">
                        <span className="mini-label">Fit summary</span>
                        <p>{application.fit_summary ?? "No summary yet."}</p>
                      </div>

                      <div className="candidate-note-block">
                        <span className="mini-label">Latest call</span>
                        <p>{latestCall?.call_summary ?? "No call summary yet."}</p>
                        <div className="muted">
                          {latestCall?.call_status ?? "pending"}
                          {latestCall?.next_action ? ` | ${latestCall.next_action}` : ""}
                        </div>
                      </div>

                      <div className="candidate-note-block">
                        <span className="mini-label">Interview</span>
                        <p>
                          {latestInterview?.scheduled_at
                            ? new Date(latestInterview.scheduled_at).toLocaleString()
                            : "No interview scheduled yet."}
                        </p>
                        <div className="muted">
                          {latestInterview?.interview_status ?? "not_scheduled"}
                          {latestInterview?.result ? ` | ${latestInterview.result}` : ""}
                        </div>
                      </div>

                      {application.rejection_reason ? (
                        <div className="candidate-note-block">
                          <span className="mini-label">Rejection reason</span>
                          <p>{application.rejection_reason}</p>
                        </div>
                      ) : null}

                      <Link className="secondary-link-button" href={`/candidates/${application.id}`}>
                        Open details
                      </Link>
                    </article>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
