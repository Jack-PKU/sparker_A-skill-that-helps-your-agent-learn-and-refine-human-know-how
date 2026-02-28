// SparkHub identity & authentication — binding key management, login, register.
// Binding key is the bridge between a Sparkland user account and an OpenClaw agent.
// Flow: register on SparkHub → login → generate binding key → store locally
//       → all subsequent hub requests carry the key in X-Sparkland-Binding-Key header.

const fs = require('fs');
const path = require('path');
const { getNodeId } = require('../core/asset-id');

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '/root', '.openclaw');
const CONFIG_PATH = path.join(CONFIG_DIR, 'sparkhub.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeConfig(cfg) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

function getBindingKey() {
  return process.env.STP_BINDING_KEY
    || process.env.SPARKHUB_BINDING_KEY
    || readConfig().binding_key
    || null;
}

function saveBindingKey(key) {
  var cfg = readConfig();
  cfg.binding_key = key;
  cfg.bound_at = new Date().toISOString();
  writeConfig(cfg);
}

function getAgentName() {
  return process.env.STP_AGENT_NAME
    || process.env.AGENT_NAME
    || readConfig().agent_name
    || 'default';
}

function saveAgentName(name) {
  var cfg = readConfig();
  cfg.agent_name = name;
  writeConfig(cfg);
}

function getHubUrl() {
  return process.env.STP_HUB_URL
    || process.env.SPARKHUB_URL
    || process.env.SPARK_HUB_URL
    || readConfig().hub_url
    || null;
}

function saveHubUrl(url) {
  var cfg = readConfig();
  cfg.hub_url = url;
  writeConfig(cfg);
}

// Login to SparkHub → obtain JWT → generate binding key → store locally
async function loginToHub(email, password) {
  var hubUrl = getHubUrl();
  if (!hubUrl) return { ok: false, error: 'Hub URL not configured. Set STP_HUB_URL or run: node index.js hub-url <url>' };

  var base = hubUrl.replace(/\/+$/, '');

  try {
    var loginRes = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
      signal: AbortSignal.timeout(15000),
    });
    var loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.session) {
      return { ok: false, error: loginData.error || 'Login failed' };
    }

    var jwt = loginData.session.access_token;

    var bindRes = await fetch(base + '/api/me/binding-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + jwt,
      },
      signal: AbortSignal.timeout(15000),
    });
    var bindData = await bindRes.json();
    if (!bindRes.ok || !bindData.binding_key) {
      return { ok: false, error: bindData.error || 'Failed to generate binding key' };
    }

    saveBindingKey(bindData.binding_key);

    return {
      ok: true,
      binding_key: bindData.binding_key,
      user_id: loginData.user ? loginData.user.id : null,
      email: loginData.user ? loginData.user.email : email,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Register a new account on SparkHub (requires invite code)
async function registerOnHub(email, password, inviteCode) {
  var hubUrl = getHubUrl();
  if (!hubUrl) return { ok: false, error: 'Hub URL not configured. Set STP_HUB_URL or run: node index.js hub-url <url>' };

  try {
    var res = await fetch(hubUrl.replace(/\/+$/, '') + '/api/auth/register-with-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, invite_code: inviteCode }),
      signal: AbortSignal.timeout(15000),
    });
    var data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Registration failed' };
    }
    return { ok: true, data: data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function getIdentity() {
  var bk = getBindingKey();
  return {
    node_id: getNodeId(),
    agent_name: getAgentName(),
    binding_key_preview: bk ? '***' + bk.slice(-8) : null,
    hub_url: getHubUrl(),
    bound: !!bk,
    config_path: CONFIG_PATH,
  };
}

module.exports = {
  getBindingKey,
  saveBindingKey,
  getAgentName,
  saveAgentName,
  getHubUrl,
  saveHubUrl,
  loginToHub,
  registerOnHub,
  getIdentity,
  readConfig,
  writeConfig,
  CONFIG_PATH,
};
