"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LandingLocale } from "@/lib/landing/v2-copy";

export function LanguageSwitcher({ locale, label, onChangeComplete }: { locale: LandingLocale; label: string; onChangeComplete?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return <label className="ll-v2-language">
    <span>{label}</span>
    <select value={locale} aria-label={label} onChange={(event) => {
      document.documentElement.lang = event.target.value;
      const next = new URLSearchParams(search.toString());
      if (event.target.value === "en") next.delete("lang"); else next.set("lang", event.target.value);
      onChangeComplete?.();
      router.push(`${pathname}${next.size ? `?${next.toString()}` : ""}`);
    }}>
      <option value="en">EN</option><option value="es">ES</option><option value="pt">PT</option><option value="ja">日本語</option>
    </select>
  </label>;
}
