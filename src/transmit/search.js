// Knowledge search — local TF-IDF + optional remote SparkHub hybrid search.
// When hub is configured, merges local and remote results with deduplication.

var { readRawSparks, readRefinedSparks, readEmbers } = require('../core/storage');
var { computeSimilarities, sparkToText } = require('../core/similarity');
var { hubSearch, getHubUrl } = require('./hub-client');

var RELEVANCE_THRESHOLD = 0.10;
var MAX_RESULTS = 10;

function searchLocal(query, opts) {
  var o = opts || {};
  var threshold = typeof o.threshold === 'number' ? o.threshold : RELEVANCE_THRESHOLD;
  var maxResults = o.maxResults || o.max_results || MAX_RESULTS;
  var domain = o.domain || null;

  var rawSparks = readRawSparks().filter(function (s) { return s.status !== 'rejected'; });
  var embers = readEmbers();
  var refinedSparks = readRefinedSparks().filter(function (s) { return s.status === 'published' || s.status === 'active'; });
  var candidates = [].concat(rawSparks, embers, refinedSparks);

  if (domain) {
    candidates = candidates.filter(function (c) {
      var d = c.domain || '';
      return d === domain || d.startsWith(domain + '.');
    });
  }

  if (candidates.length === 0) {
    return [];
  }

  var similarities = computeSimilarities(query, candidates);
  var filtered = similarities.filter(function (s) { return s.score >= threshold; });
  filtered = filtered.slice(0, maxResults);

  return filtered.map(function (r) {
    var spark = r.item;
    var sparkType = spark.type || 'unknown';
    if (sparkType === 'unknown') {
      if (spark.card) sparkType = 'RawSpark';
      else if (spark.insight) sparkType = 'RefinedSpark';
      else if (spark.source_refined_id) sparkType = 'Ember';
    }
    return {
      id: spark.id,
      type: sparkType,
      domain: spark.domain,
      summary: spark.summary || spark.content || (spark.card && spark.card.heuristic) || '',
      score: parseFloat(r.score.toFixed(4)),
      confidence: spark.confidence || (spark.credibility && spark.credibility.composite) || 0,
      source: 'local',
    };
  });
}

async function searchRemote(query, opts) {
  var o = opts || {};
  if (!getHubUrl()) return [];

  try {
    var result = await hubSearch(query, {
      domain: o.domain,
      threshold: typeof o.threshold === 'number' ? o.threshold : 0.25,
      topK: o.maxResults || o.max_results || 20,
    });
    if (!result.ok) {
      process.stderr.write('[sparker] Hub search failed: ' + (result.error || 'unknown') + '\n');
      return [];
    }
    return result.results || [];
  } catch (e) {
    process.stderr.write('[sparker] Hub search error: ' + e.message + '\n');
    return [];
  }
}

function mergeResults(localResults, hubResults, maxResults) {
  var seen = new Set();
  var merged = [];

  for (var i = 0; i < localResults.length; i++) {
    seen.add(localResults[i].id);
    merged.push(localResults[i]);
  }

  for (var j = 0; j < hubResults.length; j++) {
    if (!seen.has(hubResults[j].id)) {
      seen.add(hubResults[j].id);
      merged.push(hubResults[j]);
    }
  }

  merged.sort(function (a, b) { return b.score - a.score; });
  return merged.slice(0, maxResults || MAX_RESULTS);
}

// Unified search — queries local assets and optionally the remote hub
// mode: 'all' (default) | 'local' | 'hub'
async function searchKnowledge(query, opts) {
  var o = opts || {};
  var mode = o.mode || 'all';
  var maxResults = o.maxResults || o.max_results || MAX_RESULTS;

  var localResults = [];
  var hubResults = [];

  if (mode === 'local' || mode === 'all') {
    localResults = searchLocal(query, o);
  }

  if ((mode === 'hub' || mode === 'all') && getHubUrl()) {
    hubResults = await searchRemote(query, o);
  }

  var results = mergeResults(localResults, hubResults, maxResults);

  return {
    query: query,
    results: results,
    local_count: localResults.length,
    hub_count: hubResults.length,
    total_candidates: localResults.length + hubResults.length,
    threshold: typeof o.threshold === 'number' ? o.threshold : RELEVANCE_THRESHOLD,
    hub_available: !!getHubUrl(),
    mode: mode,
  };
}

module.exports = {
  searchKnowledge: searchKnowledge,
  searchLocal: searchLocal,
  searchRemote: searchRemote,
  RELEVANCE_THRESHOLD: RELEVANCE_THRESHOLD,
  MAX_RESULTS: MAX_RESULTS,
};
