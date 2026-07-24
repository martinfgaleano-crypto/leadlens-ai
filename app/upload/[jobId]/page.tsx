export default function RetiredUploadPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <section className="bg-white rounded-2xl max-w-xl w-full p-8 shadow-sm border border-gray-100 text-center">
        <div className="text-4xl mb-4" aria-hidden="true">🔎</div>
        <h1 className="text-2xl font-bold mb-3">Contact-list upload retired</h1>
        <p className="text-gray-600 leading-7 mb-6">
          LeadLens now researches company-level opportunity signals. It does not
          accept personal contact lists, emails, phone numbers, or LinkedIn profiles.
        </p>
        <a
          href="/demo-pipeline"
          className="inline-block bg-sky-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-sky-700"
        >
          View Account Opportunity Intelligence
        </a>
      </section>
    </main>
  );
}
