import { useState } from 'react'
import { Sparkles, Copy, Check, RefreshCw, AlertCircle, MessageSquare, Phone, Mail } from 'lucide-react'
import Modal from './Modal'
import { generateOutreachDraft, getApiKey } from '../utils/aiDraft'
import { Link } from 'react-router-dom'

const PLATFORMS = [
  { id: 'Instagram DM', label: 'Instagram DM', icon: MessageSquare },
  { id: 'Text/SMS',     label: 'Text/SMS',     icon: Phone },
  { id: 'Email',        label: 'Email',         icon: Mail },
]

export default function AIMessageModal({ contact, interactions, productName, onClose }) {
  const [platform, setPlatform] = useState('Instagram DM')
  const [context, setContext] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const hasKey = !!getApiKey()

  async function generate() {
    setLoading(true)
    setError('')
    setDraft('')
    try {
      const text = await generateOutreachDraft({ contact, interactions, platform, productName, context })
      setDraft(text)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function copy() {
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal title="AI Message Draft" onClose={onClose}>
      <div className="space-y-4">
        {/* Contact context */}
        <div className="p-3 rounded-lg bg-gray-800/60 border border-gray-700 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-700/40 flex items-center justify-center text-sm font-bold text-brand-300 flex-shrink-0">
            {contact.name[0]}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{contact.name}</p>
            <p className="text-xs text-gray-400">{contact.status}{productName ? ` · Re: ${productName}` : ''}</p>
          </div>
        </div>

        {!hasKey && (
          <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/40 flex items-start gap-2">
            <AlertCircle size={15} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-300">
              No API key set.{' '}
              <Link to="/settings" onClick={onClose} className="underline hover:text-yellow-200">
                Add your Anthropic key in Settings
              </Link>{' '}
              to enable AI drafts.
            </p>
          </div>
        )}

        {/* Platform selector */}
        <div>
          <label className="label">Platform</label>
          <div className="flex gap-2">
            {PLATFORMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPlatform(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  platform === id ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Extra context */}
        <div>
          <label className="label">Extra context <span className="text-gray-600 font-normal">(optional)</span></label>
          <input
            className="input"
            placeholder="e.g. She mentioned she wants to lose 15 lbs…"
            value={context}
            onChange={e => setContext(e.target.value)}
          />
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={loading || !hasKey}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading
            ? <><RefreshCw size={14} className="animate-spin" /> Drafting…</>
            : <><Sparkles size={14} /> {draft ? 'Regenerate' : 'Generate Draft'}</>
          }
        </button>

        {error && (
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-700/40">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Draft output */}
        {draft && (
          <div className="space-y-2">
            <label className="label">Draft</label>
            <div className="relative">
              <textarea
                className="input min-h-28 resize-none pr-10 text-sm leading-relaxed"
                value={draft}
                onChange={e => setDraft(e.target.value)}
              />
            </div>
            <button
              onClick={copy}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                copied ? 'bg-green-900/40 text-green-400' : 'btn-secondary'
              }`}
            >
              {copied ? <><Check size={14} /> Copied to clipboard!</> : <><Copy size={14} /> Copy Message</>}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
