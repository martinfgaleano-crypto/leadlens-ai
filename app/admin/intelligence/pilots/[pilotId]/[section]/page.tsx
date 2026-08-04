import { notFound } from "next/navigation";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { buildSerializablePilotWorkspace, canonicalPilotId } from "@/lib/intelligence/pilot-workspace";
import { isPilotSection } from "@/lib/intelligence/pilot-intelligence";
import PilotExperience from "../pilot-experience";

export default function PilotSectionPage({ params, searchParams }: { params: { pilotId: string; section: string }; searchParams: { account?: string } }) {
  if (!canonicalPilotId(params.pilotId) || !isPilotSection(params.section) || params.section === "overview") notFound();
  return <AdminLayout><PilotExperience workspace={buildSerializablePilotWorkspace()} activeSection={params.section} initialAccountId={searchParams.account} /></AdminLayout>;
}
