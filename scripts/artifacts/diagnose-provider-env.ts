import { providerEnvDiagnostic } from "../../lib/discovery/source-intelligence/provider-env";
const d = providerEnvDiagnostic();
console.log(".env.local exists:", d.env_local_exists);
for (const p of d.providers) console.log(`${p.provider} | in_file=${p.key_defined_in_env_file} before_load=${p.visible_to_runner_before_load} after_load=${p.visible_to_runner_after_load} state=${p.exec_state}`);
