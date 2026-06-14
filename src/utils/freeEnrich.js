// freeEnrich.js — Free-tier contact enrichment. All calls browser-direct (CORS-safe).
// Gravatar: free, no key. Emailrep.io: 1000/day free. Abstract API email+phone: 100/month.
// Keybase: free, no key. GitHub search: free, 10req/min. PDL: 100/month (key required).
// Snov.io: 150 credits/month free. Numverify: 250/month free.

export const EMAILREP_KEY = 'phorm_emailrep_key'
export const ABSTRACT_KEY = 'phorm_abstract_key'

export function getEmailrepKey()  { return localStorage.getItem(EMAILREP_KEY) || '' }
export function getAbstractKey()  { return localStorage.getItem(ABSTRACT_KEY) || '' }
export function saveEmailrepKey(k) { if (k) localStorage.setItem(EMAILREP_KEY, k.trim()); else localStorage.removeItem(EMAILREP_KEY) }
export function saveAbstractKey(k) { if (k) localStorage.setItem(ABSTRACT_KEY, k.trim()); else localStorage.removeItem(ABSTRACT_KEY) }

// Gravatar — free, no key. Returns a URL that resolves to a profile photo if one exists,
// or null if the email has no Gravatar (we probe with d=404 to detect 404 = no account).
export async function getGravatarUrl(email) {
  if (!email) return null
  try {
    const hash = await md5(email.trim().toLowerCase())
    const url = `https://www.gravatar.com/avatar/${hash}?d=404&s=80`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.ok && res.status !== 404) return url
  } catch {}
  return null
}

// Subtle crypto md5 — needed for Gravatar hashing
async function md5(str) {
  // Using SubtleCrypto is SHA-based; Gravatar needs MD5.
  // Use a simple pure-JS MD5 so we don't need a library.
  // Source: RFC 1321-derived, well-known public-domain snippet.
  function safeAdd(x, y) { const lsw = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff) }
  function bitRotateLeft(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)) }
  function md5cmn(q, a, b, x, s, t) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b) }
  function md5ff(a, b, c, d, x, s, t) { return md5cmn((b & c) | (~b & d), a, b, x, s, t) }
  function md5gg(a, b, c, d, x, s, t) { return md5cmn((b & d) | (c & ~d), a, b, x, s, t) }
  function md5hh(a, b, c, d, x, s, t) { return md5cmn(b ^ c ^ d, a, b, x, s, t) }
  function md5ii(a, b, c, d, x, s, t) { return md5cmn(c ^ (b | ~d), a, b, x, s, t) }
  function calc(x, len) {
    x[len >> 5] |= 0x80 << len % 32
    x[(((len + 64) >>> 9) << 4) + 14] = len
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878
    for (let i = 0; i < x.length; i += 16) {
      const [oa, ob, oc, od] = [a, b, c, d]
      a = md5ff(a,b,c,d,x[i],7,-680876936);d=md5ff(d,a,b,c,x[i+1],12,-389564586);c=md5ff(c,d,a,b,x[i+2],17,606105819);b=md5ff(b,c,d,a,x[i+3],22,-1044525330)
      a=md5ff(a,b,c,d,x[i+4],7,-176418897);d=md5ff(d,a,b,c,x[i+5],12,1200080426);c=md5ff(c,d,a,b,x[i+6],17,-1473231341);b=md5ff(b,c,d,a,x[i+7],22,-45705983)
      a=md5ff(a,b,c,d,x[i+8],7,1770035416);d=md5ff(d,a,b,c,x[i+9],12,-1958414417);c=md5ff(c,d,a,b,x[i+10],17,-42063);b=md5ff(b,c,d,a,x[i+11],22,-1990404162)
      a=md5ff(a,b,c,d,x[i+12],7,1804603682);d=md5ff(d,a,b,c,x[i+13],12,-40341101);c=md5ff(c,d,a,b,x[i+14],17,-1502002290);b=md5ff(b,c,d,a,x[i+15],22,1236535329)
      a=md5gg(a,b,c,d,x[i+1],5,-165796510);d=md5gg(d,a,b,c,x[i+6],9,-1069501632);c=md5gg(c,d,a,b,x[i+11],14,643717713);b=md5gg(b,c,d,a,x[i],20,-373897302)
      a=md5gg(a,b,c,d,x[i+5],5,-701558691);d=md5gg(d,a,b,c,x[i+10],9,38016083);c=md5gg(c,d,a,b,x[i+15],14,-660478335);b=md5gg(b,c,d,a,x[i+4],20,-405537848)
      a=md5gg(a,b,c,d,x[i+9],5,568446438);d=md5gg(d,a,b,c,x[i+14],9,-1019803690);c=md5gg(c,d,a,b,x[i+3],14,-187363961);b=md5gg(b,c,d,a,x[i+8],20,1163531501)
      a=md5gg(a,b,c,d,x[i+13],5,-1444681467);d=md5gg(d,a,b,c,x[i+2],9,-51403784);c=md5gg(c,d,a,b,x[i+7],14,1735328473);b=md5gg(b,c,d,a,x[i+12],20,-1926607734)
      a=md5hh(a,b,c,d,x[i+5],4,-378558);d=md5hh(d,a,b,c,x[i+8],11,-2022574463);c=md5hh(c,d,a,b,x[i+11],16,1839030562);b=md5hh(b,c,d,a,x[i+14],23,-35309556)
      a=md5hh(a,b,c,d,x[i+1],4,-1530992060);d=md5hh(d,a,b,c,x[i+4],11,1272893353);c=md5hh(c,d,a,b,x[i+7],16,-155497632);b=md5hh(b,c,d,a,x[i+10],23,-1094730640)
      a=md5hh(a,b,c,d,x[i+13],4,681279174);d=md5hh(d,a,b,c,x[i],11,-358537222);c=md5hh(c,d,a,b,x[i+3],16,-722521979);b=md5hh(b,c,d,a,x[i+6],23,76029189)
      a=md5hh(a,b,c,d,x[i+9],4,-640364487);d=md5hh(d,a,b,c,x[i+12],11,-421815835);c=md5hh(c,d,a,b,x[i+15],16,530742520);b=md5hh(b,c,d,a,x[i+2],23,-995338651)
      a=md5ii(a,b,c,d,x[i],6,-198630844);d=md5ii(d,a,b,c,x[i+7],10,1126891415);c=md5ii(c,d,a,b,x[i+14],15,-1416354905);b=md5ii(b,c,d,a,x[i+5],21,-57434055)
      a=md5ii(a,b,c,d,x[i+12],6,1700485571);d=md5ii(d,a,b,c,x[i+3],10,-1894986606);c=md5ii(c,d,a,b,x[i+10],15,-1051523);b=md5ii(b,c,d,a,x[i+1],21,-2054922799)
      a=md5ii(a,b,c,d,x[i+8],6,1873313359);d=md5ii(d,a,b,c,x[i+15],10,-30611744);c=md5ii(c,d,a,b,x[i+6],15,-1560198380);b=md5ii(b,c,d,a,x[i+13],21,1309151649)
      a=md5ii(a,b,c,d,x[i+4],6,-145523070);d=md5ii(d,a,b,c,x[i+11],10,-1120210379);c=md5ii(c,d,a,b,x[i+2],15,718787259);b=md5ii(b,c,d,a,x[i+9],21,-343485551)
      a=safeAdd(a,oa);b=safeAdd(b,ob);c=safeAdd(c,oc);d=safeAdd(d,od)
    }
    return [a, b, c, d]
  }
  function str2binl(str) {
    const bin = []; const mask = 0xff
    for (let i = 0; i < str.length * 8; i += 8) bin[i >> 5] |= (str.charCodeAt(i / 8) & mask) << i % 32
    return bin
  }
  function binl2hex(binarray) {
    const hexTab = '0123456789abcdef'; let str = ''
    for (let i = 0; i < binarray.length * 4; i++) {
      str += hexTab.charAt((binarray[i >> 2] >> (i % 4 * 8 + 4)) & 0xf) + hexTab.charAt((binarray[i >> 2] >> (i % 4 * 8)) & 0xf)
    }
    return str
  }
  const binl = str2binl(str)
  return binl2hex(calc(binl, str.length * 8))
}

// Emailrep.io — returns reputation data + social links for a given email.
// Free: 1000 lookups/day (no key), or higher limits with a key.
// Returns { reputation, suspicious, references, profiles } or null.
export async function emailrepLookup(email) {
  if (!email) return null
  const key = getEmailrepKey()
  try {
    const headers = { 'Accept': 'application/json' }
    if (key) headers['Key'] = key
    const res = await fetch(`https://emailrep.io/${encodeURIComponent(email)}`, {
      headers,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    // Returns: { email, reputation, suspicious, references, details: { profiles, ... } }
    return data
  } catch { return null }
}

// Abstract API — validate email deliverability (100 free/month).
// Returns 'DELIVERABLE' | 'UNDELIVERABLE' | 'RISKY' | 'UNKNOWN' or null.
export async function abstractValidateEmail(email) {
  const key = getAbstractKey()
  if (!key || !email) return null
  try {
    const params = new URLSearchParams({ api_key: key, email })
    const res = await fetch(`https://emailvalidation.abstractapi.com/v1/?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.deliverability || null
  } catch { return null }
}

// ── Gravatar profile JSON — linked social accounts from email (free, no key) ─────────────
// Returns { displayName, photoUrl, accounts: [{domain, username, url}] } or null
export async function gravatarProfile(email) {
  if (!email) return null
  try {
    const hash = await md5(email.trim().toLowerCase())
    const res  = await fetch(`https://www.gravatar.com/${hash}.json`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const entry = (await res.json())?.entry?.[0]
    if (!entry) return null
    return {
      displayName: entry.displayName || null,
      photoUrl:    entry.photos?.[0]?.value || null,
      accounts: (entry.accounts || []).map(a => ({ domain: a.domain, username: a.username, url: a.url })),
      urls:     (entry.urls    || []).map(u => u.value),
    }
  } catch { return null }
}

// ── Keybase — links email to GitHub, Twitter, Reddit, HN handles (free, no key) ─────────
// Returns { keybaseUsername, twitter, github, reddit, hackernews } or null
export async function keybaseLookup(email) {
  if (!email) return null
  try {
    const res = await fetch(
      `https://keybase.io/_/api/1.0/user/lookup.json?emails=${encodeURIComponent(email)}&fields=basics,proofs_summary`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const user = (await res.json())?.them?.[0]
    if (!user) return null
    const proofs = user.proofs_summary?.all || []
    const find   = (type) => proofs.find(p => p.proof_type === type)?.nametag || null
    return {
      keybaseUsername: user.basics?.username || null,
      twitter:         find('twitter'),
      github:          find('github'),
      reddit:          find('reddit'),
      hackernews:      find('hackernews'),
    }
  } catch { return null }
}

// ── GitHub search by email — find GitHub username from email (free, 10 req/min) ──────────
// Returns { login, name, avatarUrl, bio, location, followers } or null
export async function githubSearchByEmail(email) {
  if (!email) return null
  try {
    const res = await fetch(
      `https://api.github.com/search/users?q=${encodeURIComponent(email)}+in:email&per_page=1`,
      { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const first = (await res.json())?.items?.[0]
    if (!first) return null
    const profileRes = await fetch(`https://api.github.com/users/${first.login}`,
      { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(8000) })
    if (!profileRes.ok) return { login: first.login, avatarUrl: first.avatar_url }
    const p = await profileRes.json()
    return { login: p.login, name: p.name, avatarUrl: p.avatar_url, bio: p.bio, location: p.location, followers: p.followers }
  } catch { return null }
}

// ── People Data Labs — full profile enrichment (email + phone + all social) ──────────────
// Free tier: 100 API calls/month after sign-up at peopledatalabs.com
// Returns { email, phone, linkedin, twitter, github, facebook, location, company, title, photoUrl } or null
export const PDL_KEY = 'phorm_pdl_key'
export function getPdlKey()   { return localStorage.getItem(PDL_KEY) || '' }
export function savePdlKey(k) { if (k) localStorage.setItem(PDL_KEY, k.trim()); else localStorage.removeItem(PDL_KEY) }

export async function pdlEnrich({ email, firstName, lastName, phone } = {}) {
  const key = getPdlKey()
  if (!key || (!email && !phone)) return null
  try {
    const params = new URLSearchParams({ pretty: 'false' })
    if (email)               params.set('email',      email)
    if (phone)               params.set('phone',      phone.replace(/\D/g, ''))
    if (firstName)           params.set('first_name', firstName)
    if (lastName)            params.set('last_name',  lastName)
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
      headers: { 'X-Api-Key': key },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 200 || !data.data) return null
    const p = data.data
    const findProfile = (net) => p.profiles?.find(pr => pr.network === net)?.url || null
    return {
      email:    p.emails?.[0]?.address     || email || null,
      phone:    p.mobile_phone || p.phone_numbers?.[0] || null,
      linkedin: p.linkedin_url || findProfile('linkedin'),
      twitter:  p.twitter_url  || findProfile('twitter'),
      github:   p.github_url   || findProfile('github'),
      facebook: p.facebook_url || findProfile('facebook'),
      location: p.location_name     || null,
      company:  p.job_company_name  || null,
      title:    p.job_title         || null,
      photoUrl: p.profile_pic_url   || null,
    }
  } catch { return null }
}

// ── Snov.io — email finder by name+domain (150 credits/month free) ───────────────────────
// Requires client_id + client_secret from app.snov.io → Settings → API
export const SNOV_CLIENT_KEY  = 'phorm_snov_client'
export const SNOV_SECRET_KEY  = 'phorm_snov_secret'
const SNOV_TOKEN_CACHE        = 'phorm_snov_token'
export function getSnovClient() { return localStorage.getItem(SNOV_CLIENT_KEY) || '' }
export function getSnovSecret() { return localStorage.getItem(SNOV_SECRET_KEY) || '' }
export function saveSnovKeys(clientId, secret) {
  if (clientId) localStorage.setItem(SNOV_CLIENT_KEY, clientId.trim()); else localStorage.removeItem(SNOV_CLIENT_KEY)
  if (secret)   localStorage.setItem(SNOV_SECRET_KEY, secret.trim());   else localStorage.removeItem(SNOV_SECRET_KEY)
  localStorage.removeItem(SNOV_TOKEN_CACHE) // invalidate cached token on key change
}

async function getSnovToken() {
  try {
    const cached = JSON.parse(localStorage.getItem(SNOV_TOKEN_CACHE) || 'null')
    if (cached?.token && cached.expires > Date.now() + 60000) return cached.token
  } catch {}
  const clientId = getSnovClient()
  const secret   = getSnovSecret()
  if (!clientId || !secret) return null
  try {
    const res = await fetch('https://api.snov.io/v1/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: secret }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.access_token) return null
    localStorage.setItem(SNOV_TOKEN_CACHE, JSON.stringify({
      token: data.access_token,
      expires: Date.now() + (data.expires_in || 3600) * 1000,
    }))
    return data.access_token
  } catch { return null }
}

export async function snovioFindEmail(firstName, lastName, domain) {
  if (!firstName || !domain) return null
  const token = await getSnovToken()
  if (!token) return null
  try {
    const res = await fetch('https://api.snov.io/v1/get-emails-from-names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token, firstName, lastName: lastName || '', domain }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const valid = (data?.emails || []).filter(e => e.emailStatus === 'Valid' || e.confidence >= 70)
    return valid[0]?.email || null
  } catch { return null }
}

// ── Abstract API Phone validation (100 lookups/month on free tier) ────────────────────────
// Returns { valid, carrier, type ('mobile'|'landline'|'voip'), country, formatted } or null
export const ABSTRACT_PHONE_KEY = 'phorm_abstract_phone_key'
export function getAbstractPhoneKey()   { return localStorage.getItem(ABSTRACT_PHONE_KEY) || '' }
export function saveAbstractPhoneKey(k) { if (k) localStorage.setItem(ABSTRACT_PHONE_KEY, k.trim()); else localStorage.removeItem(ABSTRACT_PHONE_KEY) }

export async function abstractValidatePhone(phone) {
  const key = getAbstractPhoneKey()
  if (!key || !phone) return null
  const clean = phone.replace(/\D/g, '')
  if (!clean) return null
  try {
    const params = new URLSearchParams({ api_key: key, phone: clean })
    const res = await fetch(`https://phonevalidation.abstractapi.com/v1/?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const d = await res.json()
    return { valid: d.valid || false, carrier: d.carrier || null, type: d.type || null, country: d.country?.name || null, formatted: d.format?.international || null }
  } catch { return null }
}

// ── Numverify — phone carrier + line type lookup (250/month free via apilayer.com) ────────
// Returns { valid, carrier, lineType, country, formatted } or null
export const NUMVERIFY_KEY = 'phorm_numverify_key'
export function getNumverifyKey()   { return localStorage.getItem(NUMVERIFY_KEY) || '' }
export function saveNumverifyKey(k) { if (k) localStorage.setItem(NUMVERIFY_KEY, k.trim()); else localStorage.removeItem(NUMVERIFY_KEY) }

export async function numverifyPhone(phone) {
  const key = getNumverifyKey()
  if (!key || !phone) return null
  const clean = phone.replace(/\D/g, '')
  if (!clean) return null
  try {
    const params = new URLSearchParams({ access_key: key, number: clean, format: 1 })
    const res = await fetch(`https://apilayer.net/api/validate?${params}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const d = await res.json()
    if (!d.valid) return null
    return { valid: true, carrier: d.carrier || null, lineType: d.line_type || null, country: d.country_name || null, formatted: d.international_format || null }
  } catch { return null }
}

// ── Reddit public about.json — scrape email from bio, get karma/account age as trust signals
export async function enrichRedditPublic(username) {
  if (!username) return null
  const clean = username.replace(/^u\//, '').replace(/^@/, '')
  try {
    const res = await fetch(
      `https://www.reddit.com/user/${encodeURIComponent(clean)}/about.json`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json()?.data
    if (!data) return null
    const bio = [data.subreddit?.public_description, data.subreddit?.description].filter(Boolean).join(' ')
    const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
    const emails = (bio.match(EMAIL_RE) || []).filter(e => !e.includes('noreply') && !e.includes('example'))
    return {
      email:    emails[0]?.toLowerCase() || null,
      karma:    (data.link_karma || 0) + (data.comment_karma || 0),
      verified: data.verified || false,
      iconUrl:  data.icon_img || null,
    }
  } catch { return null }
}
