export const MVP_MODE='mvp-homologation'
export const MVP_SCOPE=Object.freeze({userId:'fc944d4c-32f8-442d-a778-721938f0342f',householdId:'066d6654-308d-4a90-a599-6dff6e879a89',casalCode:'hml-clean-01'})
const fail=code=>{throw new Error('MVP_PREFLIGHT: '+code)}
const commands=new Set(['manage_bank_account_transaction','transfer_bank_transaction','record_income_transaction','amend_income_transaction','void_income_transaction','record_expense_transaction','amend_expense_transaction','void_expense_transaction','pay_fixed_bill_period','reverse_fixed_bill_payment','ensure_fixed_bill_periods','archive_fixed_bill','manage_card_transaction','pay_card_invoice_transaction','void_card_purchase_transaction','create_card_recurrence_transaction','process_due_card_commitments','post_recurring_income_now','set_card_recurrence_flags','contribute_to_goal_investment_transaction','set_account_allocation','set_goal_account_source','set_meta_account_allocation','delete_patrimonial_goal'])
const reads=new Set(['ef_motor_03_contract','ef_motor_04_contract','bank_operations_contract','get_card_financial_state','get_card_recurrence_schedule','current_user_is_product_admin'])
export function assertMvpCommand(rpc,p,uid){
 if(uid!==MVP_SCOPE.userId)fail('ACTOR_OUT_OF_SCOPE')
 if(!commands.has(rpc))fail('UNIMPLEMENTED_OR_GLOBAL_COMMAND_DISABLED')
 if(p.p_expected?.household_id&&p.p_expected.household_id!==MVP_SCOPE.householdId)fail('HOUSEHOLD_OUT_OF_SCOPE')
 if(p.p_household_id&&p.p_household_id!==MVP_SCOPE.householdId)fail('HOUSEHOLD_OUT_OF_SCOPE')
}
export function assertMvpRequest(input,init={}){
 const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,'http://127.0.0.1:4175'),method=(init.method||input?.method||'GET').toUpperCase()
 if(url.origin==='http://127.0.0.1:4175')return
 if(url.origin!=='http://127.0.0.1:55321')fail('NON_SUPABASE_TRANSPORT_DISABLED')
 if(url.pathname.startsWith('/auth/v1/')){if(method==='GET'||(method==='POST'&&['/auth/v1/token','/auth/v1/logout'].includes(url.pathname)))return;fail('LOGIN_ONLY_NO_SIGNUP_OR_PROFILE_WRITE')}
 if(url.pathname.startsWith('/rest/v1/')&&['GET','HEAD'].includes(method)&&!url.pathname.includes('/rpc/'))return
 let uid,p;try{const token=(new Headers(init.headers||input?.headers).get('authorization')||'').replace(/^Bearer\s+/i,'');uid=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;p=typeof init.body==='string'?JSON.parse(init.body):{}}catch{fail('AUTHENTICATED_JSON_REQUIRED')}
 if(uid!==MVP_SCOPE.userId)fail('ACTOR_OUT_OF_SCOPE')
 if(url.pathname.startsWith('/rest/v1/rpc/')){const rpc=url.pathname.slice('/rest/v1/rpc/'.length);if(reads.has(rpc))return;assertMvpCommand(rpc,p,uid);return}
 const table=url.pathname.slice('/rest/v1/'.length)
 if(p.household_id&&p.household_id!==MVP_SCOPE.householdId||p.casal_code&&p.casal_code!==MVP_SCOPE.casalCode||p.user_id&&p.user_id!==uid)fail('HOUSEHOLD_OUT_OF_SCOPE')
 if(table==='recorrencias_cartao'&&method==='PATCH'&&Object.keys(p).every(k=>['ativa','auto_lancar'].includes(k)&&typeof p[k]==='boolean')&&url.search.includes(MVP_SCOPE.householdId))return
 if(['contas_fixas','contas_variaveis','receitas_recorrentes','metas','categorias','orcamento_config'].includes(table)&&['POST','PATCH','DELETE'].includes(method))return
 if(table==='profiles'&&method==='PATCH'&&url.search.includes(uid)&&Object.keys(p).every(k=>['banco_principal_id','nome'].includes(k)))return
 fail('DIRECT_FINANCIAL_WRITE_DISABLED')
}
export function validateMvpWindow(a,now=Date.now()){
 if(a?.approved!==true||a.environment!=='local-stage'||a.client_mode!==MVP_MODE||!a.human_reference)fail('NEW_R3_WINDOW_REQUIRED')
 if(a.user_id!==MVP_SCOPE.userId||a.household_id!==MVP_SCOPE.householdId||a.stage!=='all-existing-financial-journeys')fail('WINDOW_SCOPE_INVALID')
 const start=Date.parse(a.issued_at),end=Date.parse(a.expires_at)
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>now||end<=now||end-start>30*60000)fail('WINDOW_EXPIRED_OR_INVALID')
 if(!/^[a-f0-9]{64}$/.test(a.manifest_sha256||'')||!/^[a-f0-9]{64}$/.test(a.hba_sha256||''))fail('EVIDENCE_REQUIRED')
 return a
}
