import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { getApiKey } from '../utils/aiDraft'
import { matchProduct, buildUTMLink, DEFAULT_SEQUENCES } from '../utils/affiliateLinks'
import Anthropic from '@anthropic-ai/sdk'
import { Radio, CheckSquare, Square, ChevronRight, Copy, Check, MessageSquare, Loader2, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

const STATUS_OPTIONS = ['New Lead', 'Warm Lead', 'Hot Lead']

const STATUS_COLOR = {
  'New Lead':  'bg-blue-900/40 text-blue-300',
  'Warm Lead': 'bg-yellow-900/40 text-yellow-300',
  'Hot Lead':  'bg-orange-900/40 text-orange-300',
  'Customer':  'bg-green-900/40 text-green-300',
  'Repeat Customer': 'bg-emerald-900/40 text-emerald-300',
  'Inactive':  'bg-gray-800 text-gray-400',
}

const SOURCE_PLATFORM_ICON = {
  Instagram: '📸',
  Facebook:  '👥',
  Twitter:   '🐦',
  TikTok:    '🎵',
  LinkedIn:  '💼',
  Reddit:    '🤖',
  Text:      '💬',
  Email:     '📧',
  Referral:  '🤝',
  Other:     '🌐',
}

function getPlatformIcon(source) {
  if (!source) return '🌐'
  for (const [key, icon] of Object.entries(SOURCE_PLATFORM_ICON)) {
    if (source.toLowerCase().includes(key.toLowerCase())) return icon
  }
  return '🌐'
}

export default function Broadcast() {
  const { contacts, interactions, addInteraction } = useStore()
  const apiKey = getApiKey()

  // Filter state
  const [statusFilter, setStatusFilter] = useState(new Set(STATUS_OPTIONS))
  const [tagFilter, setTagFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  // Selection
  const [selected, setSelected] = useState(new Set())

  // Generation state
  const [step, setStep] = useState('select') // 'select' | 'generate' | 'send'
  const [generating, setGenerating] = useState(false)
  const [generatingId, setGeneratingId] = useState(null)
  const [generateProgress, setGenerateProgress] = useState(0)
  const [messages, setMessages] = useState(new Map()) // contactId -> string

  // Per-message UI state
  const [copied, setCopied] = useState(new Set())
  const [sent, setSent] = useState(new Set())

  // Filtered contacts
  const filtered = useMemo(() => {
    return contacts.filter(c => {
      if (!statusFilter.has(c.status)) return false
      if (tagFilter.trim()) {
        const tf = tagFilter.trim().toLowerCase()
        const tags = (c.tags || []).map(t => t.toLowerCase())
        if (!tags.some(t => t.includes(tf))) return false
      }
      if (sourceFilter.trim()) {
        const sf = sourceFilter.trim().toLowerCase()
        if (!(c.source || '').toLowerCase().includes(sf)) return false
      }
      return true
    })
  }, [contacts, statusFilter, tagFilter, sourceFilter])

  // Unique sources for display
  const allSources = useMemo(() => {
    const s = new Set(contacts.map(c => c.source).filter(Boolean))
    return Array.from(s).sort()
  }, [contacts])

  function toggleStatus(s) {
    setStatusFilter(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  function toggleContact(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(filtered.map(c => c.id)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  function updateMessage(contactId, text) {
    setMessages(prev => new Map(prev).set(contactId, text))
  }

  async function handleGenerate() {
    if (!apiKey) return
    const selectedContacts = filtered.filter(c => selected.has(c.id))
    if (selectedContacts.length === 0) return

    setGenerating(true)
    setStep('generate')
    setGenerateProgress(0)

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    const newMessages = new Map(messages)

    for (let i = 0; i < selectedContacts.length; i++) {
      const contact = selectedContacts[i]
      setGeneratingId(contact.id)

      const product = matchProduct(contact)
      const utmLink = buildUTMLink(product.url, {
        contactId: contact.id,
        medium: 'broadcast',
        stepKey: 'broadcast',
      })

      const recentInteractions = (interactions || [])
        .filter(inter => inter.contactId === contact.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3)
        .map(i => `- ${i.type}: ${i.notes}`)
        .join('\n')

      const prompt = `You are writing a short personalized outreach message for Conan, a 1st Phorm fitness supplement affiliate.

CONTACT:
- Name: ${contact.name}
- Status: ${contact.status}
- Source: ${contact.source || 'unknown'}
- Tags: ${(contact.tags || []).join(', ') || 'none'}
- Notes: ${contact.notes || 'none'}

RECENT INTERACTIONS:
${recentInteractions || 'No prior interactions'}

RECOMMENDED PRODUCT: ${product.name}
PRODUCT LINK: ${utmLink}

Write a single short message (60-100 words) that:
1. Feels personal and genuine — not a template
2. References something specific from their profile if possible
3. Naturally mentions the product and includes the link
4. Ends with a soft question or invitation to chat
5. Matches casual DM/social media tone

Output ONLY the message text, nothing else.`

      try {
        const msg = await client.messages.create({
          model: 'claude-opus-4-8',
          max_tokens: 300,
          thinking: { type: 'adaptive' },
          messages: [{ role: 'user', content: prompt }],
        })
        const text = msg.content.find(b => b.type === 'text')?.text || ''
        newMessages.set(contact.id, text)
        setMessages(new Map(newMessages))
      } catch (err) {
        newMessages.set(contact.id, `Hey ${contact.name}! I wanted to reach out about something that might really help your fitness journey — check this out: ${utmLink} — Happy to answer any questions!`)
        setMessages(new Map(newMessages))
      }

      setGenerateProgress(Math.round(((i + 1) / selectedContacts.length) * 100))

      // 500ms delay between calls to avoid rate limits
      if (i < selectedContacts.length - 1) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    setGeneratingId(null)
    setGenerating(false)
    setStep('send')
  }

  function handleCopy(contactId) {
    const text = messages.get(contactId) || ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(prev => new Set(prev).add(contactId))
      setTimeout(() => {
        setCopied(prev => {
          const next = new Set(prev)
          next.delete(contactId)
          return next
        })
      }, 2000)
    })
  }

  function handleMarkSent(contactId) {
    const contact = contacts.find(c => c.id === contactId)
    addInteraction({
      contactId,
      type: 'DM',
      notes: `[Broadcast] ${messages.get(contactId)?.slice(0, 100) || 'Message sent via Broadcast'}`,
    })
    setSent(prev => new Set(prev).add(contactId))
  }

  const selectedContacts = filtered.filter(c => selected.has(c.id))
  const selectedCount = selected.size

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-brand-900/40 border border-brand-700/30">
            <Radio size={20} className="text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Broadcast</h1>
            <p className="text-gray-400 text-sm">Reach Many at Once</p>
          </div>
        </div>
        <p className="text-gray-500 text-sm mt-2">
          Generate personalized messages for multiple contacts, then send them one by one.
        </p>
      </div>

      {/* No API key warning */}
      {!apiKey && (
        <div className="card border border-yellow-700/40 bg-yellow-900/10 flex items-start gap-3">
          <AlertCircle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-300 font-semibold text-sm">API Key Required</p>
            <p className="text-gray-400 text-sm mt-1">
              Add your Anthropic API key in{' '}
              <Link to="/settings" className="text-brand-400 hover:text-brand-300 underline">Settings</Link>{' '}
              to generate personalized AI messages.
            </p>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {['select', 'generate', 'send'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium ${
              step === s
                ? 'bg-brand-600/30 text-brand-300 border border-brand-600/40'
                : (step === 'send' && s !== 'send') || (step === 'generate' && s === 'select')
                  ? 'text-gray-500 line-through'
                  : 'text-gray-600'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-500'
              }`}>{i + 1}</span>
              {s === 'select' ? 'Select' : s === 'generate' ? 'Generate' : 'Send'}
            </div>
            {i < 2 && <ChevronRight size={14} className="text-gray-700" />}
          </div>
        ))}
      </div>

      {/* Filter Panel */}
      <div className="card">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Filter Contacts</p>
        <div className="flex flex-wrap gap-4 items-end">
          {/* Status checkboxes */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Status</p>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    statusFilter.has(s)
                      ? 'bg-brand-900/30 border-brand-700/40 text-brand-300'
                      : 'border-gray-700/50 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {statusFilter.has(s) ? <CheckSquare size={12} /> : <Square size={12} />}
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Tag filter */}
          <div className="flex-1 min-w-[140px]">
            <p className="text-xs text-gray-500 mb-1.5">Tag contains</p>
            <input
              type="text"
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              placeholder="e.g. fitness, keto..."
              className="input-field text-sm py-1.5 w-full"
            />
          </div>

          {/* Source filter */}
          <div className="flex-1 min-w-[140px]">
            <p className="text-xs text-gray-500 mb-1.5">Source contains</p>
            <input
              type="text"
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              placeholder="e.g. Instagram..."
              className="input-field text-sm py-1.5 w-full"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          <span className="text-white font-semibold">{filtered.length}</span> contacts match
        </p>
      </div>

      {/* SELECT STEP */}
      {step === 'select' && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-white text-sm">Select Contacts</p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-brand-400 hover:text-brand-300">Select All</button>
              <span className="text-gray-700">·</span>
              <button onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-300">Clear</button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">No contacts match the current filter.</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
              {filtered.map(c => (
                <div
                  key={c.id}
                  onClick={() => toggleContact(c.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    selected.has(c.id) ? 'bg-brand-900/20 border border-brand-700/30' : 'hover:bg-gray-800/40 border border-transparent'
                  }`}
                >
                  <div className="flex-shrink-0 text-brand-400">
                    {selected.has(c.id) ? <CheckSquare size={16} /> : <Square size={16} className="text-gray-600" />}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-xs flex-shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{c.name}</span>
                      <span className={`badge text-[10px] ${STATUS_COLOR[c.status] || 'bg-gray-800 text-gray-400'}`}>{c.status}</span>
                      {c.source && (
                        <span className="text-[10px] text-gray-500">
                          {getPlatformIcon(c.source)} {c.source}
                        </span>
                      )}
                    </div>
                    {(c.tags || []).length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {(c.tags || []).slice(0, 4).map(tag => (
                          <span key={tag} className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-md">{tag}</span>
                        ))}
                        {(c.tags || []).length > 4 && (
                          <span className="text-[10px] text-gray-600">+{c.tags.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-800">
            <button
              onClick={handleGenerate}
              disabled={selectedCount === 0 || !apiKey}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MessageSquare size={15} />
              Generate Messages for {selectedCount} Selected
              <ChevronRight size={15} />
            </button>
            {!apiKey && (
              <p className="text-xs text-gray-500 text-center mt-2">Add your API key in Settings to generate messages.</p>
            )}
          </div>
        </div>
      )}

      {/* GENERATE STEP (progress) */}
      {step === 'generate' && (
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 size={18} className="text-brand-400 animate-spin" />
            <div>
              <p className="font-semibold text-white text-sm">Generating Messages...</p>
              <p className="text-xs text-gray-500">Personalizing each message with AI — please wait</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{generateProgress}% complete</span>
              <span>{Math.round((generateProgress / 100) * selectedCount)} / {selectedCount}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-600 rounded-full transition-all duration-300"
                style={{ width: `${generateProgress}%` }}
              />
            </div>
          </div>

          {/* Contact cards */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {selectedContacts.map(c => {
              const isGenerating = generatingId === c.id
              const isDone = messages.has(c.id)
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                    isGenerating
                      ? 'border-brand-700/50 bg-brand-900/10'
                      : isDone
                        ? 'border-green-700/30 bg-green-900/5'
                        : 'border-gray-700/30'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-xs flex-shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-white">{c.name}</span>
                    <span className={`ml-2 badge text-[10px] ${STATUS_COLOR[c.status] || 'bg-gray-800 text-gray-400'}`}>{c.status}</span>
                  </div>
                  {isGenerating && <Loader2 size={14} className="text-brand-400 animate-spin flex-shrink-0" />}
                  {isDone && !isGenerating && <Check size={14} className="text-green-400 flex-shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SEND STEP */}
      {step === 'send' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">
              {selectedCount} messages ready
            </p>
            <button
              onClick={() => { setStep('select'); setSelected(new Set()); setMessages(new Map()); setSent(new Set()) }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Start Over
            </button>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {selectedContacts.map(c => {
              const msg = messages.get(c.id) || ''
              const isCopied = copied.has(c.id)
              const isSent = sent.has(c.id)
              return (
                <div
                  key={c.id}
                  className={`card border transition-colors ${
                    isSent ? 'border-green-700/40 bg-green-900/5 opacity-70' : 'border-gray-700/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-xs flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm">{c.name}</span>
                        <span className={`badge text-[10px] ${STATUS_COLOR[c.status] || 'bg-gray-800 text-gray-400'}`}>{c.status}</span>
                        {c.source && (
                          <span className="text-xs text-gray-500">{getPlatformIcon(c.source)}</span>
                        )}
                      </div>
                    </div>
                    {isSent && (
                      <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                        <Check size={12} /> Sent
                      </span>
                    )}
                  </div>

                  <textarea
                    value={msg}
                    onChange={e => updateMessage(c.id, e.target.value)}
                    rows={4}
                    disabled={isSent}
                    className="w-full bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-brand-600/50 disabled:opacity-60"
                  />

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleCopy(c.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700/50 text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
                    >
                      {isCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => handleMarkSent(c.id)}
                      disabled={isSent}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-900/30 border border-brand-700/40 text-brand-300 hover:bg-brand-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Check size={12} />
                      {isSent ? 'Marked Sent' : 'Mark Sent'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          <div className="card border border-gray-700/30 text-center">
            <p className="text-sm text-gray-400">
              <span className="text-green-400 font-bold">{sent.size}</span> of {selectedCount} messages sent
            </p>
            {sent.size === selectedCount && selectedCount > 0 && (
              <p className="text-xs text-green-400 mt-1 font-medium">All messages sent!</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
