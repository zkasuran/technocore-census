/* Shared client-safe helpers. No server-only imports here so any component can use it. */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortDid(did: string): string {
  const tail = did.replace(/^did:key:z/, "");
  return tail.length > 12 ? `${tail.slice(0, 4)}…${tail.slice(-6)}` : tail;
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${n}`;
}

export function percent(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function riskColor(band?: string): string {
  if (band === "flag") return "var(--color-flag)";
  if (band === "watch") return "var(--color-warn)";
  return "var(--color-signal)";
}
