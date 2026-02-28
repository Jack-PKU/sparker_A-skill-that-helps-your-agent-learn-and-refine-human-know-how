// Document Ingestion — bulk-extract Spark cards from user's existing materials.
// Supports: .md, .txt, .csv, .json, .jsonl (built-in)
//           .docx (via mammoth, optional npm dep)
//           .pdf  (via pdf-parse, optional npm dep)
//           .pptx (via pptx text extraction, optional)
// Falls back to command-line tools (pdftotext, pandoc) if npm packages unavailable.
// Uses LLM to identify heuristic rules, boundary conditions, patterns, and
// causal relationships, then outputs candidate Spark cards for user review.

var fs = require('fs');
var path = require('path');
var { execSync } = require('child_process');
var { createRawSpark } = require('./extractor');
var { appendRawSpark } = require('../core/storage');
var { resolveLLMConfig, callLLM } = require('../core/openclaw-config');

var INGEST_PROMPT_TEMPLATE = [
  'You are an expert knowledge extractor. From the document below, extract',
  'reusable professional insights that an AI assistant could apply to future tasks.',
  '',
  'For EACH insight, output a JSON object:',
  '  heuristic        — one actionable sentence (the rule, tip, or pattern)',
  '  heuristic_type   — "rule" | "preference" | "pattern" | "boundary"',
  '  domain           — which professional domain this belongs to',
  '  sub_domain       — more specific area within the domain',
  '  applicable_when  — array of conditions when this applies',
  '  not_applicable_when — array of conditions when this does NOT apply',
  '  evidence         — brief quote or reference from the document supporting this',
  '  confidence_note  — how certain you are about this extraction',
  '',
  'Extract these knowledge types:',
  '  - Heuristic rules ("When X, do Y")',
  '  - Boundary conditions ("X does NOT apply when Y")',
  '  - Data patterns ("X averages Y, ranging Z")',
  '  - Causal relationships ("X causes Y because Z")',
  '  - Preference patterns ("Prefer X over Y")',
  '  - Failure lessons ("X failed because Y")',
  '',
  'Return a JSON array. Only return JSON, no markdown fences, no commentary.',
  'If the document contains no extractable insights, return [].',
  '',
  '## Document Content',
  '{{content}}',
].join('\n');

var TEXT_EXTENSIONS = ['.md', '.txt', '.csv', '.json', '.jsonl', '.tsv', '.log', '.yml', '.yaml'];
var RICH_EXTENSIONS = ['.docx', '.pdf', '.pptx', '.doc', '.rtf'];
var SUPPORTED_EXTENSIONS = TEXT_EXTENSIONS.concat(RICH_EXTENSIONS);

// Try to load optional npm packages; return null if unavailable
function tryRequire(name) {
  try { return require(name); } catch (e) { return null; }
}

function extractTextFromDocx(filePath) {
  var mammoth = tryRequire('mammoth');
  if (mammoth) {
    try {
      var result = mammoth.extractRawTextSync({ path: filePath });
      return result.value;
    } catch (e) { /* fall through */ }
  }
  // Fallback: pandoc
  try {
    return execSync('pandoc -t plain "' + filePath + '"', { encoding: 'utf8', timeout: 30000 });
  } catch (e) { /* fall through */ }
  // Fallback: unzip + xml parse (basic .docx is a zip of XML)
  try {
    return execSync('unzip -p "' + filePath + '" word/document.xml 2>/dev/null | sed -e "s/<[^>]*>//g"', { encoding: 'utf8', timeout: 15000 });
  } catch (e) { return null; }
}

function extractTextFromPdf(filePath) {
  var pdfParse = tryRequire('pdf-parse');
  if (pdfParse) {
    try {
      var buffer = fs.readFileSync(filePath);
      // pdf-parse returns a promise; use sync workaround via execSync
      var script = 'var p=require("pdf-parse");p(require("fs").readFileSync("' +
        filePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"') +
        '")).then(d=>process.stdout.write(d.text))';
      return execSync('node -e \'' + script + '\'', { encoding: 'utf8', timeout: 30000 });
    } catch (e) { /* fall through */ }
  }
  // Fallback: pdftotext (poppler-utils)
  try {
    return execSync('pdftotext "' + filePath + '" -', { encoding: 'utf8', timeout: 30000 });
  } catch (e) { /* fall through */ }
  // Fallback: python pdfminer
  try {
    return execSync('python3 -c "import sys; from pdfminer.high_level import extract_text; print(extract_text(sys.argv[1]))" "' + filePath + '"',
      { encoding: 'utf8', timeout: 30000 });
  } catch (e) { return null; }
}

function extractTextFromPptx(filePath) {
  // pandoc approach
  try {
    return execSync('pandoc -t plain "' + filePath + '"', { encoding: 'utf8', timeout: 30000 });
  } catch (e) { /* fall through */ }
  // Basic zip extraction of slide XML
  try {
    return execSync('unzip -p "' + filePath + '" ppt/slides/*.xml 2>/dev/null | sed -e "s/<[^>]*>//g"', { encoding: 'utf8', timeout: 15000 });
  } catch (e) { return null; }
}

function readFileContent(filePath) {
  var ext = path.extname(filePath).toLowerCase();
  if (SUPPORTED_EXTENSIONS.indexOf(ext) === -1) return null;

  // Plain text formats
  if (TEXT_EXTENSIONS.indexOf(ext) >= 0) {
    try { return fs.readFileSync(filePath, 'utf8'); } catch (e) { return null; }
  }

  // Rich document formats
  if (ext === '.docx' || ext === '.doc') return extractTextFromDocx(filePath);
  if (ext === '.pdf') return extractTextFromPdf(filePath);
  if (ext === '.pptx') return extractTextFromPptx(filePath);
  if (ext === '.rtf') {
    try { return execSync('pandoc -t plain "' + filePath + '"', { encoding: 'utf8', timeout: 15000 }); }
    catch (e) { return null; }
  }

  return null;
}

function readDirectoryContents(dirPath) {
  var entries = [];
  try {
    var files = fs.readdirSync(dirPath);
    for (var i = 0; i < files.length; i++) {
      var fp = path.join(dirPath, files[i]);
      var stat = fs.statSync(fp);
      if (stat.isFile()) {
        var content = readFileContent(fp);
        if (content) entries.push({ path: fp, content: content });
      }
    }
  } catch (e) { /* skip */ }
  return entries;
}

function buildIngestPrompt(content) {
  var truncated = String(content || '').slice(0, 8000);
  return INGEST_PROMPT_TEMPLATE.replace('{{content}}', truncated);
}

function parseIngestResponse(text) {
  if (!text) return [];
  var cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  try {
    var arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return [];
    return arr.filter(function (item) {
      return item && item.heuristic;
    });
  } catch (e) {
    return [];
  }
}

async function ingestFile(filePath, opts) {
  var o = opts || {};
  var content = readFileContent(filePath);
  if (!content) return { error: 'Cannot read file or unsupported format: ' + filePath, candidates: [] };

  var prompt = buildIngestPrompt(content);
  var llmConfig = resolveLLMConfig();
  var response = await callLLM(prompt, Object.assign({}, llmConfig, { max_tokens: 3000, temperature: 0.2 }));

  var insights = parseIngestResponse(response);
  if (insights.length === 0) return { file: filePath, candidates: [] };

  var candidates = [];
  for (var i = 0; i < insights.length; i++) {
    var ins = insights[i];
    var spark = createRawSpark({
      source: 'human_teaching',
      trigger: 'document_ingestion: ' + path.basename(filePath),
      content: ins.heuristic,
      domain: ins.domain || o.domain || 'general',
      extraction_method: 'document_ingestion',
      confirmation_status: o.auto_confirm ? 'human_confirmed' : 'unconfirmed',
      confidence: o.auto_confirm ? 0.45 : 0.20,
      tags: [ins.heuristic_type || 'rule', ins.sub_domain].filter(Boolean),
      card: {
        heuristic: ins.heuristic,
        heuristic_type: ins.heuristic_type || 'rule',
        context_envelope: {
          domain: ins.domain || o.domain || 'general',
          sub_domain: ins.sub_domain || null,
        },
        boundary_conditions: (ins.not_applicable_when || []).map(function (c) {
          return { condition: c, effect: 'not_applicable', reason: '' };
        }),
        applicable_when: ins.applicable_when || [],
        evidence: ins.evidence ? { source_document: path.basename(filePath), quote: ins.evidence } : null,
      },
    });

    if (!o.dry_run) {
      appendRawSpark(spark);
    }
    candidates.push(spark);
  }

  return { file: filePath, candidates: candidates };
}

async function ingestPath(targetPath, opts) {
  var o = opts || {};
  var stat;
  try {
    stat = fs.statSync(targetPath);
  } catch (e) {
    return { error: 'Path not found: ' + targetPath, results: [] };
  }

  if (stat.isFile()) {
    var result = await ingestFile(targetPath, o);
    return { results: [result], total_candidates: result.candidates.length };
  }

  if (stat.isDirectory()) {
    var entries = readDirectoryContents(targetPath);
    var results = [];
    var totalCandidates = 0;
    for (var i = 0; i < entries.length; i++) {
      var r = await ingestFile(entries[i].path, o);
      results.push(r);
      totalCandidates += r.candidates.length;
    }
    return { results: results, total_candidates: totalCandidates };
  }

  return { error: 'Unsupported path type', results: [] };
}

module.exports = {
  ingestFile,
  ingestPath,
  readFileContent,
  buildIngestPrompt,
  parseIngestResponse,
  SUPPORTED_EXTENSIONS,
};
