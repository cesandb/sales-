// DigestSender — sends a daily morning summary to a Discord or Slack webhook.
// Runs once per day at startup if a webhook URL is configured.
// Covers: new leads added, emails sent, pipeline value, top contacts to reach today.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { getMQ } from '../utils/messageQueue'
import { getPipelineLog } from './PipelineAutomationEngine'

export const DIGEST_WEBHOOK_KEY   = 'phorm_digest_webhook'
export const DIGEST_LAST_SENT_KEY = 'phorm_digest_last_sent'
export const DIGEST_TYPE_KEY      = 'phorm_digest_type'  // 'discord' | 'slack'

function getWebhook() {
  return localStorage.getItem(DIGEST_WEBHOOK_KEY) || ''
}

function wasAlreadySentToday() {
  const last = localStorage.getItem(DIGEST_LAST_SENT_KEY) || ''
  return last === new Date().toISOString().split('T')[0]
}

function markSentToday() {
  localStorage.setItem(DIGEST_LAST_SENT_KEY, new Date().toISOString().split('T')[0])
}

function buildDigest(store) {
  const { contacts, interactions, followups, deals, pipeline } = store
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // New leads added in last 24h
  const newLeads = contacts.filter(c => c.createdAt >= yesterdayStr)

  // Interactions logged today
  const todayInteractions = interactions.filter(i => (i.date || '').startsWith(todayStr))

  // Pending follow-ups due today or overdue
  const dueFollowups = followups.filter(f => f.status === 'pending' && f.date <= todayStr)

  // Active pipeline value
  const pipelineValue = (deals || [])
    .filter(d => d.stage !== 'closed_lost' && d.stage !== 'closed_won')
    .reduce((sum, d) => sum + (d.amount || 0), 0)

  // Won deals (commissions)
  const wonDeals = (deals || []).filter(d => d.stage === 'closed_won')
  const totalRevenue = wonDeals.reduce((sum, d) => sum + ((d.amount || 0) * 0.15), 0)

  // Recent pipeline log (last 24h)
  const recentLog = getPipelineLog().filter(l => l.ts >= yesterdayStr)
  const emailsSent = recentLog.filter(l => ['gmail-sent', 'email-sent', 'sms-sent'].includes(l.type)).length
  const dmsSent    = recentLog.filter(l => l.type === 'reddit-dm').length
  const newImports = recentLog.filter(l => l.type === 'apollo-import').length

  // Message queue pending
  const mqPending = getMQ().filter(i => i.status === 'pending').length

  // Top contacts to reach today
  const topFollowups = dueFollowups
    .slice(0, 5)
    .map(f => contacts.find(c => c.id === f.contactId))
    .filter(Boolean)

  // Hot + champion leads
  const hotLeads = contacts.filter(c => c.status === 'Hot Lead' || c.status === 'Opportunity').length

  return {
    newLeads: newLeads.length,
    hotLeads,
    emailsSent,
    dmsSent,
    newImports,
    dueFollowups: dueFollowups.length,
    todayInteractions: todayInteractions.length,
    pipelineValue,
    totalRevenue,
    mqPending,
    topFollowups: topFollowups.map(c => c.name),
    totalContacts: contacts.length,
  }
}

async function sendDiscordDigest(webhookUrl, d) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  const emoji = d.emailsSent + d.dmsSent > 10 ? '🔥' : d.emailsSent + d.dmsSent > 0 ? '📬' : '😴'

  const embed = {
    title: `${emoji} Phorm CRM Daily Digest — ${date}`,
    color: 0x6366f1,
    fields: [
      {
        name: '📈 Pipeline',
        value: [
          `**${d.totalContacts}** total contacts`,
          `**${d.hotLeads}** hot leads / opportunities`,
          `**$${d.pipelineValue.toFixed(0)}** active pipeline`,
          `**$${d.totalRevenue.toFixed(0)}** commissions earned`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '📬 Outreach (24h)',
        value: [
          `**${d.emailsSent}** emails sent`,
          `**${d.dmsSent}** Reddit DMs sent`,
          `**${d.newImports}** new leads imported`,
          `**${d.mqPending}** messages pending`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '📅 Today\'s Queue',
        value: d.dueFollowups > 0
          ? [
              `**${d.dueFollowups}** follow-ups due`,
              ...(d.topFollowups.length > 0 ? [`Top: ${d.topFollowups.slice(0, 3).join(', ')}`] : []),
            ].join('\n')
          : '✅ Clear queue',
        inline: false,
      },
    ],
    footer: { text: 'Phorm CRM · Auto-Digest' },
    timestamp: new Date().toISOString(),
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
    signal: AbortSignal.timeout(10000),
  })
}

async function sendSlackDigest(webhookUrl, d) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const text = [
    `*📊 Phorm CRM Digest — ${date}*`,
    `Pipeline: *${d.hotLeads}* hot leads · *$${d.pipelineValue.toFixed(0)}* active · *$${d.totalRevenue.toFixed(0)}* earned`,
    `Outreach (24h): *${d.emailsSent}* emails · *${d.dmsSent}* DMs · *${d.newImports}* imported`,
    `Queue: *${d.dueFollowups}* follow-ups due · *${d.mqPending}* messages pending`,
    d.topFollowups.length > 0 ? `Top contacts: ${d.topFollowups.slice(0, 3).join(', ')}` : '',
  ].filter(Boolean).join('\n')

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(10000),
  })
}

async function runDigest(store) {
  const webhookUrl = getWebhook()
  if (!webhookUrl) return
  if (wasAlreadySentToday()) return

  const d = buildDigest(store)
  const type = localStorage.getItem(DIGEST_TYPE_KEY) || 'discord'

  try {
    if (type === 'slack') {
      await sendSlackDigest(webhookUrl, d)
    } else {
      await sendDiscordDigest(webhookUrl, d)
    }
    markSentToday()
    window.dispatchEvent(new CustomEvent('digest-sent', { detail: d }))
  } catch { /* network failure — try again tomorrow */ }
}

export default function DigestSender() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    // Send ~2 minutes after app loads (gives data time to load from localStorage)
    const t = setTimeout(() => runDigest(storeRef.current), 2 * 60 * 1000)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
