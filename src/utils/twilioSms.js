// Twilio SMS — actual outbound SMS for contacts with phone numbers.
// Credentials stored in localStorage only (never committed).

export const TWILIO_SID_KEY   = 'phorm_twilio_sid'
export const TWILIO_AUTH_KEY  = 'phorm_twilio_auth'
export const TWILIO_FROM_KEY  = 'phorm_twilio_from'
export const TWILIO_WA_FROM_KEY = 'phorm_twilio_wa_from'

const SMS_SENT_KEY = 'phorm_sms_sent_v1'
const SMS_RATE_KEY = 'phorm_sms_rate'

export function isTwilioReady() {
  return !!(
    localStorage.getItem(TWILIO_SID_KEY) &&
    localStorage.getItem(TWILIO_AUTH_KEY) &&
    localStorage.getItem(TWILIO_FROM_KEY)
  )
}

export function isWhatsAppReady() {
  return !!(
    localStorage.getItem(TWILIO_SID_KEY) &&
    localStorage.getItem(TWILIO_AUTH_KEY) &&
    localStorage.getItem(TWILIO_WA_FROM_KEY)
  )
}

const WA_RATE_KEY = 'phorm_wa_rate'

function canSendWhatsApp() {
  try {
    const now = Date.now()
    const ts = JSON.parse(localStorage.getItem(WA_RATE_KEY) || '[]')
    const recent = ts.filter(t => now - t < 60000)
    if (recent.length >= 10) return false
    recent.push(now)
    localStorage.setItem(WA_RATE_KEY, JSON.stringify(recent))
    return true
  } catch { return true }
}

export async function sendWhatsApp(toPhone, body, sentKey) {
  if (!isWhatsAppReady()) return false

  const smsSent = getSMSSent()
  const waKey = sentKey ? `wa::${sentKey}` : null
  if (waKey && smsSent[waKey]) return false
  if (!canSendWhatsApp()) return false

  const to = cleanPhone(toPhone)
  if (!to) return false

  const sid   = localStorage.getItem(TWILIO_SID_KEY)
  const auth  = localStorage.getItem(TWILIO_AUTH_KEY)
  const from  = localStorage.getItem(TWILIO_WA_FROM_KEY)

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${auth}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${to}`, Body: body }),
        signal: AbortSignal.timeout(15000),
      }
    )
    if (res.ok) {
      if (waKey) {
        smsSent[waKey] = new Date().toISOString()
        localStorage.setItem(SMS_SENT_KEY, JSON.stringify(smsSent))
      }
      return true
    }
  } catch {}
  return false
}

export function getSMSSent() {
  try { return JSON.parse(localStorage.getItem(SMS_SENT_KEY) || '{}') }
  catch { return {} }
}

// Rate limit: max 5 SMS per minute to avoid Twilio flags
function canSendSMS() {
  try {
    const now = Date.now()
    const ts = JSON.parse(localStorage.getItem(SMS_RATE_KEY) || '[]')
    const recent = ts.filter(t => now - t < 60000)
    if (recent.length >= 5) return false
    recent.push(now)
    localStorage.setItem(SMS_RATE_KEY, JSON.stringify(recent))
    return true
  } catch { return true }
}

function cleanPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '')
  // Ensure E.164 format — prepend +1 for US numbers if no country code
  if (!digits) return null
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length > 10) return `+${digits}`
  return null
}

export async function sendTwilioSMS(toPhone, body, sentKey) {
  if (!isTwilioReady()) return false

  const sent = getSMSSent()
  if (sentKey && sent[sentKey]) return false
  if (!canSendSMS()) return false

  const to = cleanPhone(toPhone)
  if (!to) return false

  const sid      = localStorage.getItem(TWILIO_SID_KEY)
  const authKey  = localStorage.getItem(TWILIO_AUTH_KEY)
  const fromNum  = localStorage.getItem(TWILIO_FROM_KEY)

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${authKey}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: fromNum, To: to, Body: body }),
        signal: AbortSignal.timeout(15000),
      }
    )
    if (res.ok) {
      if (sentKey) {
        sent[sentKey] = new Date().toISOString()
        localStorage.setItem(SMS_SENT_KEY, JSON.stringify(sent))
      }
      return true
    }
  } catch {}
  return false
}
