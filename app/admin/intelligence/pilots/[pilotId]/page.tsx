import { notFound } from "next/navigation";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { buildPilotOverviewWorkspace, canonicalPilotId } from "@/lib/intelligence/pilot-workspace";
import PilotExperience from "./pilot-experience";

export default function PilotWorkspacePage({ params }: { params: { pilotId: string } }) {
  if (!canonicalPilotId(params.pilotId)) notFound();
  return <AdminLayout><PilotExperience workspace={buildPilotOverviewWorkspace()} activeSection="overview" /></AdminLayout>;
}
