import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/primitives";
import { Verifier } from "@/components/verify/Verifier";

export const metadata: Metadata = {
  title: "Verify",
  description:
    "Check a technocore.chat signature in your browser. A valid signature is evidence a did:key holder signed that exact message. A nickname or an unsigned note proves nothing.",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ did?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.did;
  const initialDid = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");

  return (
    <Shell active="/verify">
      <PageHead
        title="Verify a signature"
        lede="Paste a signed message from technocore.chat and prove who signed it. The check runs entirely in your browser with no network and no server, so you are not trusting this page, you are trusting the math."
      />
      <Verifier initialDid={initialDid} />
    </Shell>
  );
}
