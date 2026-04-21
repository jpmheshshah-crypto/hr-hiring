"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const workflowSteps = [
  {
    id: "01",
    title: "Create the role request",
    text: "Recruiters enter a human hiring need like E-commerce Customer Care, 10 openings, shift, salary band, and language requirements."
  },
  {
    id: "02",
    title: "Review and post the job",
    text: "The system prepares the job post and application form, then sends it for approval before publishing on job portals."
  },
  {
    id: "03",
    title: "Screen every applicant",
    text: "Leads are imported into Supabase and Airtable, then the recruiter team can screen, call, and qualify each candidate in one place."
  },
  {
    id: "04",
    title: "Schedule and close",
    text: "Interview slots, recruiter notes, candidate decisions, and final selection emails all stay in one dashboard."
  }
];

const pipelineStages = [
  "New Request",
  "Draft Post",
  "Approved",
  "Applied",
  "Screened",
  "Interview Scheduled",
  "Selected"
];

type HiringRequestForm = {
  roleTitle: string;
  headcountNeeded: string;
  location: string;
  shiftType: string;
  salaryMin: string;
  salaryMax: string;
  languageRequired: string;
  jobDescription: string;
};

type HiringRequestSummary = {
  id: string;
  role_title: string;
  headcount_needed: number;
  status: string;
  location: string | null;
  created_at: string;
};

const initialForm: HiringRequestForm = {
  roleTitle: "E-commerce Customer Care",
  headcountNeeded: "10",
  location: "Noida",
  shiftType: "Rotational",
  salaryMin: "18000",
  salaryMax: "24000",
  languageRequired: "English and Hindi",
  jobDescription:
    "Handle order issues, returns, order tracking, and customer queries for e-commerce buyers. Good spoken English, clear customer handling, and basic computer knowledge required."
};

export default function HomePage() {
  const [form, setForm] = useState<HiringRequestForm>(initialForm);
  const [recentRequests, setRecentRequests] = useState<HiringRequestSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadRecentRequests();
  }, []);

  async function loadRecentRequests() {
    setIsLoadingRequests(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("hiring_requests")
        .select("id, role_title, headcount_needed, status, location, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        throw error;
      }

      setRecentRequests(data ?? []);
      setErrorMessage(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load hiring requests.";
      setErrorMessage(message);
    } finally {
      setIsLoadingRequests(false);
    }
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { id, value } = event.target;

    setForm((current) => ({
      ...current,
      [id]: value
    }));
  }

  async function handleSaveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const headcountNeeded = Number.parseInt(form.headcountNeeded, 10);
      const salaryMin = form.salaryMin ? Number.parseFloat(form.salaryMin) : null;
      const salaryMax = form.salaryMax ? Number.parseFloat(form.salaryMax) : null;

      if (!Number.isFinite(headcountNeeded) || headcountNeeded <= 0) {
        throw new Error("Headcount must be a number greater than 0.");
      }

      const { data, error } = await supabase
        .from("hiring_requests")
        .insert({
          role_title: form.roleTitle,
          department: "Customer Support",
          headcount_needed: headcountNeeded,
          location: form.location,
          shift_type: form.shiftType,
          salary_min: salaryMin,
          salary_max: salaryMax,
          experience_required: "0-2 years",
          language_required: form.languageRequired,
          job_description: form.jobDescription,
          status: "draft"
        })
        .select("id, role_title, headcount_needed, status, location, created_at")
        .single();

      if (error) {
        throw error;
      }

      setSaveMessage("Hiring request saved to Supabase.");
      setForm(initialForm);
      setRecentRequests((current) => (data ? [data, ...current].slice(0, 5) : current));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save hiring request.";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <DashboardHeader
        current="home"
        title="Create and manage hiring requests."
        description="Use this dashboard to open a role, review the hiring flow, and feed candidate screening, interviews, and final decisions from one system."
      />

      <section className="hero">
        <div className="eyebrow">BPO Hiring Control Center</div>
        <h1>Hire human customer care teams through one clean dashboard.</h1>
        <p>
          This starter app is designed for your workflow: create a hiring
          request, review the post, collect applicants, sync candidate data to
          Airtable, schedule interviews, and send final selection or rejection
          emails from one place.
        </p>
        <div className="button-row">
          <button className="primary-button" type="button">
            Active role: E-commerce customer care
          </button>
          <Link className="secondary-link-button" href="/candidates">
            Open candidate pipeline
          </Link>
        </div>
        <div className="hero-stats">
          <article className="stat-card">
            <span className="mini-label">Open role</span>
            <strong>10</strong>
            <div className="muted">E-commerce customer care hires</div>
          </article>
          <article className="stat-card">
            <span className="mini-label">Pipeline status</span>
            <strong>4</strong>
            <div className="muted">Approval checkpoints</div>
          </article>
          <article className="stat-card">
            <span className="mini-label">Automations</span>
            <strong>Supabase + Airtable</strong>
            <div className="muted">Core data and candidate sync</div>
          </article>
        </div>
      </section>

      <section className="info-grid">
        <form className="panel" onSubmit={handleSaveDraft}>
          <div className="section-header">
            <div>
              <div className="eyebrow">New Hiring Request</div>
              <h2 className="section-title">Recruiter intake form</h2>
            </div>
            <div className="muted">This is the first screen your recruiter uses.</div>
          </div>

          <div className="form-grid" style={{ marginTop: 20 }}>
            <div className="field">
              <label htmlFor="roleTitle">Role title</label>
              <input id="roleTitle" value={form.roleTitle} onChange={handleInputChange} />
            </div>
            <div className="field">
              <label htmlFor="headcountNeeded">Headcount needed</label>
              <input
                id="headcountNeeded"
                value={form.headcountNeeded}
                onChange={handleInputChange}
              />
            </div>
            <div className="field">
              <label htmlFor="location">Location</label>
              <input id="location" value={form.location} onChange={handleInputChange} />
            </div>
            <div className="field">
              <label htmlFor="shiftType">Shift</label>
              <select id="shiftType" value={form.shiftType} onChange={handleInputChange}>
                <option>Rotational</option>
                <option>Day</option>
                <option>Night</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="salaryMin">Salary min</label>
              <input id="salaryMin" value={form.salaryMin} onChange={handleInputChange} />
            </div>
            <div className="field">
              <label htmlFor="salaryMax">Salary max</label>
              <input id="salaryMax" value={form.salaryMax} onChange={handleInputChange} />
            </div>
            <div className="field">
              <label htmlFor="languageRequired">Language required</label>
              <input
                id="languageRequired"
                value={form.languageRequired}
                onChange={handleInputChange}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="jobDescription">Role notes</label>
              <textarea
                id="jobDescription"
                value={form.jobDescription}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-footer">
            <div>
              <div className="muted">
                This form now targets the `hiring_requests` table in Supabase.
              </div>
              <div className="chip-row">
                <div className="chip">Supabase</div>
                <div className="chip">Airtable sync</div>
                <div className="chip">Portal posting</div>
              </div>
              {saveMessage ? <div className="status-success">{saveMessage}</div> : null}
              {errorMessage ? <div className="status-error">{errorMessage}</div> : null}
            </div>
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => setForm(initialForm)}>
                Reset
              </button>
              <button className="primary-button" type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save draft"}
              </button>
            </div>
          </div>
        </form>

        <article className="panel">
          <div className="eyebrow">Current Stack</div>
          <h2 className="section-title">Recommended setup</h2>
          <div className="section-stack">
            <div className="card" style={{ padding: 18 }}>
              <span className="mini-label">Frontend</span>
              <p>Next.js dashboard now, or Lovable later if you want visual iteration faster.</p>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <span className="mini-label">Data</span>
              <p>Supabase stores hiring requests, job posts, candidates, calls, interviews, and email logs.</p>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <span className="mini-label">Automation</span>
              <p>Supabase stores the core workflow, and the app syncs candidate records directly to Airtable through its own API route.</p>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <span className="mini-label">Voice AI</span>
              <p>Vapi calls candidates, confirms details, and sends the call summary back into your pipeline.</p>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <span className="mini-label">Recent requests</span>
              {isLoadingRequests ? <p>Loading from Supabase...</p> : null}
              {!isLoadingRequests && recentRequests.length === 0 ? (
                <p>No hiring requests yet. Save your first draft from the form.</p>
              ) : null}
              {recentRequests.map((request) => (
                <div key={request.id} style={{ marginTop: 14 }}>
                  <strong style={{ display: "block", fontSize: "1rem" }}>
                    {request.role_title}
                  </strong>
                  <div className="muted">
                    {request.headcount_needed} hires | {request.location ?? "No location"} |{" "}
                    {request.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="section-stack">
        <article className="panel">
          <div className="section-header">
            <div>
              <div className="eyebrow">Workflow</div>
              <h2 className="section-title">Hiring automation stages</h2>
            </div>
            <div className="muted">These map directly to your hiring stages and the candidate pipeline in Supabase.</div>
          </div>
          <div className="steps-grid" style={{ marginTop: 20 }}>
            {workflowSteps.map((step) => (
              <article className="step-card" key={step.id}>
                <span>{step.id}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="section-header">
            <div>
              <div className="eyebrow">Pipeline</div>
              <h2 className="section-title">Candidate status board</h2>
            </div>
            <div className="muted">Next build step: make each stage load live data from Supabase.</div>
          </div>
          <div className="pipeline-grid" style={{ marginTop: 20 }}>
            {pipelineStages.map((stage, index) => (
              <article className="stage-card" key={stage}>
                <span>Stage {index + 1}</span>
                <strong>{stage}</strong>
                <p className="muted">
                  {index < 3
                    ? "Recruiter and approval phase"
                    : index < 6
                      ? "Candidate progress phase"
                      : "Final hiring outcome"}
                </p>
              </article>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
