const fs = require('fs');
const path = require('path');

// Auto-load .env if not already loaded into process.env
if (!process.env.GEMINI_API_KEY) {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    envLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const k = trimmed.substring(0, idx).trim();
          let v = trimmed.substring(idx + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.substring(1, v.length - 1);
          }
          if (!process.env[k]) process.env[k] = v;
        }
      }
    });
  }
}

const { TextRankSummarizer } = require('../modules/engine/textrank-summarizer.js');
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const SQUEEZE_PROMPT_TEMPLATE = (inputContext) => `You are compressing a conversation so it can continue seamlessly in a new session with zero loss of important context.

Respond ONLY with valid JSON matching this exact schema:
{
  "goal": "string",
  "decisions": ["string"],
  "current_state": "string",
  "open_threads": ["string"],
  "user_preferences": ["string"],
  "artifacts": [{"name": "string", "type": "code|file|config|data", "summary": "string"}],
  "entities": {"key": "value"}
}

Rules:
- Preserve exact filenames, variable names, numbers, IDs, and technical terms in "entities" and "artifacts" — never paraphrase these away.
- Omit exploratory back-and-forth that led nowhere; keep only what changes what happens next.
- "current_state" should let someone resume work immediately without re-reading the original conversation.
- "open_threads" should be actionable, not vague.
- If a previous summary is included in the input, merge it with new messages — integrate and re-prioritize, don't just append.

CONVERSATION:
${inputContext}`;

function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

async function callSqueezeModel(inputContext) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SQUEEZE_PROMPT_TEMPLATE(inputContext) }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} — ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");

  try {
    return JSON.parse(text);
  } catch (parseErr) {
    // Sanitize markdown fences if present
    const cleanText = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleanText);
  }
}

async function callSqueezeModelWithRetry(inputContext, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await callSqueezeModel(inputContext);
    } catch (err) {
      if (attempt === retries) throw err;
      const isRateLimit = err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'));
      if (isRateLimit) {
        const backoffMs = 2000 * (attempt + 1);
        await new Promise(r => setTimeout(r, backoffMs));
      } else {
        throw err; // don't retry non-rate-limit errors
      }
    }
  }
}

async function runSqueeze(sessionId, db) {
  const lastSummary = await db.getLatestSummary(sessionId);

  const newMessages = lastSummary
    ? await db.getMessagesAfter(sessionId, lastSummary.covers_up_to_message_id)
    : await db.getAllMessages(sessionId);

  if (!newMessages || newMessages.length === 0) {
    return lastSummary; // nothing new to squeeze
  }

  const formattedNew = newMessages
    .map(m => `[${(m.role || 'user').toUpperCase()}]: ${m.content}`)
    .join("\n\n");

  const inputContext = lastSummary
    ? `PREVIOUS SUMMARY:\n${JSON.stringify(lastSummary.summary_json)}\n\nNEW MESSAGES:\n${formattedNew}`
    : formattedNew;

  let summaryResult;
  let modelUsed = GEMINI_MODEL;

  try {
    summaryResult = await callSqueezeModelWithRetry(inputContext);
  } catch (err) {
    console.warn(`[Squeeze] Cloud Gemini model failed (${err.message}). Falling back to 100% Local TextRank engine.`);
    modelUsed = "local-textrank-engine";

    const turns = newMessages.map(m => ({
      sender: (m.role || 'user').toLowerCase() === 'user' ? 'user' : 'claude',
      text: m.content || "",
      codeBlocks: []
    }));

    const textRankRes = TextRankSummarizer.summarizeTurns(turns);
    summaryResult = {
      goal: "Extracted context transfer from conversation history",
      decisions: textRankRes.rulesApplied || [],
      current_state: textRankRes.summary || "",
      open_threads: ["Continue in new chat with extracted context capsule"],
      user_preferences: [],
      artifacts: [],
      entities: TextRankSummarizer.extractKeyTerms(formattedNew, 6).reduce((acc, term) => {
        acc[term] = "key_term";
        return acc;
      }, {})
    };
  }

  const lastMsg = newMessages[newMessages.length - 1];
  const lastMsgId = lastMsg ? lastMsg.id : null;

  const saved = await db.saveSummary({
    session_id: sessionId,
    version: (lastSummary?.version ?? 0) + 1,
    summary_json: summaryResult,
    covers_up_to_message_id: lastMsgId,
    source_token_count: estimateTokens(inputContext),
    output_token_count: estimateTokens(JSON.stringify(summaryResult)),
    status: 'ready'
  });

  return saved;
}

module.exports = {
  runSqueeze,
  callSqueezeModel,
  callSqueezeModelWithRetry,
  estimateTokens
};
