# Smart Model Routing — Technical Build Blueprint

> **Status:** 📋 Planning / Architecture  
> **Premium Feature:** Yes — Squeeze Premium  
> **Separate Pipeline:** Does NOT touch Squeeze prompt optimization  
> **Created:** 2026-07-18

---

## The Core Insight

We already have **everything we need** inside the existing Squeeze extension to build this:

1. ✅ We already **intercept the user's prompt** in real-time (content.js `input` listener)
2. ✅ We already **locate Claude's model selector button** (`findModelChooser()` function)
3. ✅ We already have a **sidebar drawer** and **toolbar badge** system for in-page UI
4. ✅ We already have **chrome.storage.local** for tracking stats and preferences

The only new piece is: **a local prompt complexity classifier** + **model switcher logic**.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                  content.js                       │
│                                                   │
│  User types prompt                                │
│       │                                           │
│       ▼                                           │
│  ┌─────────────────┐    ┌──────────────────────┐ │
│  │ Prompt Classifier│───▶│ Model Recommendation │ │
│  │ (Local Heuristic)│    │ Engine               │ │
│  └─────────────────┘    └──────────┬───────────┘ │
│                                     │             │
│                          ┌──────────▼──────────┐ │
│                          │ UI: Routing Badge   │ │
│                          │ "Use Haiku — save   │ │
│                          │  ~80% on this task" │ │
│                          └──────────┬──────────┘ │
│                                     │             │
│                          User clicks "Switch"     │
│                                     │             │
│                          ┌──────────▼──────────┐ │
│                          │ Model Switcher      │ │
│                          │ (Click Claude's     │ │
│                          │  dropdown + select) │ │
│                          └─────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## Component 1: Local Prompt Complexity Classifier

This is the brain. It runs **100% locally** — no API calls, no latency. Scores the prompt on multiple signals and outputs a tier.

### Scoring Signals

```javascript
function classifyPromptComplexity(promptText) {
  let score = 0;  // 0-100 scale
  const lower = promptText.toLowerCase();
  const wordCount = promptText.trim().split(/\s+/).length;
  const charCount = promptText.length;

  // ── Signal 1: Prompt Length ──
  if (wordCount <= 15)       score += 0;   // Very short = simple
  else if (wordCount <= 50)  score += 10;
  else if (wordCount <= 150) score += 25;
  else if (wordCount <= 500) score += 40;
  else                       score += 55;  // Very long = complex

  // ── Signal 2: Task Complexity Keywords ──
  const simpleKeywords = [
    "what is", "define", "translate", "format", "convert",
    "list", "summarize briefly", "yes or no", "true or false",
    "spell check", "rewrite this", "fix grammar", "how to"
  ];
  const mediumKeywords = [
    "write code", "create a function", "explain how",
    "compare", "analyze", "generate", "implement",
    "write a script", "build", "design", "refactor"
  ];
  const complexKeywords = [
    "architect", "debug complex", "deep analysis",
    "multi-step", "trade-offs", "system design",
    "optimize algorithm", "security audit", "review codebase",
    "long-form", "research paper", "comprehensive"
  ];

  const simpleHits = simpleKeywords.filter(k => lower.includes(k)).length;
  const mediumHits = mediumKeywords.filter(k => lower.includes(k)).length;
  const complexHits = complexKeywords.filter(k => lower.includes(k)).length;

  score += simpleHits * -5;   // Pull score down
  score += mediumHits * 8;    // Moderate push
  score += complexHits * 15;  // Strong push up

  // ── Signal 3: Code Block Presence ──
  const codeBlocks = (promptText.match(/```/g) || []).length / 2;
  if (codeBlocks >= 3)       score += 20;  // Multiple code blocks = complex
  else if (codeBlocks >= 1)  score += 10;

  // ── Signal 4: Question Complexity ──
  const questionMarks = (promptText.match(/\?/g) || []).length;
  if (questionMarks === 1 && wordCount < 20) score -= 10;  // Simple single question
  if (questionMarks >= 3) score += 10;                      // Multi-part question

  // ── Signal 5: Conversation Depth ──
  // (passed as parameter from content.js — number of messages in thread)
  // Deep threads = model already has context, might need less power
  // But also = complex ongoing project

  // ── Signal 6: Structured Output Requests ──
  const structuredPatterns = [
    /in\s+(json|xml|csv|yaml|table)\s+format/i,
    /output\s+as\s+(json|xml|table|markdown)/i
  ];
  if (structuredPatterns.some(p => p.test(promptText))) score += 5;

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // ── Map to Tier ──
  if (score <= 25) return { tier: "low", model: "haiku", confidence: "high" };
  if (score <= 55) return { tier: "medium", model: "sonnet", confidence: "medium" };
  return { tier: "high", model: "opus", confidence: "medium" };
}
```

### Tier → Model Mapping

| Score | Tier | Recommended Model | Typical Tasks |
|-------|------|-------------------|---------------|
| 0–25 | Low | **Haiku** | Quick Q&A, formatting, translations, simple lookups |
| 26–55 | Medium | **Sonnet** | Code generation, summaries, analysis, writing |
| 56–100 | High | **Opus** | Architecture, deep debugging, research, nuanced reasoning |

---

## Component 2: Model Switcher (DOM Manipulation)

We already have `findModelChooser()` in content.js. The switcher would:

1. **Click** Claude's model dropdown button to open the menu
2. **Find** the menu item matching the recommended model name
3. **Click** that menu item to switch

```javascript
// Conceptual approach
async function switchModel(targetModelName) {
  const modelBtn = findModelChooser();
  if (!modelBtn) return false;

  // 1. Open the dropdown
  modelBtn.click();
  await sleep(200); // Wait for dropdown animation

  // 2. Find the option matching target model
  const options = document.querySelectorAll('[role="option"], [role="menuitem"]');
  const target = Array.from(options).find(opt =>
    opt.textContent.toLowerCase().includes(targetModelName.toLowerCase())
  );

  if (target) {
    target.click();
    return true;
  }

  return false;
}
```

> **Note:** This requires careful DOM testing since Claude.ai updates their UI frequently. We'd need a resilient selector strategy with fallbacks.

---

## Component 3: UI — Routing Recommendation Badge

A small, non-intrusive badge that appears **above the input box** (similar to the existing Vault badge) when the classifier detects the user is on the wrong model.

### Badge States

| State | Appearance | When |
|-------|-----------|------|
| **Hidden** | Not visible | User is on the optimal model already |
| **Suggestion** | `💡 Haiku could handle this — save ~80%` | Prompt is simple but user is on Sonnet/Opus |
| **Confirmation** | `✅ Good model choice for this task` | Quick flash, then fade (optional) |
| **Override** | `⚡ This looks complex — consider Opus` | Prompt is complex but user is on Haiku |

### Badge Behavior
- Appears after the user **pauses typing for 800ms** (debounced, not on every keystroke)
- Shows a **"Switch" button** that triggers the model switcher
- Shows a **"Dismiss" button** to hide it
- Tracks dismissed suggestions to learn user preferences over time

---

## Component 4: Stats Dashboard (Drawer Integration)

Add a **new section** inside the existing Squeeze sidebar drawer:

```
┌─────────────────────────────────┐
│ 🧠 Model Routing Insights      │
│                                 │
│  This Week:                     │
│  ┌───────┐ ┌───────┐ ┌───────┐ │
│  │  12   │ │  847  │ │ $1.20 │ │
│  │Routes │ │Tokens │ │ Saved │ │
│  │Applied│ │ Saved │ │       │ │
│  └───────┘ └───────┘ └───────┘ │
│                                 │
│  Model Usage Breakdown:         │
│  Haiku  ████████░░░░  62%      │
│  Sonnet ████░░░░░░░░  30%      │
│  Opus   █░░░░░░░░░░░   8%      │
│                                 │
│  ⚠ 7 tasks used Opus that      │
│    could have been Haiku        │
└─────────────────────────────────┘
```

---

## Component 5: Premium Gating

### How to gate it

```javascript
// Simple local license check
function isSmartRoutingEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["squeezePremiumKey", "premiumExpiry"], (data) => {
      if (!data.squeezePremiumKey) return resolve(false);

      // Validate key format
      const validFormat = /^SQ-PRO-[A-Z0-9]{12}$/.test(data.squeezePremiumKey);
      const notExpired = data.premiumExpiry && Date.now() < data.premiumExpiry;

      resolve(validFormat && notExpired);
    });
  });
}
```

### Premium Tiers (Future)

| Tier | Price | Features |
|------|-------|----------|
| **Squeeze Free** | $0 | Prompt optimization, usage bar, PDF squeeze |
| **Squeeze Pro** | ~$5/mo | Smart Model Routing, advanced stats, Context Vault unlimited files |

### Where to sell
- Chrome Web Store listing upsell
- In-extension banner (subtle, non-annoying)
- Landing page (the TokenMaxer website the user is building)

---

## File Structure (When We Build It)

```
version2/
├── content.js          ← Add classifier + badge + model switcher
├── content.css         ← Add routing badge styles
├── background.js       ← Add routing stats tracking
├── popup.html          ← Add premium activation UI
├── popup.js            ← Add premium key validation
├── popup.css           ← Badge and premium styles
└── model-classifier.js ← [NEW] Standalone classifier module
```

Only **1 new file** (`model-classifier.js`) — everything else plugs into existing files.

---

## Build Phases

### Phase 1 — Core Classifier + Badge (MVP)
- Build the local heuristic classifier
- Inject routing badge into Claude's input area
- Show recommendation text (no auto-switching yet)
- Track basic stats (suggestions shown, accepted, dismissed)

### Phase 2 — Auto-Switch + Dashboard
- Add model switcher DOM manipulation
- Add "Switch" button to badge
- Build routing insights section in drawer
- Add weekly stats tracking

### Phase 3 — Premium + Polish
- Add license key validation
- Gate routing behind premium check
- Add premium activation UI in popup
- Polish animations, add user preference learning
- Website integration for purchases

---

## Risk Factors

| Risk | Mitigation |
|------|------------|
| Claude.ai changes their DOM/model selector | Build resilient selectors with multiple fallback strategies; version-check on load |
| Classifier mis-routes (sends complex task to Haiku) | Default to **suggestion only** (not auto-switch); let user always override |
| Users find it annoying | Make badge dismissable; add "Don't suggest for this session" option; respect frequency caps |
| Chrome Web Store policy on premium features | Use external payment + license key model (Gumroad/Stripe), not Chrome Web Store payments |

---

*This is a planning document. No code changes have been made. Implementation will be done from this blueprint when ready.*
