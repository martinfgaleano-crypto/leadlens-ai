// Central source registry. Add new providers here when implemented.
// Server-side only.

import type { SourceProvider } from "./source-provider";
import { apolloProvider }      from "./apollo-provider";
import { googleMapsProvider }  from "./google-maps-provider";
import { linkedinProvider }    from "./linkedin-provider";
import { directoryProvider }   from "./directory-provider";

const REGISTRY = new Map<string, SourceProvider>([
  [apolloProvider.name,      apolloProvider],
  [googleMapsProvider.name,  googleMapsProvider],
  [linkedinProvider.name,    linkedinProvider],
  [directoryProvider.name,   directoryProvider],
]);

export function getSourceProvider(name: string): SourceProvider | null {
  return REGISTRY.get(name) ?? null;
}

export function listProviders(): SourceProvider[] {
  return Array.from(REGISTRY.values());
}

export function listActiveProviders(): SourceProvider[] {
  return listProviders().filter(p => p.active);
}
