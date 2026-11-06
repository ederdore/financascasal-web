import { LOCAL_STAGE } from './environment.js'

export function assertLocalRequest(input, base = LOCAL_STAGE.webOrigin, socket = false) {
  const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url
  if (typeof raw !== 'string' || /[\\\r\n\t]/.test(raw)) throw new Error('EF-MOTOR-02: NETWORK_DESTINATION_BLOCKED')
  const url = new URL(raw, base)
  const allowed = socket
    ? ['ws://127.0.0.1:4175', 'ws://127.0.0.1:55321']
    : [LOCAL_STAGE.webOrigin, LOCAL_STAGE.supabaseUrl, LOCAL_STAGE.apiUrl]
  if (url.username || url.password || !allowed.includes(url.origin)) throw new Error('EF-MOTOR-02: NETWORK_DESTINATION_BLOCKED')
  return url
}

// Installed before createClient, protecting even legacy fetch URLs without
// changing financial consumers. CSP is the browser enforcement layer for XHR
// redirects, subresources and transports not covered by these wrappers.
export function installLocalNetworkBoundary(target, requestGuard) {
  if (target.__edenLocalNetworkBoundary) return
  if (target.location?.origin !== LOCAL_STAGE.webOrigin) throw new Error('EF-MOTOR-02: LOCAL_WEB_ORIGIN_REQUIRED')
  const nativeFetch = target.fetch.bind(target)
  target.fetch = (input, init = {}) => {
    assertLocalRequest(input)
    requestGuard?.(input,init)
    return nativeFetch(input, { ...init, redirect: 'error' })
  }
  if (target.XMLHttpRequest) {
    const open = target.XMLHttpRequest.prototype.open
    target.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      assertLocalRequest(url)
      requestGuard?.(url,{method})
      return open.call(this, method, url, ...rest)
    }
  }
  for (const name of ['WebSocket', 'EventSource']) {
    const Native = target[name]
    if (!Native) continue
    target[name] = new Proxy(Native, { construct(Type, args, NewTarget) {
      assertLocalRequest(args[0], LOCAL_STAGE.webOrigin, name === 'WebSocket')
      return Reflect.construct(Type, args, NewTarget)
    } })
  }
  if (target.navigator?.sendBeacon) {
    const beacon = target.navigator.sendBeacon.bind(target.navigator)
    target.navigator.sendBeacon = (url, data) => { assertLocalRequest(url); requestGuard?.(url,{method:'POST',body:data}); return beacon(url, data) }
  }
  Object.defineProperty(target, '__edenLocalNetworkBoundary', { value: true })
}
