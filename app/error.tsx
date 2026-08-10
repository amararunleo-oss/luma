"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/status/error-state";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Route error", error); }, [error]);
  return <ErrorState reset={reset} />;
}
