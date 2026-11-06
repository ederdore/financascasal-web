import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRODUCTION, validateProductionEnvironment } from '../src/config/production.mjs'

const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const anonKey = [
  encode({ alg: 'HS256' }),
  encode({ role: 'anon', iss: 'supabase', ref: PRODUCTION.projectId, exp: Date.now() / 1000 + 3600 }),
  'synthetic',
].join('.')
const env = {
  VITE_EDEN_ENV: 'production',
  VITE_EDEN_CLIENT_MODE: 'private-pilot',
  VITE_EDEN_PROJECT_ID: PRODUCTION.projectId,
  VITE_PRODUCTION_WEB_ORIGIN: PRODUCTION.webOrigin,
  VITE_SUPABASE_URL: PRODUCTION.supabaseUrl,
  VITE_API_URL: PRODUCTION.apiUrl,
  VITE_SUPABASE_ANON_KEY: anonKey,
  VITE_EDEN_CARD_SCOPE: 'blocked',
}

test('accepts the eight production settings', () => {
  assert.equal(validateProductionEnvironment(env, PRODUCTION.webOrigin).environment, 'production')
})

test('ignores Vercel metadata without changing the validated configuration', () => {
  const withMetadata = { ...env, VITE_VERCEL_ENV: 'preview', VITE_VERCEL_URL: 'preview.example.test' }
  assert.deepEqual(validateProductionEnvironment(withMetadata), validateProductionEnvironment(env))
  assert.throws(
    () => validateProductionEnvironment({ ...withMetadata, VITE_SUPABASE_URL: 'https://wrong.example.test' }),
    /EXACT_PRODUCTION_BINDINGS_REQUIRED/,
  )
})

test('rejects unknown public settings and lookalike prefixes', () => {
  for (const key of ['VITE_UNKNOWN', 'VITE_VERCEL', 'VITE_VERCELISH_ENV']) {
    assert.throws(() => validateProductionEnvironment({ ...env, [key]: 'value' }), /UNEXPECTED_PUBLIC_ENV_KEY/)
  }
})
