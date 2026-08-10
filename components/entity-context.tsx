import type { EntityContext as EntityContextValue } from "@/lib/entity-context";
import Link from "next/link";

export function EntityContext({ value }: { value: EntityContextValue }) {
  return (
    <section className="entity-context" aria-labelledby="entity-context-title">
      <div className="entity-context-copy">
        <h2 id="entity-context-title">{value.heading}</h2>
        {value.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      <div className="entity-context-groups">
        {value.groups.map((group) => (
          <div key={group.label}>
            <h3>{group.label}</h3>
            <ul>
              {group.links.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
