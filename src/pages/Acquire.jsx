import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { generateProspectingStrategy, getApiKey } from '../utils/aiDraft'
import {
  UserPlus, Clipboard, Smartphone, Instagram, RefreshCw,
  CheckCircle2, AlertCircle, Sparkles, Copy, ExternalLink,
  Target, Hash, Users, ChevronDown, ChevronUp, Upload, Zap,
  MapPin, MessageSquare,
} from 'lucide-react'

const SOURCES = ['Instagram', 'Facebook', 'TikTok', 'Twitter/X', 'YouTube', 'WhatsApp', 'Referral', 'In Person', 'Email', 'Other']
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
function Section({ title, subtitle, icon: Icon, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen)
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
              {badge && <span className="badge bg-brand-700/40 text-brand-300 text-[10px]">{badge}</span>}
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

      <QuickAddSection />
      <PasteImportSection />
      <ProspectStrategySection contacts={contacts} />
      <PhoneContactsSection />
      <InstagramImportSection />
    </div>
  )
}
