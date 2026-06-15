import { useState } from 'react'
import { supabase } from '../supabase.js'
import { registrarEvento, EVENTOS } from '../components/Eventos.js'

const OBJETIVOS = [
  {
    id: 'controle',
    emoji: '📊',
    titulo: 'Controle financeiro',
    desc: 'Organizar as finanças do casal, entender para onde vai o dinheiro e parar de ter surpresas no fim do mês.',
    cor: '#3D5A3E',
    corBg: '#EFF6EF',
    metas_sugeridas: [
      { nome: 'Reserva de emergência', valor_alvo: 15000, categoria: 'reserva_extra', descricao: '3 meses de despesas fixas' },
      { nome: 'Quitar dívidas', valor_alvo: 5000, categoria: 'outro', descricao: 'Eliminar dívidas do cartão' },
    ],
    dicas: [
      '💡 Registre todos os gastos por 30 dias antes de criar um orçamento',
      '💡 O bot Telegram é seu melhor amigo — registre na hora que gastar',
      '💡 Separe as despesas EU / ELA / Casal para clareza total',
    ],
  },
  {
    id: 'reserva',
    emoji: '🛡',
    titulo: 'Completar reserva',
    desc: 'Construir uma reserva de emergência sólida que garanta segurança para o casal por 6 a 12 meses.',
    cor: '#6B5A8E',
    corBg: '#F3F0F9',
    metas_sugeridas: [
      { nome: 'Reserva de emergência', valor_alvo: 30000, categoria: 'reserva_extra', descricao: '6 meses de despesas' },
      { nome: 'Fundo de oportunidade', valor_alvo: 10000, categoria: 'outro', descricao: 'Para oportunidades que aparecem' },
    ],
    dicas: [
      '💡 Configure o aporte automático de reserva nas configurações',
      '💡 Mantenha a reserva em renda fixa de alta liquidez (CDB, Tesouro Selic)',
      '💡 Meta: 6 meses de despesas fixas + variáveis médias',
    ],
  },
  {
    id: 'liberdade',
    emoji: '🚀',
    titulo: 'Liberdade financeira',
    desc: 'Construir patrimônio, criar renda passiva e chegar ao ponto onde trabalhar vira escolha, não obrigação.',
    cor: '#B8860B',
    corBg: '#FDF8EC',
    metas_sugeridas: [
      { nome: 'Patrimônio investido', valor_alvo: 100000, categoria: 'outro', descricao: 'Marco inicial de patrimônio' },
      { nome: 'Reserva de emergência', valor_alvo: 50000, categoria: 'reserva_extra', descricao: '12 meses de despesas' },
    ],
    dicas: [
      '💡 A regra 50/30/20 é o mínimo — tente chegar em 70/10/20',
      '💡 Cada real investido hoje trabalha para vocês dormirem',
      '💡 Diversifique: renda fixa + variável + internacional',
    ],
  },
  {
    id: 'casa',
    emoji: '🏠',
    titulo: 'Comprar imóvel',
    desc: 'Juntar a entrada, organizar as finanças e realizar o sonho da casa própria com segurança.',
    cor: '#C17F5A',
    corBg: '#FDF5EF',
    metas_sugeridas: [
      { nome: 'Entrada do imóvel', valor_alvo: 80000, categoria: 'casa', descricao: '20% do valor do imóvel' },
      { nome: 'Reserva pós-compra', valor_alvo: 20000, categoria: 'reserva_extra', descricao: 'Para reforma e imprevistos' },
    ],
    dicas: [
      '💡 A entrada ideal é 20-30% do valor do imóvel',
      '💡 Inclua ITBI, cartório e reforma no planejamento',
      '💡 Enquanto junta, invista em renda fixa de médio prazo',
    ],
  },
  {
    id: 'viagem',
    emoji: '✈️',
    titulo: 'Viajar mais',
    desc: 'Criar momentos juntos, explorar o mundo e realizar aquela viagem dos sonhos sem culpa financeira.',
    cor: '#3A6EA8',
    corBg: '#EDF3FB',
    metas_sugeridas: [
      { nome: 'Viagem dos sonhos', valor_alvo: 20000, categoria: 'viagem', descricao: 'A viagem que sempre quiseram' },
      { nome: 'Fundo de viagens anuais', valor_alvo: 8000, categoria: 'viagem', descricao: 'Para viajar todo ano' },
    ],
    dicas: [
      '💡 Crie uma meta específica para cada viagem planejada',
      '💡 Separe um % fixo da renda mensalmente para o fundo de viagens',
      '💡 Milhas de cartão bem usadas pagam voos inteiros',
    ],
  },
]

const PASSOS = ['Bem-vindos', 'Objetivo', 'Perfil', 'Primeiro banco', 'Primeiras metas', 'Pronto!']

function ProgressBar({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? 'var(--eden-green)' : 'var(--border)', transition: 'background 0.3s' }} />
      ))}
    </div>
  )
}

export default function Onboarding({ session, onComplete }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Dados coletados
  const [objetivo, setObjetivo] = useState(null)
  const [nomeEu, setNomeEu] = useState('')
  const [papelEu, setPapelEu] = useState('eu')
  const [rendaEu, setRendaEu] = useState('')
  const [codigoCasal, setCodigoCasal] = useState('')
  const [nomeBanco, setNomeBanco] = useState('')
  const [saldoBanco, setSaldoBanco] = useState('')
  const [metasEscolhidas, setMetasEscolhidas] = useState([])

  const objAtual = OBJETIVOS.find(o => o.id === objetivo)

  function toggleMeta(meta) {
    setMetasEscolhidas(prev =>
      prev.find(m => m.nome === meta.nome)
        ? prev.filter(m => m.nome !== meta.nome)
        : [...prev, meta]
    )
  }

  async function finalizar() {
    setSaving(true)
    const uid = session.user.id
    const cc  = codigoCasal.trim().toLowerCase() || uid.slice(0, 8)
    const now = new Date()

    try {
      // 1. Salva perfil
      const { error: pe } = await supabase.from('profiles').upsert({
        id: uid,
        nome: nomeEu,
        papel: papelEu,
        renda: parseFloat(rendaEu) || 0,
        casal_code: cc,
        objetivo,
        pct_reserva: objetivo === 'reserva' ? 20 : objetivo === 'liberdade' ? 30 : 10,
        onboarding_completo: true,
        onboarding_step: 5,
      }, { onConflict: 'id' })
      if (pe) throw pe

      // 2. Cria banco se informado
      if (nomeBanco.trim()) {
        await supabase.from('contas_banco').insert({
          user_id: uid, casal_code: cc,
          banco: nomeBanco.trim(),
          tipo: 'corrente',
          titular: papelEu,
          saldo: parseFloat(saldoBanco) || 0,
          moeda: 'BRL',
        })
      }

      // 3. Cria metas sugeridas escolhidas
      for (const meta of metasEscolhidas) {
        await supabase.from('metas').insert({
          user_id: uid, casal_code: cc,
          nome: meta.nome,
          descricao: meta.descricao,
          valor_alvo: meta.valor_alvo,
          valor_atual: 0,
          atual: 0,
          categoria: meta.categoria,
          dono: 'casal',
          ativa: true,
          origem: 'onboarding',
        })
      }

      // 4. Cria assinatura trial 14 dias
      const trialFim = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      await supabase.from('assinaturas').upsert({
        user_id: uid, casal_code: cc,
        plano: 'trial', status: 'ativo',
        trial_inicio: now.toISOString(),
        trial_fim: trialFim.toISOString(),
      }, { onConflict: 'user_id' })

      // 5. Registra conquista de primeiro lançamento
      await supabase.from('conquistas').insert({
        casal_code: cc, user_id: uid,
        tipo: 'primeiro_lancamento',
        titulo: '🌿 Bem-vindos ao Éden!',
        descricao: 'Vocês deram o primeiro passo para finanças sem segredos.',
        mes: now.getMonth(), ano: now.getFullYear(),
        celebrado: false,
      }).select()

      await registrarEvento(uid, cc, EVENTOS.CONTA_CRIADA, { objetivo })
      onComplete()
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally { setSaving(false) }
  }

  const S = {
    green: '#3D5A3E', terra: '#C17F5A', sand: '#E8DCC8',
    cream: '#FAF6EF', bark: '#2C1F14', muted: '#7A7060', border: '#E4DDD2',
  }

  const container = {
    minHeight: '100vh', background: S.cream,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, fontFamily: "'Inter', -apple-system, sans-serif",
  }

  const card = {
    width: '100%', maxWidth: 560,
    background: '#fff', borderRadius: 24,
    padding: '40px 40px 36px',
    boxShadow: '0 20px 60px rgba(44,31,20,0.12)',
    border: `0.5px solid ${S.border}`,
  }

  const btn = (cor = S.green) => ({
    padding: '13px 28px', borderRadius: 12, border: 'none',
    background: cor, color: cor === S.sand ? S.bark : '#fff',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all .15s',
  })

  const input = {
    width: '100%', padding: '11px 14px',
    border: `0.5px solid ${S.border}`, borderRadius: 10,
    fontSize: 14, background: S.cream, fontFamily: 'inherit',
    color: S.bark, outline: 'none', marginBottom: 14,
  }

  return (
    <div style={container}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap');`}</style>
      <div style={card}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: S.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌿</div>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 600, color: S.green }}>Éden</div>
            <div style={{ fontSize: 10, color: S.muted, fontStyle: 'italic' }}>Finanças a dois, sem segredos.</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: S.muted }}>{PASSOS[step]}</div>
        </div>

        <ProgressBar step={step} total={PASSOS.length} />

        {/* ── PASSO 0 — Boas-vindas ── */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 20, lineHeight: 1 }}>🌿</div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 700, color: S.green, marginBottom: 12, letterSpacing: -0.3 }}>
              Bem-vindos ao Éden
            </h1>
            <p style={{ fontSize: 16, color: S.muted, lineHeight: 1.7, marginBottom: 12 }}>
              Finanças a dois, sem segredos.
            </p>
            <p style={{ fontSize: 14, color: S.muted, lineHeight: 1.7, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
              Em 2 minutos vamos configurar o Éden para o perfil do casal — objetivos, banco e primeiras metas. Quanto mais personalizado, mais útil.
            </p>
            <button style={btn()} onClick={() => setStep(1)}>
              Começar a plantar 🌱
            </button>
          </div>
        )}

        {/* ── PASSO 1 — Objetivo ── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: S.green, marginBottom: 8 }}>
              Qual é o objetivo do casal?
            </h2>
            <p style={{ fontSize: 14, color: S.muted, marginBottom: 24, lineHeight: 1.6 }}>
              Isso personaliza as dicas, metas sugeridas e análises da IA para o que importa para vocês.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {OBJETIVOS.map(obj => (
                <div key={obj.id} onClick={() => setObjetivo(obj.id)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${objetivo === obj.id ? obj.cor : S.border}`, background: objetivo === obj.id ? obj.corBg : '#fff', transition: 'all .15s' }}>
                  <span style={{ fontSize: 26, flexShrink: 0, marginTop: 2 }}>{obj.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: objetivo === obj.id ? obj.cor : S.bark, marginBottom: 3 }}>{obj.titulo}</div>
                    <div style={{ fontSize: 13, color: S.muted, lineHeight: 1.5 }}>{obj.desc}</div>
                  </div>
                  {objetivo === obj.id && (
                    <div style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: 10, background: obj.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontSize: 11 }}>✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Dicas do objetivo selecionado */}
            {objAtual && (
              <div style={{ background: objAtual.corBg, borderRadius: 12, padding: '14px 16px', marginBottom: 24, borderLeft: `3px solid ${objAtual.cor}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: objAtual.cor, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                  Como o Éden vai te ajudar com {objAtual.titulo}
                </div>
                {objAtual.dicas.map((d, i) => (
                  <div key={i} style={{ fontSize: 13, color: S.muted, marginBottom: 5, lineHeight: 1.5 }}>{d}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...btn(S.sand), flex: 1 }} onClick={() => setStep(0)}>← Voltar</button>
              <button style={{ ...btn(), flex: 2, opacity: !objetivo ? 0.5 : 1 }} disabled={!objetivo} onClick={() => setStep(2)}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ── PASSO 2 — Perfil ── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: S.green, marginBottom: 8 }}>
              Seu perfil
            </h2>
            <p style={{ fontSize: 14, color: S.muted, marginBottom: 24, lineHeight: 1.6 }}>
              Como quer ser identificado no casal?
            </p>

            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 7 }}>Seu nome</label>
            <input style={input} placeholder="Como quer ser chamado(a)?" value={nomeEu} onChange={e => setNomeEu(e.target.value)} autoFocus />

            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 7 }}>Você é</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {[['eu', '👤 EU'], ['ela', '👤 ELA']].map(([v, l]) => (
                <button key={v} onClick={() => setPapelEu(v)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${papelEu === v ? S.green : S.border}`, background: papelEu === v ? '#EFF6EF' : '#fff', color: papelEu === v ? S.green : S.muted, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {l}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 7 }}>Renda mensal (R$)</label>
            <input style={input} type="number" placeholder="Ex: 8.500" value={rendaEu} onChange={e => setRendaEu(e.target.value)} />

            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 7 }}>Código do casal</label>
            <input style={{ ...input, marginBottom: 4 }} placeholder="Ex: joaoemaria (crie ou use o do parceiro)" value={codigoCasal} onChange={e => setCodigoCasal(e.target.value.toLowerCase().replace(/\s/g, ''))} autoCapitalize="none" />
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 20 }}>
              Compartilhe com seu parceiro(a) para ver os dados juntos. Deixe em branco para gerar automaticamente.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...btn(S.sand), flex: 1 }} onClick={() => setStep(1)}>← Voltar</button>
              <button style={{ ...btn(), flex: 2, opacity: !nomeEu ? 0.5 : 1 }} disabled={!nomeEu} onClick={() => setStep(3)}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ── PASSO 3 — Primeiro banco ── */}
        {step === 3 && (
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: S.green, marginBottom: 8 }}>
              Seu banco principal
            </h2>
            <p style={{ fontSize: 14, color: S.muted, marginBottom: 24, lineHeight: 1.6 }}>
              Cadastre o banco mais usado para que os lançamentos debitrem automaticamente.
            </p>

            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 7 }}>Nome do banco</label>
            <input style={input} placeholder="Ex: Nubank, Itaú, Inter, C6..." value={nomeBanco} onChange={e => setNomeBanco(e.target.value)} autoFocus />

            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 7 }}>Saldo atual (R$)</label>
            <input style={input} type="number" placeholder="Ex: 3.200" value={saldoBanco} onChange={e => setSaldoBanco(e.target.value)} />

            <div style={{ background: '#EFF6EF', borderRadius: 10, padding: '12px 14px', marginBottom: 24, fontSize: 13, color: S.green, lineHeight: 1.5 }}>
              🌿 Pode pular e adicionar depois em <strong>Bancos</strong>. Mas com o banco cadastrado, cada despesa debita automaticamente.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...btn(S.sand), flex: 1 }} onClick={() => setStep(2)}>← Voltar</button>
              <button style={{ ...btn(), flex: 2 }} onClick={() => setStep(4)}>
                {nomeBanco ? 'Continuar →' : 'Pular por agora →'}
              </button>
            </div>
          </div>
        )}

        {/* ── PASSO 4 — Primeiras metas ── */}
        {step === 4 && objAtual && (
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: S.green, marginBottom: 8 }}>
              Primeiras metas
            </h2>
            <p style={{ fontSize: 14, color: S.muted, marginBottom: 6, lineHeight: 1.6 }}>
              Para o objetivo <strong>{objAtual.titulo}</strong>, sugerimos:
            </p>
            <p style={{ fontSize: 12, color: S.muted, marginBottom: 20 }}>Selecione as que fazem sentido. Podem ser editadas depois.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {objAtual.metas_sugeridas.map(meta => {
                const sel = metasEscolhidas.find(m => m.nome === meta.nome)
                return (
                  <div key={meta.nome} onClick={() => toggleMeta(meta)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${sel ? objAtual.cor : S.border}`, background: sel ? objAtual.corBg : '#fff', transition: 'all .15s' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: sel ? objAtual.cor : S.bark, marginBottom: 3 }}>{meta.nome}</div>
                      <div style={{ fontSize: 12, color: S.muted }}>{meta.descricao}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: sel ? objAtual.cor : S.muted, marginTop: 4 }}>
                        Meta: R$ {meta.valor_alvo.toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${sel ? objAtual.cor : S.border}`, background: sel ? objAtual.cor : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                      {sel && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Gráfico visual das metas */}
            {metasEscolhidas.length > 0 && (
              <div style={{ background: objAtual.corBg, borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: objAtual.cor, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
                  Prévia das suas metas
                </div>
                {metasEscolhidas.map(m => (
                  <div key={m.nome} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                      <span style={{ fontWeight: 500, color: S.bark }}>{m.nome}</span>
                      <span style={{ color: objAtual.cor }}>R$ {m.valor_alvo.toLocaleString('pt-BR')}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: '2%', height: '100%', background: objAtual.cor, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 3 }}>0% · Começando do zero 🌱</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...btn(S.sand), flex: 1 }} onClick={() => setStep(3)}>← Voltar</button>
              <button style={{ ...btn(), flex: 2 }} onClick={() => setStep(5)}>
                {metasEscolhidas.length > 0 ? `Criar ${metasEscolhidas.length} meta(s) →` : 'Pular por agora →'}
              </button>
            </div>
          </div>
        )}

        {/* ── PASSO 5 — Concluído ── */}
        {step === 5 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 20, lineHeight: 1 }}>🎉</div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 700, color: S.green, marginBottom: 12 }}>
              O jardim está plantado!
            </h1>
            <p style={{ fontSize: 15, color: S.muted, lineHeight: 1.7, marginBottom: 24 }}>
              <strong>{nomeEu}</strong>, tudo está configurado para o objetivo{' '}
              <strong style={{ color: objAtual?.cor }}>{objAtual?.emoji} {objAtual?.titulo}</strong>.
            </p>

            {/* Resumo */}
            <div style={{ background: '#EFF6EF', borderRadius: 14, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: S.green, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Resumo do seu Éden</div>
              {[
                ['🎯', 'Objetivo', objAtual?.titulo],
                ['👤', 'Seu perfil', `${nomeEu} · ${papelEu === 'eu' ? 'EU' : 'ELA'}`],
                ['🔑', 'Código do casal', codigoCasal || 'Gerado automaticamente'],
                nomeBanco && ['🏦', 'Banco cadastrado', nomeBanco],
                metasEscolhidas.length > 0 && ['🎯', 'Metas criadas', `${metasEscolhidas.length} meta(s)`],
                ['⏳', 'Trial ativo', '14 dias Premium grátis'],
              ].filter(Boolean).map(([emoji, label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: `0.5px solid rgba(61,90,62,0.1)`, fontSize: 13 }}>
                  <span>{emoji}</span>
                  <span style={{ color: S.muted, width: 140 }}>{label}</span>
                  <span style={{ fontWeight: 500, color: S.bark }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 13, color: S.muted, marginBottom: 28, lineHeight: 1.6 }}>
              💌 Compartilhe o código <strong>{codigoCasal || 'do casal'}</strong> com seu parceiro(a) para que ele(a) entre no mesmo jardim.
            </div>

            <button style={{ ...btn(), width: '100%', justifyContent: 'center', padding: '14px', fontSize: 16 }}
              onClick={finalizar} disabled={saving}>
              {saving ? 'Plantando...' : 'Entrar no Éden 🌿'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
