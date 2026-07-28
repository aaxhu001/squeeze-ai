// SmartRouter Stats — Routing Event Tracking
// Standalone module. Zero dependencies on Squeeze.
// All storage keys prefixed with "router_" to avoid collision.

(function() {
  "use strict";

  const STORAGE_KEYS = {
    suggestionsShown: "router_suggestionsShown",
    suggestionsAccepted: "router_suggestionsAccepted",
    suggestionsDismissed: "router_suggestionsDismissed",
    tokensSavedEstimate: "router_tokensSavedEstimate",
    switchesApplied: "router_switchesApplied",
    modelUsage: "router_modelUsage",
    history: "router_weeklyHistory"
  };

  /**
   * Increment a numeric counter in storage.
   */
  function incrementStat(key, amount = 1) {
    chrome.storage.local.get([key], (data) => {
      const current = data[key] || 0;
      chrome.storage.local.set({ [key]: current + amount });
    });
  }

  /**
   * Track a model usage event.
   */
  function trackModelUsage(modelName) {
    chrome.storage.local.get([STORAGE_KEYS.modelUsage], (data) => {
      const usage = data[STORAGE_KEYS.modelUsage] || { haiku: 0, sonnet: 0, opus: 0 };
      if (usage[modelName] !== undefined) {
        usage[modelName]++;
      }
      chrome.storage.local.set({ [STORAGE_KEYS.modelUsage]: usage });
    });
  }

  /**
   * Record a routing event to weekly history.
   */
  function recordHistoryEvent(event) {
    chrome.storage.local.get([STORAGE_KEYS.history], (data) => {
      const history = data[STORAGE_KEYS.history] || [];
      history.push({
        timestamp: Date.now(),
        type: event.type,                   // "shown", "accepted", "dismissed", "switched"
        fromModel: event.fromModel || null,
        toModel: event.toModel || null,
        score: event.score || 0
      });

      // Keep only the last 500 events to prevent storage bloat
      if (history.length > 500) {
        history.splice(0, history.length - 500);
      }

      chrome.storage.local.set({ [STORAGE_KEYS.history]: history });
    });
  }

  // ── Public API ──

  const RouterStats = {
    /**
     * Track when a suggestion badge is shown to the user.
     */
    trackSuggestionShown(classification) {
      incrementStat(STORAGE_KEYS.suggestionsShown);
      recordHistoryEvent({
        type: "shown",
        fromModel: classification.currentModel,
        toModel: classification.recommendedModel,
        score: classification.score
      });
    },

    /**
     * Track when the user accepts a suggestion (clicks Switch).
     */
    trackSuggestionAccepted(classification) {
      incrementStat(STORAGE_KEYS.suggestionsAccepted);
      incrementStat(STORAGE_KEYS.switchesApplied);
      trackModelUsage(classification.recommendedModel);
      recordHistoryEvent({
        type: "accepted",
        fromModel: classification.currentModel,
        toModel: classification.recommendedModel,
        score: classification.score
      });
    },

    /**
     * Track when the user dismisses a suggestion.
     */
    trackSuggestionDismissed(classification) {
      incrementStat(STORAGE_KEYS.suggestionsDismissed);
      recordHistoryEvent({
        type: "dismissed",
        fromModel: classification.currentModel,
        toModel: classification.recommendedModel,
        score: classification.score
      });
    },

    /**
     * Get all routing stats for display.
     */
    getStats(callback) {
      chrome.storage.local.get(Object.values(STORAGE_KEYS), (data) => {
        callback({
          suggestionsShown: data[STORAGE_KEYS.suggestionsShown] || 0,
          suggestionsAccepted: data[STORAGE_KEYS.suggestionsAccepted] || 0,
          suggestionsDismissed: data[STORAGE_KEYS.suggestionsDismissed] || 0,
          tokensSavedEstimate: data[STORAGE_KEYS.tokensSavedEstimate] || 0,
          switchesApplied: data[STORAGE_KEYS.switchesApplied] || 0,
          modelUsage: data[STORAGE_KEYS.modelUsage] || { haiku: 0, sonnet: 0, opus: 0 },
          history: data[STORAGE_KEYS.history] || []
        });
      });
    },

    /**
     * Reset all routing stats.
     */
    resetStats() {
      const resetData = {};
      resetData[STORAGE_KEYS.suggestionsShown] = 0;
      resetData[STORAGE_KEYS.suggestionsAccepted] = 0;
      resetData[STORAGE_KEYS.suggestionsDismissed] = 0;
      resetData[STORAGE_KEYS.tokensSavedEstimate] = 0;
      resetData[STORAGE_KEYS.switchesApplied] = 0;
      resetData[STORAGE_KEYS.modelUsage] = { haiku: 0, sonnet: 0, opus: 0 };
      resetData[STORAGE_KEYS.history] = [];
      chrome.storage.local.set(resetData);
    },

    STORAGE_KEYS: STORAGE_KEYS
  };

  // Expose API
  window.__squeezeRouterStats = RouterStats;

})();
