// Canonical root: render the public landing directly at "/" (was a redirect to
// /demo-pipeline, ugly for the production domain and duplicate content).
// /demo-pipeline now permanently redirects to "/" (see next.config.mjs).
export { default } from "./demo-pipeline/page";

