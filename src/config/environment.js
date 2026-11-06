import {validatePrivateWebEnvironment} from './privatePilot.mjs'
import {validateProductionEnvironment} from './production.mjs'
// EF-MOTOR-02: local-stage is the only authorized runtime in this package.
export const LOCAL_STAGE = Object.freeze({
  environment: 'local-stage', webOrigin: 'http://127.0.0.1:4175',
  supabaseUrl: 'http://127.0.0.1:55321', apiUrl: 'http://127.0.0.1:3001',
})
export const WEB_ENV_KEYS = Object.freeze(['VITE_EDEN_ENV', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_API_URL', 'VITE_EDEN_CLIENT_MODE'])
const fail = code => { throw new Error(`EF-MOTOR-02: ${code}. Consulte docs/operations/EF_MOTOR_02_LOCAL_WEB.md.`) }

function exactUrl(raw, expected, code) {
  // Compare raw canonical origins too: URL normalization must not hide credentials,
  // numeric IP aliases, paths, query strings, fragments or alternative ports.
  if (typeof raw !== 'string' || raw !== expected) fail(code)
  const url = new URL(raw)
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail(code)
  return raw
}

export function validateLocalAnonKey(key, nowSeconds = Date.now() / 1000) {
  if (typeof key !== 'string' || key.trim() !== key || !key) fail('LOCAL_ANON_KEY_REQUIRED')
  try {
    const parts = key.split('.')
    if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) fail('LOCAL_ANON_KEY_INVALID')
    const decode = part => JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    const header = decode(parts[0]), claims = decode(parts[1])
    if (header.alg !== 'HS256' || claims.role !== 'anon' || claims.iss !== 'supabase-demo'
      || (claims.ref !== undefined && claims.ref !== 'eden-local-stage')
      || !Number.isFinite(claims.exp) || claims.exp <= nowSeconds) fail('LOCAL_ANON_KEY_INVALID')
  } catch { fail('LOCAL_ANON_KEY_INVALID') }
  // Claims screening is not signature verification. The local Supabase server
  // authenticates the token; this guard excludes remote/service-role config.
  return key
}

export function validateWebEnvironment(env, browserOrigin) {
  if(env?.VITE_EDEN_ENV==='production')return validateProductionEnvironment(env,browserOrigin)
  if(env?.VITE_EDEN_ENV==='private-pilot')return validatePrivateWebEnvironment(env,browserOrigin)
  if (!env || env.VITE_EDEN_ENV !== LOCAL_STAGE.environment) fail('EXPLICIT_LOCAL_STAGE_REQUIRED')
  if (env.EDEN_ENV !== undefined && env.EDEN_ENV !== env.VITE_EDEN_ENV) fail('ENVIRONMENT_MISMATCH')
  if (Object.keys(env).some(key => key.startsWith('VITE_') && !WEB_ENV_KEYS.includes(key))) fail('UNEXPECTED_PUBLIC_ENV_KEY')
  if (!['standard','ef03-homologation','mvp-homologation'].includes(env.VITE_EDEN_CLIENT_MODE)) fail('EXPLICIT_CLIENT_MODE_REQUIRED')
  const supabaseUrl = exactUrl(env.VITE_SUPABASE_URL, LOCAL_STAGE.supabaseUrl, 'LOCAL_SUPABASE_URL_REQUIRED')
  const apiUrl = exactUrl(env.VITE_API_URL, LOCAL_STAGE.apiUrl, 'LOCAL_API_URL_REQUIRED')
  const anonKey = validateLocalAnonKey(env.VITE_SUPABASE_ANON_KEY)
  if (browserOrigin !== undefined && browserOrigin !== LOCAL_STAGE.webOrigin) fail('LOCAL_WEB_ORIGIN_REQUIRED')
  return Object.freeze({ ...LOCAL_STAGE, clientMode:env.VITE_EDEN_CLIENT_MODE, supabaseUrl, apiUrl, anonKey, storageKey: env.VITE_EDEN_CLIENT_MODE==='mvp-homologation'?'eden:local-stage:hml-clean-01:auth:v1':'eden:local-stage:auth:v1' })
}

export function localContentSecurityPolicy() {
  return ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:", "img-src 'self' data: blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
    `connect-src ${LOCAL_STAGE.webOrigin} ws://127.0.0.1:4175 ${LOCAL_STAGE.supabaseUrl} ws://127.0.0.1:55321 ${LOCAL_STAGE.apiUrl}`,
    "frame-src 'none'", "worker-src 'none'"].join('; ')
}
