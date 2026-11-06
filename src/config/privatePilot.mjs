// Explicit private-pilot profile. No endpoints, keys or identities are inferred.
export const PRIVATE_WEB_ENV_KEYS=Object.freeze(['VITE_EDEN_ENV','VITE_EDEN_CLIENT_MODE','VITE_EDEN_PROJECT_ID','VITE_EDEN_CARD_SCOPE','VITE_PILOT_WEB_ORIGIN','VITE_SUPABASE_URL','VITE_API_URL','VITE_SUPABASE_ANON_KEY']);
const fail=m=>{throw Error('PRIVATE_PILOT: '+m)};
function origin(v){if(typeof v!=='string')fail('ORIGIN_REQUIRED');let u;try{u=new URL(v)}catch{fail('ORIGIN_INVALID')}if(u.protocol!=='https:'||u.origin!==v||u.username||u.password||u.search||u.hash||u.pathname!=='/'||/^(localhost|127\.|0\.|\[::1\])/.test(u.hostname)||/\.(test|invalid)$/.test(u.hostname))fail('HTTPS_EXACT_ORIGIN_REQUIRED');return v;}
export function validatePrivateWebEnvironment(env,browserOrigin){
 if(env?.EDEN_ENV!==undefined&&env.EDEN_ENV!=='private-pilot')fail('ENVIRONMENT_MISMATCH');
 if(env?.VITE_EDEN_ENV!=='private-pilot'||env.VITE_EDEN_CLIENT_MODE!=='private-pilot')fail('EXPLICIT_PROFILE_REQUIRED');
 if(Object.keys(env).some(k=>k.startsWith('VITE_')&&!PRIVATE_WEB_ENV_KEYS.includes(k)))fail('UNEXPECTED_PUBLIC_ENV_KEY');
 if(!/^eden-private-[a-z0-9-]+$/.test(env.VITE_EDEN_PROJECT_ID||''))fail('NEW_PROJECT_REQUIRED');
 const webOrigin=origin(env.VITE_PILOT_WEB_ORIGIN),supabaseUrl=origin(env.VITE_SUPABASE_URL),apiUrl=origin(env.VITE_API_URL);if(browserOrigin!==undefined&&browserOrigin!==webOrigin)fail('WEB_ORIGIN_MISMATCH');
 const cardScope=env.VITE_EDEN_CARD_SCOPE??'blocked';if(!['blocked','manual-validation'].includes(cardScope)||(cardScope==='manual-validation'&&env.VITE_EDEN_PROJECT_ID!=='eden-private-hml03a'))fail('CARD_VALIDATION_TARGET_REQUIRED');
 const anonKey=env.VITE_SUPABASE_ANON_KEY;let claims;try{if(typeof anonKey!=='string'||anonKey.trim()!==anonKey)fail('ANON_KEY_REQUIRED');const parts=anonKey.split('.');if(parts.length!==3||parts.some(p=>!/^[A-Za-z0-9_-]+$/.test(p)))fail('JWT_FORMAT');const h=JSON.parse(atob(parts[0].replace(/-/g,'+').replace(/_/g,'/')));claims=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));if(h.alg!=='HS256'||claims.role!=='anon'||typeof claims.iss!=='string'||!claims.iss||claims.iss==='supabase-demo'||claims.ref!==env.VITE_EDEN_PROJECT_ID||!Number.isFinite(claims.exp)||claims.exp<=Date.now()/1000)fail('PRIVATE_ANON_KEY_REQUIRED')}catch{fail('PRIVATE_ANON_KEY_REQUIRED')}
 return Object.freeze({environment:'private-pilot',clientMode:'private-pilot',cardScope,projectId:env.VITE_EDEN_PROJECT_ID,webOrigin,supabaseUrl,apiUrl,anonKey,storageKey:'eden:'+env.VITE_EDEN_PROJECT_ID+':auth:v1'});
}
export function privateCsp(e){return ["default-src 'self'","script-src 'self'","style-src 'self' 'unsafe-inline'","font-src 'self' data:","img-src 'self' data: blob:","object-src 'none'","base-uri 'self'","form-action 'self'",`connect-src ${e.webOrigin} ${e.supabaseUrl} ${e.apiUrl} ${e.supabaseUrl.replace('https:','wss:')}`,"frame-src 'none'","worker-src 'none'"].join('; ')}
export function installPrivateBoundary(target,e){
 if(target.__edenPrivateBoundary)return;if(target.location?.origin!==e.webOrigin)fail('WEB_ORIGIN_MISMATCH');
 const guard=(input,socket=false)=>{const raw=typeof input==='string'||input instanceof URL?String(input):input?.url;if(typeof raw!=='string'||/[\\\r\n\t]/.test(raw))fail('DESTINATION_BLOCKED');const u=new URL(raw,e.webOrigin);const allowed=socket?[e.supabaseUrl.replace('https:','wss:')]:[e.webOrigin,e.supabaseUrl,e.apiUrl];if(u.username||u.password||!allowed.includes(u.origin))fail('DESTINATION_BLOCKED');};
 const fetch=target.fetch.bind(target);target.fetch=(input,init={})=>{guard(input);return fetch(input,{...init,redirect:'error'})};
 if(target.XMLHttpRequest){const open=target.XMLHttpRequest.prototype.open;target.XMLHttpRequest.prototype.open=function(method,url,...rest){guard(url);return open.call(this,method,url,...rest)}}
 for(const name of ['WebSocket','EventSource']){const Native=target[name];if(Native)target[name]=new Proxy(Native,{construct(Type,args,NewTarget){guard(args[0],name==='WebSocket');return Reflect.construct(Type,args,NewTarget)}})}
 if(target.navigator?.sendBeacon){const beacon=target.navigator.sendBeacon.bind(target.navigator);target.navigator.sendBeacon=(url,data)=>{guard(url);return beacon(url,data)}}
 Object.defineProperty(target,'__edenPrivateBoundary',{value:true});
}
