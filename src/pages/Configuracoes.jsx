import { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'

const OBJETIVOS = [
  ['controle', '📊 Controle financeiro'],
  ['reserva',  '🛡 Completar reserva'],
  ['liberdade','🚀 Liberdade financeira'],
  ['casa',     '🏠 Comprar imóvel'],
  ['viagem',   '✈️ Viajar mais'],
]

export default function Configuracoes({ session, profile, onProfileUpdate }) {
  const [aba, setAba] = useState('perfil')
  // Notificações bot
  const [notifSemanal,   setNotifSemanal]   = useState(profile.notif_semanal   !== false)
  const [notifDia,       setNotifDia]       = useState(profile.notif_dia       !== false)
  const [notifOnboarding,setNotifOnboarding]= useState(profile.notif_onboarding !== false)
  const [savingNotif,    setSavingNotif]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ texto: '', tipo: '' })
  const [parceiro, setParceiro] = useState(null)

  // Perfil
  const [nome, setNome] = useState(profile.nome || '')
  const [papel, setPapel] = useState(profile.papel || 'eu')
  const [renda, setRenda] = useState(profile.renda ? String(profile.renda) : '')
  const [pctReserva, setPctReserva] = useState(profile.pct_reserva ? String(profile.pct_reserva) : '5')
  const [objetivo, setObjetivo] = useState(profile.objetivo || 'controle')
  const [telefone, setTelefone] = useState(profile.telefone || '')

  // Casal
  const [casalCode, setCasalCode] = useState(profile.casal_code || '')
  const [novoCasalCode, setNovoCasalCode] = useState('')

  // Senha
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  // Email
  const [novoEmail, setNovoEmail] = useState('')

  useEffect(() => { loadParceiro() }, [])

  async function loadParceiro() {
    if (!profile.casal_code) return
    const { data } = await supabase.from('profiles').select('*')
      .eq('casal_code', profile.casal_code).neq('id', session.user.id).maybeSingle()
    if (data) setParceiro(data)
  }

  function showMsg(texto, tipo = 'sucesso') {
    setMsg({ texto, tipo })
    setTimeout(() => setMsg({ texto: '', tipo: '' }), 4000)
  }

  async function salvarPerfil(e) {
    e.preventDefault(); setLoading(true)
    try {
      const { error } = await supabase.from('profiles').update({
        nome, papel, renda: parseFloat(renda) || 0,
        pct_reserva: parseFloat(pctReserva) || 5,
        objetivo, telefone: telefone || null,
      }).eq('id', session.user.id)
      if (error) throw error
      showMsg('✅ Perfil atualizado com sucesso!')
      if (onProfileUpdate) onProfileUpdate()
    } catch (e) { showMsg('Erro: ' + e.message, 'erro') }
    finally { setLoading(false) }
  }

  async function salvarCasal(e) {
    e.preventDefault(); setLoading(true)
    try {
      const code = novoCasalCode.trim().toLowerCase() || casalCode
      const { error } = await supabase.from('profiles').update({ casal_code: code }).eq('id', session.user.id)
      if (error) throw error
      setCasalCode(code); setNovoCasalCode('')
      showMsg('✅ Código do casal atualizado!')
      if (onProfileUpdate) onProfileUpdate()
    } catch (e) { showMsg('Erro: ' + e.message, 'erro') }
    finally { setLoading(false) }
  }

  async function alterarSenha(e) {
    e.preventDefault()
    if (novaSenha !== confirmarSenha) { showMsg('As senhas não coincidem', 'erro'); return }
    if (novaSenha.length < 6) { showMsg('Senha deve ter mínimo 6 caracteres', 'erro'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha })
      if (error) throw error
      setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha('')
      showMsg('✅ Senha alterada com sucesso!')
    } catch (e) { showMsg('Erro: ' + e.message, 'erro') }
    finally { setLoading(false) }
  }

  async function alterarEmail(e) {
    e.preventDefault()
    if (!novoEmail) { showMsg('Informe o novo e-mail', 'erro'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: novoEmail })
      if (error) throw error
      setNovoEmail('')
      showMsg('✅ Verifique seu novo e-mail para confirmar a alteração.')
    } catch (e) { showMsg('Erro: ' + e.message, 'erro') }
    finally { setLoading(false) }
  }

  async function exportarDados() {
    setLoading(true)
    try {
      const cc = profile.casal_code
      const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
      const [desp, rec, cartoes, bancos, metas, inv] = await Promise.all([
        cf(supabase.from('despesas').select('*')),
        cf(supabase.from('receitas').select('*')),
        cf(supabase.from('cartoes').select('*')),
        cf(supabase.from('contas_banco').select('*')),
        cf(supabase.from('metas').select('*')),
        cf(supabase.from('investimentos').select('*')),
      ])
      const dados = {
        exportado_em: new Date().toISOString(),
        perfil: { nome: profile.nome, email: session.user.email, casal_code: profile.casal_code },
        despesas: desp.data || [],
        receitas: rec.data || [],
        cartoes: cartoes.data || [],
        bancos: bancos.data || [],
        metas: metas.data || [],
        investimentos: inv.data || [],
      }
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `financascasal-dados-${new Date().toISOString().split('T')[0]}.json`
      a.click(); URL.revokeObjectURL(url)
      showMsg('✅ Dados exportados com sucesso!')
    } catch (e) { showMsg('Erro ao exportar: ' + e.message, 'erro') }
    finally { setLoading(false) }
  }

  async function excluirConta() {
    const confirmacao = prompt('Para confirmar a exclusão, digite seu e-mail:')
    if (confirmacao !== session.user.email) { showMsg('E-mail incorreto. Exclusão cancelada.', 'erro'); return }
    if (!confirm('⚠️ ATENÇÃO: Todos os seus dados serão apagados permanentemente. Confirma?')) return
    setLoading(true)
    try {
      // Registra solicitação de exclusão
      await supabase.from('solicitacoes_exclusao').insert({
        user_id: session.user.id, email: session.user.email,
        motivo: 'Solicitado pelo usuário via configurações', status: 'pendente',
      })
      showMsg('✅ Solicitação de exclusão registrada. Seus dados serão removidos em até 30 dias conforme a LGPD. Você receberá um e-mail de confirmação.')
    } catch (e) { showMsg('Erro: ' + e.message, 'erro') }
    finally { setLoading(false) }
  }

  const abas = [
    ['perfil', '👤 Perfil'],
    ['casal', '💑 Casal'],
    ['seguranca', '🔒 Segurança'],
    ['lgpd', '🛡 Privacidade'],
    ['notificacoes', '🔔 Notificações'],
  ]

  async function salvarNotificacoes() {
    setSavingNotif(true)
    try {
      await supabase.from('profiles').update({
        notif_semanal:   notifSemanal,
        notif_dia:       notifDia,
        notif_onboarding: notifOnboarding,
      }).eq('id', session.user.id)
      showMsg('✅ Preferências salvas!')
    } catch(e) { showMsg('Erro: '+e.message, 'erro') }
    finally { setSavingNotif(false) }
  }

  return (
    <div>
      {/* Abas */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid var(--border)', marginBottom: 24 }}>
        {abas.map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: aba === id ? 600 : 400, color: aba === id ? 'var(--primary)' : 'var(--secondary)',
              borderBottom: aba === id ? '2px solid var(--primary)' : '2px solid transparent',
              fontSize: 14 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Mensagem feedback */}
      {msg.texto && (
        <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13,
          background: msg.tipo === 'sucesso' ? '#E1F5EE' : '#FCEBEB',
          color: msg.tipo === 'sucesso' ? 'var(--green)' : 'var(--red)',
          border: `0.5px solid ${msg.tipo === 'sucesso' ? '#A3D9C0' : '#F5BABA'}` }}>
          {msg.texto}
        </div>
      )}

      {/* ── PERFIL ── */}
      {aba === 'perfil' && (
        <div style={{ maxWidth: 520 }}>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 20, fontSize: 15 }}>Dados pessoais</div>
            <form onSubmit={salvarPerfil}>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" value={nome} onChange={e => setNome(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail (só leitura)</label>
                <input className="form-input" value={session.user.email} disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 4 }}>Para alterar o e-mail vá em Segurança</div>
              </div>
              <div className="form-group">
                <label className="form-label">Telefone (opcional)</label>
                <input className="form-input" placeholder="Ex: (11) 99999-9999" value={telefone} onChange={e => setTelefone(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Papel no casal</label>
                  <select className="form-select" value={papel} onChange={e => setPapel(e.target.value)}>
                    <option value="eu">👤 EU</option>
                    <option value="ela">👤 ELA</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Renda mensal (R$)</label>
                  <input className="form-input" type="number" step="0.01" value={renda} onChange={e => setRenda(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">% reserva automática</label>
                  <input className="form-input" type="number" min="0" max="100" step="0.5" value={pctReserva} onChange={e => setPctReserva(e.target.value)} />
                  <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 4 }}>% de cada receita vai para a reserva</div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Objetivo financeiro</label>
                <select className="form-select" value={objetivo} onChange={e => setObjetivo(e.target.value)}>
                  {OBJETIVOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Salvando...' : '💾 Salvar perfil'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── CASAL ── */}
      {aba === 'casal' && (
        <div style={{ maxWidth: 520 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>Código do casal</div>
            <div style={{ background: '#EEF6FF', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--secondary)', marginBottom: 6 }}>Código atual</div>
              <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 2, color: 'var(--blue)' }}>
                {casalCode || '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 6 }}>
                Compartilhe este código com seu parceiro(a) para vincular as contas
              </div>
            </div>
            <form onSubmit={salvarCasal}>
              <div className="form-group">
                <label className="form-label">Novo código (opcional)</label>
                <input className="form-input" placeholder="Ex: joaoemaria2024" value={novoCasalCode}
                  onChange={e => setNovoCasalCode(e.target.value.toLowerCase().replace(/\s/g, ''))} />
                <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 4 }}>
                  Apenas letras e números, sem espaços. Deixe em branco para manter o atual.
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Salvando...' : '💾 Atualizar código'}
              </button>
            </form>
          </div>

          {/* Parceiro vinculado */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>Parceiro(a) vinculado(a)</div>
            {parceiro ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--ela-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: 'var(--ela-text)' }}>
                  {parceiro.papel === 'eu' ? 'EU' : 'ELA'}
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>{parceiro.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 2 }}>
                    Renda: R$ {parceiro.renda?.toLocaleString('pt-BR') || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--secondary)' }}>
                    Reserva: {parceiro.pct_reserva || 5}% automático
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--secondary)', fontSize: 13 }}>
                Nenhum parceiro vinculado ainda. Compartilhe o código do casal para conectar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SEGURANÇA ── */}
      {aba === 'seguranca' && (
        <div style={{ maxWidth: 520 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>🔑 Alterar senha</div>
            <form onSubmit={alterarSenha}>
              <div className="form-group">
                <label className="form-label">Nova senha</label>
                <input className="form-input" type="password" placeholder="Mínimo 6 caracteres"
                  value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar nova senha</label>
                <input className="form-input" type="password" placeholder="Repita a senha"
                  value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} required />
              </div>
              {novaSenha && confirmarSenha && novaSenha !== confirmarSenha && (
                <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>⚠️ As senhas não coincidem</div>
              )}
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                disabled={loading || (novaSenha && novaSenha !== confirmarSenha)}>
                {loading ? 'Alterando...' : '🔑 Alterar senha'}
              </button>
            </form>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>📧 Alterar e-mail</div>
            <div style={{ fontSize: 13, color: 'var(--secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              E-mail atual: <strong>{session.user.email}</strong><br />
              Após alterar, você receberá um link de confirmação no novo e-mail.
            </div>
            <form onSubmit={alterarEmail}>
              <div className="form-group">
                <label className="form-label">Novo e-mail</label>
                <input className="form-input" type="email" placeholder="novo@email.com"
                  value={novoEmail} onChange={e => setNovoEmail(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Enviando...' : '📧 Alterar e-mail'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── LGPD / PRIVACIDADE ── */}
      {aba === 'lgpd' && (
        <div style={{ maxWidth: 520 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>📤 Exportar meus dados</div>
            <div style={{ fontSize: 13, color: 'var(--secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              Conforme a LGPD (Art. 18), você tem direito à portabilidade dos seus dados.
              O arquivo JSON conterá todas as suas informações financeiras.
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
              onClick={exportarDados} disabled={loading}>
              {loading ? 'Exportando...' : '📥 Baixar meus dados (JSON)'}
            </button>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>📄 Documentos legais</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="/politica-privacidade" target="_blank"
                style={{ color: 'var(--blue)', fontSize: 13, textDecoration: 'none' }}>
                🔒 Política de Privacidade →
              </a>
              <a href="/termos-uso" target="_blank"
                style={{ color: 'var(--blue)', fontSize: 13, textDecoration: 'none' }}>
                📋 Termos de Uso →
              </a>
            </div>
          </div>

          <div className="card" style={{ border: '0.5px solid var(--red)' }}>
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 15, color: 'var(--red)' }}>
              🗑️ Excluir minha conta
            </div>
            <div style={{ fontSize: 13, color: 'var(--secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              Solicita a exclusão permanente de todos os seus dados. Esta ação é irreversível.
              Seus dados serão removidos em até 30 dias conforme a LGPD.
            </div>
            <button onClick={excluirConta} disabled={loading}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--red)',
                background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              {loading ? 'Processando...' : '⚠️ Solicitar exclusão da conta'}
            </button>
          </div>
        </div>
      )}
      {/* ── NOTIFICAÇÕES ── */}
      {aba === 'notificacoes' && (
        <div className="card">
          <div style={{ fontWeight:600, marginBottom:4, fontSize:15 }}>🔔 Notificações do Bot</div>
          <div style={{ fontSize:13, color:'var(--secondary)', marginBottom:20 }}>
            Controle quais mensagens o Broto envia no Telegram
          </div>

          {[
            ['notif_semanal', notifSemanal, setNotifSemanal, '📊 Saúde semanal', 'Toda segunda-feira: resumo do jardim, top 3 gastos e dica da IA'],
            ['notif_dia',     notifDia,     setNotifDia,     '🌿 Dia sem gastos', 'Aviso entre 21h-23h quando o dia foi econômico ou sem gastos'],
            ['notif_onboarding', notifOnboarding, setNotifOnboarding, '🌱 Dica de boas-vindas', 'Follow-up 24h após vincular se ainda não registrou gastos'],
          ].map(([key, val, setter, titulo, desc]) => (
            <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'0.5px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight:500, fontSize:14 }}>{titulo}</div>
                <div style={{ fontSize:12, color:'var(--secondary)', marginTop:3 }}>{desc}</div>
              </div>
              <label style={{ display:'flex', alignItems:'center', cursor:'pointer', flexShrink:0, marginLeft:16 }}>
                <div style={{ position:'relative', width:44, height:24 }} onClick={() => setter(!val)}>
                  <div style={{ position:'absolute', inset:0, borderRadius:12, background:val?'var(--eden-green)':'var(--border)', transition:'background .2s' }}/>
                  <div style={{ position:'absolute', top:3, left:val?22:3, width:18, height:18, borderRadius:9, background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }}/>
                </div>
              </label>
            </div>
          ))}

          <button className="btn btn-primary" style={{ marginTop:20, width:'100%', justifyContent:'center' }}
            onClick={salvarNotificacoes} disabled={savingNotif}>
            {savingNotif ? 'Salvando...' : '✅ Salvar preferências'}
          </button>
        </div>
      )}

    </div>
  )
}
