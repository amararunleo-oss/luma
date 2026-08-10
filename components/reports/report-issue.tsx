"use client";

import { AlertTriangle, Check, Flag, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SelectMenu } from "@/components/ui/select-menu";

type SubmitState = "idle" | "sending" | "success" | "error";

export function ReportIssue({ videoSlug, title }: { videoSlug: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoSlug, category: form.get("category"), details: form.get("details"), contactEmail: form.get("contactEmail"), website: form.get("website") }),
      });
      const payload = await response.json() as { error?: { message?: string }; duplicate?: boolean };
      if (!response.ok) throw new Error(payload.error?.message || "The report could not be submitted.");
      setState("success");
      setMessage(payload.duplicate ? "This issue is already in the review queue." : "Report received. Thank you for helping keep the information accurate.");
      event.currentTarget.reset();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The report could not be submitted.");
    }
  }

  return (
    <div className="report-action">
      <button type="button" onClick={() => { setOpen(true); setState("idle"); setMessage(""); }}><Flag size={14} aria-hidden="true" />Report a problem</button>
      {open && (
        <div className="report-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <header><div><Flag size={17} aria-hidden="true" /><span>Report issue</span></div><button ref={closeButton} type="button" aria-label="Close report form" onClick={() => setOpen(false)}><X size={17} /></button></header>
            {state === "success" ? (
              <div className="report-success"><span><Check size={22} aria-hidden="true" /></span><h2>Report submitted</h2><p>{message}</p><button type="button" onClick={() => setOpen(false)}>Done</button></div>
            ) : (
              <form onSubmit={submit}>
                <div className="report-intro"><h2 id="report-title">Report “{title}”</h2><p>Tell us what needs attention. Every report is reviewed before information is changed.</p></div>
                <label htmlFor="report-category"><span>Issue type</span><SelectMenu id="report-category" name="category" ariaLabel="Issue type" defaultValue="unavailable" required options={[{ value: "unavailable", label: "Video unavailable" }, { value: "thumbnail", label: "Thumbnail problem" }, { value: "metadata", label: "Incorrect metadata" }, { value: "duplicate", label: "Duplicate video" }, { value: "legal", label: "Legal or privacy concern" }, { value: "other", label: "Other issue" }]} /></label>
                <label><span>Details</span><textarea name="details" maxLength={1000} rows={5} placeholder="Include the incorrect information or what happened." /></label>
                <label><span>Email <small>optional</small></span><input name="contactEmail" type="email" maxLength={254} autoComplete="email" placeholder="For follow-up only" /></label>
                <label className="report-honeypot" aria-hidden="true"><span>Website</span><input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
                {state === "error" && <p className="report-error" role="alert"><AlertTriangle size={14} aria-hidden="true" />{message}</p>}
                <div className="report-submit"><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" disabled={state === "sending"}>{state === "sending" && <LoaderCircle size={14} className="search-spinner" />}Submit report</button></div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
