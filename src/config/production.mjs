// Explicit configuration for the existing production deployment. No fallback URLs/keys.
export const PRODUCTION = Object.freeze({
  webOrigin: 'https://financascasal-web.vercel.app',
  supabaseUrl: 'https://cpombcvppitlgynqzhsr.supabase.co',
  apiUrl: 'https://financascasal-backend.vercel.app',
  projectId: 'cpombcvppitlgynqzhsr',
})
export const PRODUCTION_ENV_KEYS = Object.freeze([
  'VITE_EDEN_ENV', 'VITE_EDEN_CLIENT_MODE', 'VITE_EDEN_PROJECT_ID',
  'VITE_PRODUCTION_WEB_ORIGIN', 'VITE_SUPABASE_URL', 'VITE_API_URL',
  'VITE_SUPABASE_ANON_KEY', 'VITE_EDEN_CARD_SCOPE',
])
const fail = code => { throw new Error(`EDEN_PRODUCTION: ${code}`) }

export function validateProductionEnvironment(env, browserOrigin) {
  if (env?.VITE_EDEN_ENV !== 'production' ||
      (env.EDEN_ENV !== undefined && env.EDEN_ENV !== 'production')) fail('EXPLICIT_ENVIRONMENT_REQUIRED')
  // Reuse the existing restricted command policy: manual RPCs, no navigation jobs.
  if (env.VITE_EDEN_CLIENT_MODE !== 'private-pilot') fail('RESTRICTED_CLIENT_POLICY_REQUIRED')
  const publicConfigKeys = Object.keys(env).filter(
    key => key.startsWith('VITE_') && !key.startsWith('VITE_VERCEL_'),
  )
  if (publicConfigKeys.some(key => !PRODUCTION_ENV_KEYS.includes(key))) fail('UNEXPECTED_PUBLIC_ENV_KEY')
  if (env.VITE_EDEN_PROJECT_ID !== PRODUCTION.projectId ||
      env.VITE_PRODUCTION_WEB_ORIGIN !== PRODUCTION.webOrigin ||
      env.VITE_SUPABASE_URL !== PRODUCTION.supabaseUrl ||
      env.VITE_API_URL !== PRODUCTION.apiUrl) fail('EXACT_PRODUCTION_BINDINGS_REQUIRED')
  if (browserOrigin !== undefined && browserOrigin !== PRODUCTION.webOrigin) fail('BROWSER_ORIGIN_MISMATCH')
  // Production card activation is a separate decision; synthetic SQL PASS is insufficient.
  if (env.VITE_EDEN_CARD_SCOPE !== 'blocked') fail('CARDS_NOT_RELEASED')
  const key = env.VITE_SUPABASE_ANON_KEY
  try {
    if (typeof key !== 'string' || !key || key.trim() !== key) throw new Error()
    const parts = key.split('.')
    if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error()
    const decode = part => JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    const header = decode(parts[0]), claims = decode(parts[1])
    if (header.alg !== 'HS256' || claims.role !== 'anon' || claims.iss !== 'supabase' ||
        claims.ref !== PRODUCTION.projectId || !Number.isFinite(claims.exp) ||
        claims.exp <= Date.now() / 1000) throw new Error()
  } catch { fail('VALID_PRODUCTION_ANON_KEY_REQUIRED') }
  // This screens claims; Supabase verifies the signature and enforces Auth/RLS.
  return Object.freeze({
    environment: 'production', clientMode: 'private-pilot', cardScope: 'blocked',
    projectId: PRODUCTION.projectId, ...PRODUCTION, anonKey: key,
    storageKey: `eden:production:${PRODUCTION.projectId}:auth:v1`,
  })
}
