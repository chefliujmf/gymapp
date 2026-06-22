import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

export interface Passkey { id: string; label: string; createdAt: number }
export interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'user'
  info: Record<string, unknown>
  avatar: string
  passkeys: Passkey[]
  hasIcuKey: boolean
  icuAthlete: string
}

async function req<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch('/auth' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && (data as { error?: string }).error) || `HTTP ${res.status}`)
  return data as T
}

export const authApi = {
  me: () => req<User>('/me'),
  login: (login: string, password: string) => req<User>('/login', { body: { login, password } }),
  logout: () => req<{ ok: boolean }>('/logout', { method: 'POST' }),

  async passkeyLogin(login: string): Promise<User> {
    const { uid, options } = await req<{ uid: string; options: unknown }>('/passkey/login/options', { body: { login } })
    const response = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] })
    return req<User>('/passkey/login/verify', { body: { uid, response } })
  },
  // Usernameless: the device offers its passkeys for this site — no username.
  async passkeyLoginDiscoverable(): Promise<User> {
    const options = await req<unknown>('/passkey/login/begin', { method: 'POST' })
    const response = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] })
    return req<User>('/passkey/login/finish', { body: { response } })
  },
  async passkeyRegister(label: string): Promise<User> {
    const options = await req<unknown>('/passkey/register/options', { method: 'POST' })
    const response = await startRegistration({ optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'] })
    return req<User>('/passkey/register/verify', { body: { response, label } })
  },
  passkeyDelete: (id: string) => req<User>(`/passkeys/${id}`, { method: 'DELETE' }),

  changePassword: (current: string, newPassword: string) => req<{ ok: boolean }>('/password/change', { body: { current, newPassword } }),
  forgot: (email: string) => req<{ ok: boolean; emailSent: boolean }>('/password/forgot', { body: { email } }),
  reset: (email: string, code: string, newPassword: string) => req<{ ok: boolean }>('/password/reset', { body: { email, code, newPassword } }),
  saveProfile: (info: Record<string, unknown>) => req<User>('/profile', { method: 'PUT', body: info }),
  saveIcu: (icuKey: string, icuAthlete: string) => req<User>('/icu', { method: 'PUT', body: { icuKey, icuAthlete } }),
  saveAvatar: (avatar: string) => req<User>('/avatar', { method: 'PUT', body: { avatar } }),
  getToken: () => req<{ token: string }>('/token'),
  rotateToken: () => req<{ token: string }>('/token/rotate', { method: 'POST' }),

  listUsers: () => req<User[]>('/users'),
  addUser: (username: string, email: string, role: 'admin' | 'user') => req<{ user: User; tempPassword: string; emailed: boolean }>('/users', { body: { username, email, role } }),
  resetUser: (id: string) => req<{ tempPassword: string; emailed: boolean }>(`/users/${id}/reset`, { method: 'POST' }),
  deleteUser: (id: string) => req<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),
}
