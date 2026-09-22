/*
 * A methodology section: an anchored heading, an optional lede and the body. Server
 * component, no interactivity. The id lets the on-page contents jump to it and gives each
 * section a stable heading for assistive tech.
 */
import { cn } from "@/lib/ui";

export function Section({
  id,
  step,
  title,
  lede,
  className,
  children,
}: {
  id: string;
  step?: number;
  title: string;
  lede?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20", className)} aria-labelledby={`${id}-h`}>
      <div className="mb-4 flex items-baseline gap-3">
        {typeof step === "number" && (
          <span
            className="mono text-sm text-[color:var(--color-signal)]"
            aria-hidden
          >
            {String(step).padStart(2, "0")}
          </span>
        )}
        <h2 id={`${id}-h`} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      {lede && (
        <p className="mb-5 max-w-3xl text-sm leading-relaxed text-[color:var(--color-ink-dim)]">
          {lede}
        </p>
      )}
      {children}
    </section>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-[color:var(--color-ink-dim)]">{children}</p>
  );
}

export function KeyTerm({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-[color:var(--color-ink)]">{children}</span>;
}
