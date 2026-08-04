# LeadLens — Amor de Gea Pilot Loading Fix

## Initial state

- Initial HEAD: `d8381ddb93bf1249dcfe257dbfdcf7df71c2d788` on `main`.
- Git state: only `.leadlens/source-intelligence.json` and `.leadlens/usage.json` modified.
- `origin/main` contained `d8381ddb`; all four Pilot 1 static artifacts returned HTTP 200 in production, confirming that finalization deployment was present.
- `/login` returned HTTP 200. An unauthenticated pilot request returned the expected 307 to `/admin/login?reason=unauthorized`.

## Reproduction and root cause

The local production request reproduced the server exception `Functions cannot be passed directly to Client Components` with digest `1763543875`. `buildPilotWorkspace()` included complete imported module namespaces. Some namespaces export helper functions as well as data; passing that workspace into the client `PilotExperience` component made React Server Components fail during serialization. No pilot HTML could reach the browser.

The route was also server-protected by middleware while `AdminLayout` performed a second client-side `GET /api/admin/session` before rendering children. Its initial output was only `Loading...`, so the serialization failure was visually misrepresented as an endless authentication/loading state rather than a recoverable route error.

The recent finalization component did not create the auth loop. It exposed another usability defect: it was mounted inside the historical Context chain instead of the operational overview, so the requested downloads were absent from the main pilot URL.

## Findings

- Authentication: middleware already validates the signed httpOnly Admin grant once and redirects invalid/expired sessions. The duplicate client gate was unnecessary and failure-prone.
- Data loading: base workspace is synchronous and bundled; the failure was a non-serializable function at the server/client boundary, not an unresolved remote Promise.
- Artifact paths: browser links used public static paths, not Mac absolute paths, but were not routed through an authenticated Admin handler.
- Performance: the operational closeout now renders first on the overview. Historical intelligence namespaces are removed from the overview payload and remain available on their dedicated sections.

## Fix

- Removed the duplicate client auth/loading gate from `AdminLayout`; valid server-authorized pages render immediately.
- Added a dedicated serializable workspace builder that strips executable module members and normalizes unsupported scalar values before crossing into the client component.
- Preserved middleware and API authorization without weakening Admin access.
- Moved `Pilot1Finalization` to the overview route and removed its duplicate historical mount.
- Added a route error boundary with Retry, Back to Pilots and a safe diagnostic code.
- Added an allowlisted, Admin-protected artifact route with correct MIME types, no path traversal, private/no-store headers and a controlled `Not available in this deployment` 404.
- Updated all four download controls to use the authenticated route. Optional file absence cannot block page rendering.

## Verification record

- Portfolio and report contents unchanged; V3R3 remains ten accounts.
- Provider calls, account searches and customer contact: zero.
- Focused regression, Admin auth suites, TypeScript, production build and local production-browser smoke are recorded after execution.
- Commit, push, deployment and production verification are recorded in the final handoff.

## Remaining limitation

Authenticated production verification requires a live founder Admin session. Unauthenticated verification intentionally reaches the login redirect and cannot inspect protected page content.
