// Enrich a contact from public APIs based on social handle prefix.
// Supported: github:username, hn:username, devto:username, reddit:u/username
// Returns { source, notesAppend, tagsAdd } or throws an Error.

export async function enrichContact(contact) {
  const social = (contact.social || '').trim()

  if (social.toLowerCase().startsWith('github:')) {
    const username = social.slice(7).trim()
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`GitHub user "${username}" not found`)
    const d = await res.json()
    const parts = [d.name, d.bio, d.company?.replace('@', ''), d.location].filter(Boolean)
    return {
      source: 'github',
      notesAppend: `[GitHub] ${parts.join(' · ')} · ${d.public_repos} repos · ${d.followers} followers · ${d.html_url}`,
      tagsAdd: ['enriched', 'github-verified', ...(d.location ? [d.location.split(',')[0].trim().toLowerCase()] : [])],
      nameOverride: !contact.name || contact.name === username ? (d.name || contact.name) : null,
    }
  }

  if (social.toLowerCase().startsWith('hn:')) {
    const username = social.slice(3).trim()
    const res = await fetch(`https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username)}.json`)
    if (!res.ok) throw new Error(`HN user "${username}" not found`)
    const d = await res.json()
    if (!d) throw new Error(`HN user "${username}" not found`)
    const about = d.about ? d.about.replace(/<[^>]*>/g, '').slice(0, 120) : null
    return {
      source: 'hackernews',
      notesAppend: `[HN] karma: ${d.karma}${about ? ' · ' + about : ''} · https://news.ycombinator.com/user?id=${username}`,
      tagsAdd: ['enriched', 'hn-verified'],
    }
  }

  if (social.toLowerCase().startsWith('devto:')) {
    const username = social.slice(6).trim()
    const res = await fetch(`https://dev.to/api/users/by_username?url=${encodeURIComponent(username)}`)
    if (!res.ok) throw new Error(`Dev.to user "${username}" not found`)
    const d = await res.json()
    const parts = [d.name, d.summary, d.location].filter(Boolean)
    return {
      source: 'devto',
      notesAppend: `[Dev.to] ${parts.join(' · ')} · https://dev.to/${username}`,
      tagsAdd: ['enriched', 'devto-verified'],
      nameOverride: !contact.name || contact.name === username ? (d.name || contact.name) : null,
    }
  }

  throw new Error('No enrichable handle found. Supported prefixes: github:, hn:, devto:')
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

// Fetch a Reddit user's public profile and extract any email they've shared in their bio.
// No auth required — uses the public JSON API.
export async function enrichRedditProfile(username) {
  try {
    const res = await fetch(
      `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const bio = [
      data?.data?.subreddit?.public_description || '',
      data?.data?.subreddit?.description || '',
    ].join(' ')
    const emails = (bio.match(EMAIL_RE) || []).filter(e =>
      !e.includes('noreply') && !e.includes('example') && !e.includes('domain')
    )
    return emails[0]?.toLowerCase() || null
  } catch { return null }
}
