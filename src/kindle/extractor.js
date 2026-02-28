// Spark extraction — transforms various knowledge sources into RawSpark objects.
// Each extraction method creates a RawSpark with appropriate source, confidence,
// and card structure based on the knowledge acquisition context.

var { generateId, getNodeId, computeAssetId, STP_SCHEMA_VERSION } = require('../core/asset-id');
var { getInitialConfidence, SOURCE_INITIAL_CONFIDENCE, BOOST_RULES } = require('../core/credibility');

var VERIFICATION_RULES = {
  human_teaching: 'human_confirmed',
  human_feedback: 'agent_confirmed',
  task_negotiation: 'human_confirmed',
  iterative_refinement: 'human_confirmed',
  micro_probe: 'human_confirmed',
  human_choice: 'agent_confirmed',
  casual_mining: 'pending_verification',
  web_exploration: 'pending_verification',
  post_task: 'agent_confirmed',
  self_diagnosis: 'agent_confirmed',
  agent_exchange: 'pending_verification',
};

var STATUS_RULES = {
  human_confirmed: 'active',
  agent_confirmed: 'active',
  pending_verification: 'pending_verification',
  unconfirmed: 'pending_verification',
};

function buildCard(params) {
  var card = params.card || {};
  return {
    heuristic: card.heuristic || params.content || '',
    heuristic_type: card.heuristic_type || 'rule',
    context_envelope: card.context_envelope || {},
    boundary_conditions: card.boundary_conditions || [],
    preference_dimensions: card.preference_dimensions || [],
    evidence: card.evidence || { practice_count: 0, success_rate: null },
  };
}

function buildContributor(params) {
  if (params.contributor) return params.contributor;
  var source = params.source || 'human_teaching';
  if (source === 'web_exploration' || source === 'agent_exchange' || source === 'self_diagnosis') {
    return { type: 'agent', id: getNodeId() };
  }
  var expertise = params.contributor_expertise || 0.5;
  if (params.contributor_years && !params.contributor_expertise) {
    var years = Number(params.contributor_years) || 0;
    if (years >= 10) expertise = 0.9;
    else if (years >= 5) expertise = 0.7;
    else if (years >= 2) expertise = 0.5;
    else expertise = 0.3;
  }
  return { type: 'human', id: params.contributor_id || 'unknown', domain_expertise: expertise };
}

function createRawSpark(params) {
  var source = params.source || 'human_teaching';
  var confirmationStatus = params.confirmation_status || VERIFICATION_RULES[source] || 'unconfirmed';
  var status = STATUS_RULES[confirmationStatus] || 'pending_verification';

  if (params.status) status = params.status;

  var confidence = typeof params.confidence === 'number'
    ? params.confidence
    : getInitialConfidence(source);

  if (confirmationStatus === 'human_confirmed' && source === 'human_teaching') {
    confidence = Math.min(1.0, (SOURCE_INITIAL_CONFIDENCE.human_teaching || 0.50) + BOOST_RULES.human_confirmed);
  }

  var spark = {
    type: 'RawSpark',
    schema_version: STP_SCHEMA_VERSION,
    id: generateId('raw'),
    source: source,
    extraction_method: params.extraction_method || source,
    domain: params.domain || 'general',
    content: params.content || '',
    card: buildCard(params),
    confidence: parseFloat(confidence.toFixed(2)),
    confirmation_status: confirmationStatus,
    status: status,
    contributor: buildContributor(params),
    practice_count: 0,
    success_count: 0,
    visibility: params.visibility || 'private',
    tags: params.tags || [],
    relations: params.relations || [],
    created_at: new Date().toISOString(),
  };

  if (params.trigger) spark.trigger = params.trigger;
  if (params.context) spark.context = params.context;
  if (params.related_session) spark.related_session = params.related_session;

  spark.asset_id = computeAssetId(spark);
  return spark;
}

function extractFromTeaching(params) {
  params.extraction_method = 'teaching';
  params.confirmation_status = params.confirmation_status || 'human_confirmed';
  return createRawSpark(params);
}

function extractFromFeedback(params) {
  var method = params.is_choice ? 'feedback' : 'feedback';
  if (params.source === 'micro_probe') method = 'micro_probe';
  params.extraction_method = method;
  if (params.source === 'micro_probe') {
    params.confirmation_status = 'human_confirmed';
  }
  return createRawSpark(params);
}

function extractFromTaskNegotiation(params) {
  params.extraction_method = 'task_negotiation';
  params.confirmation_status = 'human_confirmed';
  return createRawSpark(params);
}

function extractFromIterativeRefinement(params) {
  params.extraction_method = 'iterative_refinement';
  var corrections = params.corrections || [];
  var rounds = corrections.length;

  if (typeof params.confidence !== 'number') {
    params.confidence = Math.min(0.60, 0.35 + rounds * 0.05);
  }

  if (rounds > 0) {
    var summaries = corrections.map(function (c, i) {
      return '第' + (i + 1) + '轮: ' + (c.summary || c);
    });
    if (!params.content) {
      params.content = summaries.join('\n');
    }
  }

  params.confirmation_status = 'human_confirmed';
  params.context = Object.assign(params.context || {}, {
    refinement_rounds: rounds,
    final_accepted: true,
  });

  return createRawSpark(params);
}

function extractFromObservation(params) {
  params.extraction_method = params.source || 'casual_mining';
  if (params.source === 'casual_mining') {
    params.confirmation_status = 'pending_verification';
    if (typeof params.confidence !== 'number') {
      params.confidence = 0.25;
    }
  }
  return createRawSpark(params);
}

function extractFromExploration(params) {
  params.extraction_method = 'exploration';
  params.confirmation_status = 'pending_verification';
  if (typeof params.confidence !== 'number') {
    params.confidence = getInitialConfidence('web_exploration');
  }
  return createRawSpark(params);
}

function extractFromAgentExchange(params) {
  params.extraction_method = 'agent_exchange';
  params.confirmation_status = 'pending_verification';
  return createRawSpark(params);
}

module.exports = {
  createRawSpark: createRawSpark,
  extractFromTeaching: extractFromTeaching,
  extractFromFeedback: extractFromFeedback,
  extractFromTaskNegotiation: extractFromTaskNegotiation,
  extractFromIterativeRefinement: extractFromIterativeRefinement,
  extractFromObservation: extractFromObservation,
  extractFromExploration: extractFromExploration,
  extractFromAgentExchange: extractFromAgentExchange,
};
