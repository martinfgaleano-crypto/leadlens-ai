import fs from "node:fs";
import path from "node:path";

const { ADMIN_NAVIGATION, ADMIN_DEPRECATED_NAVIGATION, ADMIN_INFORMATION_ARCHITECTURE_VERSION } = await import("@/lib/admin/admin-information-architecture");
const root = process.cwd();
const pagesRoot = path.join(root, "app/admin");
const primary = new Map(ADMIN_NAVIGATION.flatMap((section) => section.items.map((item) => [item.href, { ...item, section: section.id }])));
const deprecated = new Map(ADMIN_DEPRECATED_NAVIGATION.map((item) => [item.href, item]));

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : entry.name === "page.tsx" ? [target] : [];
  });
}
function routeFor(file: string) {
  const relative = path.relative(path.join(root, "app"), path.dirname(file));
  return `/${relative}`.replace(/\\/g, "/");
}

const surfaces = walk(pagesRoot).map((file) => {
  const route = routeFor(file);
  const exact = primary.get(route);
  const retired = deprecated.get(route);
  const dynamic = route.includes("[");
  const childOfPrimary = Array.from(primary.keys()).some((href) => href !== "/admin" && route.startsWith(`${href}/`));
  const authSurface = route === "/admin/login";
  return {
    route, file: path.relative(root, file),
    disposition: exact ? exact.disposition : retired ? retired.disposition : dynamic || childOfPrimary || authSurface ? "contextual" : "unlisted_contextual",
    section: exact?.section ?? null,
    purpose: exact?.purpose ?? retired?.purpose ?? (authSurface ? "Authentication entrypoint; intentionally absent from authenticated navigation" : dynamic ? "Detail route reached from a parent workflow" : "Reachable contextual surface; not a primary navigation destination"),
  };
}).sort((a, b) => a.route.localeCompare(b.route));
const counts = surfaces.reduce<Record<string, number>>((acc, item) => { acc[item.disposition] = (acc[item.disposition] ?? 0) + 1; return acc; }, {});
const artifact = { version: ADMIN_INFORMATION_ARCHITECTURE_VERSION, generated_at: new Date().toISOString(), page_entrypoints: surfaces.length, primary_destinations: primary.size, deprecated_navigation_destinations: deprecated.size, counts, surfaces };
const target = path.join(root, "ml/data/acceptance/admin-information-architecture-v1.json");
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ target: path.relative(root, target), page_entrypoints: surfaces.length, primary: primary.size, deprecated_navigation: deprecated.size, counts }));
