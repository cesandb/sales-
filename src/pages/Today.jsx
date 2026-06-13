// Today — Daily manual action hub. Surfaces the highest-priority contacts
// to personally reach out to, with copy-ready messages for each.

import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { matchProduct, buildUTMLink } from '../utils/affiliateLinks'
import { Target, Flame, MousePointerClick, MessageSquare, UserPlus, Copy, Check, Zap, TrendingUp } from 'lucide-react'

const OUTREACH_TYPES = new Set(['Email', 'SMS', 'DM', 'Reddit DM', 'Outreach'])
const REPLY_TYPES    = new Set(['Email Reply', 'Reddit Reply', 'DM Reply', 'Reply'])

function buildMessage(type, firstName, productName, link) {
  switch (type) {
    case 'hot':
      return `Hey ${firstName}! Wanted to check in — have you had a chance to look at that ${productName} link I sent? Happy to answer any questions or help you figure out the best option for your goals 💪\n\n${link}`
    case 'click':
      return `Hey ${firstName}! Noticed you checked out that ${productName} link — did it look like a good fit? Happy to answer anything before you decide 🙌\n\n${link}`
    case 'reply':
      return `Hey ${firstName}! Great hearing from you. Based on what you mentioned, I think ${productName} is exactly what you're looking for. Here's the link if you want to grab it:\n\n${link}`
    case 'new':
      return `Hey ${firstName}! I came across your profile and wanted to reach out — I help people find the right nutrition stack for their goals. ${productName} is what I'd recommend for someone like you. Worth a look!\n\n${link}`
    default:
      return `Hey ${firstName}! Checking in from Conan at 1st Phorm — ${link}`
  }
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }
  return (
    <button
      onClick={copy}
      className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
        copied
          ? 'bg-green-900/40 text-green-400 border-green-700/40'
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700'
      }`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function ContactRow({ entry }) {
  const { contact, product, messageType } = entry
  const firstName = contact.name.split(' ')[0]
  const link = buildUTMLink(
    `https://1stphorm.com/products/${product.id}/?a_aid=Conan`,
    { contactId: contact.id, stepKey: `today-${messageType}` }
  )
  const message = buildMessage(messageType, firstName, product.name, link)
  const channel = contact.email ? 'Email' : contact.phone ? 'SMS' : contact.social ? 'DM' : '—'

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-900/60 border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white">{contact.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{contact.status}</span>
          <span className="text-[10px] text-gray-500">{channel}</span>
          {contact.email && <span className="text-[10px] text-gray-600 truncate max-w-[140px]">{contact.email}</span>}
          {!contact.email && contact.social && <span className="text-[10px] text-gray-600 truncate max-w-[140px]">{contact.social}</span>}
        </div>
        <p className="text-[11px] font-medium text-brand-300 mt-0.5">{product.name}</p>
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-3">{message}</p>
      </div>
      <CopyButton text={message} />
    </div>
  )
}

function Section({ title, subtitle, items, icon: Icon, iconCls, borderCls, bgCls, emptyText }) {
  if (items.length === 0) {
    return (
      <div className={`rounded-xl border ${borderCls} ${bgCls} p-4 opacity-50`}>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Icon size={14} className={iconCls} /> {title}
        </h2>
        <p className="text-xs text-gray-500 mt-1">{emptyText}</p>
      </div>
    )
  }
  return (
    <div className={`rounded-xl border ${borderCls} ${bgCls} p-4 space-y-2`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Icon size={14} className={iconCls} /> {title}
          </h2>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-[10px] text-gray-500 bg-gray-800/60 px-2 py-1 rounded">
          {items.length} contact{items.length !== 1 ? 's' : ''}
        </span>
      </div>
      {items.map(entry => (
        <ContactRow key={entry.contact.id} entry={entry} />
      ))}
    </div>
  )
}

function useTodayPriorities() {
  const { contacts, interactions } = useStore()

  return useMemo(() => {
    const now          = Date.now()
    const h24          = now - 24 * 60 * 60 * 1000
    const h48          = now - 48 * 60 * 60 * 1000
    const todayStr     = new Date().toISOString().split('T')[0]

    const lastOutreach = new Map()
    const lastReply    = new Map()
    const recentClicks = new Set()
    const todayReached = new Set()

    for (const i of interactions) {
      const ts = new Date(i.date).getTime()
      if (OUTREACH_TYPES.has(i.type)) {
        const prev = lastOutreach.get(i.contactId) || 0
        if (ts > prev) lastOutreach.set(i.contactId, ts)
        if (i.date === todayStr) todayReached.add(i.contactId)
      }
      if (REPLY_TYPES.has(i.type)) {
        const prev = lastReply.get(i.contactId) || 0
        if (ts > prev) lastReply.set(i.contactId, ts)
      }
      if (i.type === 'Link Click' && ts > h24) {
        recentClicks.add(i.contactId)
      }
    }

    const hotLeads  = []
    const clickers  = []
    const needReply = []
    const newToday  = []

    for (const contact of contacts) {
      if (contact.status === 'Inactive') continue
      const product = matchProduct(contact)
      const entry   = { contact, product, messageType: '' }

      // Hot Leads not already reached today
      if (contact.status === 'Hot Lead' && !todayReached.has(contact.id)) {
        hotLeads.push({ ...entry, messageType: 'hot' })
        continue
      }

      // Clicked a link in the last 24h and not yet a Customer
      if (recentClicks.has(contact.id) && contact.status !== 'Customer') {
        clickers.push({ ...entry, messageType: 'click' })
        continue
      }

      // Replied in last 48h with no subsequent outreach
      const replyTs   = lastReply.get(contact.id) || 0
      const outTs     = lastOutreach.get(contact.id) || 0
      if (replyTs > h48 && replyTs > outTs) {
        needReply.push({ ...entry, messageType: 'reply' })
        continue
      }

      // Added today — first impression opportunity
      if (contact.createdAt && new Date(contact.createdAt).getTime() > h24) {
        newToday.push({ ...entry, messageType: 'new' })
      }
    }

    return {
      hotLeads:  hotLeads.slice(0, 5),
      clickers:  clickers.slice(0, 5),
      needReply: needReply.slice(0, 5),
      newToday:  newToday.slice(0, 10),
    }
  }, [contacts, interactions])
}

export default function Today() {
  const { hotLeads, clickers, needReply, newToday } = useTodayPriorities()
  const total = hotLeads.length + clickers.length + needReply.length + newToday.length

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Target size={22} className="text-brand-400" />
            Today's Hit List
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {total > 0
              ? `${total} high-priority contact${total !== 1 ? 's' : ''} to personally reach out to right now.`
              : 'All caught up — automation engines are running in the background.'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-2">
          <Zap size={11} className="text-brand-400" />
          Copy message → send via your preferred channel
        </div>
      </div>

      {total === 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-8 text-center">
          <TrendingUp size={32} className="mx-auto text-brand-400 mb-3" />
          <p className="text-white font-semibold">Fully automated today</p>
          <p className="text-gray-400 text-sm mt-1">The engines are running. Check back after new contacts arrive or automation fires.</p>
        </div>
      )}

      <Section
        title="Hot Leads — Reach Out Now"
        subtitle="Manually touch every hot lead every day until they buy or opt out"
        items={hotLeads}
        icon={Flame}
        iconCls="text-red-400"
        borderCls="border-red-800/40"
        bgCls="bg-red-900/5"
        emptyText="No hot leads needing manual contact today."
      />

      <Section
        title="Clicked Your Link — Strike While Hot"
        subtitle="Someone looked at your product in the last 24h — they're interested"
        items={clickers}
        icon={MousePointerClick}
        iconCls="text-brand-400"
        borderCls="border-brand-800/40"
        bgCls="bg-brand-900/5"
        emptyText="No link clickers in the last 24h."
      />

      <Section
        title="Replied — Follow Up"
        subtitle="They responded — close the loop before they lose interest"
        items={needReply}
        icon={MessageSquare}
        iconCls="text-green-400"
        borderCls="border-green-800/40"
        bgCls="bg-green-900/5"
        emptyText="No unanswered replies right now."
      />

      <Section
        title="New Today — First Impression"
        subtitle="New contacts added in the last 24h — reach out while the signal is fresh"
        items={newToday}
        icon={UserPlus}
        iconCls="text-blue-400"
        borderCls="border-blue-800/40"
        bgCls="bg-blue-900/5"
        emptyText="No new contacts added today."
      />
    </div>
  )
}
