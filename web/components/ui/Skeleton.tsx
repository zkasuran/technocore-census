import { cn } from "@/lib/ui";

/**
 * A shimmering placeholder box. Server-safe: the shimmer is pure CSS, so this
 * needs no client boundary. Give it a height and width through className.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

/** A stack of skeleton lines for a text block that is still loading. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
