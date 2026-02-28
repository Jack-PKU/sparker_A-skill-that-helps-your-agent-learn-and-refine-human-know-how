// Ember publisher — converts RefinedSpark to Ember and publishes to SparkHub.
// Handles desensitization, owner confirmation, and privacy levels.

const { STP_SCHEMA_VERSION, computeAssetId, generateId, getNodeId } = require('../core/asset-id');
const { createCredibility } = require('../core/credibility');
const { appendEmber, readRefinedSparks, updateRefinedSpark } = require('../core/storage');
const { sanitizeForPublishing, checkContentSafety } = require('./sanitizer');
const { buildPublishMessage, sendToHub } = require('./hub-client');
const { getAgentName, getBindingKey } = require('./auth');

// Convert RefinedSpark to Ember (desensitized publishing form)
function createEmber(refinedSpark, opts) {
  var o = opts || {};
  var sanitized = sanitizeForPublishing(refinedSpark);

  // Content safety check
  var safetyCheck = checkContentSafety(sanitized.summary + ' ' + JSON.stringify(sanitized.insight));
  if (!safetyCheck.safe) {
    return { error: 'content_safety_failed', issues: safetyCheck.issues };
  }

  var now = new Date().toISOString();
  var ember = {
    type: 'Ember',
    schema_version: STP_SCHEMA_VERSION,
    id: generateId('ember'),
    source_refined_id: refinedSpark.id,
    domain: refinedSpark.domain,
    summary: sanitized.summary,
    insight: sanitized.insight,
    applicable_when: sanitized.applicable_when || refinedSpark.applicable_when || [],
    not_applicable_when: sanitized.not_applicable_when || refinedSpark.not_applicable_when || [],
    keywords: extractKeywords(refinedSpark),
    task_type: refinedSpark.context ? refinedSpark.context.task_type : null,
    contributor_chain: sanitized.contributor_chain || [],
    credibility: {
      internal: refinedSpark.credibility ? refinedSpark.credibility.internal : createCredibility().internal,
      external: createCredibility().external,
      composite: refinedSpark.credibility ? refinedSpark.credibility.composite : 0.5,
      trend: 'stable',
    },
    origin: {
      node_id: getNodeId(),
      agent_name: getAgentName(),
      bound: !!getBindingKey(),
    },
    pricing: o.pricing || { model: 'free', price: 0, currency: 'USD' },
    license: o.license || 'open',
    relations: refinedSpark.relations || [],
    citation_count: 0,
    upvotes: 0,
    downvotes: 0,
    status: 'candidate',
    published_at: now,
    valid_until: refinedSpark.valid_until || null,
    freshness_half_life_days: refinedSpark.freshness_half_life_days || 90,
    forge_eligible: false,
    asset_id: null,
  };

  ember.asset_id = computeAssetId(ember);
  return ember;
}

function extractKeywords(spark) {
  var keywords = [];
  if (spark.domain) keywords.push(spark.domain);
  if (Array.isArray(spark.tags)) keywords.push(...spark.tags);
  if (spark.insight) {
    var text = (spark.summary || '') + ' ' + (spark.insight.rules || []).join(' ');
    var words = text.split(/\s+/).filter(w => w.length >= 2);
    var seen = new Set(keywords);
    for (var i = 0; i < words.length && keywords.length < 10; i++) {
      if (!seen.has(words[i])) { keywords.push(words[i]); seen.add(words[i]); }
    }
  }
  return keywords.slice(0, 15);
}

// Publish a RefinedSpark as Ember
async function publishEmber(refinedSparkId, opts) {
  var o = opts || {};
  var refined = readRefinedSparks().find(s => s.id === refinedSparkId);
  if (!refined) return { ok: false, error: 'refined_spark_not_found' };

  // Determine target visibility
  var visibility = o.visibility || refined.visibility || 'private';

  // Owner confirmation auto-promotes visibility
  if (o.ownerConfirmed || o.owner_confirmed) {
    if (visibility === 'private') visibility = 'public';
  }

  if (visibility === 'private') {
    return { ok: false, error: 'cannot_publish_private_spark' };
  }

  // Public visibility requires explicit owner confirmation
  if (visibility === 'public' && !o.ownerConfirmed && !o.owner_confirmed) {
    return {
      ok: false,
      error: 'owner_confirmation_required',
      message: 'Public publishing requires owner confirmation. Set owner_confirmed: true to proceed.',
      preview: sanitizeForPublishing(refined),
    };
  }

  var ember = createEmber(refined, o);
  if (ember.error) return { ok: false, error: ember.error, issues: ember.issues };

  // Store locally
  appendEmber(ember);

  // Update source refined spark status
  updateRefinedSpark(refinedSparkId, { status: 'published' });

  // Send to SparkHub (skip for circle-only unless hub is configured)
  var transport = { ok: true, skipped: false };
  if (visibility !== 'private') {
    var message = buildPublishMessage(ember, { action: 'create' });
    transport = await sendToHub(message);
  }

  return {
    ok: true,
    ember: ember,
    transport: transport,
    visibility: visibility,
  };
}

module.exports = {
  createEmber,
  publishEmber,
  extractKeywords,
};
