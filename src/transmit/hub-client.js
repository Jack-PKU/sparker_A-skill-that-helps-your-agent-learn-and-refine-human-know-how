// SparkHub HTTP/file client — handles STP-A2A message transport.
// Sends binding key on all HTTP requests for user identity resolution.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getNodeId } = require('../core/asset-id');
const { getStpAssetsDir, ensureDir } = require('../core/storage');
const { getBindingKey, getHubUrl, getAgentName } = require('./auth');

const PROTOCOL_NAME = 'stp-a2a';
const PROTOCOL_VERSION = '1.0.0';

function generateMessageId() {
  return 'msg_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function buildMessage(params) {
  return {
    protocol: PROTOCOL_NAME,
    protocol_version: PROTOCOL_VERSION,
    message_type: params.messageType,
    message_id: generateMessageId(),
    sender_id: params.senderId || getNodeId(),
    agent_name: params.agentName || getAgentName(),
    timestamp: new Date().toISOString(),
    payload: params.payload || {},
  };
}

function buildPublishMessage(ember, opts) {
  var o = opts || {};
  return buildMessage({
    messageType: 'spark_publish',
    payload: { spark: ember, action: o.action || 'create' },
  });
}

function buildSearchMessage(query, opts) {
  var o = opts || {};
  return buildMessage({
    messageType: 'spark_search',
    payload: {
      query_text: query,
      domain: o.domain || null,
      threshold: typeof o.threshold === 'number' ? o.threshold : 0.25,
      top_k: typeof o.topK === 'number' ? o.topK : 20,
    },
  });
}

function buildFeedbackMessage(emberId, feedbackType, opts) {
  var o = opts || {};
  var voteTypeMap = { upvote: 'upvote', downvote: 'downvote', positive: 'upvote', negative: 'downvote', cite: 'cite' };
  return buildMessage({
    messageType: 'spark_feedback',
    payload: {
      spark_id: emberId,
      vote_type: voteTypeMap[feedbackType] || feedbackType,
      reason: o.reason || null,
      context: o.context || null,
      voter_reputation: o.voterReputation || 1.0,
    },
  });
}

function buildForgeRequestMessage(emberId) {
  return buildMessage({
    messageType: 'spark_forge_request',
    payload: { ember_id: emberId },
  });
}

function buildRelateMessage(sourceId, targetId, relationType, opts) {
  var o = opts || {};
  return buildMessage({
    messageType: 'spark_relate',
    payload: {
      source_id: sourceId,
      target_id: targetId,
      relation_type: relationType,
      evidence: o.evidence || null,
    },
  });
}

function buildSyncMessage(opts) {
  var o = opts || {};
  return buildMessage({
    messageType: 'spark_sync',
    payload: {
      since: o.since || null,
      domain: o.domain || null,
      limit: o.limit || 100,
    },
  });
}

// --- File transport ---

function getA2aDir() {
  return path.join(getStpAssetsDir(), 'a2a');
}

function fileTransportSend(message) {
  var dir = path.join(getA2aDir(), 'outbox');
  ensureDir(dir);
  var filePath = path.join(dir, message.message_type + '.jsonl');
  fs.appendFileSync(filePath, JSON.stringify(message) + '\n', 'utf8');
  return { ok: true, path: filePath };
}

function fileTransportReceive() {
  var dir = path.join(getA2aDir(), 'inbox');
  if (!fs.existsSync(dir)) return [];
  var files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
  var messages = [];
  for (var i = 0; i < files.length; i++) {
    try {
      var raw = fs.readFileSync(path.join(dir, files[i]), 'utf8');
      var lines = raw.split('\n').filter(Boolean);
      for (var j = 0; j < lines.length; j++) {
        try {
          var msg = JSON.parse(lines[j]);
          if (msg && msg.protocol === PROTOCOL_NAME) messages.push(msg);
        } catch (e) { /* skip */ }
      }
    } catch (e) { /* skip */ }
  }
  return messages;
}

// --- HTTP transport ---

function buildHttpHeaders() {
  var headers = { 'Content-Type': 'application/json' };
  var bindingKey = getBindingKey();
  if (bindingKey) {
    headers['X-Sparkland-Binding-Key'] = bindingKey;
  }
  return headers;
}

var TYPE_TO_ENDPOINT = {
  spark_publish: '/spark/spark_publish',
  spark_search: '/spark/spark_search',
  spark_feedback: '/spark/spark_vote',
  spark_fetch: '/spark/spark_fetch',
  spark_forge_request: '/spark/spark_fetch',
  spark_relate: '/spark/spark_relate',
  spark_sync: '/spark/spark_sync',
  spark_domain: '/spark/spark_domain',
};

async function httpTransportSend(message) {
  var hubUrl = getHubUrl();
  if (!hubUrl) return { ok: false, error: 'STP_HUB_URL not set' };

  var endpoint = hubUrl.replace(/\/+$/, '') + (TYPE_TO_ENDPOINT[message.message_type] || '/stp/' + message.message_type);

  try {
    var res = await fetch(endpoint, {
      method: 'POST',
      headers: buildHttpHeaders(),
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(15000),
    });
    var data = await res.json();
    return { ok: res.ok, status: res.status, response: data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// --- Transport registry ---
// Auto-detect: use HTTP when hub URL is configured, otherwise file.

function getTransport() {
  var explicit = (process.env.STP_TRANSPORT || process.env.SPARK_TRANSPORT || '').toLowerCase();
  if (explicit === 'file') return { send: fileTransportSend, receive: fileTransportReceive };
  if (explicit === 'http') return { send: httpTransportSend, receive: async () => [] };
  if (getHubUrl()) return { send: httpTransportSend, receive: async () => [] };
  return { send: fileTransportSend, receive: fileTransportReceive };
}

async function sendToHub(message) {
  var transport = getTransport();
  return transport.send(message);
}

// --- High-level hub operations ---

async function hubSearch(query, opts) {
  var hubUrl = getHubUrl();
  if (!hubUrl) return { ok: false, error: 'Hub not configured', results: [] };

  var message = buildSearchMessage(query, opts);
  var result = await httpTransportSend(message);
  if (!result.ok) return { ok: false, error: result.error || 'Hub search failed', results: [] };

  var payload = result.response && result.response.payload ? result.response.payload : result.response;
  var sparks = payload.sparks || [];

  return {
    ok: true,
    results: sparks.map(function (s) {
      return {
        id: s.id,
        type: 'HubSpark',
        domain: s.domain_id || s.domain,
        summary: extractSummary(s),
        score: s._score || s._effective_score || 0,
        credibility: s.credibility_score || s._effective_score || 0,
        source: 'hub',
        hub_data: s,
      };
    }),
    total: payload.total || sparks.length,
    threshold: payload.threshold_applied,
  };
}

function extractSummary(spark) {
  if (typeof spark.insight === 'string') {
    try {
      var ins = JSON.parse(spark.insight);
      return ins.summary || ins.detail || '';
    } catch (e) { return spark.insight; }
  }
  if (spark.insight && typeof spark.insight === 'object') {
    return spark.insight.summary || spark.insight.detail || '';
  }
  return '';
}

async function hubPublish(ember) {
  var message = buildPublishMessage(ember);
  return httpTransportSend(message);
}

async function hubVote(sparkId, voteType, opts) {
  var message = buildFeedbackMessage(sparkId, voteType, opts);
  return httpTransportSend(message);
}

async function hubFetch(sparkId) {
  var message = buildMessage({
    messageType: 'spark_fetch',
    payload: { spark_id: sparkId },
  });
  return httpTransportSend(message);
}

async function hubSync(opts) {
  var message = buildSyncMessage(opts);
  return httpTransportSend(message);
}

module.exports = {
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
  buildMessage,
  buildPublishMessage,
  buildSearchMessage,
  buildFeedbackMessage,
  buildForgeRequestMessage,
  buildRelateMessage,
  buildSyncMessage,
  getTransport,
  sendToHub,
  getHubUrl,
  hubSearch,
  hubPublish,
  hubVote,
  hubFetch,
  hubSync,
  buildHttpHeaders,
};
