import { useState, useRef, useEffect } from 'react'
import { Key, Bell, Database, Shield, CheckCircle, AlertCircle, Eye, EyeOff, Download, Upload, Trash2, RefreshCw, Sparkles, ExternalLink, Send, Radio, Mail, Instagram, Copy, Check, Newspaper, Chrome, LogIn, Unlink, AtSign, Phone, Zap, MessageSquare, Clock, Linkedin } from 'lucide-react'
import { getApiKey, saveApiKey, clearApiKey, testApiKey } from '../utils/aiDraft'
import { requestNotificationPermission, sendNotification } from '../utils/notifications'
import { useAuth } from '../components/AuthGate'
import { useStore } from '../store/useStore'
import { REDDIT_KEY, REDDIT_SECRET, getRedditToken, YOUTUBE_KEY, NEWSAPI_KEY, GNEWS_KEY, EVENTBRITE_KEY } from '../utils/autoAcquire'
import { GOOGLE_CLIENT_ID_KEY, GOOGLE_TOKEN_KEY, GOOGLE_TOKEN_EXPIRY, getGoogleToken, buildOAuthURL } from '../components/GoogleSync'
import { EMAILJS_KEY, EMAILJS_SERVICE, EMAILJS_TEMPLATE, SEND_WINDOW_KEY, SEND_START_KEY, SEND_END_KEY } from '../components/PipelineAutomationEngine'
import { HUNTER_KEY, saveHunterKey, clearHunterKey } from '../utils/contactEnrich'
import { REDDIT_DM_CLIENT_KEY, REDDIT_DM_TOKEN_KEY, REDDIT_DM_EXPIRY_KEY, getRedditDMToken, buildRedditDMAuthURL } from '../components/RedditDMSender'
import { TWILIO_SID_KEY, TWILIO_AUTH_KEY, TWILIO_FROM_KEY, isTwilioReady } from '../utils/twilioSms'
import { APOLLO_KEY } from '../utils/apolloEnrich'
import { isGmailSendReady } from '../utils/gmailSend'
import { DIGEST_WEBHOOK_KEY, DIGEST_LAST_SENT_KEY, DIGEST_TYPE_KEY } from '../components/DigestSender'

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
  const [testEmail, setTestEmail]   = useState('')
  const [show, setShow]             = useState(false)
  const [status, setStatus]         = useState(localStorage.getItem(EMAILJS_KEY) ? 'saved' : 'empty')
  const [testStatus, setTestStatus] = useState(null) // null | 'sending' | 'ok' | 'error'
  const [errMsg, setErrMsg]         = useState('')

  async function sendTestRequest(toEmail) {
    return fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId.trim(),
        template_id: templateId.trim(),
        user_id: publicKey.trim(),
        template_params: {
          to_email: toEmail,
          to_name: 'Conan',
          from_name: 'Conan (1st Phorm)',
          subject: '✅ Phorm CRM — Email test',
          message: 'Your EmailJS connection is working! Auto-send is now active. This message was sent by Phorm CRM to verify your setup.\n\nYou\'re all set — emails will go out automatically when sequence steps come due.',
          reply_to: '',
        },
      }),
      signal: AbortSignal.timeout(12000),
    })
  }

  async function handleSave() {
    if (!publicKey.trim() || !serviceId.trim() || !templateId.trim()) return
    setStatus('testing'); setErrMsg('')
    localStorage.setItem(EMAILJS_KEY, publicKey.trim())
    localStorage.setItem(EMAILJS_SERVICE, serviceId.trim())
    localStorage.setItem(EMAILJS_TEMPLATE, templateId.trim())
    try {
      // Validate connection — send to a real deliverable inbox if testEmail provided,
      // otherwise just hit the API to confirm credentials work
      const target = testEmail.trim() || 'noreply@emailjs.com'
      const res = await sendTestRequest(target)
      setStatus(res.ok ? 'ok' : 'error')
      if (!res.ok) setErrMsg(`EmailJS returned ${res.status} — check your credentials.`)
    } catch (e) {
      setStatus('error')
      setErrMsg(e.message)
    }
  }

  async function handleSendTestToMe() {
    if (!testEmail.trim()) return
    setTestStatus('sending')
    try {
      const res = await sendTestRequest(testEmail.trim())
      setTestStatus(res.ok ? 'ok' : 'error')
      if (!res.ok) setErrMsg(`Send failed: ${res.status}`)
      setTimeout(() => setTestStatus(null), 4000)
    } catch (e) {
      setTestStatus('error')
      setErrMsg(e.message)
      setTimeout(() => setTestStatus(null), 4000)
    }
  }

  function handleClear() {
    localStorage.removeItem(EMAILJS_KEY)
    localStorage.removeItem(EMAILJS_SERVICE)
    localStorage.removeItem(EMAILJS_TEMPLATE)
    setPublicKey(''); setServiceId(''); setTemplateId(''); setStatus('empty'); setTestStatus(null)
  }

  const isConfigured = status === 'ok' || status === 'saved'

  return (
    <Section title="EmailJS Auto-Send (optional)" icon={Mail}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          When configured, the Pipeline Engine automatically emails contacts when sequence steps come due. Contacts without email get queued in the Outreach DM Queue instead.{' '}
          <span className="text-gray-500">Free tier: 200 emails/month.</span>
        </p>
        <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
          <li>Sign up free at{' '}
            <a href="https://www.emailjs.com" target="_blank" rel="noopener noreferrer"
              className="text-brand-400 underline">emailjs.com</a>
          </li>
          <li>Add an email service (Gmail, Outlook, etc.)</li>
          <li>Create a template with: <code className="bg-gray-800 px-1 rounded text-[10px]">to_email, to_name, from_name, subject, message</code></li>
          <li>Paste your <strong className="text-gray-300">Public Key</strong>, <strong className="text-gray-300">Service ID</strong>, and <strong className="text-gray-300">Template ID</strong></li>
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
            <span className="text-xs text-gray-300">Credentials saved — click Save &amp; Verify to test</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-900/20 border border-red-700/40">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-xs text-red-300">{errMsg || 'Connection failed — check credentials'}</span>
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

        {/* Test email input */}
        <div>
          <label className="label">Your Email (for test send)</label>
          <div className="flex gap-2">
            <input className="input text-xs flex-1" placeholder="your@email.com"
              value={testEmail} onChange={e => setTestEmail(e.target.value)} />
            {isConfigured && (
              <button
                onClick={handleSendTestToMe}
                disabled={!testEmail.trim() || testStatus === 'sending'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {testStatus === 'sending' ? <><RefreshCw size={11} className="animate-spin" /> Sending…</> :
                 testStatus === 'ok'      ? <><CheckCircle size={11} className="text-green-400" /> Sent!</> :
                 testStatus === 'error'   ? <><AlertCircle size={11} className="text-red-400" /> Failed</> :
                 <><Send size={11} /> Send Test</>}
              </button>
            )}
          </div>
          {testStatus === 'ok' && (
            <p className="text-[10px] text-green-400 mt-1">Test email sent! Check your inbox to confirm.</p>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave}
            disabled={!publicKey.trim() || !serviceId.trim() || !templateId.trim() || status === 'testing'}
            className="btn-primary flex items-center gap-2 flex-1">
            {status === 'testing' ? <><RefreshCw size={13} className="animate-spin" /> Verifying…</> : 'Save & Verify'}
          </button>
          {isConfigured && (
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

// ── Google OAuth (Gmail + Calendar) ──────────────────────────────────────────
function GoogleOAuthSection() {
  const [clientId, setClientId] = useState(localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || '')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState(() => (getGoogleToken() ? 'ok' : localStorage.getItem(GOOGLE_TOKEN_KEY) ? 'expired' : 'empty'))

  // Detect OAuth redirect — token lands in URL hash
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token')) return
    const params = new URLSearchParams(hash.replace('#', ''))
    const token     = params.get('access_token')
    const expiresIn = parseInt(params.get('expires_in') || '3600')
    if (!token) return
    localStorage.setItem(GOOGLE_TOKEN_KEY, token)
    localStorage.setItem(GOOGLE_TOKEN_EXPIRY, String(Date.now() + expiresIn * 1000))
    window.history.replaceState(null, '', window.location.pathname)
    setStatus('ok')
  }, [])

  function saveClientId() {
    localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId.trim())
  }

  function connect() {
    saveClientId()
    const url = buildOAuthURL()
    if (!url) return
    window.location.href = url
  }

  function disconnect() {
    localStorage.removeItem(GOOGLE_TOKEN_KEY)
    localStorage.removeItem(GOOGLE_TOKEN_EXPIRY)
    setStatus('empty')
  }

  const tokenExpiry = parseInt(localStorage.getItem(GOOGLE_TOKEN_EXPIRY) || '0')
  const minutesLeft = status === 'ok' ? Math.round((tokenExpiry - Date.now()) / 60000) : 0

  return (
    <Section title="Gmail Send + Calendar Sync (optional)" icon={Chrome}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Connects your Gmail account so the Pipeline Engine sends outreach emails <strong className="text-white">directly from your inbox</strong> — no EmailJS setup needed. Also auto-logs replies and detects upcoming meetings.
        </p>

        {status === 'ok' && isGmailSendReady() && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-900/20 border border-green-700/40">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-300">
              Connected — auto-sending active · token valid {minutesLeft}m
            </span>
          </div>
        )}
        {status === 'ok' && !isGmailSendReady() && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-yellow-900/20 border border-yellow-700/40">
            <AlertCircle size={14} className="text-yellow-400" />
            <span className="text-xs text-yellow-300">Token expired or missing gmail.send scope — reconnect below</span>
          </div>
        )}
        {status === 'expired' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-yellow-900/20 border border-yellow-700/40">
            <AlertCircle size={14} className="text-yellow-400" />
            <span className="text-xs text-yellow-300">Token expired — reconnect to resume syncing</span>
          </div>
        )}

        <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside leading-relaxed">
          <li>Go to{' '}
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
              className="text-brand-400 underline">Google Cloud Console → Credentials</a>
          </li>
          <li>Create an OAuth 2.0 Client ID for Web Application</li>
          <li>Add <code className="bg-gray-800 px-1 rounded">https://cesandb.github.io</code> to Authorized JavaScript origins</li>
          <li>Add <code className="bg-gray-800 px-1 rounded">https://cesandb.github.io/sales-/settings</code> to redirect URIs</li>
          <li>Enable Gmail API and Calendar API in the project</li>
        </ol>

        <div>
          <label className="label">Google OAuth Client ID</label>
          <div className="relative">
            <input type={show ? 'text' : 'password'} className="input text-xs pr-8"
              placeholder="xxxx.apps.googleusercontent.com" value={clientId}
              onChange={e => setClientId(e.target.value)} />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={connect} disabled={!clientId.trim()}
            className="btn-primary flex items-center gap-2 flex-1">
            <LogIn size={13} /> {status === 'ok' ? 'Reconnect' : 'Connect Google Account'}
          </button>
          {status === 'ok' && (
            <button onClick={disconnect} className="btn-secondary flex items-center gap-1.5">
              <Unlink size={13} /> Disconnect
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-600">Token stored in localStorage only. Expires after 1 hour — reconnect to refresh.</p>
      </div>
    </Section>
  )
}

// ── News API Keys ─────────────────────────────────────────────────────────────
function NewsApisSection() {
  const [newsApiKey, setNewsApiKey]   = useState(localStorage.getItem(NEWSAPI_KEY) || '')
  const [gnewsKey, setGnewsKey]       = useState(localStorage.getItem(GNEWS_KEY) || '')
  const [showNewsApi, setShowNewsApi] = useState(false)
  const [showGnews, setShowGnews]     = useState(false)
  const [newsApiStatus, setNewsApiStatus] = useState(localStorage.getItem(NEWSAPI_KEY) ? 'saved' : 'empty')
  const [gnewsStatus, setGnewsStatus]     = useState(localStorage.getItem(GNEWS_KEY)   ? 'saved' : 'empty')
  const [newsApiErr, setNewsApiErr] = useState('')
  const [gnewsErr, setGnewsErr]     = useState('')

  async function saveNewsApi() {
    if (!newsApiKey.trim()) return
    setNewsApiStatus('testing'); setNewsApiErr('')
    localStorage.setItem(NEWSAPI_KEY, newsApiKey.trim())
    try {
      const url = `https://newsapi.org/v2/everything?q=fitness&pageSize=1&apiKey=${newsApiKey.trim()}`
      let ok = false
      // Try via allorigins proxy first (free tier blocks CORS)
      try {
        const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) })
        if (r.ok) {
          const j = await r.json()
          const d = JSON.parse(j.contents || '{}')
          ok = d.status === 'ok'
          if (!ok) setNewsApiErr(d.message || 'Invalid key')
        }
      } catch { /* try direct */ }
      if (!ok && !newsApiErr) {
        const r = await fetch(url, { signal: AbortSignal.timeout(6000) }).catch(() => null)
        if (r?.ok) { const d = await r.json(); ok = d.status === 'ok' }
      }
      setNewsApiStatus(ok ? 'ok' : 'error')
      if (!ok && !newsApiErr) setNewsApiErr('Could not verify key — check it and try again.')
    } catch (e) {
      setNewsApiStatus('error'); setNewsApiErr(e.message)
    }
  }

  async function saveGnews() {
    if (!gnewsKey.trim()) return
    setGnewsStatus('testing'); setGnewsErr('')
    localStorage.setItem(GNEWS_KEY, gnewsKey.trim())
    try {
      const r = await fetch(`https://gnews.io/api/v4/search?q=fitness&max=1&token=${gnewsKey.trim()}`, { signal: AbortSignal.timeout(8000) })
      if (r.ok) {
        setGnewsStatus('ok')
      } else {
        const d = await r.json().catch(() => ({}))
        setGnewsStatus('error')
        setGnewsErr(d.errors?.[0] || `HTTP ${r.status} — check your key`)
      }
    } catch (e) {
      setGnewsStatus('error'); setGnewsErr(e.message)
    }
  }

  function clearNewsApi() { localStorage.removeItem(NEWSAPI_KEY); setNewsApiKey(''); setNewsApiStatus('empty'); setNewsApiErr('') }
  function clearGnews()   { localStorage.removeItem(GNEWS_KEY);   setGnewsKey('');   setGnewsStatus('empty');   setGnewsErr('') }

  return (
    <Section title="News APIs (optional — 100 req/day free)" icon={Newspaper}>
      <div className="space-y-5">
        <p className="text-xs text-gray-400 leading-relaxed">
          Pulls fitness/supplement news articles as media and content creator leads. Both offer 100 free requests/day — no credit card required.
        </p>

        {/* NewsAPI */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white">NewsAPI.org</p>
            <a href="https://newsapi.org/register" target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1 underline">
              Get free key <ExternalLink size={9} />
            </a>
          </div>
          {newsApiStatus === 'ok' && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-900/20 border border-green-700/40">
              <CheckCircle size={12} className="text-green-400" />
              <span className="text-xs text-green-300">NewsAPI connected — fitness news feed active</span>
            </div>
          )}
          {newsApiStatus === 'error' && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-900/20 border border-red-700/40">
              <AlertCircle size={12} className="text-red-400" />
              <span className="text-xs text-red-300">{newsApiErr}</span>
            </div>
          )}
          <div className="relative">
            <input type={showNewsApi ? 'text' : 'password'} className="input text-xs pr-8"
              placeholder="NewsAPI key…" value={newsApiKey}
              onChange={e => { setNewsApiKey(e.target.value); setNewsApiStatus('empty'); setNewsApiErr('') }} />
            <button type="button" onClick={() => setShowNewsApi(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {showNewsApi ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={saveNewsApi} disabled={!newsApiKey.trim() || newsApiStatus === 'testing'}
              className="btn-primary flex items-center gap-2 flex-1 text-xs">
              {newsApiStatus === 'testing' ? <><RefreshCw size={11} className="animate-spin" /> Testing…</> : 'Save & Test'}
            </button>
            {(newsApiStatus === 'saved' || newsApiStatus === 'ok') && (
              <button onClick={clearNewsApi} className="btn-secondary flex items-center gap-1.5 text-xs">
                <Trash2 size={11} /> Clear
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-800" />

        {/* GNews */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white">GNews.io</p>
            <a href="https://gnews.io/register" target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1 underline">
              Get free key <ExternalLink size={9} />
            </a>
          </div>
          {gnewsStatus === 'ok' && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-900/20 border border-green-700/40">
              <CheckCircle size={12} className="text-green-400" />
              <span className="text-xs text-green-300">GNews connected — fitness news feed active</span>
            </div>
          )}
          {gnewsStatus === 'error' && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-900/20 border border-red-700/40">
              <AlertCircle size={12} className="text-red-400" />
              <span className="text-xs text-red-300">{gnewsErr}</span>
            </div>
          )}
          <div className="relative">
            <input type={showGnews ? 'text' : 'password'} className="input text-xs pr-8"
              placeholder="GNews token…" value={gnewsKey}
              onChange={e => { setGnewsKey(e.target.value); setGnewsStatus('empty'); setGnewsErr('') }} />
            <button type="button" onClick={() => setShowGnews(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {showGnews ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={saveGnews} disabled={!gnewsKey.trim() || gnewsStatus === 'testing'}
              className="btn-primary flex items-center gap-2 flex-1 text-xs">
              {gnewsStatus === 'testing' ? <><RefreshCw size={11} className="animate-spin" /> Testing…</> : 'Save & Test'}
            </button>
            {(gnewsStatus === 'saved' || gnewsStatus === 'ok') && (
              <button onClick={clearGnews} className="btn-secondary flex items-center gap-1.5 text-xs">
                <Trash2 size={11} /> Clear
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-800" />

        {/* Eventbrite */}
        <EventbriteKeyEntry />

        <p className="text-[10px] text-gray-600 leading-relaxed">
          Google News RSS is always active (no key needed). NewsAPI + GNews add more publisher breadth when keys are present. Eventbrite pulls fitness event organizers.
        </p>
      </div>
    </Section>
  )
}

function EventbriteKeyEntry() {
  const [key, setKey] = useState(localStorage.getItem(EVENTBRITE_KEY) || '')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState(localStorage.getItem(EVENTBRITE_KEY) ? 'saved' : 'empty')

  function handleSave() {
    if (!key.trim()) return
    localStorage.setItem(EVENTBRITE_KEY, key.trim())
    setStatus('saved')
  }
  function handleClear() {
    localStorage.removeItem(EVENTBRITE_KEY)
    setKey(''); setStatus('empty')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white">Eventbrite (fitness events)</p>
        <a href="https://www.eventbrite.com/platform/api" target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1 underline">
          Get API key <ExternalLink size={9} />
        </a>
      </div>
      {status === 'saved' && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-900/20 border border-green-700/40">
          <CheckCircle size={12} className="text-green-400" />
          <span className="text-xs text-green-300">Eventbrite key saved — fitness event organizers active</span>
        </div>
      )}
      <div className="relative">
        <input type={show ? 'text' : 'password'} className="input text-xs pr-8"
          placeholder="Eventbrite private token…" value={key}
          onChange={e => { setKey(e.target.value); setStatus('empty') }} />
        <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={!key.trim()}
          className="btn-primary flex items-center gap-2 flex-1 text-xs">Save</button>
        {status === 'saved' && (
          <button onClick={handleClear} className="btn-secondary flex items-center gap-1.5 text-xs">
            <Trash2 size={11} /> Clear
          </button>
        )}
      </div>
    </div>
  )
}

// ── Reddit DM Auto-Send ───────────────────────────────────────────────────────
function RedditDMSection() {
  const [clientId, setClientId] = useState(localStorage.getItem(REDDIT_DM_CLIENT_KEY) || '')
  const [show, setShow]         = useState(false)
  const token = getRedditDMToken()
  const expiry = parseInt(localStorage.getItem(REDDIT_DM_EXPIRY_KEY) || '0')
  const minutesLeft = token ? Math.round((expiry - Date.now()) / 60000) : 0

  function handleConnect() {
    if (!clientId.trim()) return
    localStorage.setItem(REDDIT_DM_CLIENT_KEY, clientId.trim())
    const url = buildRedditDMAuthURL()
    if (url) window.location.href = url
  }

  function handleDisconnect() {
    localStorage.removeItem(REDDIT_DM_TOKEN_KEY)
    localStorage.removeItem(REDDIT_DM_EXPIRY_KEY)
  }

  return (
    <Section title="Reddit DM Auto-Send (optional)" icon={Radio}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Automatically sends Reddit DMs to all <code className="bg-gray-800 px-1 rounded text-[10px]">u/username</code> contacts in your pipeline. Messages are pre-written by the sequence engine — Reddit OAuth sends them without you lifting a finger.
        </p>

        {token ? (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-900/20 border border-green-700/40">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-300">Reddit connected — DM auto-send active · {minutesLeft}m left</span>
          </div>
        ) : (
          <div className="rounded-lg bg-orange-900/10 border border-orange-800/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-orange-300">One-time Reddit app setup:</p>
            <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Go to <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer" className="text-brand-400 underline">reddit.com/prefs/apps</a> → "create another app…"</li>
              <li>Choose <strong className="text-white">installed app</strong>, name it "Phorm CRM"</li>
              <li>Redirect URI: <code className="bg-gray-800 px-1 rounded text-[10px]">https://cesandb.github.io/sales-/settings</code></li>
              <li>Copy the <strong className="text-white">client ID</strong> (under the app name) and paste below</li>
            </ol>
          </div>
        )}

        <div>
          <label className="label">Reddit App Client ID</label>
          <div className="relative">
            <input type={show ? 'text' : 'password'} className="input text-xs pr-8"
              placeholder="Reddit client ID…" value={clientId}
              onChange={e => setClientId(e.target.value)} />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleConnect} disabled={!clientId.trim()}
            className="btn-primary flex items-center gap-2 flex-1">
            <LogIn size={13} /> {token ? 'Reconnect Reddit' : 'Connect Reddit Account'}
          </button>
          {token && (
            <button onClick={handleDisconnect} className="btn-secondary flex items-center gap-1.5">
              <Unlink size={13} /> Disconnect
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-600">Max 3 DMs per 10 min to stay under Reddit rate limits. Token expires in 1h — reconnect to refresh.</p>
      </div>
    </Section>
  )
}

// ── Twilio SMS ────────────────────────────────────────────────────────────────
function TwilioSection() {
  const [sid, setSid]   = useState(localStorage.getItem(TWILIO_SID_KEY) || '')
  const [auth, setAuth] = useState(localStorage.getItem(TWILIO_AUTH_KEY) || '')
  const [from, setFrom] = useState(localStorage.getItem(TWILIO_FROM_KEY) || '')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState(isTwilioReady() ? 'saved' : 'empty')

  function handleSave() {
    if (!sid.trim() || !auth.trim() || !from.trim()) return
    localStorage.setItem(TWILIO_SID_KEY, sid.trim())
    localStorage.setItem(TWILIO_AUTH_KEY, auth.trim())
    localStorage.setItem(TWILIO_FROM_KEY, from.trim())
    setStatus('saved')
  }

  function handleClear() {
    localStorage.removeItem(TWILIO_SID_KEY)
    localStorage.removeItem(TWILIO_AUTH_KEY)
    localStorage.removeItem(TWILIO_FROM_KEY)
    setSid(''); setAuth(''); setFrom(''); setStatus('empty')
  }

  return (
    <Section title="Twilio SMS Auto-Send (optional)" icon={Phone}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Sends real SMS messages to contacts with phone numbers. The Pipeline Engine automatically texts sequence steps — ~$0.008/message on Twilio pay-as-you-go.{' '}
          <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer"
            className="text-brand-400 underline inline-flex items-center gap-1">
            Free trial includes $15 credit <ExternalLink size={10} />
          </a>
        </p>

        {status === 'saved' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-900/20 border border-green-700/40">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-300">Twilio connected — SMS auto-send active</span>
          </div>
        )}

        <div className="space-y-2">
          <div>
            <label className="label">Account SID</label>
            <input className="input text-xs" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={sid} onChange={e => { setSid(e.target.value); setStatus('empty') }} />
          </div>
          <div>
            <label className="label">Auth Token</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} className="input text-xs pr-8"
                placeholder="Auth token…" value={auth}
                onChange={e => { setAuth(e.target.value); setStatus('empty') }} />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {show ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">From Phone Number</label>
            <input className="input text-xs" placeholder="+15551234567"
              value={from} onChange={e => { setFrom(e.target.value); setStatus('empty') }} />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!sid.trim() || !auth.trim() || !from.trim()}
            className="btn-primary flex items-center gap-2 flex-1">Save Twilio Credentials</button>
          {status === 'saved' && (
            <button onClick={handleClear} className="btn-secondary flex items-center gap-1.5">
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-600">Rate limited to 5 SMS/min. Max 160 chars per message to avoid splitting.</p>
      </div>
    </Section>
  )
}

// ── Apollo.io Contact Import ──────────────────────────────────────────────────
function ApolloSection() {
  const [key, setKey]     = useState(localStorage.getItem(APOLLO_KEY) || '')
  const [show, setShow]   = useState(false)
  const [status, setStatus] = useState(localStorage.getItem(APOLLO_KEY) ? 'saved' : 'empty')

  function handleSave() {
    if (!key.trim()) return
    localStorage.setItem(APOLLO_KEY, key.trim())
    setStatus('saved')
  }

  function handleClear() {
    localStorage.removeItem(APOLLO_KEY)
    setKey(''); setStatus('empty')
  }

  const masked = key ? key.slice(0, 6) + '…' + key.slice(-4) : ''

  return (
    <Section title="Apollo.io Contact Import (optional)" icon={Zap}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Apollo has 265M+ verified B2C/B2B contacts. With your API key, the Sales Engine automatically imports 25 fitness professionals per hour — personal trainers, nutrition coaches, gym owners — with verified emails, phones, and LinkedIn.{' '}
          <a href="https://app.apollo.io/#/settings/integrations/api" target="_blank" rel="noopener noreferrer"
            className="text-brand-400 underline inline-flex items-center gap-1">
            Get API key <ExternalLink size={10} />
          </a>
        </p>

        {status === 'saved' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-900/20 border border-green-700/40">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-300">Apollo key saved ({masked}) — auto-import active · 25 leads/hour</span>
          </div>
        )}

        <div className="rounded-lg bg-gray-900/50 border border-gray-800 p-3 space-y-1">
          <p className="text-[10px] font-semibold text-gray-400">What gets auto-imported:</p>
          <ul className="text-[10px] text-gray-500 space-y-0.5 list-disc list-inside">
            <li>Personal trainers, fitness coaches, nutritionists, gym owners</li>
            <li>Verified emails + phone numbers included where available</li>
            <li>Tagged <code className="bg-gray-800 px-0.5 rounded">apollo-import</code> + <code className="bg-gray-800 px-0.5 rounded">fitness-pro</code></li>
            <li>Auto-enrolled in Cold Intro sequence within 24h</li>
          </ul>
        </div>

        <div className="relative">
          <input type={show ? 'text' : 'password'} className="input pr-10"
            placeholder="Apollo.io API key…" value={key}
            onChange={e => { setKey(e.target.value); setStatus('empty') }} />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!key.trim()}
            className="btn-primary flex items-center gap-2 flex-1">Save Apollo Key</button>
          {status === 'saved' && (
            <button onClick={handleClear} className="btn-secondary flex items-center gap-1.5">
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-600">Free tier: 10,000 export credits/month. Paginated — fetches next page of results each hour.</p>
      </div>
    </Section>
  )
}

// ── Hunter.io Email Enrichment ────────────────────────────────────────────────
function HunterSection() {
  const [key, setKey]   = useState(localStorage.getItem(HUNTER_KEY) || '')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState(localStorage.getItem(HUNTER_KEY) ? 'saved' : 'empty')

  function handleSave() {
    if (!key.trim()) return
    saveHunterKey(key.trim())
    setStatus('saved')
  }
  function handleClear() {
    clearHunterKey()
    setKey('')
    setStatus('empty')
  }

  const masked = key ? key.slice(0, 6) + '…' + key.slice(-4) : ''

  return (
    <Section title="Hunter.io Email Enrichment (optional)" icon={AtSign}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Hunter.io automatically finds email addresses for contacts who only have a social handle or website.
          The Sales Automation Engine tries to enrich up to 5 contacts per run.{' '}
          <a href="https://hunter.io/users/sign_up" target="_blank" rel="noopener noreferrer"
            className="text-brand-400 hover:text-brand-300 underline inline-flex items-center gap-1">
            Free tier: 25 searches/mo <ExternalLink size={10} />
          </a>
        </p>
        {status === 'saved' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-900/20 border border-green-700/40">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-300">Hunter.io key saved ({masked}) — email enrichment active</span>
          </div>
        )}
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            className="input pr-10"
            placeholder="Hunter.io API key…"
            value={key}
            onChange={e => { setKey(e.target.value); setStatus('empty') }}
          />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!key.trim()}
            className="btn-primary flex items-center gap-2 flex-1">Save Key</button>
          {status === 'saved' && (
            <button onClick={handleClear} className="btn-secondary flex items-center gap-1.5">
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
        <div className="rounded-lg bg-gray-900/50 border border-gray-800 p-3 space-y-1">
          <p className="text-[10px] font-semibold text-gray-400">What gets enriched automatically:</p>
          <ul className="text-[10px] text-gray-500 space-y-0.5 list-disc list-inside">
            <li>Contacts with a domain social (healthline.com, menshealth.com, etc.)</li>
            <li>GitHub, Medium, Dev.to, HackerNews profiles with identifiable names</li>
            <li>Only contacts missing an email address are enriched</li>
            <li>Minimum 50% confidence score required before saving</li>
          </ul>
        </div>
      </div>
    </Section>
  )
}

// ── LinkedIn Bookmarklet ──────────────────────────────────────────────────────
const LI_BOOKMARKLET = `javascript:(function(){var h=window.location.href;var m=h.match(/linkedin\\.com\\/in\\/([a-zA-Z0-9_-]+)/);if(!m){alert('Phorm CRM: Navigate to a LinkedIn profile page (linkedin.com/in/username) first');return;}var u=m[1];var n='';try{n=(document.querySelector('h1')||{}).textContent||'';}catch(e){}window.open('${APP_URL}/acquire?li='+encodeURIComponent(u)+'&liname='+encodeURIComponent(n.trim()||u),'_blank');})();`

function LinkedInBookmarkletSection() {
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(LI_BOOKMARKLET)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Section title="LinkedIn Bookmarklet" icon={Linkedin}>
      <div className="space-y-4">
        <p className="text-xs text-gray-400 leading-relaxed">
          Browse LinkedIn as normal. When you find a fitness professional, personal trainer, or coach — click this bookmarklet to send their profile straight into Quick Add. Zero copy-paste.
        </p>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white">One-time setup:</p>
          <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>Click <strong className="text-white">Copy Code</strong> below</li>
            <li>Open bookmarks bar (Cmd+Shift+B)</li>
            <li>Right-click → <strong className="text-white">Add page</strong> → paste code as URL</li>
            <li>Name it <strong className="text-white">+ Phorm LinkedIn</strong>, save</li>
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
            {LI_BOOKMARKLET.slice(0, 120)}…
          </p>
        </div>
        <div className="rounded-lg bg-blue-900/10 border border-blue-800/30 px-4 py-3">
          <p className="text-xs text-blue-300 font-semibold mb-1">How it works</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Navigate to <code className="bg-gray-800 px-1 rounded">linkedin.com/in/username</code> → click bookmarklet → Phorm CRM opens with their name and LinkedIn handle pre-filled in Quick Add → hit "Add Contact."
          </p>
        </div>
      </div>
    </Section>
  )
}

// ── Outreach Send Window ──────────────────────────────────────────────────────
function SendWindowSection() {
  const [enabled, setEnabled] = useState(localStorage.getItem(SEND_WINDOW_KEY) === 'true')
  const [start,   setStart]   = useState(parseInt(localStorage.getItem(SEND_START_KEY) || '8'))
  const [end,     setEnd]     = useState(parseInt(localStorage.getItem(SEND_END_KEY)   || '20'))
  const [saved, setSaved]     = useState(false)

  function handleSave() {
    localStorage.setItem(SEND_WINDOW_KEY, enabled ? 'true' : 'false')
    localStorage.setItem(SEND_START_KEY,  String(start))
    localStorage.setItem(SEND_END_KEY,    String(end))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const fmt = h => {
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12  = h % 12 || 12
    return `${h12}:00 ${ampm}`
  }

  return (
    <Section title="Outreach Send Window" icon={Clock}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Limit auto-send to specific hours. Outreach sent during business hours gets higher open rates and fewer spam flags than messages sent at 3am.
        </p>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 accent-brand-500"
          />
          <span className="text-sm text-white font-medium">Restrict sends to a time window</span>
        </label>

        {enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Send After</label>
              <select className="input text-xs" value={start} onChange={e => setStart(parseInt(e.target.value))}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{fmt(i)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Stop After</label>
              <select className="input text-xs" value={end} onChange={e => setEnd(parseInt(e.target.value))}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{fmt(i)}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {enabled && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-900/20 border border-blue-700/40">
            <Clock size={13} className="text-blue-400 shrink-0" />
            <span className="text-xs text-blue-300">
              Auto-send active {fmt(start)} – {fmt(end)} · skips outside this window
            </span>
          </div>
        )}

        <button onClick={handleSave}
          className={`btn-primary w-full flex items-center justify-center gap-2 ${saved ? 'bg-green-700 hover:bg-green-700' : ''}`}>
          {saved ? <><CheckCircle size={13} /> Saved!</> : 'Save Schedule'}
        </button>
      </div>
    </Section>
  )
}

// ── Daily Digest ──────────────────────────────────────────────────────────────
function DigestSection() {
  const [url, setUrl]   = useState(localStorage.getItem(DIGEST_WEBHOOK_KEY) || '')
  const [type, setType] = useState(localStorage.getItem(DIGEST_TYPE_KEY) || 'discord')
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)
  const lastSent = localStorage.getItem(DIGEST_LAST_SENT_KEY) || ''
  const isConfigured = !!localStorage.getItem(DIGEST_WEBHOOK_KEY)

  function handleSave() {
    if (!url.trim()) return
    localStorage.setItem(DIGEST_WEBHOOK_KEY, url.trim())
    localStorage.setItem(DIGEST_TYPE_KEY, type)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleClear() {
    localStorage.removeItem(DIGEST_WEBHOOK_KEY)
    localStorage.removeItem(DIGEST_LAST_SENT_KEY)
    localStorage.removeItem(DIGEST_TYPE_KEY)
    setUrl(''); setType('discord'); setSaved(false)
  }

  return (
    <Section title="Daily Digest (Discord / Slack)" icon={MessageSquare}>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Sends a morning summary to a Discord channel or Slack workspace — new leads, emails sent, pipeline value, and top follow-ups for the day.
        </p>

        {isConfigured && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-900/20 border border-green-700/40">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-300">
              Digest active · {lastSent ? `last sent ${lastSent}` : 'not yet sent today'}
            </span>
          </div>
        )}

        <div className="flex gap-4">
          {['discord', 'slack'].map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="digest-type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="accent-brand-500"
              />
              <span className="text-xs text-gray-300 capitalize">{t}</span>
            </label>
          ))}
        </div>

        <div>
          <label className="label">Webhook URL</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              className="input text-xs pr-8"
              placeholder={type === 'discord' ? 'https://discord.com/api/webhooks/…' : 'https://hooks.slack.com/services/…'}
              value={url}
              onChange={e => { setUrl(e.target.value); setSaved(false) }}
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-gray-900/50 border border-gray-800 p-3 space-y-1">
          <p className="text-[10px] font-semibold text-gray-400">Daily digest includes:</p>
          <ul className="text-[10px] text-gray-500 space-y-0.5 list-disc list-inside">
            <li>New leads added + hot leads / opportunities count</li>
            <li>Emails, DMs, and new imports in the last 24h</li>
            <li>Active pipeline value + commissions earned</li>
            <li>Due follow-ups + top 3 contacts to reach today</li>
          </ul>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!url.trim()}
            className={`btn-primary flex items-center gap-2 flex-1 ${saved ? 'bg-green-700 hover:bg-green-700' : ''}`}>
            {saved ? <><CheckCircle size={13} /> Saved!</> : 'Save Webhook'}
          </button>
          {isConfigured && (
            <button onClick={handleClear} className="btn-secondary flex items-center gap-1.5">
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-600">Sends once per day, ~2 min after app loads. Skips if already sent today.</p>
      </div>
    </Section>
  )
}

// ── AI Icebreaker Personalizer ────────────────────────────────────────────────
function AIPersonalizerSection() {
  const isEnabled = !!getApiKey()

  return (
    <Section title="AI Icebreaker Personalizer" icon={Sparkles}>
      <div className="space-y-3">
        {isEnabled ? (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-900/20 border border-green-700/40">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-300">Active — prepending personalized icebreakers to all outreach</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-800/60 border border-gray-700">
            <AlertCircle size={14} className="text-gray-400" />
            <span className="text-xs text-gray-400">Add your Anthropic API key above to enable</span>
          </div>
        )}

        <p className="text-xs text-gray-400 leading-relaxed">
          Uses Claude Haiku to generate a unique opening line for each outreach message, referencing the contact's notes, interests, and platform. Every email and DM starts with something specific to them — not a template.
        </p>

        <div className="rounded-lg bg-gray-900/50 border border-gray-800 p-3 space-y-2">
          <p className="text-[10px] font-semibold text-gray-400">Example icebreakers generated:</p>
          <ul className="text-[10px] text-gray-500 space-y-1 list-disc list-inside italic">
            <li>"Saw your marathon PR — that kind of dedication is rare."</li>
            <li>"Your meal prep content has been super inspiring to follow."</li>
            <li>"Love the detail in your supplement review posts."</li>
          </ul>
        </div>

        <p className="text-[10px] text-gray-600">
          Results cached per contact — same contact reuses the same icebreaker. ~80 tokens via Claude Haiku (~$0.0001 each).
        </p>
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
        <AIPersonalizerSection />
        <InstagramBookmarkletSection />
        <LinkedInBookmarkletSection />
        <GoogleOAuthSection />
        <RedditDMSection />
        <TwilioSection />
        <ApolloSection />
        <YouTubeSection />
        <RedditSection />
        <NewsApisSection />
        <EmailJSSection />
        <HunterSection />
        <DigestSection />
        <SendWindowSection />
        <NotificationsSection />
        <OutreachSection />
        <DataSection />
        <SecuritySection />
      </div>
    </div>
  )
}
