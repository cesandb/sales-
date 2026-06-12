import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'phorm_crm_v1'

const DEFAULT_STATE = {
  contacts: [],
  pipeline: [],
  followups: [],
  interactions: [],
  goals: [],
  productClicks: {},
  campaigns: [],
  linkShares: [],
  contactProducts: [],
  enrollments: [],
  settings: {
    commissionRate: 0.15,
    avgOrderValue: 45,
    dailyOutreachTarget: 10,
  },
  templates: [
    {
      id: 'tmpl-1',
      title: 'First Contact – Fitness Goals',
      category: 'Outreach',
      body: `Hey {{name}}! 👋 I saw you're into fitness and wanted to share something that's been a game-changer for me. I partner with 1st Phorm – they make top-tier supplements with zero compromises on quality. Whether you're looking to build muscle, improve recovery, or just get healthier, they've got you covered. Check out my page: https://1stphorm.com/Conan – happy to point you to the right products for YOUR goals. What are you currently working on?`,
    },
    {
      id: 'tmpl-2',
      title: 'Post-Purchase Follow-Up',
      category: 'Retention',
      body: `Hey {{name}}! Just checking in – how are you liking the product so far? 💪 I want to make sure you're getting the best results. Also, if you're looking to take things to the next level, let me know your goals and I can recommend the perfect stack. 1st Phorm has a ton of options and I'd love to help you dial it in. Any questions at all, I'm here!`,
    },
    {
      id: 'tmpl-3',
      title: 'Product Recommendation – Weight Loss',
      category: 'Recommendation',
      body: `Hey {{name}}! Based on what you told me about your goals, I'd highly recommend starting with the Micro Factor Pack (https://1stphorm.com/products/micro-factor/?a_aid=Conan) to cover your nutritional bases, and pairing it with Opti-Greens 50 (https://1stphorm.com/products/opti-greens-50/?a_aid=Conan). These two together are a phenomenal foundation. Once you're ready to get serious, the Transphormation Stack is the next level. Let me know if you have questions!`,
    },
    {
      id: 'tmpl-4',
      title: 'Product Recommendation – Muscle Building',
      category: 'Recommendation',
      body: `Hey {{name}}! For muscle and performance, here's what I'd suggest: 1) Phormula-1 post-workout: https://1stphorm.com/products/phormula-1/?a_aid=Conan 2) Creatine Monohydrate: https://1stphorm.com/products/micronized-creatine-monohydrate/?a_aid=Conan 3) Level-1 as your everyday protein: https://1stphorm.com/products/level-1/?a_aid=Conan. This combo is going to dramatically speed up your gains. You won't regret it 💪`,
    },
    {
      id: 'tmpl-5',
      title: "Re-Engagement – Haven't Heard Back",
      category: 'Re-Engagement',
      body: `Hey {{name}}! Just circling back – I know life gets busy. I still think 1st Phorm products would be a great fit for you. If you have 2 minutes, I'd love to point you to what would work best for your specific goals. No pressure at all – just here to help. What's the #1 thing you're trying to improve right now with your health or fitness?`,
    },
    {
      id: 'tmpl-6',
      title: 'Family Health – Kiddo Series',
      category: 'Recommendation',
      body: `Hey {{name}}! Did you know 1st Phorm has an incredible line specifically for kids? The Opti-Kids greens (https://1stphorm.com/products/opti-kids/?a_aid=Conan) and M-Factor Kiddos multivitamin (https://1stphorm.com/products/m-factor-kiddos/?a_aid=Conan) are things I'd want every parent to know about. Kids rarely get enough nutrients from food alone. Great quality, great taste – kids actually love them!`,
    },
    {
      id: 'tmpl-7',
      title: 'General Website Share',
      category: 'Outreach',
      body: `Hey {{name}}! I wanted to share my 1st Phorm page with you – https://1stphorm.com/Conan. They're my #1 trusted supplement brand. Every product is backed by science, no proprietary blends, and the results speak for themselves. Browse around and if anything catches your eye or you have questions about what would work for your goals, hit me up! I love helping people find what actually works.`,
    },
  ],
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return DEFAULT_STATE
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

let globalState = loadState()
const listeners = new Set()

function notify() {
  listeners.forEach(fn => fn(globalState))
}

function setState(updater) {
  globalState = typeof updater === 'function' ? updater(globalState) : { ...globalState, ...updater }
  saveState(globalState)
  notify()
}

export function useStore() {
  const [state, setLocalState] = useState(globalState)

  useEffect(() => {
    const handler = (s) => setLocalState({ ...s })
    listeners.add(handler)
    return () => listeners.delete(handler)
  }, [])

  // ── Contacts ──────────────────────────────────────────────────────────────
  const addContact = useCallback((contact) => {
    const id = `c-${Date.now()}`
    setState(s => ({
      ...s,
      contacts: [...s.contacts, { ...contact, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastContact: null }],
    }))
    return id
  }, [])

  const updateContact = useCallback((id, patch) => {
    setState(s => ({
      ...s,
      contacts: s.contacts.map(c => c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c),
    }))
  }, [])

  const deleteContact = useCallback((id) => {
    setState(s => ({
      ...s,
      contacts: s.contacts.filter(c => c.id !== id),
      pipeline: s.pipeline.filter(p => p.contactId !== id),
      followups: s.followups.filter(f => f.contactId !== id),
      interactions: s.interactions.filter(i => i.contactId !== id),
    }))
  }, [])

  // ── Pipeline ──────────────────────────────────────────────────────────────
  const addPipelineItem = useCallback((item) => {
    const id = `pi-${Date.now()}`
    setState(s => ({
      ...s,
      pipeline: [...s.pipeline, { ...item, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    }))
    return id
  }, [])

  const updatePipelineItem = useCallback((id, patch) => {
    setState(s => ({
      ...s,
      pipeline: s.pipeline.map(p => p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p),
    }))
  }, [])

  const deletePipelineItem = useCallback((id) => {
    setState(s => ({ ...s, pipeline: s.pipeline.filter(p => p.id !== id) }))
  }, [])

  // ── Follow-ups ────────────────────────────────────────────────────────────
  const addFollowup = useCallback((followup) => {
    const id = `fu-${Date.now()}`
    setState(s => ({
      ...s,
      followups: [...s.followups, { ...followup, id, createdAt: new Date().toISOString(), status: 'pending' }],
    }))
    return id
  }, [])

  const updateFollowup = useCallback((id, patch) => {
    setState(s => ({
      ...s,
      followups: s.followups.map(f => f.id === id ? { ...f, ...patch } : f),
    }))
  }, [])

  const deleteFollowup = useCallback((id) => {
    setState(s => ({ ...s, followups: s.followups.filter(f => f.id !== id) }))
  }, [])

  // ── Interactions ──────────────────────────────────────────────────────────
  const addInteraction = useCallback((interaction) => {
    const id = `int-${Date.now()}`
    setState(s => ({
      ...s,
      interactions: [...s.interactions, { ...interaction, id, date: new Date().toISOString() }],
      contacts: s.contacts.map(c =>
        c.id === interaction.contactId
          ? { ...c, lastContact: new Date().toISOString() }
          : c
      ),
    }))
    return id
  }, [])

  // ── Goals ─────────────────────────────────────────────────────────────────
  const setGoal = useCallback((goal) => {
    setState(s => {
      const existing = s.goals.find(g => g.id === goal.id)
      if (existing) {
        return { ...s, goals: s.goals.map(g => g.id === goal.id ? { ...g, ...goal } : g) }
      }
      return { ...s, goals: [...s.goals, { ...goal, id: `goal-${Date.now()}` }] }
    })
  }, [])

  const deleteGoal = useCallback((id) => {
    setState(s => ({ ...s, goals: s.goals.filter(g => g.id !== id) }))
  }, [])

  // ── Templates ─────────────────────────────────────────────────────────────
  const addTemplate = useCallback((tpl) => {
    const id = `tmpl-${Date.now()}`
    setState(s => ({ ...s, templates: [...s.templates, { ...tpl, id }] }))
    return id
  }, [])

  const updateTemplate = useCallback((id, patch) => {
    setState(s => ({ ...s, templates: s.templates.map(t => t.id === id ? { ...t, ...patch } : t) }))
  }, [])

  const deleteTemplate = useCallback((id) => {
    setState(s => ({ ...s, templates: s.templates.filter(t => t.id !== id) }))
  }, [])

  // ── Product click tracking ────────────────────────────────────────────────
  const trackProductClick = useCallback((productId) => {
    setState(s => ({
      ...s,
      productClicks: { ...s.productClicks, [productId]: (s.productClicks[productId] || 0) + 1 },
    }))
  }, [])

  // ── Campaigns ─────────────────────────────────────────────────────────────
  const addCampaign = useCallback((campaign) => {
    const id = `camp-${Date.now()}`
    setState(s => ({
      ...s,
      campaigns: [...s.campaigns, { ...campaign, id, createdAt: new Date().toISOString() }],
    }))
    return id
  }, [])

  const updateCampaign = useCallback((id, patch) => {
    setState(s => ({
      ...s,
      campaigns: s.campaigns.map(c => c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c),
    }))
  }, [])

  const deleteCampaign = useCallback((id) => {
    setState(s => ({ ...s, campaigns: s.campaigns.filter(c => c.id !== id) }))
  }, [])

  // ── Link Shares ───────────────────────────────────────────────────────────
  const addLinkShare = useCallback(({ contactId, productId, campaignId, notes }) => {
    const id = `ls-${Date.now()}`
    setState(s => ({
      ...s,
      linkShares: [...s.linkShares, {
        id,
        contactId,
        productId,
        campaignId: campaignId || null,
        notes: notes || '',
        date: new Date().toISOString(),
        followedUp: false,
      }],
    }))
    return id
  }, [])

  const updateLinkShare = useCallback((id, patch) => {
    setState(s => ({
      ...s,
      linkShares: s.linkShares.map(ls => ls.id === id ? { ...ls, ...patch } : ls),
    }))
  }, [])

  // ── Contact Products ──────────────────────────────────────────────────────
  const addContactProduct = useCallback(({ contactId, productId, orderValue, commissionRate, campaignId }) => {
    const id = `cp-${Date.now()}`
    setState(s => ({
      ...s,
      contactProducts: [...s.contactProducts, {
        id,
        contactId,
        productId,
        campaignId: campaignId || null,
        orderValue: parseFloat(orderValue) || 0,
        commissionRate: parseFloat(commissionRate) || 0.15,
        purchaseDate: new Date().toISOString(),
      }],
    }))
    return id
  }, [])

  const deleteContactProduct = useCallback((id) => {
    setState(s => ({ ...s, contactProducts: s.contactProducts.filter(cp => cp.id !== id) }))
  }, [])

  // ── Enrollments ───────────────────────────────────────────────────────────
  const addEnrollment = useCallback(({ contactId, sequenceId }) => {
    const id = `enr-${Date.now()}`
    setState(s => {
      // Prevent duplicate active enrollment in same sequence
      const exists = s.enrollments.some(
        e => e.contactId === contactId && e.sequenceId === sequenceId && e.status === 'active'
      )
      if (exists) return s
      return {
        ...s,
        enrollments: [...s.enrollments, {
          id,
          contactId,
          sequenceId,
          enrolledAt: new Date().toISOString(),
          currentStep: 0,
          status: 'active',
        }],
      }
    })
    return id
  }, [])

  const advanceEnrollment = useCallback((id, totalSteps) => {
    setState(s => ({
      ...s,
      enrollments: s.enrollments.map(e => {
        if (e.id !== id) return e
        const next = e.currentStep + 1
        return next >= totalSteps
          ? { ...e, status: 'completed', currentStep: next }
          : { ...e, currentStep: next }
      }),
    }))
  }, [])

  const updateEnrollment = useCallback((id, patch) => {
    setState(s => ({
      ...s,
      enrollments: s.enrollments.map(e => e.id === id ? { ...e, ...patch } : e),
    }))
  }, [])

  const deleteEnrollment = useCallback((id) => {
    setState(s => ({ ...s, enrollments: s.enrollments.filter(e => e.id !== id) }))
  }, [])

  // ── Settings ──────────────────────────────────────────────────────────────
  const updateSettings = useCallback((patch) => {
    setState(s => ({
      ...s,
      settings: { ...s.settings, ...patch },
    }))
  }, [])

  return {
    ...state,
    addContact, updateContact, deleteContact,
    addPipelineItem, updatePipelineItem, deletePipelineItem,
    addFollowup, updateFollowup, deleteFollowup,
    addInteraction,
    setGoal, deleteGoal,
    addTemplate, updateTemplate, deleteTemplate,
    trackProductClick,
    addCampaign, updateCampaign, deleteCampaign,
    addLinkShare, updateLinkShare,
    addContactProduct, deleteContactProduct,
    addEnrollment, advanceEnrollment, updateEnrollment, deleteEnrollment,
    updateSettings,
  }
}
