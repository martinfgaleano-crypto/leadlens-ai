"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  onClose: () => void;
}

export default function OnboardingForm({ onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_name: "",
    company_description: "",
    offer_description: "",
    value_proposition: "",
    target_customer_description: "",
    tone: "direct" as "direct" | "consultative" | "casual",
    contact_email: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar");

      // Redirect to Stripe checkout
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setLoading(false);
    }
  };

  const field = (
    key: keyof typeof form,
    label: string,
    placeholder: string,
    multiline = false
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          rows={3}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      ) : (
        <input
          type={key === "contact_email" ? "email" : "text"}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Cuéntanos sobre tu empresa</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {field("company_name", "Nombre de tu empresa", "Ej: Acme Consulting")}
          {field(
            "company_description",
            "Qué hace tu empresa",
            "Ej: Consultoría de marketing para SaaS B2B en etapa de crecimiento",
            true
          )}
          {field(
            "offer_description",
            "Qué ofreces exactamente",
            "Ej: Servicio de estrategia de contenido y SEO para SaaS con tickets de $2k-10k/mes",
            true
          )}
          {field(
            "value_proposition",
            "Tu propuesta de valor principal",
            "Ej: Ayudamos a SaaS a triplicar su tráfico orgánico en 6 meses sin contratar equipo interno",
            true
          )}
          {field(
            "target_customer_description",
            "Describe tu cliente ideal",
            "Ej: Fundadores de SaaS B2B con $1M-$5M ARR, 10-50 empleados, que ya tienen producto validado pero no equipo de marketing",
            true
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tono de los mensajes
            </label>
            <select
              value={form.tone}
              onChange={(e) => setForm({ ...form, tone: e.target.value as typeof form.tone })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="direct">Directo — al punto, sin rodeos</option>
              <option value="consultative">Consultivo — curioso, hace preguntas</option>
              <option value="casual">Casual — conversacional, cercano</option>
            </select>
          </div>

          {field("contact_email", "Tu email de contacto", "tu@empresa.com")}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 text-white py-3 rounded-xl font-semibold hover:bg-sky-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Procesando..." : "Continuar al pago — $97 →"}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Después del pago podrás subir tu lista de leads.
          </p>
        </form>
      </div>
    </div>
  );
}
