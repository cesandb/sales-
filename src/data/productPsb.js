// Problem-Solution-Benefit framework for every 1st Phorm product.
// Researched from 1st Phorm product pages, BarBend, Garage Gym Reviews,
// Consumer Health Digest, and multiple independent supplement review sites.

export const PRODUCT_PSB = [
  {
    id: 'micro-factor',
    problem: "Even people eating 'healthy' are chronically deficient in key micronutrients — the USDA says most Americans don't get enough magnesium, vitamin D, vitamin K, or essential antioxidants from food alone. These gaps quietly drain energy, weaken immunity, slow metabolism, and make every other supplement less effective.",
    solution: "Micro Factor is a comprehensive daily packet containing a multivitamin, CoQ10, fruit & vegetable blend, probiotic, essential fatty acids, and antioxidants — everything your body needs that you're not getting from food, delivered in one convenient daily pack.",
    benefits: [
      "Noticeably more energy without stimulants within 1–2 weeks",
      "Stronger immune system — fewer sick days",
      "Improved digestion and gut health from probiotics",
      "Better cardiovascular and cellular health from CoQ10",
      "Maximizes the ROI of every other supplement you take",
    ],
    idealFor: ["Everyone — this is the foundation stack regardless of goal", "Busy professionals", "Athletes", "People with low energy"],
    objections: [
      { o: "I already take a multivitamin.", r: "A standard multi is one pill. Micro Factor is 6 separate products in one pack — multivitamin, CoQ10 for energy, probiotics for gut health, essential fatty acids, antioxidants, and a fruit/veggie blend. No single pill matches this coverage." },
      { o: "It's expensive for vitamins.", r: "Buying each component separately — a quality multi, CoQ10, omega blend, probiotic, antioxidant formula — costs significantly more. Micro Factor bundles everything at roughly $2-3/day. What's low energy and poor health costing you?" },
    ],
    pitch: "This is the first thing I tell literally everyone to start with. It closes every nutritional gap you have — even if you eat well. Think of it as your daily insurance policy.",
  },
  {
    id: 'opti-greens-50',
    problem: "Most people eat far fewer servings of vegetables than recommended — and cooking destroys key enzymes and phytonutrients. The result is poor gut health, sluggish digestion, weak immunity, blood sugar spikes, and a body that can't properly absorb the nutrients it's given.",
    solution: "Opti-Greens 50 packs 50 ingredients — 8 organic grasses and greens, superfoods, digestive enzymes, 5+ billion CFU probiotics — into one daily scoop that restores gut function, improves nutrient absorption, and supports immune health.",
    benefits: [
      "Reduced bloating and digestive discomfort within days",
      "More regular digestion and less gut inflammation",
      "Improved immune function from probiotics and phytonutrients",
      "Better blood sugar regulation and fewer energy crashes",
      "Lays the foundation for every other supplement to work better",
    ],
    idealFor: ["Anyone who doesn't eat 5-9 vegetable servings daily", "People with bloating or digestive issues", "Those who get sick frequently"],
    objections: [
      { o: "I eat salads — I don't need this.", r: "A salad covers maybe 2-3 of the 50 nutrient sources here. You'd also need to eat it raw with specific digestive enzymes for the same absorption benefit. Opti-Greens closes the gaps even for people who eat well." },
      { o: "Greens powders taste terrible.", r: "Opti-Greens 50's natural berry flavor is consistently described as 'surprisingly good' — sweet, not grassy. It mixes in water, juice, or a shake. Give it a week — most people forget they ever hated greens powders." },
    ],
    pitch: "Do you eat 8-10 servings of fruits and veggies every day? Most people laugh. This is how you close that gap in 30 seconds a day.",
  },
  {
    id: 'opti-reds-50',
    problem: "Modern diets are severely lacking in polyphenols, anthocyanins, and antioxidants found in colorful fruits and berries — the compounds that protect cells from oxidative stress, support heart health, and keep energy metabolism clean. This accelerates aging, contributes to cardiovascular risk, and leaves people chronically drained.",
    solution: "Opti-Reds 50 blends 50 superfruits, berries, vegetables, and herbs into a daily drink that optimizes nitric oxide production, improves blood flow, combats free radical damage, and supports cardiovascular and metabolic health.",
    benefits: [
      "Improved circulation and cardiovascular health",
      "Enhanced nitric oxide levels — better pumps, better blood flow",
      "Powerful antioxidant defense against cellular aging",
      "Natural energy from improved metabolism and circulation",
      "Supports healthy blood pressure regulation",
    ],
    idealFor: ["Adults over 30 concerned about heart health and aging", "Athletes wanting better pumps and performance", "Anyone focused on longevity"],
    objections: [
      { o: "Can't I just eat fruit?", r: "You'd have to eat 15-20 different servings of specific superfruits daily — many aren't realistic grocery staples. This covers what you're missing in one scoop." },
      { o: "How is this different from Opti-Greens?", r: "They're complementary. Greens focuses on gut health, digestion, and immune function. Reds focuses on cardiovascular health, antioxidants, and nitric oxide. Most people benefit from both — that's why 1st Phorm stacks them together." },
    ],
    pitch: "Perfect pair with Opti-Greens — together they cover the full spectrum of plant-based nutrition your body needs for energy, heart health, and longevity.",
  },
  {
    id: 'full-mega',
    problem: "The average American diet is dramatically overloaded with inflammatory omega-6 fats and critically deficient in omega-3s — creating a systemic inflammatory environment that drives joint pain, poor cardiovascular health, brain fog, stubborn fat, and slow recovery. Most fish oil products are under-dosed and oxidized.",
    solution: "Full Mega delivers a full clinical dose of 2,500mg omega-3 per serving (1,500mg combined EPA+DHA) from wild-caught cold-water fish — the amount research supports for meaningful cardiovascular, cognitive, joint, and metabolic benefits.",
    benefits: [
      "Reduces systemic inflammation — less joint pain, faster recovery",
      "Supports heart health, healthy triglycerides, and blood pressure",
      "Improves brain function, mood, and cognitive sharpness",
      "Helps the body mobilize stored body fat",
      "Improves skin, hair, and joint lubrication",
    ],
    idealFor: ["Everyone — omega-3 deficiency is nearly universal", "People with joint discomfort or inflammation", "Anyone focused on heart health or longevity"],
    objections: [
      { o: "I eat fish a few times a week.", r: "Unless you're eating wild-caught fatty fish 3-4 times weekly, you're almost certainly under the therapeutic threshold. Most people who think they're covered are still well short of 1,000-1,500mg EPA+DHA daily." },
      { o: "Grocery store fish oil is much cheaper.", r: "Drugstore fish oil is typically 300mg omega-3 per softgel with low EPA/DHA ratios. You'd need 5-8 pills to match one serving of Full Mega — and many cheap products are oxidized, meaning rancid oil. Quality here matters." },
    ],
    pitch: "Everyone should be on Full Mega. Omega-3 deficiency is almost universal in Western diets and it's silently driving inflammation, joint pain, and slow recovery.",
  },
  {
    id: 'level-1',
    problem: "Most people can't consistently hit their daily protein targets from whole foods alone — busy schedules and poor planning leave muscles under-recovered and fat loss stalled. They feel like they're doing everything right but the results just aren't coming.",
    solution: "Level-1 uses a tri-blend of whey isolate, whey concentrate, and milk protein concentrate to deliver 23-25g of protein that digests slowly over 2-3 hours, keeping the body in a muscle-building, fat-burning state between meals.",
    benefits: [
      "Stays full longer — curbs cravings and prevents overeating",
      "Hits daily protein goals effortlessly even on hectic days",
      "Supports lean muscle maintenance while in a calorie deficit",
      "Tastes like a treat — makes clean eating sustainable",
      "Versatile: shake, baking, oatmeal — fits any lifestyle",
    ],
    idealFor: ["Busy professionals who skip meals", "Anyone in a fat-loss phase needing satiety", "People new to supplements", "Those who struggle to eat enough protein"],
    objections: [
      { o: "I can just eat chicken and eggs.", r: "Whole food is always the goal. But when it's 2pm and you haven't eaten since 8am because your day blew up, Level-1 is the difference between hitting your protein target and falling 50g short. It's your insurance policy, not a replacement." },
      { o: "Protein powders give me bloating.", r: "That's usually from cheap whey concentrate or artificial sweeteners. Level-1's blend is gentle on the gut — many people who couldn't tolerate other proteins do fine with it." },
    ],
    pitch: "This is the most important supplement after Micro Factor. Everyone needs more protein, almost nobody gets enough from food alone. Level-1 makes it effortless.",
  },
  {
    id: 'phormula-1',
    problem: "After a hard workout, there's a short window to stop muscle breakdown and kickstart repair — and most people either miss it or eat the wrong thing. They train hard but see slow muscle gains and feel like their effort isn't translating to results.",
    solution: "Phormula-1 is a hydrolyzed whey protein isolate — the fastest-digesting protein available. It floods the muscles with amino acids within minutes post-workout, halting catabolism and signaling immediate muscle repair during the critical anabolic window.",
    benefits: [
      "Dramatically reduces next-day soreness and muscle fatigue",
      "Accelerates muscle repair and growth after training",
      "Lean and light — no fat or lactose to slow absorption",
      "Works best paired with Ignition for the complete recovery protocol",
    ],
    idealFor: ["Serious athletes and gym-goers training 4+ days per week", "Anyone whose #1 goal is building muscle", "People who experience excessive soreness"],
    objections: [
      { o: "Can't I just drink a regular protein shake after my workout?", r: "Standard protein blends take 2-3 hours to fully digest. Your post-workout window is real — muscles are most primed within 30-45 minutes. Phormula-1 absorbs in minutes. It's the right tool for the right moment." },
      { o: "How is it different from Level-1?", r: "Completely different purpose. Level-1 is for sustained protein between meals. Phormula-1 is engineered for speed post-workout. Using Level-1 post-workout is like putting regular gas in a race car — it works but you're leaving results on the table." },
    ],
    pitch: "Stack this with Ignition right after training — it's 1st Phorm's signature protocol and the #1 reason people go from spinning their wheels to actually building muscle.",
  },
  {
    id: 'ignition',
    problem: "After intense training, glycogen stores are depleted and cortisol is elevated — the body is temporarily in a catabolic state. Protein alone isn't enough: without fast-digesting carbohydrates to spike insulin and drive amino acids into muscle cells, the anabolic window is only partially activated.",
    solution: "Ignition is a post-workout fast-carb formula containing dextrose and creatine monohydrate — designed to cause an immediate insulin spike that drives nutrients into muscle cells, replenishes glycogen stores rapidly, and shuts down post-workout cortisol.",
    benefits: [
      "Immediately flips the body from catabolic to anabolic post-workout",
      "Rapidly replenishes muscle glycogen for faster recovery",
      "Insulin spike drives Phormula-1 amino acids deep into muscle tissue",
      "Reduces muscle soreness from the next day",
      "Doubles the effectiveness of Phormula-1 when taken together",
    ],
    idealFor: ["Serious athletes focused on building muscle", "People with high-intensity training who feel slow to recover", "Hardgainers who struggle to put on muscle"],
    objections: [
      { o: "Won't fast carbs make me fat?", r: "Post-workout is the one time fast-digesting carbs don't go to fat — they go directly to glycogen replenishment in muscle tissue. The post-workout insulin spike is anabolic in this context, not lipogenic. Timing is everything." },
      { o: "I'm trying to lose fat — should I take carbs after training?", r: "Even in a fat loss phase, post-workout carbs serve a specific recovery function. Depleted glycogen limits future training intensity, and poor recovery increases cortisol — both hinder fat loss. The amount in Ignition is targeted and purposeful." },
    ],
    pitch: "This is 1st Phorm's most recommended product pairing — Phormula-1 + Ignition together immediately post-workout. Most people see the biggest jump in results just from nailing this one habit.",
  },
  {
    id: 'project-1',
    problem: "Too many gym sessions are wasted — dragging through half-effort workouts because of poor sleep, a stressful day, or just running on empty. The gap between showing up and actually training at a level that drives results is where most progress dies.",
    solution: "Project-1 delivers 200mg caffeine for clean energy, 300mg Alpha-GPC for sustained focus and mind-muscle connection, 5g creatine for strength and power, and 3.2g beta-alanine to buffer muscle fatigue — a complete performance formula.",
    benefits: [
      "Smooth, long-lasting energy with no mid-workout crash",
      "Laser focus and mental clarity — actually feel the muscles working",
      "More strength and explosiveness in every set",
      "Better endurance — push through that last rep, last set",
      "Makes going to the gym something to look forward to",
    ],
    idealFor: ["Anyone who struggles with motivation or low energy during training", "Athletes wanting to break performance plateaus", "People training early mornings or after long work days"],
    objections: [
      { o: "Pre-workouts give me anxiety and trouble sleeping.", r: "Those side effects come from mega-dose caffeine (300-400mg) and cheap stimulant blends. Project-1's 200mg produces focus and energy without anxiety. Take it at least 4-5 hours before bed." },
      { o: "I don't want to become dependent on a pre-workout to train.", r: "Most people cycle it — use it on training days, skip it on rest days. Take a week off every couple months to keep sensitivity high. Your training is real — this just makes each session count more." },
    ],
    pitch: "How often do you get to the gym and just go through the motions? Project-1 changes that — every session becomes a session you're proud of.",
  },
  {
    id: 'creatine',
    problem: "Strength and muscle gains plateau — workouts stop producing results, reps stall, and recovery lags — often because the body's phosphocreatine system (fuel for explosive effort) is running at below-optimal capacity. Most people are leaving measurable performance on the table every workout.",
    solution: "Micronized Creatine Monohydrate saturates muscle cells with phosphocreatine stores, enabling faster ATP regeneration — the energy currency of every rep, sprint, and explosive movement. 1st Phorm's micronized form mixes easily and absorbs without bloating.",
    benefits: [
      "Increased strength and power output — measurable within 1-2 weeks of loading",
      "More reps, more volume, more growth stimulus",
      "Supports increased muscle cell volume (more full, developed look)",
      "Accelerates recovery between sets and between sessions",
      "Emerging research supports cognitive benefits and brain energy",
    ],
    idealFor: ["Anyone doing resistance training who wants to get stronger", "Beginners who want the biggest supplement ROI", "Intermediate and advanced athletes who've plateaued", "Older adults wanting to preserve strength and muscle"],
    objections: [
      { o: "Won't creatine make me bloated and retain water?", r: "That's associated with older, non-micronized forms. 1st Phorm's micronized version mixes completely and absorbs cleanly. Any water weight goes into the muscle cells (making them fuller and stronger), not under the skin." },
      { o: "Is it safe long-term? I've heard it's hard on kidneys.", r: "Creatine monohydrate is the most studied supplement in sports nutrition — over 30 years of research on healthy individuals shows no negative impact on kidney function at recommended doses. It's safer than most things in your medicine cabinet." },
    ],
    pitch: "If someone trains and isn't taking creatine, this is the single highest-ROI supplement they're missing. Period. 4.9 stars from 2,900+ reviews and backed by 30 years of research.",
  },
  {
    id: 'collagen-dermaval',
    problem: "Starting in your late 20s, the body's collagen production declines by roughly 1% per year — leading to joint pain and stiffness, sagging skin, brittle nails, thinning hair, and longer recovery from physical activity. Most people chase these symptoms with topical creams and NSAIDs without addressing the root cause.",
    solution: "1st Phorm's Collagen + Dermaval provides 15g of five types of hydrolyzed collagen peptides combined with Dermaval — a proprietary phytonutrient complex specifically shown to support healthy elastin levels, the protein responsible for skin firmness and elasticity.",
    benefits: [
      "Improved joint comfort and mobility — often noticeable within 4-6 weeks",
      "Visibly firmer, more elastic skin — reduction in fine lines",
      "Stronger, faster-growing nails and healthier hair",
      "Gut lining support (collagen is rich in glycine and proline)",
      "Supports connective tissue and ligament health for athletes",
    ],
    idealFor: ["Women 30+ noticing changes in skin elasticity, joint health, or hair/nails", "Active individuals with joint discomfort from training or aging", "Post-injury recovery support"],
    objections: [
      { o: "Collagen supplements don't actually absorb.", r: "Hydrolyzed collagen peptides are pre-broken into small peptides that survive digestion and reach the bloodstream, where they signal fibroblasts to produce new collagen. Multiple peer-reviewed studies confirm this. This applies to hydrolyzed forms specifically." },
      { o: "Why not just use a topical collagen cream?", r: "Collagen molecules are too large to penetrate the skin topically. Consuming hydrolyzed peptides addresses the actual production deficit from the inside. Inside-out is the only approach that works at the root." },
    ],
    pitch: "For any woman talking about skin, nails, or joint health — this is a genuinely exciting product. Real results from the inside out, not another cream that sits on the surface.",
  },
  {
    id: 'gi-advantage',
    problem: "Millions of people live with chronic bloating, irregular digestion, heartburn, and gut discomfort they've just accepted as normal. A compromised gut lining reduces nutrient absorption from food and supplements, weakens immunity, and contributes to body-wide inflammation.",
    solution: "GI Advantage uses L-Glutamine (gut lining repair), Galactoarabinan prebiotic fiber (feeds beneficial bacteria), Aloe Vera, Slippery Elm Bark, and Marshmallow Root to heal, protect, and rebalance the GI environment from the inside.",
    benefits: [
      "Significant reduction in bloating and gas — often within the first week",
      "Less heartburn and GI discomfort after meals",
      "Improved regularity and digestive comfort",
      "Stronger gut barrier — reduces 'leaky gut' symptoms",
      "Better absorption of nutrients from food and all other supplements",
    ],
    idealFor: ["Anyone with chronic bloating, IBS-like symptoms, or food sensitivities", "People taking multiple supplements who want to maximize absorption", "Those who've done courses of antibiotics"],
    objections: [
      { o: "I just take a probiotic — isn't that enough?", r: "A probiotic adds good bacteria but doesn't repair the environment those bacteria need to thrive. GI Advantage's L-Glutamine heals the gut lining, the prebiotic fiber feeds the bacteria, and the botanical blend soothes inflammation. It's a complete gut restoration protocol." },
      { o: "I've had these issues for years — can a supplement really help?", r: "Chronic gut issues often persist because the underlying mucosa and microbiome are never addressed. Many users report meaningful improvement within 1-2 weeks. It's not a magic solution, but giving the gut the building blocks to heal is a very different approach than managing symptoms indefinitely." },
    ],
    pitch: "If someone mentions bloating, digestion issues, or feeling 'off' after eating — this is the first thing I recommend. Many people see results within days.",
  },
  {
    id: '1db-goddess',
    problem: "Hormonal fluctuations (estrogen dominance, high cortisol, thyroid sluggishness) directly sabotage metabolism, mood, sleep, and energy for women — making standard diet and exercise advice feel like it just doesn't work. They're not failing the plan; the plan is failing to account for their hormones.",
    solution: "1-Db Goddess is a thermogenic fat burner specifically formulated for the female hormonal environment — using a Balance Blend to support natural estrogen and hormone regulation alongside metabolism-boosting thermogenics.",
    benefits: [
      "Accelerated fat loss — especially stubborn areas like hips, thighs, and belly",
      "More stable energy throughout the day without jitters or crashes",
      "Better mood, less anxiety, and reduced hormonal mood swings",
      "Reduced cravings — especially sugar and stress eating",
      "Feeling in control of their body again",
    ],
    idealFor: ["Women 25-50 struggling with stubborn fat that won't respond to diet/exercise", "Women experiencing PMS or mood swings", "Post-partum women or those coming off hormonal birth control", "Women in perimenopause"],
    objections: [
      { o: "I've tried fat burners before and they made me feel terrible.", r: "Most fat burners are just high-dose stimulants. 1-Db Goddess is specifically formulated for women's tolerance levels — the energy is clean and the Balance Blend keeps hormones in check so you don't get the anxious, jittery feeling." },
      { o: "How do I know this will actually work for me?", r: "The hormonal imbalance is real — cortisol, estrogen, and thyroid function all directly impact metabolism and body composition for women. This addresses those pathways specifically. Most women report visible changes in mood, energy, and body composition within 4-6 weeks." },
    ],
    pitch: "For any woman saying she's 'doing everything right but nothing is working' — this is the missing piece. Her hormones are working against her diet. This addresses that directly.",
  },
  {
    id: 'harmony',
    problem: "Hormonal imbalances — elevated cortisol, estrogen dominance, disrupted sleep — create a cascade of issues for women: persistent weight gain, mood instability, poor sleep quality, low libido, and inflammatory skin issues. These symptoms are often treated individually when they share a common hormonal root.",
    solution: "Harmony uses a targeted blend of ashwagandha, DIM (diindolylmethane), and adaptogenic herbs to directly reduce cortisol, support healthy estrogen metabolism, and improve sleep quality — creating the internal hormonal environment where other interventions can actually work.",
    benefits: [
      "Better mood, less anxiety, and reduced hormonal mood swings",
      "Deeper, more restorative sleep",
      "Improved skin clarity from hormonal balance",
      "Reduced belly fat linked to cortisol dominance",
      "Greater sense of calm and emotional stability",
    ],
    idealFor: ["Women with stress-driven weight gain and mood swings", "Those with poor sleep quality linked to hormones", "Women wanting a stimulant-free hormonal support option", "Perimenopausal women"],
    objections: [
      { o: "Will this interact with my medications?", r: "As with any supplement, always check with your doctor if you're on medications. DIM and ashwagandha are natural compounds, but a quick check with your healthcare provider is always smart, especially if you're on hormone-related medications." },
      { o: "How long until I see results?", r: "Hormonal shifts take time — most women report meaningful mood and sleep improvements within 2-3 weeks, with body composition changes visible at 4-6 weeks of consistent use." },
    ],
    pitch: "This is the one I recommend for women who are stressed, not sleeping well, and noticing their body changing in ways that feel hormonal. It addresses the root, not just the symptoms.",
  },
  {
    id: 'primal-t',
    problem: "Men's testosterone levels decline roughly 1% per year after age 30 — and modern stressors accelerate this significantly. The symptoms are insidious: fading drive, strength plateaus, more belly fat, slower recovery, and a general sense that the edge you used to have is gone.",
    solution: "Primal-T uses a clinically-informed blend of KSM-66 Ashwagandha, Tribulus, Long Jack 100, and Boron Citrate to naturally optimize the hormonal environment without shutting down the body's own testosterone production.",
    benefits: [
      "Improved strength, power, and gym performance within 4-6 weeks",
      "More energy, drive, and mental clarity throughout the day",
      "Better body composition — more muscle, less body fat",
      "Improved mood and stress resilience",
      "Supports libido and overall male vitality",
    ],
    idealFor: ["Men 30+ noticing reduced energy, strength, or drive", "Men in high-stress careers where cortisol is chronically elevated", "Athletes wanting to optimize natural hormone levels", "Men who feel 'off' but haven't been diagnosed with anything specific"],
    objections: [
      { o: "Doesn't TRT work better?", r: "TRT is a medical intervention with significant side effects including testicular atrophy, fertility impact, and dependency. Primal-T supports your body's natural production. It's the right first step for men whose levels are suboptimal but not in clinical deficiency territory." },
      { o: "I've heard testosterone boosters don't really work.", r: "Most over-the-counter T-boosters are under-dosed. Primal-T uses KSM-66 Ashwagandha — one of the most studied adaptogens in the world for testosterone and stress response. With consistent use and a good training program, the difference is real and measurable." },
    ],
    pitch: "For any man over 30 who mentions feeling less sharp, less driven, or plateauing in the gym — this is a game-changer. Natural, no side effects, and it works with the body instead of replacing its own production.",
  },
  {
    id: 'night-t',
    problem: "Most people don't realize that recovery — not training — is when muscle is actually built and testosterone naturally surges. Poor sleep, elevated evening cortisol, and inadequate recovery derail results. Men especially lose the massive growth hormone pulse that happens during deep REM sleep, wasting the most anabolic window of every 24 hours.",
    solution: "Night-T uses a synergistic blend of natural herbs and neurotransmitter-supporting compounds to promote genuine deep REM sleep, support GH release, and create the optimal hormonal environment for overnight muscle repair and testosterone regeneration — without dependency-forming sedatives.",
    benefits: [
      "Deeper, more restorative REM sleep — wake up actually recovered",
      "Elevated overnight growth hormone release — muscle repair accelerates",
      "Supports natural testosterone production while you sleep",
      "Reduced cortisol and stress response at night",
      "No grogginess or morning fog — feel refreshed, not sedated",
    ],
    idealFor: ["Men over 30 whose sleep quality and testosterone are both declining", "Hard-training athletes who feel under-recovered", "High-stress individuals whose cortisol stays elevated into the evening"],
    objections: [
      { o: "I don't want to take a sleep aid — I don't want to feel groggy.", r: "Night-T isn't a sedative — it doesn't knock you out. It creates the neurochemical environment for your body's natural sleep mechanisms to work better. Most users describe falling asleep more easily and waking up genuinely refreshed." },
      { o: "Why can't I just sleep 8 hours without a supplement?", r: "Duration isn't the only variable — quality is. You can sleep 8 hours and spend most of it in light sleep, missing the GH pulse and deep recovery that only happens in REM. Night-T helps you get the right kind of sleep, not just more clock time." },
    ],
    pitch: "Stack this with Primal-T for the complete 24-hour testosterone protocol. Primal-T works during the day; Night-T maximizes what happens while you're sleeping — which is honestly where most of your results happen.",
  },
  {
    id: 'thyro-drive',
    problem: "A sluggish thyroid is one of the most common and most overlooked metabolic obstacles — especially for women. Even without a clinical diagnosis, suboptimal T3/T4 conversion slows metabolism, causes persistent fatigue, makes fat loss feel impossible despite doing everything right, and creates a frustrating disconnect between effort and results.",
    solution: "Thyro-Drive is a stimulant-free formula that provides iodine and L-Tyrosine (raw materials for thyroid hormone production), supports the conversion of inactive T4 to active T3, and uses KSM-66 Ashwagandha to reduce cortisol that directly suppresses thyroid function.",
    benefits: [
      "Improved metabolic rate and calorie burning without stimulants",
      "Increased natural energy from optimized thyroid function",
      "Better body temperature regulation",
      "Breaks through fat loss plateaus linked to metabolic adaptation",
      "Can be taken day or night — no jitters, no sleep disruption",
    ],
    idealFor: ["Women who feel they have a 'slow metabolism' despite eating well and exercising", "People in prolonged caloric deficits where metabolic rate has adapted downward", "Anyone experiencing persistent fatigue, cold hands/feet, and unexplained weight gain"],
    objections: [
      { o: "I already take a fat burner — why do I need something for my thyroid?", r: "Fat burners work through stimulant-driven thermogenesis. Thyro-Drive works through a completely different mechanism — optimizing the thyroid hormone system that regulates base metabolic rate. They're additive, not redundant. 1st Phorm stacks them in their women's fat loss system specifically because they target different pathways." },
      { o: "Shouldn't I see a doctor about my thyroid instead?", r: "Absolutely, and we encourage it. But standard thyroid blood tests often miss subclinical dysfunction. Thyro-Drive's ingredients — iodine, L-Tyrosine, ashwagandha — are nutritional building blocks, not pharmaceuticals. Supporting thyroid nutrition while getting medical evaluation is not an either/or." },
    ],
    pitch: "For any woman who's dieting and exercising but just not losing weight — the thyroid is often the bottleneck nobody talks about. This is stimulant-free, can be taken any time of day, and works on the metabolic root.",
  },
  {
    id: 'l-carnitine',
    problem: "Fat loss supplements typically just rev up the stimulant system — more caffeine, more anxiety, same stored fat. The real bottleneck is transport: dietary fat and stored body fat must be physically shuttled into the mitochondria to be burned. Without enough L-Carnitine, that shuttle capacity limits how much fat can actually be used for energy.",
    solution: "L-Carnitine acts as the molecular transport vehicle that carries long-chain fatty acids across the mitochondrial membrane where they're oxidized for energy. 1st Phorm's L-Carnitine with Fucoxanthin adds a marine-derived compound that further supports fat oxidation through a complementary, non-stimulant pathway.",
    benefits: [
      "Enhanced fat burning efficiency — especially during fasted cardio",
      "Improved energy from fat utilization rather than glucose",
      "Reduced muscle fatigue and faster recovery",
      "Synergistic with thermogenic fat burners",
      "No stimulants — can be stacked with pre-workouts or taken on rest days",
    ],
    idealFor: ["People in an active fat loss phase wanting to maximize results", "Those who do fasted morning cardio", "Older adults (L-Carnitine production declines with age)", "Vegetarians and vegans (red meat is the primary dietary source)"],
    objections: [
      { o: "Will this actually help me lose fat or is it just hype?", r: "L-Carnitine isn't a fat melter — it's a fat transporter. If you're not in a calorie deficit, it won't do much. But if you're already dieting and exercising, it helps your body preferentially use fat for fuel. Think of it as putting a bigger fuel line on an engine that's already running." },
      { o: "I'm already taking a fat burner.", r: "L-Carnitine and thermogenic fat burners work through completely different mechanisms — thermogenics increase calorie burn, L-Carnitine improves fat transport. They're complementary, not redundant. Many serious physique competitors use both in a cutting phase." },
    ],
    pitch: "Best taken 30-60 minutes before cardio. For anyone in a fat loss phase who feels like they're doing everything right but want to push harder — this is the non-stimulant accelerator that makes the engine run cleaner.",
  },
  {
    id: 'intra-formance',
    problem: "During intense or prolonged training, the body starts breaking down muscle tissue for energy — especially when training fasted or in a calorie deficit. Electrolytes are depleted, mental fatigue sets in, performance drops off in the back half of the session, and the muscle you're trying to build becomes the fuel.",
    solution: "Intra-Formance provides BCAAs to blunt muscle breakdown mid-workout, a tri-carb blend for sustained training fuel, and a complete electrolyte matrix to keep muscle fibers firing and prevent performance degradation — all delivered during the session when they're needed most.",
    benefits: [
      "Preserved muscle mass during calorie-deficit training",
      "Sustained energy and mental focus through the full workout",
      "Less mid-workout fatigue and 'wall' hitting",
      "Reduced muscle soreness post-workout",
      "Better hydration and electrolyte balance",
    ],
    idealFor: ["Athletes training 60+ minutes per session", "Those training fasted or in a calorie deficit", "Endurance athletes with high-volume training", "People who notice performance drop-off in the second half of workouts"],
    objections: [
      { o: "If I take pre-workout and post-workout protein, do I really need something during?", r: "Pre-workout sets you up and post-workout recovers you — but nothing is protecting the muscle or fueling the session as it happens. For sessions under 45 minutes, maybe not essential. For longer or harder sessions, intra-workout nutrition is the difference between a session that builds and one that just grinds." },
    ],
    pitch: "For anyone doing serious training — this is the missing middle of their nutrition protocol. It turns an hour-long grind into a session that's building muscle the whole time.",
  },
  {
    id: 'primal-t',
    problem: "Men's testosterone levels decline roughly 1% per year after age 30 — modern stressors accelerate this significantly. Fading drive, strength plateaus, more belly fat, slower recovery.",
    solution: "Primal-T uses KSM-66 Ashwagandha, Tribulus, Long Jack 100, and Boron Citrate to naturally optimize the hormonal environment without shutting down the body's own production.",
    benefits: ["Improved strength, power, and gym performance", "More energy, drive, and mental clarity", "Better body composition — more muscle, less body fat", "Improved mood and stress resilience"],
    idealFor: ["Men 30+ noticing reduced energy or drive", "Athletes wanting to optimize natural hormone levels"],
    objections: [
      { o: "Testosterone boosters don't really work.", r: "Most are under-dosed. Primal-T uses KSM-66 Ashwagandha — one of the most studied adaptogens for testosterone and stress response. The mechanistic rationale is solid, and consistent use with a good training program shows real, measurable results." },
    ],
    pitch: "For any man over 30 who mentions feeling less sharp, less driven, or plateauing in the gym — this addresses the hormonal root of those issues naturally.",
  },
]

// Quick lookup by product ID
const PSB_MAP = Object.fromEntries(PRODUCT_PSB.map(p => [p.id, p]))

export function getProductPsb(productId) {
  return PSB_MAP[productId] || null
}

// Returns the objection-handling script for a specific product
export function getObjectionScript(productId) {
  const psb = PSB_MAP[productId]
  if (!psb || !psb.objections?.length) return null
  return psb.objections.map(o => `Q: "${o.o}"\nA: ${o.r}`).join('\n\n')
}

// Returns a one-line pitch for a product
export function getProductPitch(productId) {
  return PSB_MAP[productId]?.pitch || null
}

// Builds a rich PSB context string for use in AI prompts
export function buildPsbContext(productId) {
  const psb = PSB_MAP[productId]
  if (!psb) return ''
  return `PRODUCT PSB:
Problem: ${psb.problem}
Solution: ${psb.solution}
Key Benefits: ${psb.benefits.join(' | ')}
Ideal For: ${psb.idealFor.join(', ')}
Pitch: ${psb.pitch}`
}
