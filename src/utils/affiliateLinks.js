import { PRODUCTS } from '../data/products'

// ── Product matcher ───────────────────────────────────────────────────────────
// Score matrix: contact tag → { productId: score }
const TAG_SCORES = {
  // Weight loss
  weightloss:      { '1db-overdrive': 10, '1db-goddess': 10, 'opti-greens-50': 5, 'l-carnitine': 7 },
  keto:            { '1db-overdrive': 9,  'l-carnitine': 7,  'gda': 6 },
  fatburner:       { '1db-overdrive': 10, '1db-goddess': 9,  'l-carnitine': 7 },
  paleo:           { '1db-overdrive': 6,  'opti-greens-50': 8, 'micro-factor': 7 },
  // Muscle / protein
  protein:         { 'level-1': 10, 'phormula-1': 8, 'creatine': 5 },
  muscle:          { 'level-1': 9,  'phormula-1': 8, 'creatine': 7 },
  bodybuilding:    { 'level-1': 8,  'phormula-1': 10, 'creatine': 8, 'anabolic-bridge': 6 },
  bulking:         { 'level-1': 9,  'phormula-1': 9,  'creatine': 8 },
  // Endurance / running
  endurance:       { 'endura-formance': 10, 'ultra-formance': 8, 'bcaa': 5 },
  marathon:        { 'endura-formance': 10, 'ultra-formance': 8, 'hydration-sticks': 7 },
  runner:          { 'endura-formance': 9,  'ultra-formance': 7, 'micro-factor': 6 },
  triathlon:       { 'endura-formance': 10, 'ultra-formance': 9 },
  // Energy / performance
  crossfit:        { 'project-1': 9,  'megawatt': 8, 'creatine': 7, 'level-1': 6 },
  hiit:            { 'megawatt': 8,   'project-1': 8, 'level-1': 6 },
  energy:          { 'megawatt': 9,   'project-1': 8 },
  'pre-workout':   { 'megawatt': 10,  'project-1': 9, 'alphasurge': 7 },
  // General health
  health:          { 'micro-factor': 9, 'opti-greens-50': 8, 'full-mega': 7 },
  athlete:         { 'micro-factor': 7, 'level-1': 7, 'phormula-1': 6 },
  fitness:         { 'micro-factor': 8, 'level-1': 6 },
  gym:             { 'level-1': 8,   'creatine': 7, 'megawatt': 6 },
  supplements:     { 'micro-factor': 8, 'level-1': 7, 'opti-greens-50': 6 },
  // Family
  parent:          { 'opti-kids': 10, 'micro-factor': 7 },
  family:          { 'opti-kids': 8,  'micro-factor': 7 },
  // Recovery / joints
  recovery:        { 'joint-mobility': 9, 'full-mega': 8, 'glutamine': 7 },
  joints:          { 'joint-mobility': 10, 'full-mega': 8 },
  // B2B / bulk
  'b2b-prospect':  { 'daily-stack': 10, 'essential-stack': 9, 'micro-factor': 7 },
  'federal_award': { 'daily-stack': 10, 'essential-stack': 9 },
  'event-organizer': { 'daily-stack': 8, 'micro-factor': 7 },
}

export function matchProduct(contact) {
  const tags = (contact.tags || []).map(t => t.toLowerCase())
  const notes = (contact.notes || '').toLowerCase()
  const allText = [...tags, notes].join(' ')

  const scores = {}
  for (const [tag, productScores] of Object.entries(TAG_SCORES)) {
    if (allText.includes(tag)) {
      for (const [pid, score] of Object.entries(productScores)) {
        scores[pid] = (scores[pid] || 0) + score
      }
    }
  }

  const topId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0]
  return (
    PRODUCTS.find(p => p.id === topId) ||
    PRODUCTS.find(p => p.id === 'micro-factor') ||
    PRODUCTS[0]
  )
}

// ── UTM link builder ──────────────────────────────────────────────────────────
export function buildUTMLink(productUrl, { contactId = '', medium = 'sequence', stepKey = '' } = {}) {
  try {
    const url = new URL(productUrl)
    url.searchParams.set('utm_source', 'phorm-crm')
    url.searchParams.set('utm_medium', medium)
    if (contactId) url.searchParams.set('utm_campaign', contactId)
    if (stepKey) url.searchParams.set('utm_content', stepKey)
    return url.toString()
  } catch {
    return productUrl
  }
}

// ── Sequence step message templates ──────────────────────────────────────────
export const STEP_MESSAGES = {
  intro: (name, productName, link) =>
    `Hey ${name}! I noticed you're into fitness and wanted to reach out. I partner with 1st Phorm — top-tier supplements, no compromises on quality. Based on what I can see about your goals, I think you'd love ${productName}: ${link}\n\nWhat are you currently focused on — muscle, weight loss, or general health?`,

  product_fit: (name, productName, link) =>
    `Hey ${name}! Following up from my last message. Given your goals, ${productName} is exactly what I'd recommend: ${link}\n\nIt's one of my top products and the results speak for themselves. Any questions at all?`,

  offer: (name, productName, link) =>
    `Hey ${name}! Quick one — if you've been thinking about trying 1st Phorm, this is a great time to start. Here's what I'd get first: ${link}\n\nHappy to build a full stack recommendation for your specific goals if you'd like!`,

  check_in: (name, productName, link) =>
    `Hey ${name}! Just checking in — how are your fitness goals going lately? If you haven't had a chance to look at this yet: ${link}\n\nLet me know what you're working on and I'll make sure you're using the right stuff 💪`,

  re_engage: (name, productName, link) =>
    `Hey ${name}! Last check-in from me — if you're ever ready to take your nutrition to the next level, I've got you: ${link}\n\nHope your fitness journey is going great either way. Feel free to reach out anytime!`,

  reorder: (name, productName, link) =>
    `Hey ${name}! Hope you're crushing your goals 💪 It's been about a month — time to restock? ${link}\n\nLet me know if you want to add anything to your stack this time around!`,

  upsell: (name, productName, link) =>
    `Hey ${name}! Now that you've been on the product a bit, here's what pairs really well with it: ${link}\n\nA lot of people stack these together and see significantly better results. Want me to build you a custom combo?`,

  referral_ask: (name, productName, link) =>
    `Hey ${name}! Hope you're loving the 1st Phorm products — how are they going for you? 💪 Quick favor: do you know anyone who might benefit from better nutrition? Even just mentioning my page to one friend helps them out and means a lot. Here's the link: ${link}`,

  referral_follow: (name, productName, link) =>
    `Hey ${name}! Just a quick follow-up on my referral ask. If you know anyone working on their fitness goals, I'd love to help them the same way I helped you. Here's the link to share: ${link} — no pressure at all, just wanted to check in!`,

  hot_close_1: (name, productName, link) =>
    `Hey ${name}! You showed some real interest in 1st Phorm and I don't want you to miss this. ${productName} is exactly what your goals need right now: ${link}\n\nI've helped a ton of people get started and the results speak for themselves. What's holding you back — price, timing, questions about the product?`,

  hot_close_2: (name, productName, link) =>
    `Hey ${name}! Quick one — I wanted to share some results I've seen from people who started with ${productName}. Consistent energy, better recovery, real results within the first few weeks. Link: ${link}\n\nIf you've been on the fence, this is the one people thank me for recommending. Ready to lock it in?`,

  hot_close_3: (name, productName, link) =>
    `Hey ${name}! Last nudge from me, I promise 😄 If you're going to try one supplement this month, make it this one: ${link}\n\nYour fitness goals deserve real support. I'm here if you have ANY questions — even after you order. Let's get you started this week!`,

  win_back_1: (name, productName, link) =>
    `Hey ${name}! Just checking in — haven't heard from you in a while and wanted to make sure everything's going well with your fitness goals. How have things been? Any changes in what you're working on?`,

  win_back_2: (name, productName, link) =>
    `Hey ${name}! I wanted to reach back out because I have a recommendation specifically for where you are right now. ${productName} would be a game-changer for your goals: ${link}\n\nLet me know if you have any questions — I want to make sure you're set up for success.`,

  win_back_3: (name, productName, link) =>
    `Hey ${name}! I've been thinking about your fitness journey. A lot of people who took a break from supplements came back and noticed a huge difference once they restarted consistently. ${productName} is the easiest way back in: ${link}\n\nEven 30 days makes a visible difference. What do you think?`,

  win_back_4: (name, productName, link) =>
    `Hey ${name}! This is my last check-in — I just want to make sure you have everything you need if you ever want to revisit. My store link is always here: ${link}\n\nWould love to help you hit your goals whenever you're ready. Take care either way 💪`,

  welcome_1: (name, productName, link) =>
    `Hey ${name}! Welcome to the 1st Phorm fam 🎉 So glad you made the jump! Quick tip: consistency is everything — take ${productName} at the same time each day and you'll start noticing a real difference within 2 weeks. Questions on anything? I'm your person!`,

  welcome_2: (name, productName, link) =>
    `Hey ${name}! How's it going with your 1st Phorm order? By now you should be feeling the difference. A lot of people find that pairing it with this product takes results to the next level: ${link}\n\nBuilding a solid stack is how the real progress happens. Want me to customize a recommendation for your specific goals?`,

  welcome_3: (name, productName, link) =>
    `Hey ${name}! It's been about 3 weeks — how are the results feeling? I'd love a quick review if you've been happy with it (helps more people find quality supplements). And if you know anyone with similar goals, here's my store link to share: ${link}\n\nYou're one of the people I love helping most — let me know how things are going!`,
}

// ── Default sequences ─────────────────────────────────────────────────────────
export const DEFAULT_SEQUENCES = [
  {
    id: 'seq-cold-intro',
    name: '5-Touch Cold Intro',
    description: 'Full drip for new leads from acquisition feeds. Day 0 → 3 → 7 → 14 → 30.',
    autoEnrollTags: [
      'auto-feed', 'reddit', 'hackernews', 'devto', 'mastodon',
      'eventbrite', 'federal_award', 'new_business_registration', 'github-verified',
    ],
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-900/20 border-blue-700/30',
    steps: [
      { day: 0,  stepKey: 'intro',       label: 'Initial Intro' },
      { day: 3,  stepKey: 'product_fit', label: 'Product Fit' },
      { day: 7,  stepKey: 'offer',       label: 'Offer Push' },
      { day: 14, stepKey: 'check_in',    label: 'Check-In' },
      { day: 30, stepKey: 're_engage',   label: 'Final Re-Engage' },
    ],
  },
  {
    id: 'seq-warm-convert',
    name: '3-Touch Warm Convert',
    description: 'For intent-signal contacts — shorter, more direct close sequence.',
    autoEnrollTags: ['intent-signal', 'org_chart_change', 'job_change'],
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-900/20 border-orange-700/30',
    steps: [
      { day: 0,  stepKey: 'offer',    label: 'Direct Offer' },
      { day: 5,  stepKey: 'check_in', label: 'Check-In' },
      { day: 14, stepKey: 're_engage', label: 'Last Touch' },
    ],
  },
  {
    id: 'seq-reorder',
    name: 'Customer Reorder',
    description: 'Re-engage past customers at 30 days for reorder + upsell.',
    autoEnrollTags: [],
    colorClass: 'text-green-400',
    bgClass: 'bg-green-900/20 border-green-700/30',
    steps: [
      { day: 0, stepKey: 'reorder', label: 'Reorder Reminder' },
      { day: 7, stepKey: 'upsell',  label: 'Upsell / Stack' },
    ],
  },
  {
    id: 'seq-referral',
    name: 'Customer Referral',
    description: 'Auto-fires after every conversion — referral ask at Day 14, follow-up at Day 21.',
    autoEnrollTags: [],
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-900/20 border-purple-700/30',
    steps: [
      { day: 14, stepKey: 'referral_ask',    label: 'Referral Ask' },
      { day: 21, stepKey: 'referral_follow', label: 'Referral Follow-Up' },
    ],
  },
  {
    id: 'seq-re-engage',
    name: 'Dead Lead Revival',
    description: 'Re-activates contacts cold for 60+ days. 3-touch over 21 days.',
    autoEnrollTags: [],
    colorClass: 'text-yellow-400',
    bgClass: 'bg-yellow-900/20 border-yellow-700/30',
    steps: [
      { day: 0,  stepKey: 'check_in',  label: 'Gentle Check-In' },
      { day: 7,  stepKey: 're_engage', label: 'Re-Engage' },
      { day: 21, stepKey: 'offer',     label: 'Fresh Offer' },
    ],
  },
  {
    id: 'seq-hot-close',
    name: 'Hot Lead Fast Close',
    description: 'Rapid 3-step urgency close for Hot Leads. Days 0 → 3 → 7.',
    autoEnrollTags: [],
    colorClass: 'text-red-400',
    bgClass: 'bg-red-900/20 border-red-700/30',
    steps: [
      { day: 0, stepKey: 'hot_close_1', label: 'Urgent Offer' },
      { day: 3, stepKey: 'hot_close_2', label: 'Social Proof' },
      { day: 7, stepKey: 'hot_close_3', label: 'Final Close' },
    ],
  },
  {
    id: 'seq-win-back',
    name: 'At Risk Win-Back',
    description: '4-touch retention sequence for At Risk customers. Days 0 → 3 → 7 → 14.',
    autoEnrollTags: [],
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-900/20 border-orange-700/30',
    steps: [
      { day: 0,  stepKey: 'win_back_1', label: 'Check-In' },
      { day: 3,  stepKey: 'win_back_2', label: 'Special Offer' },
      { day: 7,  stepKey: 'win_back_3', label: 'Results Showcase' },
      { day: 14, stepKey: 'win_back_4', label: 'Last Chance' },
    ],
  },
  {
    id: 'seq-welcome',
    name: 'New Customer Welcome',
    description: 'Post-purchase welcome + usage tips + upsell. Days 1 → 7 → 21.',
    autoEnrollTags: [],
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-900/20 border-emerald-700/30',
    steps: [
      { day: 1,  stepKey: 'welcome_1', label: 'Welcome + Tips' },
      { day: 7,  stepKey: 'welcome_2', label: 'Complement Upsell' },
      { day: 21, stepKey: 'welcome_3', label: 'Review + Referral' },
    ],
  },
]
