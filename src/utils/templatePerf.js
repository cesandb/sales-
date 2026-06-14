// templatePerf.js — lightweight self-learning: tracks sends, replies, clicks per
// sequence step so the app can surface which templates perform best.

const PERF_KEY = 'phorm_tpl_perf_v2'

function loadPerf() {
  try { return JSON.parse(localStorage.getItem(PERF_KEY) || '{}') }
  catch { return {} }
}

function savePerf(data) {
  localStorage.setItem(PERF_KEY, JSON.stringify(data))
}

function stepKey(seqId, stepKey) {
  return `${seqId}::${stepKey}`
}

export function recordTemplateSend(seqId, step) {
  const d = loadPerf()
  const k = stepKey(seqId, step)
  if (!d[k]) d[k] = { sends: 0, replies: 0, clicks: 0 }
  d[k].sends++
  savePerf(d)
}

export function recordTemplateReply(seqId, step) {
  if (!seqId || !step) return
  const d = loadPerf()
  const k = stepKey(seqId, step)
  if (!d[k]) d[k] = { sends: 0, replies: 0, clicks: 0 }
  d[k].replies++
  savePerf(d)
}

export function recordTemplateClick(seqId, step) {
  if (!seqId || !step) return
  const d = loadPerf()
  const k = stepKey(seqId, step)
  if (!d[k]) d[k] = { sends: 0, replies: 0, clicks: 0 }
  d[k].clicks++
  savePerf(d)
}

export function getTemplateStats() {
  return loadPerf()
}

// Returns engagement rate (replies + clicks) / sends for a step, or 0 if no data
export function getEngagementRate(seqId, step) {
  const d = loadPerf()
  const s = d[stepKey(seqId, step)]
  if (!s || s.sends === 0) return 0
  return (s.replies + s.clicks) / s.sends
}

// Returns the sequence ID with the best overall reply rate (to prioritize for new leads)
export function getTopSequenceId(sequenceIds) {
  if (!sequenceIds?.length) return null
  const d = loadPerf()
  let best = null, bestRate = -1
  for (const seqId of sequenceIds) {
    const steps = Object.entries(d).filter(([k]) => k.startsWith(seqId + '::'))
    if (!steps.length) continue
    const total = steps.reduce((acc, [, v]) => ({ sends: acc.sends + v.sends, replies: acc.replies + v.replies, clicks: acc.clicks + v.clicks }), { sends: 0, replies: 0, clicks: 0 })
    const rate = total.sends > 0 ? (total.replies + total.clicks) / total.sends : 0
    if (rate > bestRate) { bestRate = rate; best = seqId }
  }
  return best
}

// Returns a sorted array of { seqId, stepKey, sends, replies, clicks, rate } for display
export function getAllTemplatePerf() {
  const d = loadPerf()
  return Object.entries(d)
    .map(([k, v]) => {
      const [seqId, step] = k.split('::')
      return { seqId, stepKey: step, ...v, rate: v.sends > 0 ? (v.replies + v.clicks) / v.sends : 0 }
    })
    .sort((a, b) => b.rate - a.rate)
}

export function clearTemplatePerf() {
  localStorage.removeItem(PERF_KEY)
}
