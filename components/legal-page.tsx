import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export function LegalPage({ eyebrow = "Information", title, intro, children }: {
  eyebrow?: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="site-container legal-shell">
        <article className="legal-content">
          <header className="page-heading"><p>{eyebrow}</p><h1>{title}</h1><div><span>{intro}</span></div></header>
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
