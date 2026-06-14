// DailyPriorityEngine — fires at 8am each day, scores all contacts, and creates
// follow-up tasks for the top 8 contacts most worth a personal reach-out today.
// "Personal" means no active enrollment throttles them — just direct human contact.

import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { batchCalcLeadScores } from '../utils/leadScore'
import { differenceInDays, parseISO } from 'date-fns'

const DONE_KEY = 'phorm_daily_priority_v1'  // ISO date string of last run

function getLastRunDate() {
  return localStorage.getItem(DONE_KEY) || ''
}

function markRanToday() {
  localStorage.setItem(DONE_KEY, new Date().toISOString().split('T')[0])
}

function hasRanToday() {
  return getLastRunDate() === new Date().toISOString().split('T')[0]
}

function runDailyPriority(s) {
  if (hasRanToday()) return
  const hour = new Date().getHours()
  if (hour < 8) return  // wait for 8am

  const { contacts, interactions, followups, pipeline, addFollowup } = s
  if (!contacts?.length) return

  const scores = batchCalcLeadScores(contacts, interactions || [], followups || [], pipeline || [])
  const now    = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // Filter to active contacts only, with engagement data
  const ranked = contacts
    .filter(c => !['Inactive', 'Evangelist'].includes(c.status))
    .map(c => {
      const sc  = scores.get(c.id) || { score: 0, tier: 'cold' }
      const lastDate = c.lastContact ? parseISO(c.lastContact) : parseISO(c.createdAt)
      const daysSince = differenceInDays(now, lastDate)
      // Priority score: engagement score + bonus for not contacted recently (but not too long)
      const urgency = daysSince >= 3 && daysSince <= 21 ? 15 : daysSince > 21 ? 5 : 0
      const hotBonus = c.status === 'Hot Lead' || c.status === 'At Risk' ? 20 : 0
      return { contact: c, score: sc.score + urgency + hotBonus, tier: sc.tier, daysSince }
    })
    .sort((a, b) => b.score - a.score)

  const top = ranked.slice(0, 8)
  const alreadyScheduled = new Set((followups || []).filter(f => f.date === todayStr).map(f => f.contactId))

  let queued = 0
  for (const { contact, score, tier, daysSince } of top) {
    if (alreadyScheduled.has(contact.id)) continue
    const label = tier === 'champion' || tier === 'hot'
      ? '🔥 Priority reach-out today'
      : tier === 'warm'
        ? '⭐ Warm lead — follow up personally'
        : '📋 Check in today'
    addFollowup({
      contactId: contact.id,
      date: todayStr,
      notes: `${label} (score: ${score}, ${daysSince}d since last contact, status: ${contact.status})`,
    })
    queued++
  }

  markRanToday()

  if (queued > 0) {
    window.dispatchEvent(new CustomEvent('daily-priority-ready', { detail: { count: queued, topName: top[0]?.contact?.name } }))
  }
}

export default function DailyPriorityEngine() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    // Check every 5 minutes whether it's 8am and we haven't run yet today
    const run = () => runDailyPriority(storeRef.current)

    // First check after 30s (catches the case where app loads after 8am)
    const t  = setTimeout(run, 30 * 1000)
    // Then check every 5 minutes
    const iv = setInterval(run, 5 * 60 * 1000)

    return () => { clearTimeout(t); clearInterval(iv) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
