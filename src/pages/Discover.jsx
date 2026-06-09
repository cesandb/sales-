import { useState } from 'react'
import { Compass, Check, Copy, ExternalLink, Users, ChevronRight, RotateCcw, BookmarkPlus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { PRODUCTS, getProductById } from '../data/products'
import Modal from '../components/Modal'

// ── Step 1 options ────────────────────────────────────────────────────────────
const GOALS = [
  { id: 'weight-loss',  label: 'Weight Loss & Body Composition',   emoji: '🔥' },
  { id: 'build-muscle', label: 'Build Muscle & Strength',           emoji: '💪' },
  { id: 'energy',       label: 'Boost Energy & Performance',        emoji: '⚡' },
  { id: 'general',      label: 'General Health & Wellness',         emoji: '🌿' },
  { id: 'womens',       label: "Women's Health",                    emoji: '🌸' },
  { id: 'mens',         label: "Men's Vitality",                    emoji: '🏆' },
  { id: 'family',       label: 'Family & Kids Health',              emoji: '👨‍👩‍👧' },
  { id: 'endurance',    label: 'Athletic Endurance',                emoji: '🏃' },
]

// ── Step 2 options ────────────────────────────────────────────────────────────
const SITUATIONS = [
  { id: 'beginner',       label: 'New to supplements' },
  { id: 'gut',            label: 'Gut / digestive issues' },
  { id: 'low-energy',     label: 'Low energy / fatigue' },
  { id: 'joint',          label: 'Joint or muscle soreness' },
  { id: 'skin',           label: 'Skin, hair, or nail concerns' },
  { id: 'hormones',       label: 'Hormonal imbalance / stress' },
  { id: 'meal-replace',   label: 'Needs meal replacement' },
  { id: 'recovery',       label: 'Post-workout recovery focus' },
  { id: 'lactose-gluten', label: 'Lactose or gluten sensitive' },
]

// ── Recommendation logic ──────────────────────────────────────────────────────
const BASE_RECS = {
  'weight-loss':  ['l-carnitine', 'thyro-drive', 'opti-greens-50', 'micro-factor', 'level-1'],
  'build-muscle': ['phormula-1', 'creatine', 'level-1', 'bcaa', 'post-workout-stack'],
  'energy':       ['project-1', 'opti-reds-50', 'micro-factor', 'ignition', 'intra-formance'],
  'general':      ['micro-factor', 'opti-greens-50', 'full-mega', 'opti-reds-50', 'probiotic'],
  'womens':       ['harmony', 'micro-factor', 'collagen-dermaval', 'opti-greens-50', 'full-mega'],
  'mens':         ['primal-t', 'night-t', 'micro-factor', 'full-mega', 'creatine'],
  'family':       ['m-factor-kiddos', 'opti-kids', 'kiddo-mega', 'calciyummies', 'micro-factor'],
  'endurance':    ['endura-formance', 'intra-formance', 'ignition', 'bcaa', 'creatine'],
}

function getRecommendations(goal, situations) {
  const base = [...(BASE_RECS[goal] || BASE_RECS['general'])]
  const extras = new Set()

  if (situations.includes('gut'))            { extras.add('gi-advantage'); extras.add('probiotic') }
  if (situations.includes('joint'))          { extras.add('joint-mobility'); extras.add('full-mega') }
  if (situations.includes('low-energy'))     { extras.add('opti-reds-50') }
  if (situations.includes('skin'))           { extras.add('collagen-dermaval'); extras.add('hair-skin-nails') }
  if (situations.includes('hormones')) {
    if (goal === 'womens') extras.add('harmony')
    else extras.add('primal-t')
  }
  if (situations.includes('meal-replace'))   { extras.add('level-1') }
  if (situations.includes('recovery'))       { extras.add('phormula-1'); extras.add('ignition') }
  if (situations.includes('lactose-gluten')) { extras.add('foundation-stack') }

  // Merge: base first, then extras that aren't already in base
  const merged = [...base]
  extras.forEach(id => { if (!merged.includes(id)) merged.push(id) })

  // Limit to 5 and only include products that exist in the catalog
  return merged
    .filter(id => PRODUCTS.some(p => p.id === id))
    .slice(0, 5)
    .map(id => PRODUCTS.find(p => p.id === id))
    .filter(Boolean)
}

function getWhyReason(product, goal, situations) {
  // Custom reasons per product + context
  const reasons = {
    'micro-factor':      'The foundation everyone should start with — covers all micronutrient gaps in one daily packet.',
    'opti-greens-50':    '50 superfoods with probiotics for gut health, energy, and immune support you can\'t get from diet alone.',
    'opti-reds-50':      'Antioxidant-rich polyphenols and nitric oxide boosters for better blood flow, energy, and cardiovascular health.',
    'full-mega':         'Clinical-dose EPA/DHA from wild-caught fish — the omega-3 standard most supplements don\'t meet.',
    'level-1':           'Slow-digesting multi-source protein feeds muscles over 2–3 hours — perfect for meal replacement or between meals.',
    'phormula-1':        'Fast-absorbing whey isolate hits muscles within 30 minutes post-workout — the ultimate recovery protein.',
    'ignition':          'Pure dextrose drives 6x the insulin response to shuttle protein directly into muscles post-workout.',
    'post-workout-stack':'The complete recovery system — Phormula-1 + Ignition together maximize muscle repair and glycogen replenishment.',
    'creatine':          'The most researched supplement ever — proven to increase strength, power, and muscle in hundreds of studies.',
    'project-1':         'Full pre-workout: 5g creatine + beta-alanine + L-tyrosine for intense, focused training.',
    'megawatt':          '150mg natural caffeine with nootropics — clean energy without jitters, can be used any time of day.',
    'l-carnitine':       'Transports fatty acids directly into mitochondria to be burned as fuel — the fat mobilizer.',
    'thyro-drive':       'Stimulant-free thyroid and metabolic rate support — helps your body burn more calories all day.',
    'harmony':           'KSM-66 ashwagandha + MACA + Chasteberry for balanced female hormones, reduced PMS, and managed stress.',
    'primal-t':          'Clinically studied natural testosterone support — ashwagandha, tribulus, boron, and DIM in one product.',
    'night-t':           'Works with Primal-T overnight — 24-hour testosterone optimization with sleep support.',
    'collagen-dermaval': '10g hydrolyzed collagen with Dermaval™ — backed by 10,000+ reviews for skin, hair, nails, and joints.',
    'hair-skin-nails':   'High-dose biotin and beauty vitamins support hair growth, nail strength, and skin health from within.',
    'gi-advantage':      'Relieves bloating, gas, heartburn, and leaky gut — addresses the root of digestive discomfort.',
    'probiotic':         '8B CFU shelf-stable probiotics for gut flora balance, immune support, and better digestion.',
    'joint-mobility':    'Glucosamine, chondroitin, and MSM for joint pain relief and long-term cartilage support.',
    'bcaa':              'Essential branch-chain aminos for muscle recovery — great for intra-workout or fasted training.',
    'eaa':               'All 9 essential aminos for complete muscle protein synthesis — superior to BCAAs alone.',
    'intra-formance':    'Electrolytes and EAAs to sustain energy and prevent muscle breakdown during long sessions.',
    'endura-formance':   'Formulated for endurance athletes — delays fatigue and supports sustained performance in long cardio.',
    'foundation-stack':  'The complete foundational bundle — specifically formulated lactose-free and gluten-free.',
    'm-factor-kiddos':   "Complete children's multivitamin to fill the gaps picky eaters create — kids love the taste.",
    'opti-kids':         "Kid-friendly superfoods blend that makes getting vegetables into children easy and enjoyable.",
    'kiddo-mega':        "DHA omega-3s critical for children's brain and visual development — most kids are deficient.",
    'calciyummies':      "Delicious calcium chews that actually taste good — builds strong bones during peak growth years.",
  }
  return reasons[product.id] || product.description
}

// ── Recommend to Contact mini-modal ──────────────────────────────────────────
function RecommendModal({ product, contacts, onClose, onRecommend }) {
  const [selectedContact, setSelectedContact] = useState('')
  const [notes, setNotes] = useState(`Recommended ${product.name}`)

  return (
    <Modal title={`Recommend to Contact`} onClose={onClose}>
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-brand-900/20 border border-brand-700/40">
          <p className="text-sm font-semibold text-brand-300">{product.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{product.description}</p>
        </div>
        <div>
          <label className="label">Select Contact *</label>
          <select
            className="input"
            value={selectedContact}
            onChange={e => setSelectedContact(e.target.value)}
          >
            <option value="">Choose a contact…</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name} — {c.status}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Interaction Note</label>
          <textarea
            className="input min-h-16 resize-none"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        {contacts.length === 0 && (
          <p className="text-xs text-gray-500">No contacts yet — add contacts first.</p>
        )}
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!selectedContact}
            onClick={() => {
              if (selectedContact) {
                onRecommend(selectedContact, notes)
                onClose()
              }
            }}
          >
            Log Recommendation
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Product Result Card ───────────────────────────────────────────────────────
function ResultCard({ product, goal, situations, onRecommendToContact }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    await navigator.clipboard.writeText(product.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reason = getWhyReason(product, goal, situations)
  const keyBenefit = product.benefits?.[0] || product.description

  return (
    <div className="card border border-gray-700 hover:border-brand-700/60 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-0.5">{product.category}</p>
          <h3 className="font-bold text-white">{product.name}</h3>
        </div>
      </div>

      <p className="text-sm text-gray-300 mb-3">{reason}</p>

      <div className="bg-brand-900/20 border border-brand-800/40 rounded-lg px-3 py-2 mb-4">
        <p className="text-xs text-brand-300 leading-relaxed">{keyBenefit}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={copyLink}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
            copied
              ? 'bg-green-900/40 text-green-400'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <ExternalLink size={12} />
          Open
        </a>
        <button
          onClick={onRecommendToContact}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-brand-700/30 text-brand-400 hover:bg-brand-600/50 hover:text-white transition-colors ml-auto"
        >
          <Users size={12} />
          Recommend to Contact
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Discover() {
  const { contacts, addInteraction, trackProductClick } = useStore()

  const [step, setStep] = useState(1)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [selectedSituations, setSelectedSituations] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [recommendModal, setRecommendModal] = useState(null) // { product }
  const [saved, setSaved] = useState(false)

  function toggleSituation(id) {
    setSelectedSituations(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  function goToStep2() {
    if (selectedGoal) setStep(2)
  }

  function goToResults() {
    const recs = getRecommendations(selectedGoal, selectedSituations)
    setRecommendations(recs)
    setStep(3)
  }

  function startOver() {
    setStep(1)
    setSelectedGoal(null)
    setSelectedSituations([])
    setRecommendations([])
    setSaved(false)
  }

  function saveRecommendation() {
    recommendations.forEach(p => trackProductClick(p.id))
    setSaved(true)
  }

  function handleRecommendToContact(product, contactId, notes) {
    addInteraction({
      contactId,
      type: 'Recommendation',
      notes: notes || `Recommended ${product.name} via Smart Recommender`,
    })
    trackProductClick(product.id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Compass size={22} className="text-brand-400" />
            Smart Recommender
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Answer 2 quick questions to find the perfect products for any prospect.
          </p>
        </div>
        {step > 1 && (
          <button onClick={startOver} className="btn-secondary flex items-center gap-2">
            <RotateCcw size={14} />
            Start Over
          </button>
        )}
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step >= n
                ? 'bg-brand-600 text-white'
                : 'bg-gray-800 text-gray-500'
            }`}>
              {step > n ? <Check size={12} /> : n}
            </div>
            <span className={`text-xs hidden sm:inline ${step >= n ? 'text-gray-300' : 'text-gray-600'}`}>
              {n === 1 ? 'Primary Goal' : n === 2 ? 'Situation' : 'Results'}
            </span>
            {n < 3 && <ChevronRight size={14} className="text-gray-700" />}
          </div>
        ))}
      </div>

      {/* Step 1: Goal */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="card">
            <h2 className="font-bold text-white text-lg mb-1">What is their primary goal?</h2>
            <p className="text-gray-400 text-sm mb-4">Select one goal to get started.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {GOALS.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGoal(g.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedGoal === g.id
                      ? 'border-brand-500 bg-brand-900/30 text-white'
                      : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-600 hover:text-white'
                  }`}
                >
                  <span className="text-2xl block mb-2">{g.emoji}</span>
                  <span className="text-sm font-semibold">{g.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={goToStep2}
              disabled={!selectedGoal}
              className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Situations */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="card">
            <h2 className="font-bold text-white text-lg mb-1">Any specific situations?</h2>
            <p className="text-gray-400 text-sm mb-4">Select all that apply — or skip to continue.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SITUATIONS.map(s => {
                const checked = selectedSituations.includes(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSituation(s.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      checked
                        ? 'border-brand-500 bg-brand-900/30 text-white'
                        : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-600 hover:text-white'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      checked ? 'bg-brand-600 border-brand-600' : 'border-gray-600'
                    }`}>
                      {checked && <Check size={12} className="text-white" />}
                    </div>
                    <span className="text-sm">{s.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex gap-3 justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary">
              Back
            </button>
            <button onClick={goToResults} className="btn-primary flex items-center gap-2">
              See Recommendations <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Summary banner */}
          <div className="card border border-brand-700/40 bg-brand-900/10">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-brand-300">
                  {recommendations.length} products recommended
                </p>
                <p className="text-sm text-gray-400 mt-0.5">
                  Goal: <span className="text-white">{GOALS.find(g => g.id === selectedGoal)?.label}</span>
                  {selectedSituations.length > 0 && (
                    <> · <span className="text-white">{selectedSituations.length} situation{selectedSituations.length !== 1 ? 's' : ''} considered</span></>
                  )}
                </p>
              </div>
              <button
                onClick={saveRecommendation}
                disabled={saved}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  saved
                    ? 'bg-green-900/40 text-green-400'
                    : 'btn-primary'
                }`}
              >
                {saved ? <><Check size={14} /> Saved!</> : <><BookmarkPlus size={14} /> Save This Recommendation</>}
              </button>
            </div>
          </div>

          {/* Product cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((product, i) => (
              <div key={product.id} className="relative">
                {i === 0 && (
                  <div className="absolute -top-2 left-4 z-10">
                    <span className="bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      Top Pick
                    </span>
                  </div>
                )}
                <ResultCard
                  product={product}
                  goal={selectedGoal}
                  situations={selectedSituations}
                  onRecommendToContact={() => setRecommendModal({ product })}
                />
              </div>
            ))}
          </div>

          {recommendations.length === 0 && (
            <div className="card text-center py-12">
              <p className="text-gray-500">No products matched. Try different criteria.</p>
              <button onClick={startOver} className="btn-primary mt-4">Start Over</button>
            </div>
          )}
        </div>
      )}

      {/* Recommend to Contact modal */}
      {recommendModal && (
        <RecommendModal
          product={recommendModal.product}
          contacts={contacts}
          onClose={() => setRecommendModal(null)}
          onRecommend={(contactId, notes) => {
            handleRecommendToContact(recommendModal.product, contactId, notes)
          }}
        />
      )}
    </div>
  )
}
