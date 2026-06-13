// Persistent outreach message queue — stores pre-written messages for every
// contact regardless of whether email/SMS credentials are configured.
// Contacts without email get 'dm' channel items for manual copy+send.

const MQ_KEY = 'phorm_mq_v1'
const MAX_ITEMS = 2000

export function getMQ() {
  try { return JSON.parse(localStorage.getItem(MQ_KEY) || '[]') }
  catch { return [] }
}

function saveMQ(items) {
  localStorage.setItem(MQ_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
}

// Add a message to the queue — deduped by contactId+seqId+stepKey
export function addToMQ({ contactId, contactName, contactHandle, contactEmail,
  contactPhone, channel, subject, message, seqId, stepKey, seqName, stepLabel }) {
  const items = getMQ()
  const dupKey = `${contactId}::${seqId}::${stepKey}`
  if (items.some(i => `${i.contactId}::${i.seqId}::${i.stepKey}` === dupKey)) return null

  const id = `mq-${Date.now()}`
  saveMQ([{
    id, contactId, contactName,
    contactHandle: contactHandle || '',
    contactEmail:  contactEmail  || '',
    contactPhone:  contactPhone  || '',
    channel,     // 'email' | 'sms' | 'dm'
    subject, message, seqId, stepKey,
    seqName:   seqName   || '',
    stepLabel: stepLabel || '',
    status: 'pending',   // 'pending' | 'sent' | 'copied' | 'skipped'
    createdAt: new Date().toISOString(),
    sentAt: null,
  }, ...items])
  return id
}

export function markMQStatus(contactId, seqId, stepKey, status) {
  const items = getMQ()
  saveMQ(items.map(i =>
    i.contactId === contactId && i.seqId === seqId && i.stepKey === stepKey
      ? { ...i, status, sentAt: status === 'sent' || status === 'copied' ? new Date().toISOString() : i.sentAt }
      : i
  ))
}

export function markMQItemStatus(id, status) {
  const items = getMQ()
  saveMQ(items.map(i =>
    i.id === id
      ? { ...i, status, sentAt: status === 'sent' || status === 'copied' ? new Date().toISOString() : i.sentAt }
      : i
  ))
}

export function getPendingMQ() {
  return getMQ().filter(i => i.status === 'pending')
}

// Prune items older than 30 days that are sent/copied/skipped
export function pruneMQ() {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
  const items = getMQ()
  saveMQ(items.filter(i => i.status === 'pending' || (i.sentAt || i.createdAt) > cutoff))
}
