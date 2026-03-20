import { getCase } from "@/actions/cases";
import { notFound } from "next/navigation";
import CaseDetailClient from "./CaseDetailClient";
import { matchPmisDrugs } from "@/lib/pmisDb";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caseData = await getCase(id);
  if (!caseData) notFound();

  const geminiResult = caseData.geminiRawResponse
    ? JSON.parse(caseData.geminiRawResponse)
    : null;

  const drugNames = caseData.medications.map((m) => m.drugName);
  const pmisMatches = await matchPmisDrugs(drugNames);

  return (
    <CaseDetailClient
      caseData={caseData}
      geminiResult={geminiResult}
      pmisMatches={pmisMatches}
    />
  );
}
