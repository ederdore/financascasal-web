import React, { useEffect, useState } from 'react'
import Login from './pages/Login.jsx'
import PasswordRecovery from './components/PasswordRecovery.jsx'
import { supabase } from './supabase.js'

async function read(request) {
  const { data, error } = await request
  if (error) throw error
  return data
}

function money(cents) {
  const value = BigInt(cents)
  const absolute = value < 0n ? -value : value
  return `${value < 0n ? '−' : ''}R$ ${(absolute / 100n).toLocaleString('pt-BR')},${String(absolute % 100n).padStart(2, '0')}`
}

function parseCents(input) {
  if (!/^\d{1,9}(?:[,.]\d{1,2})?$/.test(input.trim())) throw new Error('Informe um valor em reais com até dois centavos decimais.')
  const [units, fraction = ''] = input.trim().split(/[,.]/)
  const cents = BigInt(units) * 100n + BigInt(fraction.padEnd(2, '0'))
  if (cents <= 0n) throw new Error('Informe um valor maior que zero.')
  return cents.toString()
}

function Workspace() {
  const [model, setModel] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)

  async function load() {
    const household = await read(supabase.from('households').select('id,name').maybeSingle())
    const accounts = household ? await read(supabase.from('mvp_balances').select('id,name,balance_cents').order('name')) : []
    const entries = household ? await read(supabase.from('cash_entries').select('id,account_id,kind,amount_cents').order('created_at', { ascending: false }).limit(20)) : []
    setModel({ household, accounts, entries })
  }

  useEffect(() => { load().catch(e => setError(e.message)) }, [])

  async function submit(event, action) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    setBusy(true)
    setError('')
    try {
      await action(new FormData(form))
      form.reset()
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function post(fields) {
    const params = {
      p_account_id: fields.get('account'),
      p_kind: fields.get('kind'),
      p_amount_cents: parseCents(fields.get('amount')),
    }
    const key = JSON.stringify(params)
    const id = pending?.key === key ? pending.id : crypto.randomUUID()
    setPending({ key, id })
    await read(supabase.rpc('mvp_post', { ...params, p_id: id }))
    setPending(null)
  }

  const total = model?.accounts.reduce((sum, account) => sum + BigInt(account.balance_cents), 0n)
  return <main className="card" style={{ maxWidth: 760, margin: '2rem auto', padding: '1.5rem' }}>
    <header>
      <h1>Éden Finance</h1>
      <button type="button" onClick={() => supabase.auth.signOut().then(({ error }) => { if (error) setError(error.message) })}>Sair</button>
    </header>
    {error && <p role="alert">{error}</p>}
    {!model && (error ? <button onClick={() => load().then(() => setError('')).catch(e => setError(e.message))}>Tentar novamente</button> : <p>Carregando…</p>)}
    {model && !model.household && <form onSubmit={e => submit(e, f => read(supabase.rpc('mvp_create_household', { p_name: f.get('name') })))}>
      <h2>Crie seu household</h2>
      <label>Nome do household <input name="name" required maxLength={80} /></label>
      <button disabled={busy}>Criar household</button>
    </form>}
    {model?.household && <>
      <h2>{model.household.name}</h2>
      <p>Saldo consolidado <strong>{money(total)}</strong></p>
      <form onSubmit={e => submit(e, f => read(supabase.rpc('mvp_create_account', { p_name: f.get('name') })))}>
        <label>Nome da conta <input name="name" required maxLength={80} /></label>
        <button disabled={busy}>Cadastrar conta com saldo zero</button>
      </form>
      <ul>{model.accounts.map(a => <li key={a.id}>{a.name} · {money(a.balance_cents)}</li>)}</ul>
      {model.accounts.length > 0 && <form onSubmit={e => submit(e, post)}>
        <h2>Registrar lançamento</h2>
        <label>Conta <select name="account" required>{model.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>Tipo <select name="kind"><option value="income">Receita</option><option value="expense">Despesa</option></select></label>
        <label>Valor em reais <input name="amount" required inputMode="decimal" placeholder="0,00" /></label>
        <button disabled={busy}>Registrar</button>
      </form>}
      <h2>Últimos lançamentos</h2>
      <ul>{model.entries.map(e => <li key={e.id}>{e.kind === 'income' ? 'Receita' : 'Despesa'} · {money(e.amount_cents)}</li>)}</ul>
    </>}
  </main>
}

export default function FinancialMvp() {
  const [session, setSession] = useState(undefined)
  const [recovering, setRecovering] = useState(() =>
    window.location.pathname === '/nova-senha' ||
    new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'
  )
  const [recoverySession, setRecoverySession] = useState(null)

  async function finishRecovery() {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
    window.location.replace('/')
  }

  useEffect(() => {
    let live = true
    let observed = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      observed = true
      if (!live) return
      if (event === 'PASSWORD_RECOVERY') {
        setRecovering(true)
        setRecoverySession(next)
      }
      if (event === 'SIGNED_OUT') setRecoverySession(null)
      setSession(next)
    })
    supabase.auth.getSession().then(({ data }) => { if (live && !observed) setSession(data.session) })
    return () => { live = false; subscription.unsubscribe() }
  }, [])
  if (session === undefined) return <p>Carregando sessão…</p>
  if (recovering) return <PasswordRecovery session={recoverySession} onComplete={finishRecovery} />
  return session ? <Workspace key={session.user.id} /> : <Login onLogin={() => {}} />
}
