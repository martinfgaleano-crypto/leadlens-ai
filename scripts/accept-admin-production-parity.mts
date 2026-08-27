import nextEnv from "@next/env";
import { NextRequest } from "next/server";

nextEnv.loadEnvConfig(process.cwd());
const token = process.env.ADMIN_SECRET_TOKEN;
if (!token) throw new Error("ADMIN_SECRET_TOKEN unavailable for direct local acceptance");
const request = (path: string) => new NextRequest(`http://localhost:3000${path}`, { headers: { "x-admin-token": token } });
const readinessModule = await import("@/app/api/admin/intelligence/launch-readiness/route");
const runtimeModule = await import("@/app/api/admin/system-health/route");
const readinessGET = readinessModule.GET ?? readinessModule.default?.GET;
const runtimeGET = runtimeModule.GET ?? runtimeModule.default?.GET;
if (!readinessGET || !runtimeGET) throw new Error("Admin route exports unavailable");
const readinessResponse = await readinessGET(request("/api/admin/intelligence/launch-readiness"));
const runtimeResponse = await runtimeGET(request("/api/admin/system-health"));
const readiness = await readinessResponse.json();
const runtime = await runtimeResponse.json();
console.log(JSON.stringify({
  readiness: { status: readinessResponse.status, score: readiness.readiness?.score, level: readiness.readiness?.level, confidence: readiness.readiness?.confidence, sample_size: readiness.readiness?.sample_size, telemetry: readiness.telemetry, production_configuration: readiness.production_configuration, history: readiness.history },
  runtime: { status: runtimeResponse.status, state: runtime.state, runs: runtime.runs, monitor: runtime.monitor, control_plane: runtime.control_plane, deployment: runtime.deployment },
}, null, 2));
