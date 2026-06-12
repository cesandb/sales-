import { useState, useRef } from 'react'
import { Key, Bell, Database, Shield, CheckCircle, AlertCircle, Eye, EyeOff, Download, Upload, Trash2, RefreshCw, Sparkles, ExternalLink, Send, Radio, Mail, Instagram, Copy, Check } from 'lucide-react'
import { getApiKey, saveApiKey, clearApiKey, testApiKey } from '../utils/aiDraft'
import { requestNotificationPermission, sendNotification } from '../utils/notifications'
import { useAuth } from '../components/AuthGate'
import { useStore } from '../store/useStore'
import { REDDIT_KEY, REDDIT_SECRET, getRedditToken } from '../utils/autoAcquire'
import { EMAILJS_KEY, EMAILJS_SERVICE, EMAILJS_TEMPLATE } from '../components/PipelineAutomationEngine'
import { YOUTUBE_KEY } from '../utils/autoAcquire'

const STORAGE_KEY = 'phorm_crm_v1'

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-800">
        <Icon size={16} className="text-brand-400" />
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── AI Key ────────────────────────────────────────────────────────────────────
function AISection() {
  const [key, setKey] = useState(getApiKey())
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState(getApiKey() ? 'saved' : 'empty') // empty | saved | testing | ok | error
  const [errMsg, setErrMsg] = useState('')

  async function handleSave() {
    if (!key.trim()) return
    setStatus('testing')
    setErrMsg('')
    try {
      const ok = await testApiKey(key.trim())
      if (ok) {
        saveApiKey(key.trim())
        setStatus('ok')
      } else {
        setStatus('error')
        setErrMsg('Key appears invalid — check and try again.')
      }
    } catch (err) {
      setStatus('error')
      setErrMsg(err.message)
    }
  }

  function handleClear() {
    clearApiKey()
    setKey('')
    setStatus('empty')
  }

  const masked = key ? key.slice(0, 8) + '…' + key.slice(-4) : ''

  return (
    <Section title="AI Assistant" icon={Sparkles}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400">
          Add your{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:text-brand-300 underline inline-flex items-center gap-1"
          >
            Anthropic API key <ExternalLink size={10} />
          </a>
          {' '}to enable one-click AI message drafting. The key is stored only in your browser.
        </p>

        {status === 'ok' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-900/20 border border-green-700/40">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-300">Key saved and verified ({masked})</span>
          </div>
        )}
        {status === 'saved' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-800/60 border border-gray-700">
            <Key size={14} className="text-gray-400" />
            <span className="text-xs text-gray-300">Key on file: {masked}</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-900/20 border border-red-700/40">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-xs text-red-300">{errMsg}</span>
          </div>
        )}

        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            className="input pr-10"
            placeholder="sk-ant-…"
            value={key}
            onChange={e => { setKey(e.target.value); setStatus('empty') }}
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!key.trim() || status === 'testing'}
            className="btn-primary flex items-center gap-2 flex-1"
          >
            {status === 'testing' ? <><RefreshCw size={13} className="animate-spin" /> Testing…</> : 'Save & Verify Key'}
          </button>
          {(status === 'saved' || status === 'ok') && (
            <button onClick={handleClear} className="btn-secondary flex items-center gap-1.5">
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
      </div>
    </Section>
  )
}

// ── Instagram Bookmarklet ─────────────────────────────────────────────────────
const APP_URL = 'https://cesandb.github.io/sales-'
const BOOKMARKLET_CODE = `javascript:(function(){var h=window.location.href;var m=h.match(/instagram\\.com\\/([a-zA-Z0-9_.]+)/);var skip=['p','reel','stories','explore','direct','accounts','login','tv','_n','_u','about','press','api','legal','privacy','security'];if(!m||skip.indexOf(m[1])>-1){alert('Phorm CRM: Navigate to a profile page first');return;}var u=m[1];var t=(document.title||'').split('(')[0].replace(/[•|@]/g,'').trim();window.open('${APP_URL}/acquire?ig='+encodeURIComponent(u)+'&igname='+encodeURIComponent(t||u),'_blank');})();`

function InstagramBookmarkletSection() {
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(BOOKMARKLET_CODE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Section title="Instagram Bookmarklet" icon={Instagram}>
      <div className="space-y-4">
        <p className="text-xs text-gray-400 leading-relaxed">
          Browse Instagram as normal. When you spot a promising profile, click this bookmarklet — it sends the handle straight into Quick Add on the Acquire page. Zero copy-paste.
        </p>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white">One-time setup:</p>
          <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>Click <strong className="text-white">Copy Code</strong> below</li>
            <li>Open bookmarks bar (Cmd+Shift+B on Chrome)</li>
            <li>Right-click bar → <strong className="text-white">Add page</strong> or "New bookmark"</li>
            <li>Name it <strong className="text-white">+ Phorm CRM</strong>, paste the code as the URL, save</li>
          </ol>
        </div>
        <div className="rounded-lg bg-gray-950 border border-gray-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Bookmarklet code</span>
            <button onClick={copyCode} className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors">
              {copied ? <><Check size={12} className="text-green-400" /> Copied!</> : <><Copy size={12} /> Copy Code</>}
            </button>
          </div>
          <p className="text-[10px] text-gray-600 font-mono break-all leading-relaxed line-clamp-3">
            {BOOKMARKLET_CODE.slice(0, 120)}…
          </p>
        </div>
        <div className="rounded-lg bg-pink-900/10 border border-pink-800/30 px-4 py-3">
          <p className="text-xs text-pink-300 font-semibold mb-1">How it works</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Open <code className="bg-gray-800 px-1 rounded">instagram.com/username</code> → click bookmarklet → Phorm CRM opens with that handle pre-filled in Quick Add → hit "Add Contact" and they're in your outreach queue.
          </p>
        </div>
      </div>
    </Section>
  )
}

// ── YouTube API Key ───────────────────────────────────────────────────────────
function YouTubeSection() {
  const [key, setKey]   = useState(localStorage.getItem(YOUTUBE_KEY) || '')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState(localStorage.getItem(YOUTUBE_KEY) ? 'saved' : 'empty')
  const [errMsg, setErrMsg] = useState('')

  async function handleSave() {
    if (!key.trim()) return
    setStatus('testing'); setErrMsg('')
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=fitness&type=video&maxResults=1&key=${encodeURIComponent(key.trim())}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (res.ok) {
        localStorage.setItem(YOUTUBE_KEY, key.trim())
        setStatus('ok')
      } else {
        const err = await res.json().catch(() => ({}))
        setStatus('error')
        setErrMsg(err?.error?.message || `HTTP ${res.status} — check your key`)
      }
    } catch (e) {
      setStatus('error'); setErrMsg(e.message)
    }
  }

  function handleClear() {
    localStorage.removeItem(YOUTUBE_KEY)
    setKey(''); setStatus('empty')
  }

  return (
    <Section title="YouTube Data API (optional)" icon={ExternalLink}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Enables the YouTube Creators source in the Auto-Acquire Engine — finds fitness channel owners who review supplements and post workout content.
        </p>
        <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
          <li>Go to{' '}
            <a href="https://console.developers.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
              className="text-brand-400 underline">Google Cloud Console</a>
          </li>
          <li>Create a project → Enable <strong className="text-gray-300">YouTube Data API v3</strong></li>
          <li>Create an API Key under Credentials</li>
          <li>Free quota: 10,000 units/day (~100 search calls)</li>
        </ol>

        {status === 'ok' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-900/20 border border-green-700/40">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-300">YouTube API connected — creator acquisition active</span>
          </div>
        )}
        {status === 'saved' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-800/60 border border-gray-700">
            <Key size={14} className="text-gray-400" />
            <span className="text-xs text-gray-300">Key saved (not yet tested)</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-900/20 border border-red-700/40">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-xs text-red-300">{errMsg}</span>
          </div>
        )}

        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            className="input text-xs pr-8"
            placeholder="AIza…"
            value={key}
            onChange={e => { setKey(e.target.value); setStatus('empty') }}
          />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!key.trim() || status === 'testing'}
            className="btn-primary flex items-center gap-2 flex-1">
            {status === 'testing' ? <><RefreshCw size={13} className="animate-spin" /> Testing…</> : 'Save & Test Key'}
          </button>
          {(status === 'saved' || status === 'ok') && (
            <button onClick={handleClear} className="btn-secondary flex items-center gap-1.5">
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
      </div>
    </Section>
  )
}

// ── Reddit API credentials ────────────────────────────────────────────────────
function RedditSection() {
  const [clientId, setClientId]         = useState(localStorage.getItem(REDDIT_KEY) || '')
  const [clientSecret, setClientSecret] = useState(localStorage.getItem(REDDIT_SECRET) || '')
  const [show, setShow]   = useState(false)
  const [status, setStatus] = useState(
    localStorage.getItem(REDDIT_KEY) ? 'saved' : 'empty'
  )
  const [errMsg, setErrMsg] = useState('')

  async function handleSave() {
    if (!clientId.trim() || !clientSecret.trim()) return
    setStatus('testing'); setErrMsg('')
    localStorage.setItem(REDDIT_KEY, clientId.trim())
    localStorage.setItem(REDDIT_SECRET, clientSecret.trim())
    // Clear cached token so we fetch a fresh one
    localStorage.removeItem('phorm_reddit_token')
    try {
      const token = await getRedditToken()
      setStatus(token ? 'ok' : 'error')
      if (!token) setErrMsg('Could not get a token — check your Client ID and Secret.')
    } catch (e) {
      setStatus('error')
      setErrMsg(e.message)
    }
  }

  function handleClear() {
    localStorage.removeItem(REDDIT_KEY)
    localStorage.removeItem(REDDIT_SECRET)
    localStorage.removeItem('phorm_reddit_token')
    setClientId(''); setClientSecret(''); setStatus('empty')
  }

  return (
    <Section title="Reddit API (optional — improves reliability)" icon={Radio}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Without credentials, Reddit is fetched via CORS proxies which can be slow or blocked.
          Adding a free Reddit app gives direct API access — faster and more reliable.
        </p>
        <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
          <li>Go to{' '}
            <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer"
              className="text-brand-400 underline">reddit.com/prefs/apps</a>
          </li>
          <li>Click <strong className="text-gray-300">create another app</strong>, choose <strong className="text-gray-300">script</strong></li>
          <li>Set redirect URI to <code className="bg-gray-800 px-1 rounded">http://localhost</code></li>
          <li>Copy the <strong className="text-gray-300">client ID</strong> (under app name) and <strong className="text-gray-300">secret</strong></li>
        </ol>

        {status === 'ok' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-900/20 border border-green-700/40">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-300">Connected — Reddit API working</span>
          </div>
        )}
        {status === 'saved' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-800/60 border border-gray-700">
            <Key size={14} className="text-gray-400" />
            <span className="text-xs text-gray-300">Credentials saved (not yet tested)</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-900/20 border border-red-700/40">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-xs text-red-300">{errMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Client ID</label>
            <input className="input text-xs" placeholder="e.g. aBcDeFgHiJ1234" value={clientId}
              onChange={e => { setClientId(e.target.value); setStatus('empty') }} />
          </div>
          <div>
            <label className="label">Client Secret</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} className="input text-xs pr-8"
                placeholder="secret…" value={clientSecret}
                onChange={e => { setClientSecret(e.target.value); setStatus('empty') }} />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {show ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!clientId.trim() || !clientSecret.trim() || status === 'testing'}
            className="btn-primary flex items-center gap-2 flex-1">
            {status === 'testing' ? <><RefreshCw size={13} className="animate-spin" /> Testing…</> : 'Save & Test Connection'}
          </button>
          {(status === 'saved' || status === 'ok') && (
            <button onClick={handleClear} className="btn-secondary flex items-center gap-1.5">
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
      </div>
    </Section>
  )
}

// ── EmailJS Auto-Send ─────────────────────────────────────────────────────────
function EmailJSSection() {
  const [publicKey, setPublicKey]   = useState(localStorage.getItem(EMAILJS_KEY) || '')
  const [serviceId, setServiceId]   = useState(localStorage.getItem(EMAILJS_SERVICE) || '')
  const [templateId, setTemplateId] = useState(localStorage.getItem(EMAILJS_TEMPLATE) || '')
  const [show, setShow]   = useState(false)
  const [status, setStatus] = useState(
    localStorage.getItem(EMAILJS_KEY) ? 'saved' : 'empty'
  )
  const [errMsg, setErrMsg] = useState('')

  async function handleSave() {
    if (!publicKey.trim() || !serviceId.trim() || !templateId.trim()) return
    setStatus('testing'); setErrMsg('')
    localStorage.setItem(EMAILJS_KEY, publicKey.trim())
    localStorage.setItem(EMAILJS_SERVICE, serviceId.trim())
    localStorage.setItem(EMAILJS_TEMPLATE, templateId.trim())
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId.trim(),
          template_id: templateId.trim(),
          user_id: publicKey.trim(),
          template_params: {
            to_email: 'test@example.com',
            to_name: 'Test',
            from_name: 'Conan (1st Phorm)',
            subject: 'EmailJS Test',
            message: 'This is a Phorm CRM connection test.',
            reply_to: '',
          },
        }),
      })
      setStatus(res.ok ? 'ok' : 'error')
      if (!res.ok) setErrMsg(`EmailJS returned ${res.status} — check your credentials.`)
    } catch (e) {
      setStatus('error')
      setErrMsg(e.message)
    }
  }

  function handleClear() {
    localStorage.removeItem(EMAILJS_KEY)
    localStorage.removeItem(EMAILJS_SERVICE)
    localStorage.removeItem(EMAILJS_TEMPLATE)
    setPublicKey(''); setServiceId(''); setTemplateId(''); setStatus('empty')
  }

  return (
    <Section title="EmailJS Auto-Send (optional)" icon={Mail}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          When enabled, the Pipeline Engine automatically emails contacts when sequence steps come due — no manual action needed. Free tier: 200 emails/month.
        </p>
        <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
          <li>Sign up free at{' '}
            <a href="https://www.emailjs.com" target="_blank" rel="noopener noreferrer"
              className="text-brand-400 underline">emailjs.com</a>
          </li>
          <li>Add an email service (Gmail, Outlook, etc.)</li>
          <li>Create a template with variables: <code className="bg-gray-800 px-1 rounded">to_email, to_name, from_name, subject, message</code></li>
          <li>Copy your <strong className="text-gray-300">Public Key</strong>, <strong className="text-gray-300">Service ID</strong>, and <strong className="text-gray-300">Template ID</strong></li>
        </ol>

        {status === 'ok' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-900/20 border border-green-700/40">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-300">EmailJS connected — auto-send is active</span>
          </div>
        )}
        {status === 'saved' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-800/60 border border-gray-700">
            <Mail size={14} className="text-gray-400" />
            <span className="text-xs text-gray-300">Credentials saved (not yet verified)</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-900/20 border border-red-700/40">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-xs text-red-300">{errMsg}</span>
          </div>
        )}

        <div>
          <label className="label">Public Key</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              className="input text-xs pr-8"
              placeholder="e.g. user_abc123…"
              value={publicKey}
              onChange={e => { setPublicKey(e.target.value); setStatus('empty') }}
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Service ID</label>
            <input className="input text-xs" placeholder="service_abc123"
              value={serviceId} onChange={e => { setServiceId(e.target.value); setStatus('empty') }} />
          </div>
          <div>
            <label className="label">Template ID</label>
            <input className="input text-xs" placeholder="template_abc123"
              value={templateId} onChange={e => { setTemplateId(e.target.value); setStatus('empty') }} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave}
            disabled={!publicKey.trim() || !serviceId.trim() || !templateId.trim() || status === 'testing'}
            className="btn-primary flex items-center gap-2 flex-1">
            {status === 'testing' ? <><RefreshCw size={13} className="animate-spin" /> Testing…</> : 'Save & Test'}
          </button>
          {(status === 'saved' || status === 'ok') && (
            <button onClick={handleClear} className="btn-secondary flex items-center gap-1.5">
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
      </div>
    </Section>
  )
}

// ── Notifications ─────────────────────────────────────────────────────────────
function NotificationsSection() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )

  async function enable() {
    const result = await requestNotificationPermission()
    setPermission(result)
    if (result === 'granted') {
      sendNotification('Phorm CRM', 'Notifications enabled! You\'ll be reminded of due follow-ups.', { tag: 'test' })
    }
  }

  const statusMap = {
    granted: { color: 'text-green-400', bg: 'bg-green-900/20 border-green-700/40', icon: CheckCircle, msg: 'Enabled — you\'ll get reminders for due follow-ups.' },
    denied:  { color: 'text-red-400',   bg: 'bg-red-900/20 border-red-700/40',     icon: AlertCircle, msg: 'Blocked — enable notifications in your browser settings.' },
    default: { color: 'text-gray-400',  bg: 'bg-gray-800 border-gray-700',          icon: Bell,        msg: 'Not enabled yet.' },
    unsupported: { color: 'text-gray-500', bg: 'bg-gray-800 border-gray-700',       icon: Bell,        msg: 'Your browser doesn\'t support notifications.' },
  }
  const s = statusMap[permission] || statusMap.default
  const StatusIcon = s.icon

  return (
    <Section title="Notifications" icon={Bell}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400">
          Get browser alerts when follow-ups are due. Works while the app is open. Install the app (PWA) for background reminders on Android.
        </p>
        <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${s.bg}`}>
          <StatusIcon size={14} className={s.color} />
          <span className={`text-xs ${s.color}`}>{s.msg}</span>
        </div>
        {permission !== 'granted' && permission !== 'denied' && permission !== 'unsupported' && (
          <button onClick={enable} className="btn-primary w-full flex items-center justify-center gap-2">
            <Bell size={14} /> Enable Notifications
          </button>
        )}
        {permission === 'granted' && (
          <button
            onClick={() => sendNotification('Test', 'Notifications are working!', { tag: 'test' })}
            className="btn-secondary w-full"
          >
            Send Test Notification
          </button>
        )}
      </div>
    </Section>
  )
}

// ── Data Backup ───────────────────────────────────────────────────────────────
function DataSection() {
  const store = useStore()
  const fileRef = useRef()
  const [importStatus, setImportStatus] = useState(null) // null | 'success' | 'error'
  const [importMsg, setImportMsg] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  function exportData() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `phorm-crm-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        if (!parsed.contacts || !parsed.pipeline) throw new Error('File does not look like a Phorm CRM backup.')
        localStorage.setItem(STORAGE_KEY, ev.target.result)
        setImportStatus('success')
        setImportMsg(`Imported ${parsed.contacts.length} contacts, ${parsed.pipeline.length} pipeline items.`)
        setTimeout(() => window.location.reload(), 1500)
      } catch (err) {
        setImportStatus('error')
        setImportMsg(err.message)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }

  const stats = (() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      return {
        contacts: s.contacts?.length ?? 0,
        interactions: s.interactions?.length ?? 0,
        followups: s.followups?.length ?? 0,
      }
    } catch { return { contacts: 0, interactions: 0, followups: 0 } }
  })()

  return (
    <Section title="Data Backup & Export" icon={Database}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400">
          All data is stored locally in your browser. Export regularly to avoid losing it if the browser clears storage.
        </p>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[['Contacts', stats.contacts], ['Interactions', stats.interactions], ['Follow-ups', stats.followups]].map(([label, n]) => (
            <div key={label} className="bg-gray-800/60 rounded-lg p-2">
              <p className="text-lg font-bold text-white">{n}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={exportData} className="btn-primary flex items-center gap-2 flex-1">
            <Download size={14} /> Export Backup
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-secondary flex items-center gap-2 flex-1">
            <Upload size={14} /> Import Backup
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>

        {importStatus && (
          <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${importStatus === 'success' ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
            {importStatus === 'success'
              ? <CheckCircle size={14} className="text-green-400" />
              : <AlertCircle size={14} className="text-red-400" />}
            <span className={`text-xs ${importStatus === 'success' ? 'text-green-300' : 'text-red-300'}`}>{importMsg}</span>
          </div>
        )}

        <div className="border-t border-gray-800 pt-3">
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
            >
              <Trash2 size={13} /> Clear all data
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-red-400 text-center font-semibold">This deletes everything. Are you sure?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmClear(false)} className="btn-secondary flex-1 text-xs">Cancel</button>
                <button onClick={clearAll} className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold">Delete All Data</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}

// ── Outreach Goals ────────────────────────────────────────────────────────────
function OutreachSection() {
  const { settings, updateSettings } = useStore()
  const [target, setTarget] = useState(settings.dailyOutreachTarget || 10)
  const [saved, setSaved] = useState(false)

  function save() {
    updateSettings({ dailyOutreachTarget: parseInt(target) || 10 })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Section title="Outreach Goals" icon={Send}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400">Set your daily outreach target. The Outreach Queue and Dashboard track your progress against this each day.</p>
        <div>
          <label className="label">Daily Outreach Target</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max="100"
              className="input w-24"
              value={target}
              onChange={e => setTarget(e.target.value)}
            />
            <button onClick={save} className={`btn-primary flex items-center gap-2 ${saved ? 'bg-green-700' : ''}`}>
              {saved ? <><CheckCircle size={13} /> Saved!</> : 'Save'}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">Recommended: start with 10/day, scale to 20–30 as you build momentum</p>
        </div>
      </div>
    </Section>
  )
}

// ── Security ──────────────────────────────────────────────────────────────────
function SecuritySection() {
  const { changePassword } = useAuth()
  return (
    <Section title="Security" icon={Shield}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400">Your password is stored as a SHA-256 hash locally. The app locks when you close the tab.</p>
        <button onClick={changePassword} className="btn-secondary w-full flex items-center justify-center gap-2">
          <Key size={14} /> Change Password
        </button>
      </div>
    </Section>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-0.5">Configure AI drafting, notifications, and data backup</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <AISection />
        <InstagramBookmarkletSection />
        <YouTubeSection />
        <RedditSection />
        <EmailJSSection />
        <NotificationsSection />
        <OutreachSection />
        <DataSection />
        <SecuritySection />
      </div>
    </div>
  )
}
