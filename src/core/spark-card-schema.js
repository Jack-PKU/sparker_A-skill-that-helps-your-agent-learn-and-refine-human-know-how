// Spark Card Schema — unified structure across the full lifecycle:
//   RawSpark.card → RefinedSpark.card → Ember.card → Gene
//
// Design principles:
// 1. RawSpark.card = single experience capture
// 2. RefinedSpark.card = merged synthesis of multiple RawSpark.cards
// 3. Ember.card = sanitized RefinedSpark.card (PII stripped, professional context retained)
// 4. Gene = format-converted from Ember.card (semantics preserved)

function createSparkCard(params) {
  var p = params || {};
  return {
    heuristic: p.heuristic || '',
    heuristics: p.heuristics || [],
    heuristic_type: p.heuristic_type || 'rule',

    context_envelope: Object.assign({
      domain: '',
      sub_domain: '',
      platform: [],
      audience_type: '',
      task_phase: '',
      prerequisites: [],
      contributor_role: '',
      contributor_industry: '',
      experience_level: '',
      extra: {},
    }, p.context_envelope || {}),

    boundary_conditions: (p.boundary_conditions || []).map(normalizeBoundary),

    preference_dimensions: p.preference_dimensions || [],

    evidence: Object.assign({
      practice_count: 0,
      success_rate: null,
      last_practiced: null,
      notable_cases: [],
      context_diversity: 0,
    }, p.evidence || {}),
  };
}

function normalizeBoundary(b) {
  if (typeof b === 'string') {
    return { condition: b, effect: 'do_not_apply', reason: '' };
  }
  return {
    condition: b.condition || '',
    effect: b.effect || 'do_not_apply',
    reason: b.reason || '',
  };
}

// Merge multiple RawSpark cards into a single RefinedSpark card.
// context_envelope → intersection (strictest common context)
// boundary_conditions → union (all known exceptions, deduplicated)
// heuristics → all raw heuristics collected; caller may LLM-summarize
// preference_dimensions → union, deduplicated
// evidence → aggregated from practice records
function mergeCards(cards, practiceStats) {
  if (!cards || cards.length === 0) return createSparkCard({});

  var allHeuristics = [];
  var allBoundaries = [];
  var allPrefDims = [];
  var allPlatforms = [];
  var allPrereqs = [];
  var envelopes = [];

  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    if (!c) continue;
    if (c.heuristic) allHeuristics.push(c.heuristic);
    if (c.heuristics) allHeuristics = allHeuristics.concat(c.heuristics);
    if (c.boundary_conditions) {
      allBoundaries = allBoundaries.concat(c.boundary_conditions.map(normalizeBoundary));
    }
    if (c.preference_dimensions) {
      allPrefDims = allPrefDims.concat(c.preference_dimensions);
    }
    if (c.context_envelope) envelopes.push(c.context_envelope);
  }

  var mergedEnvelope = intersectEnvelopes(envelopes);

  var boundarySet = {};
  var dedupedBoundaries = [];
  for (var bi = 0; bi < allBoundaries.length; bi++) {
    var key = (allBoundaries[bi].condition || '').toLowerCase().trim();
    if (key && !boundarySet[key]) {
      boundarySet[key] = true;
      dedupedBoundaries.push(allBoundaries[bi]);
    }
  }

  var dimSet = {};
  var dedupedDims = allPrefDims.filter(function (d) {
    if (!d || dimSet[d]) return false;
    dimSet[d] = true;
    return true;
  });

  var dedupedHeuristics = [];
  var hSet = {};
  for (var hi = 0; hi < allHeuristics.length; hi++) {
    var hKey = (allHeuristics[hi] || '').toLowerCase().trim();
    if (hKey && !hSet[hKey]) {
      hSet[hKey] = true;
      dedupedHeuristics.push(allHeuristics[hi]);
    }
  }

  var ps = practiceStats || {};
  return createSparkCard({
    heuristic: dedupedHeuristics[0] || '',
    heuristics: dedupedHeuristics,
    heuristic_type: detectDominantType(cards),
    context_envelope: mergedEnvelope,
    boundary_conditions: dedupedBoundaries,
    preference_dimensions: dedupedDims,
    evidence: {
      practice_count: ps.practice_count || 0,
      success_rate: ps.success_rate != null ? ps.success_rate : null,
      last_practiced: ps.last_practiced || null,
      notable_cases: ps.notable_cases || [],
      context_diversity: ps.context_diversity || 0,
    },
  });
}

function intersectEnvelopes(envelopes) {
  if (envelopes.length === 0) return {};
  if (envelopes.length === 1) return Object.assign({}, envelopes[0]);

  var result = {};

  var stringFields = ['domain', 'sub_domain', 'audience_type', 'task_phase',
    'contributor_role', 'contributor_industry', 'experience_level'];
  for (var fi = 0; fi < stringFields.length; fi++) {
    var field = stringFields[fi];
    var values = envelopes.map(function (e) { return e[field] || ''; }).filter(Boolean);
    if (values.length === 0) continue;
    var counts = {};
    for (var vi = 0; vi < values.length; vi++) {
      counts[values[vi]] = (counts[values[vi]] || 0) + 1;
    }
    var best = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    if (counts[best] >= Math.ceil(envelopes.length * 0.5)) {
      result[field] = best;
    }
  }

  var allPlatforms = {};
  for (var pi = 0; pi < envelopes.length; pi++) {
    var plats = envelopes[pi].platform || [];
    for (var pj = 0; pj < plats.length; pj++) {
      allPlatforms[plats[pj]] = (allPlatforms[plats[pj]] || 0) + 1;
    }
  }
  result.platform = Object.keys(allPlatforms).filter(function (k) {
    return allPlatforms[k] > envelopes.length / 2;
  });

  result.extra = {};
  return result;
}

function detectDominantType(cards) {
  var counts = {};
  for (var i = 0; i < cards.length; i++) {
    var t = (cards[i] && cards[i].heuristic_type) || 'rule';
    counts[t] = (counts[t] || 0) + 1;
  }
  var best = 'rule';
  var bestCount = 0;
  for (var k in counts) {
    if (counts[k] > bestCount) { best = k; bestCount = counts[k]; }
  }
  return best;
}

module.exports = {
  createSparkCard,
  mergeCards,
  normalizeBoundary,
  intersectEnvelopes,
};
