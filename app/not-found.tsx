import { FileQuestion, Home, Search } from "lucide-react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function NotFound() {
  return <><SiteHeader /><main className="status-page"><div className="status-mark"><FileQuestion size={28} aria-hidden="true" /></div><p>Error 404</p><h1>Page not found</h1><span>This page may have moved, been removed or never existed.</span><div><Link href="/"><Home size={15} />Latest videos</Link><Link href="/search"><Search size={15} />Search</Link></div></main><SiteFooter /></>;
}
