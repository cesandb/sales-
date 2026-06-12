import { useState, useRef, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { generateProspectingStrategy, getApiKey } from '../utils/aiDraft'
import {
  SOURCE_CONFIGS, getEngineConfig, saveEngineConfig, getLog,
} from '../utils/autoAcquire'
import {
  UserPlus, Clipboard, Smartphone, Instagram, RefreshCw,
  CheckCircle2, AlertCircle, Sparkles, Copy, ExternalLink,
  Target, Hash, Users, ChevronDown, ChevronUp, Upload, Zap,
  MapPin, MessageSquare, Search, Building2, HelpCircle, Youtube, Globe, Trophy,
  Code2, Rss, BrainCircuit, Radio, Star, Play, Pause,
} from 'lucide-react'

const SOURCES = ['Instagram', 'Facebook', 'TikTok', 'Twitter/X', 'YouTube', 'WhatsApp', 'Referral', 'In Person', 'Email', 'Other']
const GOOGLE_KEY_STORAGE = 'phorm_google_api_key'
const RUNSIGNUP_KEY_STORAGE = 'phorm_runsignup_key'
const RUNSIGNUP_SECRET_STORAGE = 'phorm_runsignup_secret'
const EVENTBRITE_KEY_STORAGE = 'phorm_eventbrite_key'
const STATUS_COLOR = {
  'New Lead': 'bg-blue-900/40 text-blue-300',
  'Warm Lead': 'bg-yellow-900/40 text-yellow-300',
}

// ── Smart text parser ─────────────────────────────────────────────────────────
function parseContactsFromText(raw) {
  const lines = raw.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean)
  return lines.map(line => {
    const contact = { status: 'New Lead', source: '' }

    // Email
    const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    if (emailMatch) {
      contact.email = emailMatch[0]
      const nameRaw = line.replace(emailMatch[0], '').replace(/[<>()[\]]/g, '').trim()
      if (nameRaw) contact.name = nameRaw
      contact.source = 'Email'
    }

    // Phone number (10+ digits, possibly formatted)
    const phoneMatch = line.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/)
    if (phoneMatch && !contact.email) {
      contact.phone = phoneMatch[0].trim()
      const nameRaw = line.replace(phoneMatch[0], '').replace(/[-–—]/g, '').trim()
      if (nameRaw) contact.name = nameRaw
      contact.source = 'Text/SMS'
    }

    // @handle — could be Instagram, TikTok, Twitter/X
    const handleMatch = line.match(/@([a-zA-Z0-9._]+)/)
    if (handleMatch) {
      contact.social = '@' + handleMatch[1]
      if (!contact.source) contact.source = 'Instagram'
      const nameRaw = line.replace(handleMatch[0], '').replace(/[-–—|:]/g, '').trim()
      if (nameRaw && !contact.name) contact.name = nameRaw
    }

    // If still no name, use the whole line (cleaned up)
    if (!contact.name) {
      const cleaned = line.replace(/@\S+/, '').replace(/https?:\/\/\S+/g, '').replace(/[<>]/g, '').trim()
      if (cleaned.length > 1 && cleaned.length < 60) contact.name = cleaned
    }

    // Instagram URL
    const igUrl = line.match(/instagram\.com\/([a-zA-Z0-9._]+)/)
    if (igUrl) {
      contact.social = '@' + igUrl[1]
      contact.source = 'Instagram'
      if (!contact.name) contact.name = igUrl[1]
    }

    // TikTok URL
    const ttUrl = line.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/)
    if (ttUrl) {
      contact.social = '@' + ttUrl[1]
      contact.source = 'TikTok'
      if (!contact.name) contact.name = ttUrl[1]
    }

    // Facebook URL
    const fbUrl = line.match(/facebook\.com\/([a-zA-Z0-9._]+)/)
    if (fbUrl) {
      contact.social = fbUrl[1]
      contact.source = 'Facebook'
      if (!contact.name) contact.name = fbUrl[1]
    }

    return contact
  }).filter(c => c.name || c.social || c.phone || c.email)
}

// ── Parse Instagram data export ───────────────────────────────────────────────
function parseInstagramExport(jsonText) {
  try {
    const data = JSON.parse(jsonText)
    // following.json format
    const list = data?.relationships_following || data?.relationships_followers || []
    return list.flatMap(item => {
      const entries = item?.string_list_data || []
      return entries.map(e => ({
        name: e.value,
        social: '@' + e.value,
        source: 'Instagram',
        status: 'New Lead',
      }))
    }).filter(c => c.name)
  } catch {
    return []
  }
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, subtitle, icon: Icon, children, defaultOpen = true, badge, badgeColor }) {
  const [open, setOpen] = useState(defaultOpen)
  const badgeCls = badgeColor || 'bg-brand-700/40 text-brand-300'
  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-800 hover:bg-gray-800/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-900/30 border border-brand-700/30">
            <Icon size={15} className="text-brand-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">{title}</span>
              {badge && <span className={`badge text-[10px] ${badgeCls}`}>{badge}</span>}
            </div>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-500" /> : <ChevronDown size={15} className="text-gray-500" />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  )
}

// ── Quick Add ─────────────────────────────────────────────────────────────────
function QuickAddSection() {
  const { addContact } = useStore()
  const [form, setForm] = useState({ name: '', social: '', phone: '', source: 'Instagram', status: 'New Lead', notes: '' })
  const [saved, setSaved] = useState(false)

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  function getDMUrl() {
    const handle = (form.social || '').replace(/^@/, '')
    const phone = (form.phone || '').replace(/\D/g, '')
    if (form.source === 'Instagram' && handle) return `https://ig.me/m/${handle}`
    if (form.source === 'Facebook' && handle) return `https://m.me/${handle}`
    if (form.source === 'WhatsApp' && phone) return `https://wa.me/${phone}`
    if (form.source === 'TikTok' && handle) return `https://www.tiktok.com/@${handle}`
    if (form.source === 'Twitter/X' && handle) return `https://x.com/${handle}`
    if (form.phone) return `sms:${form.phone}`
    return null
  }

  function save() {
    if (!form.name.trim()) return
    addContact({ ...form })
    setSaved(true)
    setTimeout(() => {
      setForm({ name: '', social: '', phone: '', source: 'Instagram', status: 'New Lead', notes: '' })
      setSaved(false)
    }, 1500)
  }

  const dmUrl = getDMUrl()

  return (
    <Section title="Quick Add" subtitle="Capture a contact in seconds — then DM them immediately" icon={UserPlus}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Name *</label>
          <input className="input" value={form.name} onChange={f('name')} placeholder="Full name" />
        </div>
        <div>
          <label className="label">Source / Platform</label>
          <select className="input" value={form.source} onChange={f('source')}>
            {SOURCES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Social Handle</label>
          <input className="input" value={form.social} onChange={f('social')} placeholder="@username" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={f('phone')} placeholder="+1 555-000-0000" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">First impression / notes</label>
          <input className="input" value={form.notes} onChange={f('notes')} placeholder="Where you found them, what they post about…" />
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={save}
          disabled={!form.name.trim() || saved}
          className="btn-primary flex items-center gap-2 flex-1"
        >
          {saved ? <CheckCircle2 size={14} className="text-green-300" /> : <UserPlus size={14} />}
          {saved ? 'Saved!' : 'Add Contact'}
        </button>
        {dmUrl && (
          <a
            href={dmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-700/30 text-brand-400 hover:bg-brand-600/40 text-sm font-semibold transition-colors"
          >
            <ExternalLink size={14} /> Open DM
          </a>
        )}
      </div>
    </Section>
  )
}

// ── Paste Importer ────────────────────────────────────────────────────────────
function PasteImportSection() {
  const { addContact, contacts } = useStore()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [imported, setImported] = useState(false)
  const [source, setSource] = useState('Instagram')

  function parse() {
    const results = parseContactsFromText(text)
    // Apply selected source to any that don't have one
    const enriched = results.map(c => ({ ...c, source: c.source || source }))
    const existingSocials = new Set(contacts.map(c => c.social).filter(Boolean))
    const existingNames = new Set(contacts.map(c => c.name.toLowerCase()))
    const deduped = enriched.filter(c =>
      !(c.social && existingSocials.has(c.social)) &&
      !(c.name && existingNames.has(c.name.toLowerCase()))
    )
    setParsed({ all: enriched, new: deduped })
  }

  function importAll() {
    parsed.new.forEach(c => addContact(c))
    setImported(true)
    setTimeout(() => { setText(''); setParsed(null); setImported(false) }, 2500)
  }

  return (
    <Section
      title="Paste & Import"
      subtitle="Paste any list — names, @handles, phone numbers, profile URLs, one per line"
      icon={Clipboard}
    >
      {!imported ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Default Source</label>
              <select className="input" value={source} onChange={e => setSource(e.target.value)}>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Paste your list here</label>
            <textarea
              className="input min-h-40 resize-none font-mono text-xs"
              value={text}
              onChange={e => { setText(e.target.value); setParsed(null) }}
              placeholder={`Examples — paste anything:\n@john_fitness\nJane Smith | @janefit | DM about fat loss\n+1 (555) 234-5678 — Mike from gym\nhttps://instagram.com/sarah.lifts\njohn.doe@email.com\nAlex Johnson`}
            />
          </div>

          {text.trim() && !parsed && (
            <button onClick={parse} className="btn-primary flex items-center gap-2 w-full justify-center">
              <Sparkles size={14} /> Parse {text.split('\n').filter(l => l.trim()).length} lines
            </button>
          )}

          {parsed && (
            <div className="space-y-3">
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${parsed.new.length > 0 ? 'bg-green-900/20 border-green-700/40' : 'bg-gray-800 border-gray-700'}`}>
                <CheckCircle2 size={16} className={parsed.new.length > 0 ? 'text-green-400' : 'text-gray-500'} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{parsed.new.length} new contacts ready to import</p>
                  {parsed.all.length - parsed.new.length > 0 && (
                    <p className="text-xs text-gray-500">{parsed.all.length - parsed.new.length} skipped (already in CRM)</p>
                  )}
                </div>
                <button onClick={() => setParsed(null)} className="text-xs text-gray-500 hover:text-white underline">Reset</button>
              </div>

              {parsed.new.length > 0 && (
                <div className="max-h-56 overflow-y-auto space-y-1 border border-gray-800 rounded-lg p-2">
                  {parsed.new.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/40">
                      <div className="w-6 h-6 rounded-full bg-brand-700/30 flex items-center justify-center text-brand-300 text-[10px] font-bold flex-shrink-0">
                        {(c.name || c.social || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{c.name || c.social}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {[c.social, c.phone, c.email].filter(Boolean).join(' · ')}
                          {c.source && ` · ${c.source}`}
                        </p>
                      </div>
                      <span className={`badge text-[10px] ${STATUS_COLOR[c.status] || 'bg-gray-800 text-gray-400'}`}>{c.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {parsed.new.length > 0 && (
                <button onClick={importAll} className="btn-primary flex items-center gap-2 w-full justify-center">
                  <Users size={14} /> Import {parsed.new.length} Contacts
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 space-y-2">
          <CheckCircle2 size={36} className="text-green-400 mx-auto" />
          <p className="text-white font-bold">{parsed?.new.length} contacts added!</p>
          <p className="text-sm text-gray-400">Head to Outreach Queue to start messaging them.</p>
        </div>
      )}
    </Section>
  )
}

// ── Instagram Export Importer ─────────────────────────────────────────────────
function InstagramImportSection() {
  const { addContact, contacts } = useStore()
  const fileRef = useRef()
  const [parsed, setParsed] = useState(null)
  const [imported, setImported] = useState(false)
  const [error, setError] = useState('')

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = ev => {
      const results = parseInstagramExport(ev.target.result)
      if (!results.length) {
        setError("Couldn't parse this file. Make sure it's following.json or followers_1.json from your Instagram data download.")
        return
      }
      const existingSocials = new Set(contacts.map(c => c.social).filter(Boolean))
      const deduped = results.filter(c => !existingSocials.has(c.social))
      setParsed({ all: results, new: deduped })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function importAll() {
    parsed.new.forEach(c => addContact(c))
    setImported(true)
    setTimeout(() => { setParsed(null); setImported(false) }, 2500)
  }

  return (
    <Section
      title="Instagram Data Import"
      subtitle="Import your Instagram following/followers list from your data download"
      icon={Instagram}
      defaultOpen={false}
    >
      {!imported ? (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 text-xs text-gray-300 space-y-1.5">
            <p className="font-semibold text-white">How to get your Instagram data:</p>
            <ol className="space-y-1 list-decimal list-inside text-gray-400">
              <li>Instagram app → Profile → Menu (☰) → Your Activity</li>
              <li>Download Your Information → Request Download</li>
              <li>Choose JSON format, select "Followers and Following"</li>
              <li>Download the ZIP, open it, upload <span className="font-mono text-brand-300">following.json</span></li>
            </ol>
          </div>

          {!parsed ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 py-8 rounded-xl border-2 border-dashed border-gray-700 hover:border-brand-600 hover:bg-brand-900/5 transition-colors"
            >
              <Upload size={24} className="text-gray-500" />
              <div className="text-center">
                <p className="text-white font-semibold text-sm">Upload following.json or followers_1.json</p>
                <p className="text-xs text-gray-500 mt-0.5">From your Instagram data download</p>
              </div>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-900/20 border border-green-700/40">
                <CheckCircle2 size={16} className="text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{parsed.new.length} new accounts ready to import</p>
                  <p className="text-xs text-gray-500">
                    {parsed.all.length} total found · {parsed.all.length - parsed.new.length} already in CRM
                  </p>
                </div>
                <button onClick={() => setParsed(null)} className="text-xs text-gray-500 hover:text-white underline">Reset</button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5 border border-gray-800 rounded-lg p-2">
                {parsed.new.slice(0, 20).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 px-2 text-sm">
                    <span className="text-gray-500 text-xs w-5">{i + 1}</span>
                    <span className="text-brand-300 font-mono text-xs">{c.social}</span>
                  </div>
                ))}
                {parsed.new.length > 20 && <p className="text-center text-xs text-gray-600 py-1">…and {parsed.new.length - 20} more</p>}
              </div>
              <button onClick={importAll} className="btn-primary flex items-center gap-2 w-full justify-center">
                <Users size={14} /> Import {parsed.new.length} Instagram Contacts
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/40">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
        </div>
      ) : (
        <div className="text-center py-6 space-y-2">
          <CheckCircle2 size={36} className="text-green-400 mx-auto" />
          <p className="text-white font-bold">{parsed?.new.length} Instagram accounts imported!</p>
        </div>
      )}
    </Section>
  )
}

// ── Phone Contacts Importer ───────────────────────────────────────────────────
function PhoneContactsSection() {
  const { addContact, contacts } = useStore()
  const [parsed, setParsed] = useState(null)
  const [loading, setLoading] = useState(false)
  const [imported, setImported] = useState(false)
  const [error, setError] = useState('')

  const supported = 'contacts' in navigator && 'ContactsManager' in window

  async function pick() {
    setLoading(true); setError('')
    try {
      const props = ['name', 'tel', 'email']
      const raw = await navigator.contacts.select(props, { multiple: true })
      if (!raw.length) { setLoading(false); return }

      const existingPhones = new Set(contacts.map(c => c.phone).filter(Boolean))
      const existingNames = new Set(contacts.map(c => c.name.toLowerCase()))

      const mapped = raw
        .map(c => ({
          name: c.name?.[0] || '',
          phone: c.tel?.[0] || '',
          email: c.email?.[0] || '',
          source: 'In Person',
          status: 'New Lead',
        }))
        .filter(c => c.name)

      const deduped = mapped.filter(c =>
        !(c.phone && existingPhones.has(c.phone)) &&
        !existingNames.has(c.name.toLowerCase())
      )
      setParsed({ all: mapped, new: deduped })
    } catch (e) {
      setError('Contact access denied or unavailable on this device.')
    }
    setLoading(false)
  }

  function importAll() {
    parsed.new.forEach(c => addContact(c))
    setImported(true)
    setTimeout(() => { setParsed(null); setImported(false) }, 2500)
  }

  return (
    <Section
      title="Phone Contacts"
      subtitle="Import directly from your device's contact list (Chrome on Android)"
      icon={Smartphone}
      defaultOpen={false}
      badge={supported ? 'Available' : 'Mobile Only'}
    >
      {!imported ? (
        <div className="space-y-4">
          {!supported ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
              <AlertCircle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white font-semibold">Available on Android Chrome</p>
                <p className="text-xs text-gray-400 mt-0.5">Open this app in Chrome on your Android phone to import contacts directly from your device's contact list. iOS and desktop browsers don't support this API yet.</p>
              </div>
            </div>
          ) : !parsed ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-300">Tap the button below to open your phone's contact picker. You can select multiple contacts at once — they'll be imported as New Leads.</p>
              <button
                onClick={pick}
                disabled={loading}
                className="btn-primary flex items-center gap-2 w-full justify-center"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Smartphone size={14} />}
                {loading ? 'Opening contacts…' : 'Open Phone Contacts'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-900/20 border border-green-700/40">
                <CheckCircle2 size={16} className="text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{parsed.new.length} new contacts selected</p>
                  <p className="text-xs text-gray-500">{parsed.all.length - parsed.new.length} already in CRM</p>
                </div>
                <button onClick={() => setParsed(null)} className="text-xs text-gray-500 hover:text-white underline">Reset</button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-800 rounded-lg p-2">
                {parsed.new.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-2">
                    <div className="w-6 h-6 rounded-full bg-brand-700/30 flex items-center justify-center text-brand-300 text-[10px] font-bold flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={importAll} className="btn-primary flex items-center gap-2 w-full justify-center">
                <Users size={14} /> Import {parsed.new.length} Contacts
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="text-center py-6 space-y-2">
          <CheckCircle2 size={36} className="text-green-400 mx-auto" />
          <p className="text-white font-bold">{parsed?.new.length} contacts imported from your phone!</p>
        </div>
      )}
    </Section>
  )
}

// ── Shared API key input ──────────────────────────────────────────────────────
function ApiKeyInput({ value, onChange, onSave, placeholder = 'Paste your key…' }) {
  return (
    <div className="flex gap-2">
      <input className="input flex-1 font-mono text-xs" type="password" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSave()} />
      <button onClick={onSave} disabled={!value.trim()} className="btn-primary flex items-center gap-2 flex-shrink-0 px-3 text-sm">
        <CheckCircle2 size={13} /> Save
      </button>
    </div>
  )
}

// ── Reddit Intent Scanner ─────────────────────────────────────────────────────
function RedditScannerSection() {
  const { addContact, contacts } = useStore()
  const [subreddit, setSubreddit] = useState('fitness')
  const [query, setQuery] = useState('looking for supplement recommendation')
  const [posts, setPosts] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  const SUBREDDITS = ['fitness', 'loseit', 'gainit', 'bodybuilding', 'Supplements', 'xxfitness', 'running', '1stphorm']
  const QUICK = [
    { label: 'Supplement help', query: 'looking for supplement recommendation' },
    { label: 'Protein powder', query: 'best protein powder recommend' },
    { label: 'Weight loss', query: 'need help losing weight supplement' },
    { label: 'Pre-workout', query: 'pre workout recommendation help' },
    { label: 'Fat burner', query: 'fat burner thermogenic recommend' },
    { label: 'Energy', query: 'energy supplement tired all day' },
  ]

  const existingSocials = new Set(contacts.map(c => c.social).filter(Boolean))

  async function scan() {
    setLoading(true); setError(''); setPosts(null)
    try {
      const directUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=new&t=month&limit=25&restrict_sr=1`
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl)}`
      const res = await fetch(proxyUrl)
      if (!res.ok) throw new Error(`${res.status}`)
      const wrapper = await res.json()
      const data = JSON.parse(wrapper.contents)
      const found = (data?.data?.children || [])
        .map(c => c.data)
        .filter(p => p.author && p.author !== '[deleted]' && p.author !== 'AutoModerator')
        .slice(0, 15)
        .map(p => ({
          id: p.id,
          author: p.author,
          title: p.title,
          selftext: (p.selftext || '').slice(0, 160),
          subreddit: p.subreddit,
          permalink: `https://reddit.com${p.permalink}`,
          created: new Date(p.created_utc * 1000).toLocaleDateString(),
        }))
      setPosts(found)
    } catch (e) {
      setError('Could not reach Reddit — ' + (e.message || 'check your connection and try again.'))
    }
    setLoading(false)
  }

  function addPost(post) {
    const handle = 'u/' + post.author
    addContact({
      name: post.author,
      social: handle,
      source: 'Other',
      status: 'New Lead',
      notes: `Reddit r/${post.subreddit}: "${post.title.slice(0, 120)}"`,
      tags: ['reddit', 'intent-signal'],
    })
    setAdded(prev => new Set([...prev, post.id]))
  }

  return (
    <Section
      title="Reddit Intent Scanner"
      subtitle="Find people actively asking about fitness & supplements — warm leads who need what you sell"
      icon={Search}
      defaultOpen={false}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Subreddit</label>
            <select className="input" value={subreddit} onChange={e => setSubreddit(e.target.value)}>
              {SUBREDDITS.map(s => <option key={s} value={s}>r/{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Search query</label>
            <input
              className="input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && scan()}
              placeholder="e.g. best protein powder"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK.map(qs => (
            <button
              key={qs.label}
              onClick={() => setQuery(qs.query)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                query === qs.query
                  ? 'bg-brand-600/30 border-brand-600/50 text-brand-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
              }`}
            >
              {qs.label}
            </button>
          ))}
        </div>

        <button onClick={scan} disabled={loading} className="btn-primary flex items-center gap-2 w-full justify-center">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? 'Scanning Reddit…' : 'Scan for Leads'}
        </button>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/40">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {posts !== null && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{posts.length} posts found in r/{subreddit}</p>
            {posts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No results — try different keywords or another subreddit.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
                {posts.map(post => {
                  const handle = 'u/' + post.author
                  const alreadyAdded = added.has(post.id) || existingSocials.has(handle)
                  return (
                    <div key={post.id} className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <a href={post.permalink} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-semibold text-white hover:text-brand-300 transition-colors line-clamp-2">
                            {post.title}
                          </a>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-brand-400 font-medium">{post.author}</span>
                            <span className="text-xs text-gray-600">·</span>
                            <span className="text-xs text-gray-500">r/{post.subreddit}</span>
                            <span className="text-xs text-gray-600">·</span>
                            <span className="text-xs text-gray-500">{post.created}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => !alreadyAdded && addPost(post)}
                          disabled={alreadyAdded}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            alreadyAdded
                              ? 'bg-green-900/30 text-green-400 cursor-default'
                              : 'bg-brand-700/30 text-brand-300 hover:bg-brand-600/40'
                          }`}
                        >
                          {alreadyAdded ? <CheckCircle2 size={11} /> : <UserPlus size={11} />}
                          {alreadyAdded ? 'Added' : 'Add Lead'}
                        </button>
                      </div>
                      {post.selftext && (
                        <p className="text-xs text-gray-400 line-clamp-2">{post.selftext}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}

// ── Fitness Stack Exchange Scanner ───────────────────────────────────────────
function StackExchangeSection() {
  const { addContact } = useStore()
  const [site, setSite] = useState('fitness')
  const [query, setQuery] = useState('protein supplement recommendation')
  const [posts, setPosts] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  const SITES = [
    { v: 'fitness', l: 'Physical Fitness' },
    { v: 'health', l: 'Health' },
    { v: 'cooking', l: 'Cooking & Nutrition' },
  ]
  const QUICK = [
    { l: 'Protein reco', q: 'protein supplement recommendation' },
    { l: 'Weight loss', q: 'weight loss supplement help' },
    { l: 'Pre-workout', q: 'pre workout energy supplement' },
    { l: 'Muscle building', q: 'muscle building creatine protein' },
    { l: 'Fat burner', q: 'fat burner supplement thermogenic' },
  ]

  async function scan() {
    setLoading(true); setError(''); setPosts(null)
    try {
      const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=activity&q=${encodeURIComponent(query)}&site=${site}&pagesize=20`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error_message) throw new Error(data.error_message)
      setPosts((data.items || []).map(q => ({
        id: String(q.question_id),
        title: q.title,
        link: q.link,
        author: q.owner?.display_name || 'unknown',
        tags: (q.tags || []).slice(0, 4),
        created: new Date(q.creation_date * 1000).toLocaleDateString(),
        answered: q.is_answered,
      })))
    } catch { setError('Could not reach Stack Exchange. Try again.') }
    setLoading(false)
  }

  function add(post) {
    addContact({
      name: post.author, source: 'Other', status: 'New Lead',
      notes: `Stack Exchange (${site}): "${post.title.slice(0, 120)}"`,
      tags: ['stackexchange', 'intent-signal'],
    })
    setAdded(prev => new Set([...prev, post.id]))
  }

  return (
    <Section title="Fitness Q&A Scanner" subtitle="Stack Exchange — people actively asking supplement questions (highest intent of all sources)" icon={HelpCircle} defaultOpen={false}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Community</label>
            <select className="input" value={site} onChange={e => setSite(e.target.value)}>
              {SITES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Search</label>
            <input className="input" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && scan()} placeholder="protein supplement…" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map(({ l, q }) => (
            <button key={l} onClick={() => setQuery(q)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${query === q ? 'bg-brand-600/30 border-brand-600/50 text-brand-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>{l}</button>
          ))}
        </div>
        <button onClick={scan} disabled={loading} className="btn-primary flex items-center gap-2 w-full justify-center">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? 'Scanning…' : 'Find Questions'}
        </button>
        {error && <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/40"><AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" /><p className="text-xs text-red-300">{error}</p></div>}
        {posts !== null && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{posts.length} questions found on {SITES.find(s => s.v === site)?.l}</p>
            {posts.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No results — try different keywords.</p> : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
                {posts.map(post => {
                  const isAdded = added.has(post.id)
                  return (
                    <div key={post.id} className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <a href={post.link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-white hover:text-brand-300 line-clamp-2">{post.title}</a>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-gray-500">
                            <span className="text-brand-400 font-medium">{post.author}</span>
                            <span>·</span><span>{post.created}</span>
                            {post.answered && <span className="px-1.5 py-0.5 rounded-full bg-green-900/30 text-green-400 text-[10px] font-medium">Answered</span>}
                          </div>
                        </div>
                        <button onClick={() => !isAdded && add(post)} disabled={isAdded} className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${isAdded ? 'bg-green-900/30 text-green-400 cursor-default' : 'bg-brand-700/30 text-brand-300 hover:bg-brand-600/40'}`}>
                          {isAdded ? <CheckCircle2 size={11} /> : <UserPlus size={11} />}
                          {isAdded ? 'Added' : 'Add'}
                        </button>
                      </div>
                      {post.tags.length > 0 && <div className="flex flex-wrap gap-1">{post.tags.map(t => <span key={t} className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 text-[10px] font-mono">{t}</span>)}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}

// ── Local Gym Finder ──────────────────────────────────────────────────────────
function GymFinderSection() {
  const { addContact, contacts } = useStore()
  const [location, setLocation] = useState('')
  const [gyms, setGyms] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  const existingNames = new Set(contacts.map(c => c.name.toLowerCase()))

  async function search() {
    if (!location.trim()) return
    setLoading(true); setError(''); setGyms(null)
    try {
      // Geocode with Nominatim (CORS-enabled)
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const geo = await geoRes.json()
      if (!geo.length) { setError('Location not found. Try "City, State" or a ZIP code.'); setLoading(false); return }
      const { lat, lon } = geo[0]

      // Query Overpass via allorigins CORS proxy
      const oql = `[out:json][timeout:20];(node["leisure"="fitness_centre"](around:8000,${lat},${lon});way["leisure"="fitness_centre"](around:8000,${lat},${lon});node["sport"="fitness"](around:8000,${lat},${lon}););out body;>;out skel qt;`
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(oql))}`
      const ovRes = await fetch(proxyUrl)
      const ovJson = await ovRes.json()
      const ovData = JSON.parse(ovJson.contents)

      const seen = new Set()
      const found = ovData.elements
        .filter(el => el.tags?.name && !seen.has(el.tags.name) && seen.add(el.tags.name))
        .slice(0, 25)
        .map(el => ({
          id: String(el.id),
          name: el.tags.name,
          phone: el.tags.phone || el.tags['contact:phone'] || '',
          website: el.tags.website || el.tags['contact:website'] || '',
          address: [el.tags['addr:housenumber'], el.tags['addr:street'], el.tags['addr:city']].filter(Boolean).join(' '),
        }))

      setGyms(found)
    } catch {
      setError('Could not load gym data. Check your connection and try again.')
    }
    setLoading(false)
  }

  function addGym(gym) {
    addContact({
      name: gym.name,
      source: 'In Person',
      status: 'New Lead',
      phone: gym.phone,
      notes: `Local gym near ${location}.${gym.address ? ' ' + gym.address : ''}${gym.website ? ' ' + gym.website : ''}`.trim(),
      tags: ['gym', 'local-prospect'],
    })
    setAdded(prev => new Set([...prev, gym.id]))
  }

  return (
    <Section
      title="Local Gym Finder"
      subtitle="Find gyms near any city or ZIP — add them as in-person prospecting targets"
      icon={Building2}
      defaultOpen={false}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder='City, State or ZIP — e.g. "Phoenix, AZ"'
            value={location}
            onChange={e => setLocation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <button
            onClick={search}
            disabled={loading || !location.trim()}
            className="btn-primary flex items-center gap-2 flex-shrink-0"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? 'Searching…' : 'Find Gyms'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/40">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {gyms !== null && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{gyms.length} gyms found near {location}</p>
            {gyms.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No gyms found. Try a larger city or expand the search area.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
                {gyms.map(gym => {
                  const alreadyAdded = added.has(gym.id) || existingNames.has(gym.name.toLowerCase())
                  return (
                    <div key={gym.id} className="flex items-start gap-3 bg-gray-800/40 border border-gray-700/40 rounded-lg p-3">
                      <div className="p-2 rounded-lg bg-gray-700/50 flex-shrink-0 mt-0.5">
                        <Building2 size={13} className="text-brand-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{gym.name}</p>
                        {gym.address && <p className="text-xs text-gray-400 truncate mt-0.5">{gym.address}</p>}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {gym.phone && (
                            <a href={`tel:${gym.phone}`} className="text-xs text-brand-400 hover:underline flex items-center gap-1">
                              <MessageSquare size={10} /> {gym.phone}
                            </a>
                          )}
                          {gym.website && (
                            <a href={gym.website.startsWith('http') ? gym.website : 'https://' + gym.website}
                              target="_blank" rel="noopener noreferrer"
                              className="text-xs text-brand-400 hover:underline flex items-center gap-1">
                              <ExternalLink size={10} /> Website
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => !alreadyAdded && addGym(gym)}
                        disabled={alreadyAdded}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          alreadyAdded
                            ? 'bg-green-900/30 text-green-400 cursor-default'
                            : 'bg-brand-700/30 text-brand-300 hover:bg-brand-600/40'
                        }`}
                      >
                        {alreadyAdded ? <CheckCircle2 size={11} /> : <UserPlus size={11} />}
                        {alreadyAdded ? 'Added' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}

// ── YouTube Creator Finder ────────────────────────────────────────────────────
function YouTubeSection() {
  const { addContact } = useStore()
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(GOOGLE_KEY_STORAGE) || '')
  const [showKey, setShowKey] = useState(!localStorage.getItem(GOOGLE_KEY_STORAGE))
  const [query, setQuery] = useState('1st phorm fitness supplement review')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  const QUICK = [
    { l: '1st Phorm', q: '1st phorm fitness supplement review' },
    { l: 'Protein review', q: 'best protein powder review fitness' },
    { l: 'Fat loss', q: 'fat loss transformation supplements' },
    { l: 'CrossFit nutrition', q: 'crossfit nutrition supplement' },
    { l: 'Supplement haul', q: 'gym supplement haul unboxing' },
  ]

  function saveKey() { localStorage.setItem(GOOGLE_KEY_STORAGE, apiKey.trim()); setShowKey(false) }

  function fmtN(n) {
    if (!n) return '–'
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
    if (n >= 1e3) return Math.round(n / 1e3) + 'K'
    return String(n)
  }

  async function search() {
    setLoading(true); setError(''); setResults(null)
    try {
      const s = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&order=relevance&maxResults=10&key=${apiKey}`)
      const sd = await s.json()
      if (sd.error) throw new Error(sd.error.message)
      const ids = (sd.items || []).map(i => i.id.channelId).filter(Boolean).join(',')
      if (!ids) { setResults([]); setLoading(false); return }
      const c = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${ids}&key=${apiKey}`)
      const cd = await c.json()
      if (cd.error) throw new Error(cd.error.message)
      setResults((cd.items || []).map(ch => ({
        id: ch.id,
        name: ch.snippet.title,
        desc: (ch.snippet.description || '').slice(0, 100),
        thumb: ch.snippet.thumbnails?.default?.url,
        subs: parseInt(ch.statistics?.subscriberCount || 0),
        videos: parseInt(ch.statistics?.videoCount || 0),
        url: ch.snippet.customUrl
          ? `https://youtube.com/@${ch.snippet.customUrl.replace(/^@/, '')}`
          : `https://youtube.com/channel/${ch.id}`,
      })).sort((a, b) => b.subs - a.subs))
    } catch (e) { setError(e.message || 'Failed — check your API key.') }
    setLoading(false)
  }

  function addCh(ch) {
    addContact({
      name: ch.name, social: ch.url, source: 'YouTube', status: 'Warm Lead',
      notes: `YouTube: ${fmtN(ch.subs)} subscribers. ${ch.desc}`.slice(0, 250),
      tags: ['youtube', 'creator', 'partnership'],
    })
    setAdded(prev => new Set([...prev, ch.id]))
  }

  return (
    <Section title="YouTube Creator Finder" subtitle="Find fitness channels to partner with — nano/micro-influencers (10K–100K) drive the best conversions" icon={Youtube} defaultOpen={false} badge="Free API Key">
      <div className="space-y-4">
        {showKey ? (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-700/40 text-xs space-y-1.5">
              <p className="font-semibold text-white">Get a free Google API key (2 min):</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-300">
                <li>Go to <span className="font-mono">console.cloud.google.com</span> → New Project</li>
                <li>APIs &amp; Services → Enable APIs → search "YouTube Data API v3" → Enable</li>
                <li>Also enable "Places API (New)" for the Venue Finder below</li>
                <li>Credentials → Create API Key → paste it here</li>
              </ol>
              <p className="text-blue-400">Free: 10,000 queries/day. No credit card needed.</p>
            </div>
            <ApiKeyInput value={apiKey} onChange={setApiKey} onSave={saveKey} placeholder="AIzaSy…" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-400 flex items-center gap-1.5"><CheckCircle2 size={11} /> Google API key saved (shared with Venue Finder)</span>
              <button onClick={() => setShowKey(true)} className="text-xs text-gray-500 hover:text-white underline">Change key</button>
            </div>
            <div>
              <label className="label">Search query</label>
              <input className="input" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="fitness supplement review…" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map(({ l, q }) => (
                <button key={l} onClick={() => setQuery(q)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${query === q ? 'bg-brand-600/30 border-brand-600/50 text-brand-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>{l}</button>
              ))}
            </div>
            <button onClick={search} disabled={loading} className="btn-primary flex items-center gap-2 w-full justify-center">
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Youtube size={14} />}
              {loading ? 'Searching…' : 'Find Creators'}
            </button>
          </>
        )}
        {error && <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/40"><AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" /><p className="text-xs text-red-300">{error}</p></div>}
        {results !== null && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{results.length} channels found</p>
            {results.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No channels — try different keywords.</p> : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map(ch => {
                  const isAdded = added.has(ch.id)
                  return (
                    <div key={ch.id} className="flex items-center gap-3 bg-gray-800/40 border border-gray-700/40 rounded-lg p-3">
                      {ch.thumb && <img src={ch.thumb} alt="" className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />}
                      <div className="flex-1 min-w-0">
                        <a href={ch.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-white hover:text-brand-300 truncate block">{ch.name}</a>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-brand-400 font-semibold">{fmtN(ch.subs)} subs</span>
                          <span className="text-xs text-gray-500">{fmtN(ch.videos)} videos</span>
                        </div>
                        {ch.desc && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{ch.desc}</p>}
                      </div>
                      <button onClick={() => !isAdded && addCh(ch)} disabled={isAdded} className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${isAdded ? 'bg-green-900/30 text-green-400 cursor-default' : 'bg-brand-700/30 text-brand-300 hover:bg-brand-600/40'}`}>
                        {isAdded ? <CheckCircle2 size={11} /> : <UserPlus size={11} />}
                        {isAdded ? 'Added' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}

// ── Google Places Venue Finder ────────────────────────────────────────────────
function GooglePlacesSection() {
  const { addContact, contacts } = useStore()
  const [apiKey] = useState(() => localStorage.getItem(GOOGLE_KEY_STORAGE) || '')
  const [location, setLocation] = useState('')
  const [venueType, setVenueType] = useState('CrossFit gym')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  const VENUE_TYPES = [
    'CrossFit gym', 'yoga studio', 'boxing gym', 'martial arts gym',
    'pilates studio', 'indoor cycling studio', 'running store',
    'sports nutrition store', 'MMA gym', 'personal trainer gym',
  ]
  const existingNames = new Set(contacts.map(c => c.name.toLowerCase()))

  async function search() {
    if (!apiKey) { setError('Save your Google API key in the YouTube Creator Finder above first.'); return }
    setLoading(true); setError(''); setResults(null)
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating',
        },
        body: JSON.stringify({ textQuery: `${venueType} near ${location}`, maxResultCount: 15 }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      setResults((data.places || []).map(p => ({
        id: p.id,
        name: p.displayName?.text || '',
        address: p.formattedAddress || '',
        phone: p.nationalPhoneNumber || '',
        website: p.websiteUri || '',
        rating: p.rating,
      })))
    } catch (e) { setError(e.message || 'Failed — make sure Places API (New) is enabled in your Google Cloud project.') }
    setLoading(false)
  }

  function addVenue(v) {
    addContact({
      name: v.name, source: 'In Person', status: 'New Lead', phone: v.phone,
      notes: `${venueType} near ${location}.${v.address ? ' ' + v.address : ''}${v.website ? ' ' + v.website : ''}`.slice(0, 250),
      tags: [venueType.split(' ')[0].toLowerCase(), 'local-prospect'],
    })
    setAdded(prev => new Set([...prev, v.id]))
  }

  return (
    <Section title="Venue Finder (Google Places)" subtitle="CrossFit boxes, yoga studios, martial arts gyms, running stores — better data than OpenStreetMap" icon={Globe} defaultOpen={false} badge="Free API Key">
      <div className="space-y-4">
        {!apiKey && (
          <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/40 text-xs text-yellow-300">
            Enter your Google API key in the YouTube Creator Finder above, then enable <span className="font-mono text-yellow-200">Places API (New)</span> in your Google Cloud project.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Venue Type</label>
            <select className="input" value={venueType} onChange={e => setVenueType(e.target.value)}>
              {VENUE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={location} onChange={e => setLocation(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="City, State or ZIP" />
          </div>
        </div>
        <button onClick={search} disabled={loading || !location.trim()} className="btn-primary flex items-center gap-2 w-full justify-center">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Globe size={14} />}
          {loading ? 'Searching…' : 'Find Venues'}
        </button>
        {error && <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/40"><AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" /><p className="text-xs text-red-300">{error}</p></div>}
        {results !== null && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{results.length} {venueType}s near {location}</p>
            {results.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">None found — try a different city or venue type.</p> : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
                {results.map(v => {
                  const isAdded = added.has(v.id) || existingNames.has(v.name.toLowerCase())
                  return (
                    <div key={v.id} className="flex items-start gap-3 bg-gray-800/40 border border-gray-700/40 rounded-lg p-3">
                      <div className="p-2 rounded-lg bg-gray-700/50 flex-shrink-0 mt-0.5"><Globe size={13} className="text-brand-400" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{v.name}</p>
                        {v.address && <p className="text-xs text-gray-400 truncate mt-0.5">{v.address}</p>}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {v.rating && <span className="text-xs text-yellow-400">★ {v.rating}</span>}
                          {v.phone && <a href={`tel:${v.phone}`} className="text-xs text-brand-400 hover:underline flex items-center gap-1"><MessageSquare size={10} />{v.phone}</a>}
                          {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:underline flex items-center gap-1"><ExternalLink size={10} />Website</a>}
                        </div>
                      </div>
                      <button onClick={() => !isAdded && addVenue(v)} disabled={isAdded} className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${isAdded ? 'bg-green-900/30 text-green-400 cursor-default' : 'bg-brand-700/30 text-brand-300 hover:bg-brand-600/40'}`}>
                        {isAdded ? <CheckCircle2 size={11} /> : <UserPlus size={11} />}
                        {isAdded ? 'Added' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}

// ── RunSignUp Race Finder ─────────────────────────────────────────────────────
function RunSignUpSection() {
  const { addContact } = useStore()
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(RUNSIGNUP_KEY_STORAGE) || '')
  const [apiSecret, setApiSecret] = useState(() => localStorage.getItem(RUNSIGNUP_SECRET_STORAGE) || '')
  const [showKey, setShowKey] = useState(!localStorage.getItem(RUNSIGNUP_KEY_STORAGE))
  const [state, setState] = useState('AZ')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

  function saveKeys() {
    localStorage.setItem(RUNSIGNUP_KEY_STORAGE, apiKey.trim())
    localStorage.setItem(RUNSIGNUP_SECRET_STORAGE, apiSecret.trim())
    setShowKey(false)
  }

  async function search() {
    setLoading(true); setError(''); setResults(null)
    try {
      const today = new Date().toISOString().split('T')[0]
      const directUrl = `https://runsignup.com/Rest/races?api_key=${apiKey}&api_secret=${apiSecret}&format=json&state=${state}&future_events_only=T&min_start_date=${today}&results_per_page=20&page=1`
      let data
      try {
        const res = await fetch(directUrl)
        if (!res.ok) throw new Error('direct_failed')
        data = await res.json()
      } catch {
        const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(directUrl)}`)
        const wrapper = await proxyRes.json()
        data = JSON.parse(wrapper.contents)
      }
      if (data.error) throw new Error(data.error)
      const races = (data.races || []).map(r => {
        const race = r.race
        const ts = race?.next_date_utc_ts
        return {
          id: String(race?.race_id || Math.random()),
          name: race?.name || '',
          date: ts ? new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD',
          city: race?.address?.city || '',
          st: race?.address?.state || state,
          url: race?.url || '',
          distances: (race?.events || []).map(e => e.name).filter(Boolean).slice(0, 3).join(', '),
        }
      }).filter(r => r.name)
      setResults(races)
    } catch (e) {
      setError(e.message || 'Failed — check your API key and secret.')
    }
    setLoading(false)
  }

  function addRace(race) {
    addContact({
      name: `${race.name} (Event)`,
      source: 'In Person', status: 'New Lead',
      notes: `Race event: ${race.name} on ${race.date} in ${race.city}, ${race.st}.${race.distances ? ' Distances: ' + race.distances : ''} In-person prospecting opportunity.`,
      tags: ['race', 'local-prospect', 'running'],
    })
    setAdded(prev => new Set([...prev, race.id]))
  }

  return (
    <Section title="RunSignUp Race Finder" subtitle="Find upcoming local races — in-person prospecting with endurance athletes (ideal L-Carnitine & protein prospects)" icon={Trophy} defaultOpen={false} badge="Free API Key">
      <div className="space-y-4">
        {showKey ? (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-700/40 text-xs space-y-1.5">
              <p className="font-semibold text-white">Free RunSignUp API access:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-300">
                <li>Create a free account at runsignup.com</li>
                <li>Profile → Developer → Create API Credentials</li>
                <li>Copy both the API Key and API Secret below</li>
              </ol>
              <p className="text-blue-400">Note: if browser CORS is blocked, race data can be added manually via Quick Add.</p>
            </div>
            <div className="space-y-2">
              <div>
                <label className="label">API Key</label>
                <input className="input font-mono text-xs" type="text" placeholder="API Key…" value={apiKey} onChange={e => setApiKey(e.target.value)} />
              </div>
              <div>
                <label className="label">API Secret</label>
                <div className="flex gap-2">
                  <input className="input flex-1 font-mono text-xs" type="password" placeholder="API Secret…" value={apiSecret} onChange={e => setApiSecret(e.target.value)} />
                  <button onClick={saveKeys} disabled={!apiKey.trim() || !apiSecret.trim()} className="btn-primary flex items-center gap-2 flex-shrink-0 px-3 text-sm">
                    <CheckCircle2 size={13} /> Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-400 flex items-center gap-1.5"><CheckCircle2 size={11} /> RunSignUp credentials saved</span>
              <button onClick={() => setShowKey(true)} className="text-xs text-gray-500 hover:text-white underline">Change keys</button>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="label">State</label>
                <select className="input" value={state} onChange={e => setState(e.target.value)}>
                  {US_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <button onClick={search} disabled={loading} className="btn-primary flex items-center gap-2 flex-shrink-0">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Trophy size={14} />}
                {loading ? 'Searching…' : 'Find Races'}
              </button>
            </div>
          </>
        )}
        {error && <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/40"><AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" /><p className="text-xs text-red-300">{error}</p></div>}
        {results !== null && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{results.length} upcoming races in {state}</p>
            {results.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No upcoming races in {state}.</p> : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
                {results.map(race => {
                  const isAdded = added.has(race.id)
                  return (
                    <div key={race.id} className="flex items-start gap-3 bg-gray-800/40 border border-gray-700/40 rounded-lg p-3">
                      <div className="p-2 rounded-lg bg-gray-700/50 flex-shrink-0 mt-0.5"><Trophy size={13} className="text-brand-400" /></div>
                      <div className="flex-1 min-w-0">
                        <a href={race.url || '#'} target={race.url ? '_blank' : '_self'} rel="noopener noreferrer" className="text-sm font-semibold text-white hover:text-brand-300 truncate block">{race.name}</a>
                        <p className="text-xs text-gray-400 mt-0.5">{race.date} · {race.city}, {race.st}</p>
                        {race.distances && <p className="text-xs text-gray-500 mt-0.5">{race.distances}</p>}
                      </div>
                      <button onClick={() => !isAdded && addRace(race)} disabled={isAdded} className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${isAdded ? 'bg-green-900/30 text-green-400 cursor-default' : 'bg-brand-700/30 text-brand-300 hover:bg-brand-600/40'}`}>
                        {isAdded ? <CheckCircle2 size={11} /> : <UserPlus size={11} />}
                        {isAdded ? 'Added' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}

// ── HackerNews Lead Scanner ───────────────────────────────────────────────────
// Free Algolia HN Search API — no key, CORS-enabled
function HackerNewsSection() {
  const { addContact } = useStore()
  const [query, setQuery] = useState('fitness supplements workout')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  const QUERIES = [
    'fitness supplements workout',
    'protein powder creatine',
    'weight loss nutrition',
    'muscle building diet',
    'endurance training nutrition',
  ]

  async function search() {
    setLoading(true); setError(''); setResults(null)
    try {
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story,ask_hn,show_hn&hitsPerPage=30&numericFilters=created_at_i>%3D${Math.floor((Date.now() / 1000) - 90 * 86400)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const hits = (data.hits || [])
        .filter(h => h.author && h.title)
        .map(h => ({
          id: h.objectID,
          author: h.author,
          title: h.title,
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          hnUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
          points: h.points || 0,
          comments: h.num_comments || 0,
          date: new Date(h.created_at).toLocaleDateString(),
        }))
      setResults(hits)
    } catch (e) {
      setError(e.message || 'Search failed')
    }
    setLoading(false)
  }

  function addLead(hit) {
    addContact({
      name: hit.author,
      social: `hn:${hit.author}`,
      source: 'Other',
      status: 'New Lead',
      notes: `HN: "${hit.title.slice(0, 120)}" — ${hit.hnUrl}`,
      tags: ['hackernews', 'tech-fitness', 'intent-signal'],
    })
    setAdded(prev => new Set([...prev, hit.id]))
  }

  return (
    <Section icon={Code2} title="Hacker News — Tech + Fitness" badge="Free · No Key" defaultOpen={false}>
      <p className="text-xs text-gray-400 mb-3">
        Find tech professionals asking about fitness/nutrition on HN. Strong purchasing power, often looking for high-quality supplements.
      </p>
      <div className="flex gap-2 mb-3">
        <select className="input text-xs flex-1" value={query} onChange={e => setQuery(e.target.value)}>
          {QUERIES.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
        <input className="input flex-1 text-sm" placeholder="or type custom query…" value={query} onChange={e => setQuery(e.target.value)} />
        <button onClick={search} disabled={loading} className="btn-primary flex items-center gap-2 flex-shrink-0 px-3 text-sm">
          <Search size={14} />{loading ? 'Searching…' : 'Search HN'}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {results && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 mb-2">{results.length} posts found</p>
          {results.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No results — try different keywords.</p>}
          {results.map(hit => (
            <div key={hit.id} className="flex items-start justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug truncate">{hit.title}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-orange-400 font-medium">u/{hit.author}</span>
                  <span className="text-xs text-gray-500">↑{hit.points} · {hit.comments} comments · {hit.date}</span>
                  <a href={hit.hnUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-brand-400 flex items-center gap-1"><ExternalLink size={10} />HN</a>
                </div>
              </div>
              <button
                onClick={() => addLead(hit)}
                disabled={added.has(hit.id)}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded-md ${added.has(hit.id) ? 'bg-green-900/40 text-green-400' : 'btn-primary'}`}
              >
                {added.has(hit.id) ? '✓ Added' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── Dev.to Fitness Bloggers ───────────────────────────────────────────────────
// Free public API — no key, CORS-enabled
function DevToSection() {
  const { addContact } = useStore()
  const [tag, setTag] = useState('fitness')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  const TAGS = ['fitness', 'health', 'nutrition', 'workout', 'weightloss', 'running', 'bodybuilding', 'wellness']

  async function search() {
    setLoading(true); setError(''); setResults(null)
    try {
      const res = await fetch(`https://dev.to/api/articles?tag=${tag}&per_page=20&state=fresh`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const articles = data
        .filter(a => a.user?.username)
        .map(a => ({
          id: String(a.id),
          username: a.user.username,
          name: a.user.name || a.user.username,
          title: a.title,
          url: a.url,
          reactions: a.positive_reactions_count || 0,
          comments: a.comments_count || 0,
          date: new Date(a.published_at).toLocaleDateString(),
          profileImage: a.user.profile_image_90,
        }))
      setResults(articles)
    } catch (e) {
      setError(e.message || 'Search failed')
    }
    setLoading(false)
  }

  function addWriter(article) {
    addContact({
      name: article.name,
      social: `devto:${article.username}`,
      source: 'Other',
      status: 'Warm Lead',
      notes: `Dev.to: "${article.title.slice(0, 120)}" — ${article.url}`,
      tags: ['devto', 'blogger', 'tech-fitness', tag],
    })
    setAdded(prev => new Set([...prev, article.id]))
  }

  return (
    <Section icon={Code2} title="Dev.to Fitness Bloggers" badge="Free · No Key" defaultOpen={false}>
      <p className="text-xs text-gray-400 mb-3">
        Find developers and tech workers who blog about fitness — high-income audience that invests in health.
      </p>
      <div className="flex gap-2 mb-3 flex-wrap">
        <div className="flex gap-2 flex-wrap flex-1">
          {TAGS.map(t => (
            <button key={t} onClick={() => setTag(t)} className={`text-xs px-2 py-1 rounded-full border ${tag === t ? 'bg-purple-900/50 border-purple-600 text-purple-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              #{t}
            </button>
          ))}
        </div>
        <button onClick={search} disabled={loading} className="btn-primary flex items-center gap-2 flex-shrink-0 px-3 text-sm">
          <Search size={14} />{loading ? 'Searching…' : `Search #${tag}`}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {results && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 mb-2">{results.length} articles found</p>
          {results.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No results for #{tag}.</p>}
          {results.map(article => (
            <div key={article.id} className="flex items-start justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug truncate">{article.title}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-purple-400 font-medium">@{article.username}</span>
                  <span className="text-xs text-gray-500">♥{article.reactions} · {article.comments} comments · {article.date}</span>
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-brand-400 flex items-center gap-1"><ExternalLink size={10} />Article</a>
                </div>
              </div>
              <button
                onClick={() => addWriter(article)}
                disabled={added.has(article.id)}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded-md ${added.has(article.id) ? 'bg-green-900/40 text-green-400' : 'btn-primary'}`}
              >
                {added.has(article.id) ? '✓ Added' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── RSS Fitness Blog Scanner ──────────────────────────────────────────────────
// Scans popular fitness/nutrition blogs via rss2json.com (free tier, CORS-safe)
function RssFeedSection() {
  const { addContact } = useStore()
  const [feed, setFeed] = useState('https://www.muscleandstrength.com/feed')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  const FEEDS = [
    { label: 'Muscle & Strength', url: 'https://www.muscleandstrength.com/feed' },
    { label: 'T-Nation', url: 'https://www.t-nation.com/feed' },
    { label: 'Breaking Muscle', url: 'https://breakingmuscle.com/feed/' },
    { label: 'Nerd Fitness', url: 'https://www.nerdfitness.com/feed/' },
    { label: 'Precision Nutrition', url: 'https://www.precisionnutrition.com/feed' },
    { label: 'ISSA', url: 'https://www.issaonline.com/blog/feed/' },
    { label: 'Bodybuilding.com News', url: 'https://www.bodybuilding.com/rss/articles.xml' },
    { label: 'Examine.com', url: 'https://examine.com/feed.xml' },
  ]

  async function scan() {
    setLoading(true); setError(''); setResults(null)
    try {
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}&count=20`
      const res = await fetch(apiUrl)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      if (data.status !== 'ok') throw new Error(data.message || 'Feed parse failed')
      const items = (data.items || []).map((item, i) => ({
        id: item.guid || String(i),
        author: item.author || data.feed?.title || 'Unknown',
        title: item.title,
        url: item.link,
        date: item.pubDate ? new Date(item.pubDate).toLocaleDateString() : '',
        source: data.feed?.title || '',
      }))
      setResults(items)
    } catch (e) {
      setError(e.message || 'Could not load feed — check the URL')
    }
    setLoading(false)
  }

  function addAuthor(item) {
    addContact({
      name: item.author,
      source: 'Other',
      status: 'Warm Lead',
      notes: `Blog: "${item.title.slice(0, 120)}" from ${item.source} — ${item.url}`,
      tags: ['blogger', 'content-creator', 'fitness-media'],
    })
    setAdded(prev => new Set([...prev, item.id]))
  }

  return (
    <Section icon={Rss} title="Fitness Blog Scanner" badge="Free · No Key" defaultOpen={false}>
      <p className="text-xs text-gray-400 mb-3">
        Scan fitness blogs for recent authors and contributors — great for identifying trainers and coaches who influence audiences.
      </p>
      <div className="flex gap-2 mb-2">
        <select className="input text-xs flex-1" value={feed} onChange={e => setFeed(e.target.value)}>
          {FEEDS.map(f => <option key={f.url} value={f.url}>{f.label}</option>)}
        </select>
        <button onClick={scan} disabled={loading} className="btn-primary flex items-center gap-2 flex-shrink-0 px-3 text-sm">
          <Search size={14} />{loading ? 'Scanning…' : 'Scan Feed'}
        </button>
      </div>
      <input className="input text-xs w-full mb-3" placeholder="or paste any RSS feed URL…" value={feed} onChange={e => setFeed(e.target.value)} />
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {results && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 mb-2">{results.length} recent posts</p>
          {results.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No posts found in this feed.</p>}
          {results.map(item => (
            <div key={item.id} className="flex items-start justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug truncate">{item.title}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-yellow-400 font-medium">{item.author}</span>
                  <span className="text-xs text-gray-500">{item.source} · {item.date}</span>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-brand-400 flex items-center gap-1"><ExternalLink size={10} />Read</a>
                </div>
              </div>
              <button
                onClick={() => addAuthor(item)}
                disabled={added.has(item.id)}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded-md ${added.has(item.id) ? 'bg-green-900/40 text-green-400' : 'btn-primary'}`}
              >
                {added.has(item.id) ? '✓ Added' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(isoString) {
  const ms = Date.now() - new Date(isoString).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

// ── Auto-Acquire Engine Panel ─────────────────────────────────────────────────
// Control panel for the background AutoAcquireManager (mounted in Layout).
// Reads / writes engine config in localStorage; fires window events to trigger
// the manager to re-setup intervals or run a source immediately.
function AutoEnginePanel() {
  const [config, setConfig] = useState(() => getEngineConfig())
  const [log, setLog] = useState(() => getLog())
  const [runningNow, setRunningNow] = useState({})

  useEffect(() => {
    function refresh() {
      setConfig(getEngineConfig())
      setLog(getLog())
    }
    window.addEventListener('auto-acquire-update', refresh)
    return () => window.removeEventListener('auto-acquire-update', refresh)
  }, [])

  function applyConfig(next) {
    saveEngineConfig(next)
    setConfig(next)
    window.dispatchEvent(new CustomEvent('auto-acquire-config-changed'))
  }

  function toggleMaster() {
    applyConfig({ ...config, enabled: !config.enabled })
  }

  function toggleSource(id) {
    applyConfig({
      ...config,
      sources: { ...config.sources, [id]: { ...config.sources[id], enabled: !config.sources[id]?.enabled } },
    })
  }

  function setSourceInterval(id, min) {
    applyConfig({
      ...config,
      sources: { ...config.sources, [id]: { ...config.sources[id], intervalMin: Number(min) } },
    })
  }

  function runNow(id) {
    setRunningNow(prev => ({ ...prev, [id]: true }))
    window.dispatchEvent(new CustomEvent('auto-acquire-run-now', { detail: { sourceId: id } }))
    // Clear spinner after 12s (in case the source errors silently)
    setTimeout(() => setRunningNow(prev => ({ ...prev, [id]: false })), 12000)
  }

  const today = new Date().toISOString().split('T')[0]
  const totalToday = SOURCE_CONFIGS.reduce((sum, src) => {
    const sc = config.sources[src.id]
    return sum + (sc?.lastAddedDate === today ? (sc.addedToday || 0) : 0)
  }, 0)
  const totalAllTime = SOURCE_CONFIGS.reduce((sum, src) => sum + (config.sources[src.id]?.addedAllTime || 0), 0)

  return (
    <Section
      icon={Radio}
      title="Auto-Acquire Engine"
      badge={config.enabled ? '● RUNNING' : 'Paused'}
      badgeColor={config.enabled ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-gray-500'}
      defaultOpen={true}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-xs text-gray-400 leading-relaxed">
          Continuously scans 8 free sources, deduplicates contacts, and auto-enrolls new leads in the 5-Touch Cold Intro sequence — no manual action required.
        </p>
        <button
          onClick={toggleMaster}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            config.enabled
              ? 'bg-red-900/40 text-red-300 border border-red-800/50 hover:bg-red-900/60'
              : 'btn-primary'
          }`}
        >
          {config.enabled ? <Pause size={13} /> : <Play size={13} />}
          {config.enabled ? 'Pause' : 'Start'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700/40">
          <p className="text-xl font-bold text-green-400">+{totalToday}</p>
          <p className="text-xs text-gray-500 mt-0.5">Added Today</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700/40">
          <p className="text-xl font-bold text-white">{totalAllTime}</p>
          <p className="text-xs text-gray-500 mt-0.5">All-Time Auto</p>
        </div>
      </div>

      {/* Source grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {SOURCE_CONFIGS.map(src => {
          const sc = config.sources[src.id] || {}
          const addedToday = sc.lastAddedDate === today ? (sc.addedToday || 0) : 0
          const isOn = !!sc.enabled
          const isRunning = !!runningNow[src.id]

          return (
            <div
              key={src.id}
              className={`rounded-lg border p-3 transition-colors ${isOn ? src.bg : 'bg-gray-900/20 border-gray-800/30'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{src.emoji}</span>
                  <span className={`text-xs font-medium ${isOn ? src.color : 'text-gray-500'}`}>{src.name}</span>
                </div>
                <button
                  onClick={() => toggleSource(src.id)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    isOn
                      ? 'bg-green-900/40 text-green-400 border-green-800/50 hover:bg-green-900/60'
                      : 'bg-gray-800/60 text-gray-500 border-gray-700/50 hover:bg-gray-800'
                  }`}
                >
                  {isOn ? 'On' : 'Off'}
                </button>
              </div>

              <div className="flex items-center gap-1.5 mb-1.5">
                <select
                  className="text-xs bg-gray-900/60 border border-gray-700/40 rounded px-1.5 py-0.5 text-gray-300 flex-1 min-w-0"
                  value={sc.intervalMin || src.defaultIntervalMin}
                  onChange={e => setSourceInterval(src.id, e.target.value)}
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hr</option>
                  <option value={120}>2 hrs</option>
                  <option value={180}>3 hrs</option>
                  <option value={360}>6 hrs</option>
                </select>
                <button
                  onClick={() => runNow(src.id)}
                  disabled={isRunning}
                  className="flex-shrink-0 text-xs px-2 py-0.5 rounded bg-gray-800 border border-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {isRunning ? '…' : '▶ Now'}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{sc.lastRun ? timeAgo(sc.lastRun) : 'never run'}</span>
                {addedToday > 0 && <span className="text-green-400 font-medium">+{addedToday} today</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Activity log */}
      {log.length > 0 ? (
        <div>
          <p className="text-xs text-gray-500 font-medium mb-1.5">Activity Log</p>
          <div className="bg-gray-900/60 rounded-lg p-3 space-y-1 max-h-44 overflow-y-auto">
            {log.slice(0, 25).map((entry, i) => (
              <p key={i} className={`text-xs font-mono ${entry.ok === false ? 'text-red-400/70' : 'text-gray-400'}`}>
                {new Date(entry.ts).toLocaleTimeString()} — {entry.source}:{' '}
                {entry.ok === false ? `❌ ${entry.error}` : `+${entry.count} contacts`}
              </p>
            ))}
          </div>
        </div>
      ) : (
        !config.enabled && (
          <p className="text-xs text-gray-500 text-center py-3">
            Press Start to begin continuous acquisition across all 8 sources.
          </p>
        )
      )}
    </Section>
  )
}

// ── Mastodon Fitness Feed ─────────────────────────────────────────────────────
// Public Mastodon API — no key, CORS-enabled, fitness hashtag timeline
function MastodonSection() {
  const { addContact } = useStore()
  const [tag, setTag] = useState('fitness')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  const TAGS = ['fitness', 'workout', 'nutrition', 'weightloss', 'running', 'supplements', 'bodybuilding', 'crossfit']
  const INSTANCES = ['mastodon.social', 'fitx.social', 'social.coop']
  const [instance, setInstance] = useState('mastodon.social')

  async function search() {
    setLoading(true); setError(''); setResults(null)
    try {
      const res = await fetch(`https://${instance}/api/v1/timelines/tag/${tag}?limit=20`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const posts = data
        .filter(p => p.account?.username && p.content)
        .map(p => ({
          id: p.id,
          username: p.account.username,
          displayName: p.account.display_name || p.account.username,
          content: p.content.replace(/<[^>]*>/g, '').slice(0, 160),
          url: p.url,
          created: new Date(p.created_at).toLocaleDateString(),
          instance,
        }))
      setResults(posts)
    } catch (e) {
      setError(e.message || 'Could not reach Mastodon instance')
    }
    setLoading(false)
  }

  function addPost(post) {
    addContact({
      name: post.displayName,
      social: `@${post.username}@${post.instance}`,
      source: 'Other',
      status: 'New Lead',
      notes: `Mastodon #${tag}: "${post.content.slice(0, 100)}" — ${post.url}`,
      tags: ['mastodon', tag, 'social'],
    })
    setAdded(prev => new Set([...prev, post.id]))
  }

  return (
    <Section icon={Hash} title="Mastodon Fitness Community" badge="Free · No Key" defaultOpen={false}>
      <p className="text-xs text-gray-400 mb-3">
        Mastodon's federated network has active fitness communities with zero algorithm — people post authentically about their fitness journey.
      </p>
      <div className="flex gap-2 mb-3 flex-wrap">
        <select className="input text-xs w-40" value={instance} onChange={e => setInstance(e.target.value)}>
          {INSTANCES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap flex-1">
          {TAGS.map(t => (
            <button key={t} onClick={() => setTag(t)} className={`text-xs px-2 py-1 rounded-full border ${tag === t ? 'bg-brand-900/50 border-brand-600 text-brand-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              #{t}
            </button>
          ))}
        </div>
        <button onClick={search} disabled={loading} className="btn-primary flex items-center gap-2 flex-shrink-0 px-3 text-sm">
          <Search size={14} />{loading ? 'Loading…' : `Fetch #${tag}`}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {results && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 mb-2">{results.length} posts found</p>
          {results.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No posts — try a different tag or instance.</p>}
          {results.map(post => (
            <div key={post.id} className="flex items-start justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug truncate">{post.content || '(no text content)'}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-blue-400 font-medium">@{post.username}</span>
                  <span className="text-xs text-gray-500">{post.instance} · {post.created}</span>
                  <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-brand-400 flex items-center gap-1"><ExternalLink size={10} />Post</a>
                </div>
              </div>
              <button
                onClick={() => addPost(post)}
                disabled={added.has(post.id)}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded-md ${added.has(post.id) ? 'bg-green-900/40 text-green-400' : 'btn-primary'}`}
              >
                {added.has(post.id) ? '✓ Added' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── GitHub Fitness Developers ─────────────────────────────────────────────────
// GitHub Search API — no key, 10 req/min unauthenticated, CORS-enabled
function GitHubFitnessSection() {
  const { addContact } = useStore()
  const [query, setQuery] = useState('fitness tracker')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  const QUERIES = [
    'fitness tracker',
    'workout app',
    'nutrition calculator',
    'calorie counter',
    'running training plan',
    'supplement stack',
  ]

  async function search() {
    setLoading(true); setError(''); setResults(null)
    try {
      const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+topic:fitness&sort=stars&per_page=15`, {
        headers: { Accept: 'application/vnd.github+json' }
      })
      if (!res.ok) {
        if (res.status === 403) throw new Error('Rate limited — wait 60s and try again (GitHub allows 10 searches/min without auth)')
        throw new Error(`${res.status}`)
      }
      const data = await res.json()
      const repos = (data.items || [])
        .filter(r => r.owner?.login && r.owner.type === 'User')
        .map(r => ({
          id: String(r.id),
          username: r.owner.login,
          avatarUrl: r.owner.avatar_url,
          repoName: r.name,
          description: (r.description || '').slice(0, 120),
          stars: r.stargazers_count,
          url: r.html_url,
          ownerUrl: r.owner.html_url,
          language: r.language,
        }))
      setResults(repos)
    } catch (e) {
      setError(e.message || 'Search failed')
    }
    setLoading(false)
  }

  function addDev(repo) {
    addContact({
      name: repo.username,
      social: `github:${repo.username}`,
      source: 'Other',
      status: 'New Lead',
      notes: `GitHub: built "${repo.repoName}" (⭐${repo.stars}) — ${repo.description || 'no description'} — ${repo.ownerUrl}`,
      tags: ['github', 'developer', 'fitness-tech', repo.language?.toLowerCase()].filter(Boolean),
    })
    setAdded(prev => new Set([...prev, repo.id]))
  }

  return (
    <Section icon={Code2} title="GitHub Fitness Developers" badge="Free · No Key" defaultOpen={false}>
      <p className="text-xs text-gray-400 mb-3">
        Developers who build fitness apps are high-income, health-focused, and often looking to optimize their own performance — ideal 1st Phorm customers.
      </p>
      <div className="flex gap-2 mb-3 flex-wrap">
        <select className="input text-xs flex-1" value={query} onChange={e => setQuery(e.target.value)}>
          {QUERIES.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
        <input className="input text-xs flex-1" placeholder="custom search…" value={query} onChange={e => setQuery(e.target.value)} />
        <button onClick={search} disabled={loading} className="btn-primary flex items-center gap-2 flex-shrink-0 px-3 text-sm">
          <Search size={14} />{loading ? 'Searching…' : 'Search GitHub'}
        </button>
      </div>
      <p className="text-xs text-gray-600 mb-3">Note: GitHub allows 10 searches/min without authentication. If rate limited, wait 60 seconds.</p>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {results && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 mb-2">{results.length} repos found</p>
          {results.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No results — try different keywords.</p>}
          {results.map(repo => (
            <div key={repo.id} className="flex items-start justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{repo.username}</span>
                  <span className="text-xs text-gray-500">built</span>
                  <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 truncate">{repo.repoName} <ExternalLink size={10} /></a>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-yellow-400">⭐{repo.stars}</span>
                  {repo.language && <span className="text-xs text-gray-500">{repo.language}</span>}
                  {repo.description && <span className="text-xs text-gray-500 truncate">{repo.description}</span>}
                </div>
              </div>
              <button
                onClick={() => addDev(repo)}
                disabled={added.has(repo.id)}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded-md ${added.has(repo.id) ? 'bg-green-900/40 text-green-400' : 'btn-primary'}`}
              >
                {added.has(repo.id) ? '✓ Added' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── Eventbrite Event Finder ───────────────────────────────────────────────────
// Eventbrite API — free API key, CORS-enabled
function EventbriteSection() {
  const { addContact } = useStore()
  const [savedKey, setSavedKey] = useState(() => localStorage.getItem(EVENTBRITE_KEY_STORAGE) || '')
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(!savedKey)
  const [city, setCity] = useState('Denver')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  function saveKey() {
    localStorage.setItem(EVENTBRITE_KEY_STORAGE, keyInput.trim())
    setSavedKey(keyInput.trim())
    setShowKey(false)
  }

  async function search() {
    if (!savedKey) { setError('Add your Eventbrite API key first.'); return }
    setLoading(true); setError(''); setResults(null)
    try {
      const url = `https://www.eventbriteapi.com/v3/events/search/?q=fitness+bootcamp+workout&location.address=${encodeURIComponent(city)}&location.within=25mi&sort_by=date&expand=organizer&token=${savedKey}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} — check your API key`)
      const data = await res.json()
      const events = (data.events || []).map(e => ({
        id: e.id,
        name: e.name?.text || 'Unnamed Event',
        date: e.start?.local ? new Date(e.start.local).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD',
        url: e.url,
        organizer: e.organizer?.name || '',
        organizerUrl: e.organizer?.url || '',
        venue: e.venue?.name || city,
        isFree: e.is_free,
      }))
      setResults(events)
    } catch (e) {
      setError(e.message || 'Search failed — check your API key')
    }
    setLoading(false)
  }

  function addEvent(ev) {
    addContact({
      name: ev.organizer || `Organizer: ${ev.name}`,
      source: 'In Person',
      status: 'New Lead',
      notes: `Eventbrite organizer: "${ev.name}" on ${ev.date} at ${ev.venue} — ${ev.url}`,
      tags: ['eventbrite', 'event-organizer', 'local-prospect'],
    })
    setAdded(prev => new Set([...prev, ev.id]))
  }

  return (
    <Section icon={MapPin} title="Eventbrite Local Events" badge="Free API Key" defaultOpen={false}>
      <p className="text-xs text-gray-400 mb-3">
        Find local fitness event organizers — they run bootcamps, races, and gym challenges and have direct access to large health-conscious audiences.
      </p>

      {showKey ? (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">
            Get your free key at <span className="text-brand-400">eventbrite.com → Account → API Keys</span>
          </p>
          <ApiKeyInput value={keyInput} onChange={setKeyInput} onSave={saveKey} placeholder="Paste Eventbrite API key…" />
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={11} /> Key saved</span>
          <button onClick={() => { setShowKey(true); setKeyInput('') }} className="text-xs text-gray-500 hover:text-gray-300 underline">Change</button>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <input className="input flex-1 text-sm" placeholder="City (e.g. Denver, Austin, Miami…)" value={city} onChange={e => setCity(e.target.value)} />
        <button onClick={search} disabled={loading || !savedKey} className="btn-primary flex items-center gap-2 flex-shrink-0 px-3 text-sm">
          <Search size={14} />{loading ? 'Searching…' : 'Find Events'}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {results && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 mb-2">{results.length} events found near {city}</p>
          {results.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No events found — try a different city or expand the search.</p>}
          {results.map(ev => (
            <div key={ev.id} className="flex items-start justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug truncate">{ev.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  {ev.organizer && <span className="text-xs text-brand-400 font-medium">{ev.organizer}</span>}
                  <span className="text-xs text-gray-500">{ev.date} · {ev.venue}</span>
                  {ev.isFree && <span className="text-xs text-green-400">Free</span>}
                  <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-brand-400 flex items-center gap-1"><ExternalLink size={10} />View</a>
                </div>
              </div>
              <button
                onClick={() => addEvent(ev)}
                disabled={added.has(ev.id)}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded-md ${added.has(ev.id) ? 'bg-green-900/40 text-green-400' : 'btn-primary'}`}
              >
                {added.has(ev.id) ? '✓ Added' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── USAspending.gov Federal Fitness Contracts ─────────────────────────────────
function USASpendingSection() {
  const { addContact } = useStore()
  const [days, setDays] = useState('90')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set())

  const FITNESS_NAICS = ['713940', '812191', '446191', '424490', '325411']

  async function search() {
    setLoading(true); setError(''); setResults(null)
    try {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - parseInt(days) * 86400000).toISOString().split('T')[0]
      const body = {
        filters: {
          award_type_codes: ['A', 'B', 'C', 'D'],
          time_period: [{ start_date: startDate, end_date: endDate }],
          naics_codes: FITNESS_NAICS,
        },
        fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Period of Performance Start Date'],
        page: 1,
        limit: 50,
        sort: 'Award Amount',
        order: 'desc',
      }
      const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      setResults((data.results || []).map((r, i) => ({
        id: r['Award ID'] || `award-${i}`,
        name: r['Recipient Name'] || 'Unknown Recipient',
        amount: r['Award Amount'] ? `$${Number(r['Award Amount']).toLocaleString()}` : 'N/A',
        agency: r['Awarding Agency'] || '',
        date: r['Period of Performance Start Date'] || '',
      })))
    } catch (e) {
      setError(e.message || 'Failed to fetch from USAspending.gov')
    }
    setLoading(false)
  }

  function addAward(award) {
    addContact({
      name: award.name,
      source: 'Other',
      status: 'New Lead',
      notes: `USAspending.gov federal award: ${award.amount} from ${award.agency}${award.date ? ` (${award.date})` : ''} — fitness/wellness NAICS contract recipient`,
      tags: ['federal_award', 'usaspending', 'intent-signal', 'b2b-prospect'],
    })
    setAdded(prev => new Set([...prev, award.id]))
  }

  return (
    <Section icon={Building2} title="USAspending.gov — Federal Fitness Contracts" badge="Free · No Key" defaultOpen={false}>
      <p className="text-xs text-gray-400 mb-3">
        Companies that hold federal fitness and wellness contracts — verified revenue, health-focused operations, and direct access to large active audiences.
      </p>
      <div className="flex gap-2 mb-2">
        <select className="input text-sm flex-1" value={days} onChange={e => setDays(e.target.value)}>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 6 months</option>
          <option value="365">Last 12 months</option>
        </select>
        <button onClick={search} disabled={loading} className="btn-primary flex items-center gap-2 flex-shrink-0 px-3 text-sm">
          <Search size={14} />{loading ? 'Loading…' : 'Fetch Awards'}
        </button>
      </div>
      <p className="text-xs text-gray-600 mb-3">NAICS codes: Fitness Centers · Weight Loss Centers · Supplement Stores · Botanical Mfg</p>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {results && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 mb-2">{results.length} award recipients found</p>
          {results.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No results — try a longer date range.</p>}
          {results.map(award => (
            <div key={award.id} className="flex items-start justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug truncate">{award.name}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-brand-400 font-medium">{award.amount}</span>
                  {award.agency && <span className="text-xs text-gray-500 truncate max-w-[180px]">{award.agency}</span>}
                  {award.date && <span className="text-xs text-gray-600">{award.date}</span>}
                </div>
              </div>
              <button
                onClick={() => addAward(award)}
                disabled={added.has(award.id)}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded-md ${added.has(award.id) ? 'bg-green-900/40 text-green-400' : 'btn-primary'}`}
              >
                {added.has(award.id) ? '✓ Added' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── AI Prospecting Strategy ───────────────────────────────────────────────────
function ProspectStrategySection({ contacts }) {
  const [strategy, setStrategy] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const customers = contacts.filter(c => c.status === 'Customer' || c.status === 'Repeat Customer')

  async function run() {
    if (!getApiKey()) { setError('Add your API key in Settings first.'); return }
    setLoading(true); setError('')
    try {
      const result = await generateProspectingStrategy({ customers, allContacts: contacts })
      setStrategy(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  function CopyBtn({ text, id }) {
    return (
      <button
        onClick={() => copy(text, id)}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex-shrink-0"
      >
        {copied === id ? <CheckCircle2 size={10} className="text-green-400" /> : <Copy size={10} />}
      </button>
    )
  }

  return (
    <Section
      title="AI Prospecting Strategy"
      subtitle="AI analyzes your best customers and tells you exactly where and how to find more like them"
      icon={Target}
    >
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {!strategy && !loading && (
        <div className="space-y-4">
          {customers.length === 0 ? (
            <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/40 text-sm text-yellow-300">
              <p className="font-semibold">No customers yet</p>
              <p className="text-xs mt-0.5 text-yellow-400">The AI will generate a general strategy for a new 1st Phorm affiliate. Add your first customers for a personalized plan.</p>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 text-sm text-gray-300">
              <p>Analyzing <span className="text-white font-semibold">{customers.length} customers</span> to find who to target next.</p>
            </div>
          )}
          <button
            onClick={run}
            className="btn-primary flex items-center gap-2 w-full justify-center"
          >
            <Sparkles size={14} /> Generate My Prospecting Strategy
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
          <RefreshCw size={20} className="animate-spin text-brand-400" />
          <p className="text-sm">Analyzing your customer profiles…</p>
        </div>
      )}

      {strategy && !loading && (
        <div className="space-y-5">
          <button
            onClick={run}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-xs font-semibold transition-colors"
          >
            <RefreshCw size={11} /> Regenerate
          </button>

          {/* Ideal prospect profile */}
          {strategy.idealProspectProfile && (
            <div className="px-4 py-3 rounded-lg bg-brand-900/20 border border-brand-700/30">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-brand-400 uppercase tracking-wide">Ideal Prospect Profile</p>
                <CopyBtn text={strategy.idealProspectProfile} id="profile" />
              </div>
              <p className="text-sm text-brand-200">{strategy.idealProspectProfile}</p>
            </div>
          )}

          {/* Cold opening line */}
          {strategy.coldOpeningLine && (
            <div className="px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700/40">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cold Opening Line</p>
                <CopyBtn text={strategy.coldOpeningLine} id="opening" />
              </div>
              <p className="text-sm text-gray-200 italic">"{strategy.coldOpeningLine}"</p>
            </div>
          )}

          {/* Qualifying signals */}
          {strategy.qualifyingSignals?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Signs They're a Warm Prospect</p>
              <div className="flex flex-wrap gap-1.5">
                {strategy.qualifyingSignals.map((s, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-green-900/30 border border-green-700/30 text-green-300 text-xs">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Platform strategies */}
          {strategy.platforms?.map((plat, i) => (
            <div key={i} className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4 space-y-3">
              <p className="font-bold text-white flex items-center gap-2">
                <MapPin size={13} className="text-brand-400" />
                {plat.platform}
              </p>

              {plat.hashtags?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1"><Hash size={10} /> Hashtags to search</p>
                  <div className="flex flex-wrap gap-1.5">
                    {plat.hashtags.map((h, j) => (
                      <span key={j} className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 text-xs font-mono">#{h.replace(/^#/, '')}</span>
                    ))}
                  </div>
                </div>
              )}

              {plat.groups?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Groups to join</p>
                  <ul className="space-y-0.5">
                    {plat.groups.map((g, j) => (
                      <li key={j} className="text-xs text-gray-300 flex items-start gap-1.5"><span className="text-brand-400 mt-0.5">→</span>{g}</li>
                    ))}
                  </ul>
                </div>
              )}

              {plat.actions?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Daily actions</p>
                  <ul className="space-y-1">
                    {plat.actions.map((a, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-gray-300">
                        <CheckCircle2 size={11} className="text-brand-400 flex-shrink-0 mt-0.5" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {plat.engagementTip && (
                <div className="px-3 py-2 rounded-lg bg-brand-900/20 border border-brand-700/20">
                  <p className="text-xs text-brand-300"><span className="font-semibold">Pro tip:</span> {plat.engagementTip}</p>
                </div>
              )}
            </div>
          ))}

          {/* Daily routine */}
          {strategy.dailyRoutine?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Daily 20-Minute Prospecting Routine</p>
              <div className="space-y-2">
                {strategy.dailyRoutine.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-800/40 rounded-lg px-4 py-2.5">
                    <span className="text-xs font-bold text-brand-400 flex-shrink-0 w-14">{r.minutes} min</span>
                    <p className="text-sm text-gray-200">{r.task}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

// ── Main Acquire page ─────────────────────────────────────────────────────────
export default function Acquire() {
  const { contacts } = useStore()

  const thisWeek = contacts.filter(c => {
    const created = new Date(c.createdAt)
    return (Date.now() - created.getTime()) < 7 * 24 * 60 * 60 * 1000
  }).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserPlus size={22} className="text-brand-400" />
            Contact Acquisition
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Continuously grow your prospect list — paste lists, import data, or let AI find your next customers.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{thisWeek}</p>
          <p className="text-xs text-gray-500">added this week</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Contacts', value: contacts.length },
          { label: 'New Leads', value: contacts.filter(c => c.status === 'New Lead').length },
          { label: 'Warm + Hot', value: contacts.filter(c => c.status === 'Warm Lead' || c.status === 'Hot Lead').length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700/40">
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <AutoEnginePanel />
      <QuickAddSection />
      <PasteImportSection />
      <RedditScannerSection />
      <HackerNewsSection />
      <DevToSection />
      <RssFeedSection />
      <StackExchangeSection />
      <GymFinderSection />
      <GooglePlacesSection />
      <YouTubeSection />
      <RunSignUpSection />
      <MastodonSection />
      <GitHubFitnessSection />
      <EventbriteSection />
      <USASpendingSection />
      <ProspectStrategySection contacts={contacts} />
      <PhoneContactsSection />
      <InstagramImportSection />
    </div>
  )
}
