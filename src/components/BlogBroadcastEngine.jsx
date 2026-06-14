// BlogBroadcastEngine — daily broadcast to contacts tagged 'blog-subscriber'.
// Fetches latest health/nutrition article and queues it via MQ (email or SMS).
// Max 30 per run, once per day per contact. Respects send window (7am–10pm).

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { fetchBlogArticles } from '../utils/blogFeed'
import { addToMQ } from '../utils/messageQueue'
import { matchProduct, buildUTMLink } from '../utils/affiliateLinks'

const BLOG_SENT_KEY = 'phorm_blog_sent_v1'
const INTERVAL_MS   = 4 * 60 * 60 * 1000
const MAX_PER_RUN   = 30
const SEND_START    = 7
const SEND_END      = 22

function isWithinSendWindow() {
  const h = new Date().getHours()
  return h >= SEND_START && h < SEND_END
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
}

function getSentSet() {
  try { return new Set(JSON.parse(localStorage.getItem(BLOG_SENT_KEY) || '[]')) }
  catch { return new Set() }
}

function markSent(entries) {
  localStorage.setItem(BLOG_SENT_KEY, JSON.stringify([...entries]))
}

function buildBlogMessage(firstName, article, affiliateLink) {
  return [
    `Hey ${firstName}! Thought you'd find this interesting:`,
    '',
    `"${article.title}"`,
    `${article.summary.slice(0, 180)}...`,
    '',
    article.link,
    '',
    `P.S. If you're working on your fitness goals, grab what I recommend here → ${affiliateLink}`,
  ].join('\n')
}

async function runBlogBroadcast(store) {
  if (!isWithinSendWindow()) return

  const { contacts } = store
  if (!contacts?.length) return

  const subscribers = contacts.filter(c =>
    (c.tags || []).includes('blog-subscriber') && c.status !== 'Inactive'
  )
  if (!subscribers.length) return

  const articles = await fetchBlogArticles()
  if (!articles?.length) return

  const today = getTodayKey()
  const sentSet = getSentSet()
  const article = articles[0]

  let count = 0

  for (const contact of subscribers) {
    if (count >= MAX_PER_RUN) break
    const sentKey = `${contact.id}::${today}`
    if (sentSet.has(sentKey)) continue

    const channel = contact.email ? 'email' : contact.phone ? 'sms' : null
    if (!channel) continue

    const product = matchProduct(contact)
    const affiliateLink = buildUTMLink(
      `https://1stphorm.com/products/${product.id}/?a_aid=Conan`,
      { contactId: contact.id, stepKey: 'blog' }
    )
    const firstName = contact.name.split(' ')[0]
    const message   = buildBlogMessage(firstName, article, affiliateLink)

    addToMQ({
      contactId:     contact.id,
      contactName:   contact.name,
      contactHandle: contact.social || '',
      contactEmail:  contact.email  || '',
      contactPhone:  contact.phone  || '',
      channel,
      subject:   `📖 ${article.title.slice(0, 60)}`,
      message,
      seqId:     'blog-broadcast',
      stepKey:   today,
      seqName:   'Health Blog',
      stepLabel: `${article.source} — ${article.title.slice(0, 40)}`,
    })

    sentSet.add(sentKey)
    count++
  }

  if (count > 0) {
    markSent(sentSet)
    window.dispatchEvent(new CustomEvent('blog-broadcast-ran', {
      detail: { count, article: article.title },
    }))
  }
}

export default function BlogBroadcastEngine() {
  const storeRef = useRef(null)
  const store = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runBlogBroadcast(storeRef.current)
    const t = setTimeout(run, 11 * 60 * 1000) // 11 min after load
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
