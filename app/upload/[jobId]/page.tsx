"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Papa from "papaparse";
import type { RawLead } from "@/types";

export default function UploadPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [leads, setLeads] = useState<RawLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const mapped: RawLead[] = rows.slice(0, 50).map((row) => ({
          name: row["name"] || row["Name"] || row["nombre"] || "",
          company: row["company"] || row["Company"] || row["empresa"] || "",
          title: row["title"] || row["Title"] || row["cargo"] || row["job_title"] || "",
          email: row["email"] || row["Email"] || "",
          linkedin_url: row["linkedin"] || row["linkedin_url"] || row["LinkedIn"] || undefined,
          notes: row["notes"] || row["Notes"] || undefined,
        }));

        const valid = mapped.filter((l) => l.name && l.company && l.email);
        if (valid.length === 0) {
          setError("No se encontraron leads válidos. Verifica que el CSV tenga columnas: name, company, title, email.");
          return;
        }

        setLeads(valid);
        setParsed(true);
      },
      error: () => setError("Error al leer el archivo CSV."),
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, leads }),
    });

    if (!uploadRes.ok) {
      setError("Error al subir leads.");
      setLoading(false);
      return;
    }

    // Trigger processing
    await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId }),
    });

    router.push(`/results/${jobId}`);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-sm border border-gray-100">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-2xl font-bold mb-2">Pago confirmado</h1>
          <p className="text-gray-500">Ahora sube tu lista de leads para comenzar el análisis.</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
          <strong>Formato esperado del CSV:</strong><br />
          Columnas requeridas: <code>name, company, title, email</code><br />
          Opcionales: <code>linkedin_url, notes</code><br />
          Máximo 50 leads por lote.
        </div>

        {!parsed ? (
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-sky-400 hover:bg-sky-50 transition-colors"
          >
            <div className="text-4xl mb-3">📂</div>
            <p className="text-gray-600 font-medium">Click para subir tu CSV</p>
            <p className="text-gray-400 text-sm mt-1">o arrastra el archivo aquí</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </div>
        ) : (
          <div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-green-700 font-medium">{leads.length} leads detectados</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 mb-6">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Nombre", "Empresa", "Cargo", "Email"].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 5).map((lead, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-4 py-2">{lead.name}</td>
                      <td className="px-4 py-2">{lead.company}</td>
                      <td className="px-4 py-2">{lead.title}</td>
                      <td className="px-4 py-2 text-gray-500">{lead.email}</td>
                    </tr>
                  ))}
                  {leads.length > 5 && (
                    <tr className="border-t border-gray-100">
                      <td colSpan={4} className="px-4 py-2 text-gray-400 text-center">
                        + {leads.length - 5} leads más
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setParsed(false); setLeads([]); }}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cambiar archivo
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-sky-600 text-white py-3 rounded-xl font-semibold hover:bg-sky-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Iniciando..." : `Procesar ${leads.length} leads →`}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
