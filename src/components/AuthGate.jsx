import { useState, useEffect, createContext, useContext } from 'react'
import { Lock, Eye, EyeOff, LogOut, ShieldCheck } from 'lucide-react'

const AUTH_KEY = 'phorm_pw'
const SESSION_KEY = 'phorm_session'

// Simple hash using Web Crypto — good enough for a local password gate
async function hashPassword(password) {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(password))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function LoginForm({ storedHash, onLogin }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const hash = await hashPassword(password)
    if (hash === storedHash) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onLogin()
    } else {
      setError('Incorrect password.')
      setPassword('')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white font-black text-lg mb-4">1P</div>
          <h1 className="text-2xl font-bold text-white">Phorm CRM</h1>
          <p className="text-gray-400 text-sm mt-1">Conan's Sales Hub</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-gray-200">Enter your password</h2>
          </div>

          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              className="input pr-10"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={!password || loading}
            className="btn-primary w-full"
          >
            {loading ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}

function SetPasswordForm({ onSet }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (pw.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (pw !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const hash = await hashPassword(pw)
    localStorage.setItem(AUTH_KEY, hash)
    sessionStorage.setItem(SESSION_KEY, '1')
    onSet()
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white font-black text-lg mb-4">1P</div>
          <h1 className="text-2xl font-bold text-white">Phorm CRM</h1>
          <p className="text-gray-400 text-sm mt-1">First-time setup</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-gray-200">Create a password</h2>
          </div>
          <p className="text-xs text-gray-500">This protects the app when others use this device. Stored locally — no account needed.</p>

          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              className="input pr-10"
              placeholder="New password (min 6 chars)"
              value={pw}
              onChange={e => setPw(e.target.value)}
              autoFocus
            />
            <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <input
            type={show ? 'text' : 'password'}
            className="input"
            placeholder="Confirm password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
          />

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button type="submit" disabled={!pw || !confirm || loading} className="btn-primary w-full">
            {loading ? 'Saving…' : 'Set Password & Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AuthGate({ children }) {
  const [state, setState] = useState('loading') // loading | setup | login | authed

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY)
    const session = sessionStorage.getItem(SESSION_KEY)
    if (!stored) {
      setState('setup')
    } else if (session === '1') {
      setState('authed')
    } else {
      setState('login')
    }
  }, [])

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setState('login')
  }

  function changePassword() {
    localStorage.removeItem(AUTH_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setState('setup')
  }

  if (state === 'loading') return null

  if (state === 'setup') {
    return <SetPasswordForm onSet={() => setState('authed')} />
  }

  if (state === 'login') {
    return <LoginForm storedHash={localStorage.getItem(AUTH_KEY)} onLogin={() => setState('authed')} />
  }

  return (
    <AuthContext.Provider value={{ logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}
