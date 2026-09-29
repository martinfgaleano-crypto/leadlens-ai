import AdminLayout from "@/app/admin/_components/AdminLayout";
import Pilot2Workspace from "./Pilot2Workspace";

// Dedicated Amor de Gea Pilot 2 (US export) Admin workspace. Standalone route so the hardcoded Pilot 1
// workspace stays intact (§57). Admin-gated by AdminLayout + middleware (/admin/*).
export const metadata = { title: "Pilot 2 — Amor de Gea (US export)" };

export default function Pilot2Page() {
  return <AdminLayout><Pilot2Workspace /></AdminLayout>;
}
