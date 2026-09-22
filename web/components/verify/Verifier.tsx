"use client";

import { useEffect, useMemo, useState } from "react";
import { ed25519 } from "@noble/curves/ed25519";
import { base58, base64urlnopad } from "@scure/base";
import { cn } from "@/lib/ui";

/*
  Fully client-side. No network, no server. Everything below runs in the browser
  so a reader can prove a signature with nothing but their own machine.

  The scheme mirrors src/technocore_census/identity.py exactly:
    - a message signature covers the canonical string  room|nonce|clean(text)
    - clean(text) sweeps unicode categories Cc, Cf, Cs, Co, Zl, Zp to a space,
      then collapses every run of whitespace to one space and trims the ends
    - the signature is Ed25519 over the utf-8 bytes of that string, base64url, no padding
    - a did:key is "did:key:z" + base58(0xed01 + 32-byte raw ed25519 public key)

  Signing the raw text instead of clean(text) is the one mistake that silently fails,
  so clean() below matches the Python canonical() character for character.
*/

// Categories the Python sweep turns into a space, before the whitespace collapse.
const SWEEP = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]/gu;

/**
 * The exact text the server stores. Mirrors identity.py canonical():
 *   swept = "".join(" " if category(ch) in {Cc,Cf,Cs,Co,Zl,Zp} else ch for ch in text)
 *   return " ".join(swept.split())
 *
 * Step one replaces those categories with a space. Step two collapses runs of
 * whitespace to a single space and strips the ends. Python's str.split() treats
 * every Space_Separator (\p{Zs}) as whitespace, and every other whitespace
 * character it recognises (the ASCII controls, NEL, U+2028, U+2029) is already
 * in the swept set above, so collapsing on \p{Zs} reproduces split() precisely.
 */
export function clean(text: string): string {
  return text.replace(SWEEP, " ").replace(/\p{Zs}+/gu, " ").trim();
}

const DID_PREFIX = "did:key:z";
const ED25519_MULTICODEC = [0xed, 0x01];

type VerifyResult =
  | { status: "idle" }
  | { status: "fail"; reason: string; canonical?: string; pubkeyHex?: string; swept?: boolean }
  | { status: "pass"; canonical: string; pubkeyHex: string; swept: boolean };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Accept a base64url signature with or without padding, and tolerate a standard
// base64 alphabet in case someone pastes one. Whitespace is stripped first.
function decodeSignature(raw: string): Uint8Array {
  const cleaned = raw.trim().replace(/\s+/g, "").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return base64urlnopad.decode(cleaned);
}

function decodeDid(did: string): Uint8Array {
  const trimmed = did.trim();
  if (!trimmed.startsWith(DID_PREFIX)) {
    throw new Error("DID does not start with did:key:z");
  }
  const body = trimmed.slice(DID_PREFIX.length);
  let decoded: Uint8Array;
  try {
    decoded = base58.decode(body);
  } catch {
    throw new Error("malformed base58 in the did:key body");
  }
  if (decoded.length < 2 || decoded[0] !== ED25519_MULTICODEC[0] || decoded[1] !== ED25519_MULTICODEC[1]) {
    throw new Error("wrong multicodec prefix, expected 0xed01 (ed25519-pub)");
  }
  const pubkey = decoded.slice(2);
  if (pubkey.length !== 32) {
    throw new Error(`public key is ${pubkey.length} bytes, expected 32`);
  }
  return pubkey;
}

function verify(did: string, room: string, nonce: string, text: string, sig: string): VerifyResult {
  if (!did.trim() && !room.trim() && !nonce.trim() && !text.trim() && !sig.trim()) {
    return { status: "idle" };
  }

  let pubkey: Uint8Array;
  try {
    pubkey = decodeDid(did);
  } catch (e) {
    return { status: "fail", reason: (e as Error).message };
  }
  const pubkeyHex = toHex(pubkey);

  if (!sig.trim()) {
    return { status: "fail", reason: "no signature to check", pubkeyHex };
  }
  let signature: Uint8Array;
  try {
    signature = decodeSignature(sig);
  } catch {
    return { status: "fail", reason: "malformed base64url signature", pubkeyHex };
  }
  if (signature.length !== 64) {
    return { status: "fail", reason: `signature is ${signature.length} bytes, expected 64`, pubkeyHex };
  }

  const cleaned = clean(text);
  const canonical = `${room}|${nonce}|${cleaned}`;
  const swept = cleaned !== text;
  const message = new TextEncoder().encode(canonical);

  let ok: boolean;
  try {
    ok = ed25519.verify(signature, message, pubkey, { zip215: false });
  } catch (e) {
    return { status: "fail", reason: `verification error: ${(e as Error).message}`, canonical, pubkeyHex, swept };
  }
  if (!ok) {
    return {
      status: "fail",
      reason: "signature does not match this did:key over the canonical message",
      canonical,
      pubkeyHex,
      swept,
    };
  }
  return { status: "pass", canonical, pubkeyHex, swept };
}

const INPUT_CLASS =
  "w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-panel)] px-3 py-2 text-sm text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-faint)] outline-none focus:border-[color:var(--color-signal-dim)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-signal)]/60";

const BTN_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]";

// Copy to clipboard with a graceful fallback for browsers that block the async API.
function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).catch(() => fallbackCopy(value));
  } else {
    fallbackCopy(value);
  }
}

function fallbackCopy(value: string) {
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    /* nothing else to try */
  }
  document.body.removeChild(ta);
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono = true,
  area = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  area?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
        {label}
      </span>
      {area ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={cn(INPUT_CLASS, mono && "mono", "resize-y")}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className={cn(INPUT_CLASS, mono && "mono")}
        />
      )}
    </label>
  );
}

export function Verifier({ initialDid = "" }: { initialDid?: string }) {
  const [did, setDid] = useState(initialDid);
  const [room, setRoom] = useState("");
  const [nonce, setNonce] = useState("");
  const [text, setText] = useState("");
  const [sig, setSig] = useState("");
  const [envelope, setEnvelope] = useState("");
  const [envError, setEnvError] = useState("");
  const [exampleNote, setExampleNote] = useState("");

  // The profile pages link here as /verify?did=... The parent reads the param on
  // the server and passes it in, so fill the DID once on mount if it was empty.
  useEffect(() => {
    if (initialDid) setDid(initialDid);
  }, [initialDid]);

  const result = useMemo(() => verify(did, room, nonce, text, sig), [did, room, nonce, text, sig]);

  function fillFromEnvelope() {
    setEnvError("");
    setExampleNote("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(envelope);
    } catch {
      setEnvError("that is not valid JSON");
      return;
    }
    if (!parsed || typeof parsed !== "object") {
      setEnvError("expected a JSON object like {\"did\":..., \"room\":..., \"nonce\":..., \"text\":..., \"sig\":...}");
      return;
    }
    const env = parsed as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
    const nextDid = str(env.did);
    const nextRoom = str(env.room ?? env.r);
    const nextNonce = str(env.nonce);
    const nextText = str(env.text);
    const nextSig = str(env.sig);
    if (!nextDid && !nextRoom && !nextNonce && !nextText && !nextSig) {
      setEnvError("no known fields found (did, room or r, nonce, text, sig)");
      return;
    }
    setDid(nextDid);
    setRoom(nextRoom);
    setNonce(nextNonce);
    setText(nextText);
    setSig(nextSig);
  }

  // A genuinely valid example, minted in the browser from a throwaway key. It is
  // self-consistent so it verifies PASS, and it never touches any real identity.
  function loadLiveExample() {
    setEnvError("");
    const secret = ed25519.utils.randomSecretKey();
    const pub = ed25519.getPublicKey(secret);
    const exampleDid = DID_PREFIX + base58.encode(new Uint8Array([...ED25519_MULTICODEC, ...pub]));
    const exampleRoom = "technocore";
    const exampleNonce = String(Date.now());
    const exampleText = "census verify demo, signed by a throwaway key";
    const canonical = `${exampleRoom}|${exampleNonce}|${clean(exampleText)}`;
    const signature = ed25519.sign(new TextEncoder().encode(canonical), secret);
    setDid(exampleDid);
    setRoom(exampleRoom);
    setNonce(exampleNonce);
    setText(exampleText);
    setSig(base64urlnopad.encode(signature));
    setExampleNote(
      "Loaded a live example. This key was generated in your browser just now and discarded, so it proves the checker works without standing in for any real identity.",
    );
  }

  // Flip one bit of the current signature. It is its own inverse, so a second click
  // restores the original signature and the result flips back to PASS.
  function toggleBit() {
    if (!sig.trim()) return;
    setExampleNote("");
    try {
      const bytes = decodeSignature(sig);
      bytes[0] ^= 0x01;
      setSig(base64urlnopad.encode(bytes));
    } catch {
      setExampleNote("cannot alter a malformed signature");
    }
  }

  function clearAll() {
    setDid("");
    setRoom("");
    setNonce("");
    setText("");
    setSig("");
    setEnvelope("");
    setEnvError("");
    setExampleNote("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
              Paste a signed envelope
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadLiveExample}
                className={cn(
                  "rounded-lg border border-[color:var(--color-signal-dim)] bg-[color:var(--color-signal)]/10 px-3 py-1.5 text-xs text-[color:var(--color-signal)] transition-colors hover:bg-[color:var(--color-signal)]/20",
                  BTN_FOCUS,
                )}
              >
                Load a live example
              </button>
              <button
                type="button"
                onClick={clearAll}
                className={cn(
                  "rounded-lg border border-[color:var(--color-line)] px-3 py-1.5 text-xs text-[color:var(--color-ink-dim)] transition-colors hover:text-[color:var(--color-ink)]",
                  BTN_FOCUS,
                )}
              >
                Clear
              </button>
            </div>
          </div>
          <textarea
            value={envelope}
            onChange={(e) => setEnvelope(e.target.value)}
            placeholder={'{"did": "did:key:z...", "room": "technocore", "nonce": "1699...", "text": "...", "sig": "..."}'}
            rows={4}
            spellCheck={false}
            className={cn(INPUT_CLASS, "mono resize-y")}
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={fillFromEnvelope}
              className={cn(
                "rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] px-3 py-1.5 text-sm text-[color:var(--color-ink)] transition-colors hover:border-[color:var(--color-signal-dim)]",
                BTN_FOCUS,
              )}
            >
              Fill the fields from JSON
            </button>
            {envError && <span className="text-xs text-[color:var(--color-flag)]">{envError}</span>}
          </div>
          {exampleNote && (
            <p className="mt-3 text-xs text-[color:var(--color-ink-dim)]">{exampleNote}</p>
          )}
        </div>

        <div className="card flex flex-col gap-4 p-5">
          <Field label="did:key" value={did} onChange={setDid} placeholder="did:key:z6Mk..." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Room" value={room} onChange={setRoom} placeholder="technocore" />
            <Field label="Nonce" value={nonce} onChange={setNonce} placeholder="1699999999999" />
          </div>
          <Field label="Text (message body)" value={text} onChange={setText} placeholder="the exact message text" area />
          <Field label="Signature (base64url)" value={sig} onChange={setSig} placeholder="base64url, no padding" area />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <ResultPanel result={result} onToggleBit={toggleBit} canToggle={!!sig.trim()} />

        <div className="card p-5 text-sm leading-relaxed text-[color:var(--color-ink-dim)]">
          <div className="mb-2 text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            Why this matters
          </div>
          <p>
            A valid signature proves one thing and proves it completely. This exact text, in this
            room, with this nonce, was signed by whoever holds the private half of that did:key.
            Nobody else can produce it and it cannot be moved to a different message.
          </p>
          <p className="mt-3">
            A nickname proves nothing. Anyone can type any name. An unsigned note proves nothing
            either, since notes on the service are world-writable and carry no key. Only a signature
            that checks out here is evidence, and this page did the check in your browser with no
            server in the loop.
          </p>
        </div>

        <div className="card p-5 text-sm leading-relaxed text-[color:var(--color-ink-dim)]">
          <div className="mb-2 text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            What gets signed
          </div>
          <p>
            The signed bytes are the canonical string <span className="mono text-[color:var(--color-ink)]">room|nonce|text</span>,
            where the text is first swept the way the service stores it. Invisible and control
            characters become spaces and every run of whitespace collapses to one. Signing the raw
            text instead of the swept text fails, so the checker rebuilds the swept form before it
            verifies.
          </p>
        </div>
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  onToggleBit,
  canToggle,
}: {
  result: VerifyResult;
  onToggleBit: () => void;
  canToggle: boolean;
}) {
  if (result.status === "idle") {
    return (
      <div className="card p-5 text-sm text-[color:var(--color-ink-dim)]" role="status" aria-live="polite">
        Paste an envelope or fill the fields. The result appears here as you type, checked entirely
        in your browser.
      </div>
    );
  }

  const pass = result.status === "pass";
  const color = pass ? "var(--color-signal)" : "var(--color-flag)";
  const detail = pass
    ? "The signature is valid for this did:key over this exact message."
    : (result as { reason: string }).reason;

  return (
    <div className={cn("card p-5", pass && "glow-signal")} style={{ borderColor: color }}>
      {/* One live region so a screen reader hears both the verdict and the reason. */}
      <div className="flex items-center gap-3" role="status" aria-live="polite">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold"
          style={{ color, backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }}
          aria-hidden
        >
          {pass ? "✓" : "✕"}
        </span>
        <div>
          <div className="text-xl font-bold" style={{ color }}>
            {pass ? "PASS" : "FAIL"}
          </div>
          <div className="text-sm text-[color:var(--color-ink-dim)]">{detail}</div>
        </div>
      </div>

      {"pubkeyHex" in result && result.pubkeyHex && (
        <div className="mt-4 space-y-2 text-xs">
          <Row label="Public key (hex)" value={result.pubkeyHex} />
          {result.canonical !== undefined && (
            <Row label="Canonical signed string" value={result.canonical} copyable />
          )}
          {result.swept && (
            <p className="text-[color:var(--color-warn)]">
              The text was rewritten by the sweep before checking. That is expected. The signature
              covers the swept form, not the raw characters you pasted.
            </p>
          )}
        </div>
      )}

      {canToggle && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onToggleBit}
            aria-pressed={!pass}
            className={cn(
              "rounded-lg border border-[color:var(--color-line)] px-3 py-1.5 text-xs text-[color:var(--color-ink-dim)] transition-colors hover:text-[color:var(--color-flag)]",
              BTN_FOCUS,
            )}
          >
            {pass ? "Falsify: flip one bit of the signature" : "Restore: flip the bit back"}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, copyable = false }: { label: string; value: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  function onCopy() {
    copyText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="uppercase tracking-wider text-[color:var(--color-ink-faint)]">{label}</span>
        {copyable && value && (
          <button
            type="button"
            onClick={onCopy}
            className={cn(
              "rounded border border-[color:var(--color-line)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--color-ink-dim)] transition-colors hover:text-[color:var(--color-ink)]",
              BTN_FOCUS,
            )}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <div className="mono mt-0.5 break-all text-[color:var(--color-ink)]">
        {value || <span className="text-[color:var(--color-ink-faint)]">(empty)</span>}
      </div>
    </div>
  );
}
