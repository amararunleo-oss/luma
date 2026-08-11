import type { AnchorHTMLAttributes, ReactNode } from "react";

type RevenueLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children: ReactNode;
  adTrigger?: boolean;
};

/**
 * Internal monetized navigation deliberately uses a normal anchor.
 *
 * ExoClick's generated tags keep document-level state and click listeners.
 * A full document navigation gives every destination a fresh provider lifecycle,
 * while still allowing click-triggered formats to observe the original click.
 */
export default function RevenueLink({ href, className, adTrigger = true, children, ...props }: RevenueLinkProps) {
  const classes = [className, adTrigger ? "actrexx-mobile-pop" : ""].filter(Boolean).join(" ");
  return <a {...props} className={classes || undefined} href={href}>{children}</a>;
}
