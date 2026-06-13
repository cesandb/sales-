// Parse social handle formats into platform-specific profile + DM URLs.
// All platforms that support deep-link DM compose get a pre-filled dmUrl.

const URL_PREFIXES = ['https://', 'http://']
const DOMAIN_RE = /^([\w-]+\.)+\w{2,}$/

export function parseSocialHandle(social) {
  if (!social) return null
  const s = social.trim()
  if (!s) return null

  // Reddit: u/username or /u/username
  if (/^\/?(u|r)\//.test(s)) {
    const username = s.replace(/^\/?u\//, '')
    return {
      platform: 'Reddit',
      handle: username,
      profileUrl: `https://www.reddit.com/u/${username}`,
      dmUrl: `https://old.reddit.com/message/compose?to=${encodeURIComponent(username)}`,
      canPrefill: true,
    }
  }

  // Hacker News: hn:username
  if (/^hn:/i.test(s)) {
    const username = s.slice(3)
    return {
      platform: 'HackerNews',
      handle: username,
      profileUrl: `https://news.ycombinator.com/user?id=${username}`,
      dmUrl: `https://news.ycombinator.com/user?id=${username}`,
      canPrefill: false,
    }
  }

  // GitHub: github:username
  if (/^github:/i.test(s)) {
    const username = s.slice(7)
    return {
      platform: 'GitHub',
      handle: username,
      profileUrl: `https://github.com/${username}`,
      dmUrl: `https://github.com/${username}`,
      canPrefill: false,
    }
  }

  // LinkedIn: linkedin:username or linkedin.com/in/username
  if (/^linkedin:/i.test(s)) {
    const handle = s.slice(9)
    return {
      platform: 'LinkedIn',
      handle,
      profileUrl: `https://www.linkedin.com/in/${handle}`,
      dmUrl: `https://www.linkedin.com/messaging/compose?recipient=${handle}`,
      canPrefill: false,
    }
  }

  // YouTube: youtube:@handle or youtube:channelId
  if (/^youtube:/i.test(s)) {
    const handle = s.slice(8)
    const url = handle.startsWith('@')
      ? `https://www.youtube.com/${handle}`
      : `https://www.youtube.com/channel/${handle}`
    return { platform: 'YouTube', handle, profileUrl: url, dmUrl: url, canPrefill: false }
  }

  // Medium: medium:@username
  if (/^medium:/i.test(s)) {
    const handle = s.slice(7)
    const url = `https://medium.com/${handle.startsWith('@') ? handle : '@' + handle}`
    return { platform: 'Medium', handle, profileUrl: url, dmUrl: url, canPrefill: false }
  }

  // Dev.to: dev:username
  if (/^dev:/i.test(s)) {
    const username = s.slice(4)
    return {
      platform: 'Dev.to',
      handle: username,
      profileUrl: `https://dev.to/${username}`,
      dmUrl: `https://dev.to/${username}`,
      canPrefill: false,
    }
  }

  // Mastodon: @user@instance.social
  const mastoMatch = s.match(/^@([\w.-]+)@([\w.-]+\.\w+)$/)
  if (mastoMatch) {
    const [, user, instance] = mastoMatch
    return {
      platform: 'Mastodon',
      handle: user,
      profileUrl: `https://${instance}/@${user}`,
      dmUrl: `https://${instance}/@${user}`,
      canPrefill: false,
    }
  }

  // Generic @username (Twitter/X, Instagram, etc.)
  if (/^@[\w.]+$/.test(s)) {
    const username = s.slice(1)
    return {
      platform: 'Twitter/X',
      handle: username,
      profileUrl: `https://twitter.com/${username}`,
      dmUrl: `https://twitter.com/${username}`,
      canPrefill: false,
    }
  }

  // Full URL — detect platform
  const isUrl = URL_PREFIXES.some(p => s.startsWith(p))
  if (isUrl) {
    let platform = 'Web'
    if (s.includes('reddit.com'))     platform = 'Reddit'
    else if (s.includes('linkedin.com')) {
      platform = 'LinkedIn'
      // Extract /in/handle for a cleaner handle
      const liMatch = s.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/)
      if (liMatch) {
        return {
          platform: 'LinkedIn',
          handle: liMatch[1],
          profileUrl: s,
          dmUrl: `https://www.linkedin.com/messaging/compose?recipient=${liMatch[1]}`,
          canPrefill: false,
        }
      }
    }
    else if (s.includes('instagram.com')) platform = 'Instagram'
    else if (s.includes('twitter.com') || s.includes('x.com')) platform = 'Twitter/X'
    else if (s.includes('facebook.com')) platform = 'Facebook'
    else if (s.includes('tiktok.com'))   platform = 'TikTok'
    else if (s.includes('youtube.com'))  platform = 'YouTube'
    else if (s.includes('github.com'))   platform = 'GitHub'
    else if (s.includes('medium.com'))   platform = 'Medium'
    return { platform, handle: s, profileUrl: s, dmUrl: s, canPrefill: false }
  }

  // Bare domain (e.g. healthline.com, menshealth.com) — used for Hunter.io enrichment
  if (DOMAIN_RE.test(s)) {
    return {
      platform: 'Domain',
      handle: s,
      profileUrl: `https://${s}`,
      dmUrl: null,
      canPrefill: false,
      isDomain: true,
    }
  }

  return { platform: 'Other', handle: s, profileUrl: null, dmUrl: null, canPrefill: false }
}

// Build a Reddit DM compose URL with pre-filled subject + body
export function buildRedditDMUrl(username, subject, body) {
  const params = new URLSearchParams({
    to: username,
    subject: subject || 'Quick question',
    message: body || '',
  })
  return `https://old.reddit.com/message/compose?${params}`
}

// Build WhatsApp deep-link with pre-filled message
export function buildWhatsAppUrl(phone, message) {
  const clean = (phone || '').replace(/\D/g, '')
  if (!clean) return null
  return `https://wa.me/${clean}?text=${encodeURIComponent(message || '')}`
}

// Build Telegram deep-link (no official pre-fill for non-bot chats)
export function buildTelegramUrl(username) {
  if (!username) return null
  const u = username.startsWith('@') ? username.slice(1) : username
  return `https://t.me/${u}`
}

// Emoji icon for each platform
export function getPlatformEmoji(platform) {
  const map = {
    Reddit: '🤖',
    HackerNews: '🟠',
    GitHub: '💻',
    YouTube: '▶️',
    Medium: '📝',
    'Dev.to': '🧑‍💻',
    Mastodon: '🐘',
    'Twitter/X': '🐦',
    LinkedIn: '💼',
    Instagram: '📸',
    Facebook: '📘',
    TikTok: '🎵',
    Domain: '🌐',
    Web: '🔗',
  }
  return map[platform] || '🔗'
}
