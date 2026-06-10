import { useState, useRef } from 'react'
import { Upload, AlertCircle, CheckCircle, Users, ChevronDown, ChevronUp } from 'lucide-react'
import Modal from './Modal'
import { useStore } from '../store/useStore'

const STATUSES = ['New Lead', 'Warm Lead', 'Hot Lead', 'Customer', 'Repeat Customer', 'Inactive']
const SOURCES  = ['Instagram', 'Facebook', 'TikTok', 'Twitter/X', 'YouTube', 'Referral', 'In Person', 'Email', 'CSV Import', 'Other']

// Map common CSV column names → our fields
const FIELD_MAP = {
  name:       ['name', 'full name', 'fullname', 'contact name', 'first name', 'firstname'],
  phone:      ['phone', 'phone number', 'mobile', 'cell', 'number'],
  email:      ['email', 'email address', 'e-mail'],
  social:     ['social', 'instagram', 'handle', 'ig', 'username', 'social media'],
  notes:      ['notes', 'note', 'comment', 'comments', 'description'],
  source:     ['source', 'lead source', 'how they found you'],
  status:     ['status', 'lead status', 'stage'],
  tags:       ['tags', 'tag', 'interests', 'labels'],
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  const rows = lines.slice(1).map(line => {
    const values = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue }
      current += char
    }
    values.push(current.trim())
    return headers.reduce((obj, h, i) => { obj[h] = values[i] || ''; return obj }, {})
  }).filter(row => Object.values(row).some(v => v))
  return { headers, rows }
}

function mapRow(row) {
  const contact = { status: 'New Lead', source: 'CSV Import' }
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== '') {
        contact[field] = row[alias]
        break
      }
    }
  }
  // Normalise status
  if (contact.status && !STATUSES.includes(contact.status)) {
    contact.status = 'New Lead'
  }
  // Normalise tags to array
  if (typeof contact.tags === 'string') {
    contact.tags = contact.tags.split(/[;|,]/).map(t => t.trim()).filter(Boolean)
  }
  return contact
}

export default function ImportModal({ onClose }) {
  const { addContact } = useStore()
  const fileRef = useRef()
  const [preview, setPreview] = useState(null)  // { rows, mapped }
  const [error, setError] = useState('')
  const [imported, setImported] = useState(false)
  const [showPreview, setShowPreview] = useState(true)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const { rows } = parseCSV(ev.target.result)
        if (rows.length === 0) { setError('No data rows found in the file.'); return }
        const mapped = rows.map(mapRow).filter(c => c.name)
        if (mapped.length === 0) { setError('No rows with a "name" column found. Make sure your CSV has a "Name" header.'); return }
        setPreview({ total: rows.length, mapped })
      } catch {
        setError('Could not parse file. Make sure it is a valid CSV.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleImport() {
    if (!preview) return
    preview.mapped.forEach(contact => addContact(contact))
    setImported(true)
  }

  return (
    <Modal title="Import Contacts" onClose={onClose} wide>
      <div className="space-y-4">
        {!imported ? (
          <>
            {/* Instructions */}
            <div className="p-3 rounded-lg bg-gray-800/60 border border-gray-700 text-xs text-gray-300 space-y-1.5">
              <p className="font-semibold text-white">CSV column names recognised:</p>
              <div className="grid grid-cols-2 gap-x-4">
                {Object.entries(FIELD_MAP).map(([field, aliases]) => (
                  <p key={field}><span className="text-brand-400 font-mono">{field}</span> — {aliases.slice(0,3).join(', ')}</p>
                ))}
              </div>
              <p className="text-gray-500 mt-1">Exports from iPhone Contacts, Google Contacts, and most CRMs work automatically.</p>
            </div>

            {/* Upload */}
            {!preview ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center gap-3 py-8 rounded-xl border-2 border-dashed border-gray-700 hover:border-brand-600 hover:bg-brand-900/5 transition-colors"
              >
                <Upload size={28} className="text-gray-500" />
                <div className="text-center">
                  <p className="text-white font-semibold text-sm">Tap to choose a CSV file</p>
                  <p className="text-xs text-gray-500 mt-0.5">From your phone or computer</p>
                </div>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-900/20 border border-green-700/40">
                  <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-green-300 font-semibold">
                      {preview.mapped.length} contacts ready to import
                    </p>
                    <p className="text-xs text-gray-500">
                      {preview.total - preview.mapped.length > 0
                        ? `${preview.total - preview.mapped.length} rows skipped (missing name)`
                        : 'All rows have names'}
                    </p>
                  </div>
                  <button
                    onClick={() => { setPreview(null); setError('') }}
                    className="ml-auto text-xs text-gray-500 hover:text-white underline"
                  >
                    Change file
                  </button>
                </div>

                {/* Preview table */}
                <button
                  onClick={() => setShowPreview(s => !s)}
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors w-full"
                >
                  {showPreview ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {showPreview ? 'Hide' : 'Show'} preview (first 5)
                </button>
                {showPreview && (
                  <div className="overflow-x-auto rounded-lg border border-gray-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-800 bg-gray-800/40">
                          {['Name', 'Phone', 'Email', 'Social', 'Status', 'Source'].map(h => (
                            <th key={h} className="text-left px-3 py-2 text-gray-400 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.mapped.slice(0, 5).map((c, i) => (
                          <tr key={i} className="border-b border-gray-800/50">
                            <td className="px-3 py-2 text-white font-medium">{c.name}</td>
                            <td className="px-3 py-2 text-gray-400">{c.phone || '—'}</td>
                            <td className="px-3 py-2 text-gray-400 truncate max-w-24">{c.email || '—'}</td>
                            <td className="px-3 py-2 text-gray-400">{c.social || '—'}</td>
                            <td className="px-3 py-2"><span className="badge bg-blue-900/40 text-blue-300 text-[10px]">{c.status}</span></td>
                            <td className="px-3 py-2 text-gray-500">{c.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.mapped.length > 5 && (
                      <p className="text-center text-xs text-gray-600 py-2">…and {preview.mapped.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/40">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />

            <div className="flex gap-3 pt-1 border-t border-gray-800">
              <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
              {preview && (
                <button
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  onClick={handleImport}
                >
                  <Users size={14} /> Import {preview.mapped.length} Contacts
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8 space-y-3">
            <CheckCircle size={40} className="text-green-400 mx-auto" />
            <p className="text-white font-bold text-lg">{preview.mapped.length} contacts imported!</p>
            <p className="text-sm text-gray-400">They're all in your Outreach Queue as New Leads.</p>
            <button className="btn-primary w-full" onClick={onClose}>Go to Queue</button>
          </div>
        )}
      </div>
    </Modal>
  )
}
