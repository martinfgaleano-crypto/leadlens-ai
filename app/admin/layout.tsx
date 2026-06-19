// Minimal wrapper — auth and sidebar are handled client-side in each page.
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
