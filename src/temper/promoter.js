// Promoter — synthesizes groups of related RawSparks into RefinedSparks.
// Called by digest Step 4 to merge domain-grouped raw knowledge into
// consolidated, higher-confidence refined entries.

var { generateId, computeAssetId, STP_SCHEMA_VERSION } = require('../core/asset-id');
var { createCredibility, computeComposite } = require('../core/credibility');
var { appendRefinedSpark } = require('../core/storage');

var MIN_GROUP_SIZE = 2;

function groupBySubDomain(sparks) {
  var groups = {};
  for (var i = 0; i < sparks.length; i++) {
    var s = sparks[i];
    var domain = s.domain || 'general';
    if (!groups[domain]) groups[domain] = [];
    groups[domain].push(s);
  }
  return groups;
}

function synthesizeRefinedSpark(group, domain) {
  var summaryParts = [];
  var allHeuristics = [];
  var doList = [];
  var dontList = [];
  var rules = [];
  var allBoundaries = [];
  var evidenceSparks = [];
  var totalConfidence = 0;
  var humanConfirmations = 0;
  var totalPractice = 0;
  var totalSuccess = 0;
  var contributors = {};

  for (var i = 0; i < group.length; i++) {
    var spark = group[i];
    evidenceSparks.push(spark.id);
    totalConfidence += spark.confidence || 0;
    totalPractice += spark.practice_count || 0;
    totalSuccess += spark.success_count || 0;

    if (spark.confirmation_status === 'human_confirmed') humanConfirmations++;

    var card = spark.card || {};
    if (card.heuristic) {
      allHeuristics.push(card.heuristic);
      summaryParts.push(card.heuristic);
    }

    if (card.heuristic_type === 'rule') {
      rules.push(card.heuristic);
      doList.push(card.heuristic);
    } else if (card.heuristic_type === 'boundary') {
      dontList.push(card.heuristic);
    }

    if (card.boundary_conditions) {
      allBoundaries = allBoundaries.concat(card.boundary_conditions);
    }

    var ctype = spark.contributor ? spark.contributor.type : 'unknown';
    var cid = spark.contributor ? spark.contributor.id : 'unknown';
    var ckey = ctype + ':' + cid;
    if (!contributors[ckey]) {
      contributors[ckey] = { type: ctype, id: cid, contributions: 0, weight: 1.0 };
    }
    contributors[ckey].contributions++;
  }

  var avgConfidence = group.length > 0 ? totalConfidence / group.length : 0;

  var summaryText = domain + ' 经验 (' + group.length + '条): ' +
    allHeuristics.slice(0, 3).join('; ') +
    (allHeuristics.length > 3 ? '...' : '');

  var primaryHeuristic = allHeuristics.length > 0 ? allHeuristics[0] : summaryText;
  var contextEnvelope = {};
  for (var j = 0; j < group.length; j++) {
    var ce = (group[j].card || {}).context_envelope;
    if (ce) {
      for (var k in ce) {
        if (!contextEnvelope[k]) contextEnvelope[k] = ce[k];
      }
    }
  }

  var credibility = createCredibility(avgConfidence);
  credibility.internal.practice_count = totalPractice;
  credibility.internal.success_count = totalSuccess;
  credibility.internal.human_confirmations = humanConfirmations;

  var notApplicableWhen = [];
  for (var bi = 0; bi < allBoundaries.length; bi++) {
    if (allBoundaries[bi].effect === 'do_not_apply') {
      notApplicableWhen.push(allBoundaries[bi].condition || allBoundaries[bi].reason);
    }
  }

  var refined = {
    type: 'RefinedSpark',
    schema_version: STP_SCHEMA_VERSION,
    id: generateId('refined_' + domain.replace(/[^a-zA-Z0-9_]/g, '_')),
    domain: domain,
    summary: summaryText,
    card: {
      heuristic: primaryHeuristic,
      heuristics: allHeuristics,
      heuristic_type: rules.length >= allHeuristics.length / 2 ? 'rule' : 'pattern',
      context_envelope: contextEnvelope,
      boundary_conditions: allBoundaries,
      preference_dimensions: [],
      evidence: {
        practice_count: totalPractice,
        success_rate: totalPractice > 0 ? totalSuccess / totalPractice : null,
        last_practiced: null,
        notable_cases: [],
        context_diversity: 0,
      },
    },
    insight: {
      do_list: doList.slice(0, 5),
      dont_list: dontList.slice(0, 5),
      rules: rules,
      expected_outcome: '',
      confidence_note: 'Synthesized from ' + group.length + ' raw sparks with avg confidence ' + avgConfidence.toFixed(2),
    },
    applicable_when: [],
    not_applicable_when: notApplicableWhen,
    evidence_sparks: evidenceSparks,
    contributor_chain: Object.keys(contributors).map(function (k) { return contributors[k]; }),
    credibility: credibility,
    practice_results: [],
    visibility: 'private',
    relations: [],
    status: 'active',
    created_at: new Date().toISOString(),
    promoted_at: new Date().toISOString(),
  };

  refined.asset_id = computeAssetId(refined);
  return refined;
}

function promoteEligibleRawSparks(activeSparks, practiceRecords) {
  var groups = groupBySubDomain(activeSparks);
  var promoted = 0;
  var refinedSparks = [];

  for (var domain in groups) {
    var group = groups[domain];
    if (group.length < MIN_GROUP_SIZE) continue;

    var refined = synthesizeRefinedSpark(group, domain);
    appendRefinedSpark(refined);
    refinedSparks.push(refined);
    promoted++;
  }

  return {
    promoted: promoted,
    refined_sparks: refinedSparks,
  };
}

module.exports = {
  promoteEligibleRawSparks: promoteEligibleRawSparks,
  synthesizeRefinedSpark: synthesizeRefinedSpark,
};
