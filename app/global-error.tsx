"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/status/error-state";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Global application error", error); }, [error]);
  return <html lang="en"><body><ErrorState global reset={reset} title="Actrexx could not start" message="A critical page error occurred. Try again or return to the homepage." /></body></html>;
}
