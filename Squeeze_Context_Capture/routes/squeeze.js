// routes/squeeze.js
"use strict";

const express = require('express');
const router = express.Router();
const { runSqueeze } = require('../services/squeezeService');

// Middleware & DB stubs (override or inject real Express auth & DB layer as needed)
const defaultAuth = (req, res, next) => {
  if (!req.user) req.user = { id: '00000000-0000-0000-0000-000000000000', plan: 'pro' };
  next();
};

function getPlanLimit(plan) {
  const limits = { free: 5, pro: 50, unlimited: Infinity };
  return limits[plan] ?? limits.free;
}

// 1. Triggered by the "Squeeze this chat" button in the UI
router.post('/api/sessions/:id/squeeze', defaultAuth, async (req, res) => {
  const userId = req.user.id;
  const sessionId = req.params.id;
  const db = req.db || global.squeezeDB;

  if (!db) {
    return res.status(500).json({ error: 'db_not_initialized', message: 'Database connection missing.' });
  }

  try {
    // Check monthly quota before spending API budget
    const usage = await db.getMonthlyUsage(userId);
    const limit = getPlanLimit(req.user.plan);
    if (usage && usage.squeeze_count >= limit) {
      return res.status(429).json({
        error: 'squeeze_limit_reached',
        message: `You've used all ${limit} squeezes this month on your current plan.`
      });
    }

    const summary = await runSqueeze(sessionId, db);
    await db.incrementUsage(userId, summary.output_token_count);

    res.json({
      id: summary.id,
      version: summary.version,
      summary: summary.summary_json,
      tokensSaved: (summary.source_token_count || 0) - (summary.output_token_count || 0)
    });
  } catch (err) {
    console.error('Squeeze failed:', err);
    res.status(500).json({ error: 'squeeze_failed', message: 'Something went wrong compressing this chat. Please try again.' });
  }
});

// 2. Get latest summary for preview card
router.get('/api/sessions/:id/squeeze/latest', defaultAuth, async (req, res) => {
  const db = req.db || global.squeezeDB;
  if (!db) return res.status(500).json({ error: 'db_not_initialized' });

  const summary = await db.getLatestSummary(req.params.id);
  if (!summary) return res.status(404).json({ error: 'no_summary_yet' });
  res.json(summary);
});

// 3. User edits the summary before continuing (optional but recommended)
router.patch('/api/sessions/:id/squeeze/:summaryId', defaultAuth, async (req, res) => {
  const { edited_summary_json } = req.body;
  const db = req.db || global.squeezeDB;
  if (!db) return res.status(500).json({ error: 'db_not_initialized' });

  await db.updateEditedSummary(req.params.summaryId, edited_summary_json);
  res.json({ success: true });
});

// 4. "Continue in new chat" — creates the linked child session
router.post('/api/sessions/:id/squeeze/continue', defaultAuth, async (req, res) => {
  const parentSessionId = req.params.id;
  const userId = req.user.id;
  const db = req.db || global.squeezeDB;
  if (!db) return res.status(500).json({ error: 'db_not_initialized' });

  const summary = await db.getLatestSummary(parentSessionId);
  if (!summary) return res.status(400).json({ error: 'must_squeeze_before_continuing' });

  const summaryToUse = summary.edited_summary_json || summary.summary_json;
  const lastFewRaw = await db.getLastNMessages(parentSessionId, 4);

  const newSession = await db.createSession(userId);
  await db.linkSqueezeSessions(parentSessionId, newSession.id, summary.id);

  const bootstrapMessage = {
    role: 'user',
    content: `[SQUEEZED CONTEXT FROM PREVIOUS SESSION]\n${JSON.stringify(summaryToUse, null, 2)}\n[END CONTEXT]\n\nContinue helping based on the above. Do not re-explain it back to me — just proceed as if you remember it.`
  };

  res.json({
    newSessionId: newSession.id,
    bootstrapMessage,
    carriedForwardMessages: lastFewRaw
  });
});

module.exports = router;
