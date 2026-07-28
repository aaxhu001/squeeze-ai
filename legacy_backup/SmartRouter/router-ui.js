// SmartRouter UI Controller — Standalone
// Injects suggestion overlay and handles DOM switcher logic.
// Works on both Claude.ai and gemini.google.com.

(function() {
  "use strict";

  let activeTextarea = null;
  let recommendationBar = null;
  let classificationResult = null;
  let debounceTimeout = null;
  let isChecking = false;

  const CFG = window.__squeezeRouterConfig;
  const Stats = window.__squeezeRouterStats;
  const classify = window.__squeezeRouterClassify;

  function init() {
    if (!window.__squeezeSmartRouterEnabled) {
      console.log("[SmartRouter] Premium not active. Exiting.");
      return;
    }

    console.log("[SmartRouter] Initializing standalone model advisor...");

    // Start watching for textareas & model indicators
    observePage();
  }

  function observePage() {
    findTextareaAndHook();

    // Watch for dynamically loaded inputs
    let checkTimeout = null;
    const observer = new MutationObserver(() => {
      if (checkTimeout) return;
      checkTimeout = setTimeout(() => {
        findTextareaAndHook();
        checkTimeout = null;
      }, 200);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Identifies the prompt input field on Claude or Gemini
   */
  function findTextareaAndHook() {
    const isGeminiSite = window.location.hostname.includes("gemini");
    
    let el = null;
    if (isGeminiSite) {
      // Gemini's input is a div with role="textbox" or a plain textarea
      el = document.querySelector('div[role="textbox"]') || document.querySelector('textarea.textarea');
    } else {
      // Claude's input is a div with contenteditable="true"
      el = document.querySelector('div[contenteditable="true"]');
    }

    if (!el) {
      activeTextarea = null;
      removeBar();
      return;
    }

    if (el === activeTextarea) return;

    activeTextarea = el;
    console.log("[SmartRouter] Hooked active prompt input field:", el);

    // Event listener for user typing (debounced classification)
    el.addEventListener("input", handleInput);
  }

  function handleInput() {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(performAnalysis, CFG.debounceMs);
  }

  function getCleanPrompt() {
    if (!activeTextarea) return "";
    return (activeTextarea.innerText || activeTextarea.value || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();
  }

  /**
   * Triggers classification and decides whether to display suggestion
   */
  function performAnalysis() {
    if (isChecking) return;
    isChecking = true;

    try {
      const prompt = getCleanPrompt();
      if (!prompt || prompt.length < CFG.minPromptLength) {
        removeBar();
        isChecking = false;
        return;
      }

      // Check dismissal suppression
      const dismissals = parseInt(sessionStorage.getItem(CFG.sessionDismissalKey) || "0", 10);
      if (dismissals >= CFG.suppressAfterDismissals) {
        removeBar();
        isChecking = false;
        return;
      }

      const currentModelName = scrapeCurrentModelName();
      const messageCount = scrapeMessageCount();

      const res = classify(prompt, {
        currentModel: currentModelName,
        messageCount: messageCount,
        hostname: window.location.hostname
      });

      if (res && res.shouldSuggest) {
        classificationResult = res;
        showRecommendationBar(res);
      } else {
        removeBar();
      }
    } catch (err) {
      console.error("[SmartRouter] Analysis error:", err);
    } finally {
      isChecking = false;
    }
  }

  /**
   * Scrapes current active model label from DOM
   */
  function scrapeCurrentModelName() {
    const isGeminiSite = window.location.hostname.includes("gemini");

    if (isGeminiSite) {
      // 1. Gemini Web App model indicators
      const geminiBtn = document.querySelector('gemini-logo, button[aria-haspopup="true"]');
      if (geminiBtn) {
        const text = geminiBtn.textContent.toLowerCase();
        if (text.includes("advanced") || text.includes("pro")) return "pro";
        if (text.includes("flash")) return "flash";
      }
      
      // Default to Pro if we see Advanced indicator, else Flash
      const advancedBadge = document.querySelector('.advanced-badge, [href*="advanced"]');
      return advancedBadge ? "pro" : "flash";
    } else {
      // Claude.ai model indicator button
      const buttons = Array.from(document.querySelectorAll('button'));
      const modelBtn = buttons.find(btn => {
        const text = (btn.textContent || "").toLowerCase();
        return ["sonnet", "haiku", "opus", "claude"].some(m => text.includes(m));
      });

      return modelBtn ? modelBtn.textContent : null;
    }
  }

  function scrapeMessageCount() {
    // Claude messages container selectors
    const claudeMessages = document.querySelectorAll('div.font-user-message, div.font-claude-message, [data-testid="user-message"]');
    if (claudeMessages.length > 0) return claudeMessages.length;

    // Gemini messages container selectors
    const geminiMessages = document.querySelectorAll('chat-message, .message-content, .query-text');
    return geminiMessages.length;
  }

  /**
   * Render recommendations bar directly above prompt box container
   */
  function showRecommendationBar(res) {
    if (recommendationBar) {
      updateBarContent(res);
      return;
    }

    const wrapper = activeTextarea.closest('form') || activeTextarea.closest('fieldset') || activeTextarea.parentElement;
    if (!wrapper) return;

    recommendationBar = document.createElement("div");
    recommendationBar.className = "squeeze-router-bar";

    // Insert bar above input card
    wrapper.parentNode.insertBefore(recommendationBar, wrapper);

    // Trigger reveal transition
    setTimeout(() => {
      if (recommendationBar) recommendationBar.classList.add("visible");
    }, 50);

    updateBarContent(res);
    Stats.trackSuggestionShown(res);
  }

  function updateBarContent(res) {
    if (!recommendationBar) return;

    const isGeminiSite = window.location.hostname.includes("gemini");
    const recommendedLabel = res.recommendedModel.toUpperCase();
    const fromLabel = res.currentModel ? res.currentModel.toUpperCase() : "Current";

    recommendationBar.innerHTML = `
      <div class="squeeze-router-info">
        <span class="squeeze-router-icon">💡</span>
        <div class="squeeze-router-text">
          <span class="squeeze-router-title">Run this prompt on <strong>Gemini ${recommendedLabel}</strong>?</span>
          <span class="squeeze-router-subtitle">Optimized for ${res.reason}. Saves <span class="savings">${res.savingsEstimate || "tokens"}</span> costs.</span>
        </div>
        <span class="squeeze-router-tier tier-${res.tier}">${res.tier} task</span>
      </div>
      <div class="squeeze-router-actions">
        <button class="squeeze-router-switch-btn" id="squeezeRouterSwitchBtn">Switch to ${recommendedLabel}</button>
        <button class="squeeze-router-dismiss-btn" id="squeezeRouterDismissBtn" title="Dismiss suggestion">&times;</button>
      </div>
    `;

    // Hook events
    recommendationBar.querySelector("#squeezeRouterSwitchBtn").addEventListener("click", handleSwitch);
    recommendationBar.querySelector("#squeezeRouterDismissBtn").addEventListener("click", handleDismiss);
  }

  function handleDismiss() {
    Stats.trackSuggestionDismissed(classificationResult);
    
    // Track dismissals in session to prevent nagging
    const dismissals = parseInt(sessionStorage.getItem(CFG.sessionDismissalKey) || "0", 10);
    sessionStorage.setItem(CFG.sessionDismissalKey, (dismissals + 1).toString());

    removeBar();
  }

  async function handleSwitch() {
    const recommended = classificationResult.recommendedModel;
    const targetName = recommended === "flash" ? "flash" : (recommended === "pro" ? "pro" : recommended);
    
    Stats.trackSuggestionAccepted(classificationResult);
    removeBar();

    const success = await switchToModel(targetName);
    if (success) {
      showToast(targetName);
    } else {
      console.warn("[SmartRouter] Model selector dropdown click failed or timed out.");
    }
  }

  /**
   * DOM selector driver for switching models dynamically
   */
  async function switchToModel(targetName) {
    const isGeminiSite = window.location.hostname.includes("gemini");

    if (isGeminiSite) {
      // 1. Find dropdown selector on Gemini page
      const modelDropdown = document.querySelector('gemini-logo, button[aria-haspopup="true"], .model-selector-btn');
      if (!modelDropdown) return false;

      modelDropdown.click();
      await delay(250);

      // 2. Select corresponding item
      const options = document.querySelectorAll('[role="menuitem"], [role="option"], .model-option');
      for (const opt of options) {
        const text = opt.textContent.toLowerCase();
        if (text.includes(targetName) || (targetName === "pro" && text.includes("advanced"))) {
          opt.click();
          return true;
        }
      }
    } else {
      // Claude.ai dropdown switcher
      const buttons = Array.from(document.querySelectorAll('button'));
      const modelBtn = buttons.find(btn => {
        const text = (btn.textContent || "").toLowerCase();
        return ["sonnet", "haiku", "opus", "claude"].some(m => text.includes(m));
      });

      if (!modelBtn) return false;

      modelBtn.click();
      await delay(200);

      const items = document.querySelectorAll('[role="option"], [role="menuitemradio"], [data-value]');
      for (const item of items) {
        const text = item.textContent.toLowerCase();
        if (text.includes(targetName)) {
          item.click();
          return true;
        }
      }
    }

    return false;
  }

  function removeBar() {
    if (recommendationBar) {
      recommendationBar.classList.remove("visible");
      recommendationBar.classList.add("hiding");
      
      const bar = recommendationBar;
      recommendationBar = null;
      setTimeout(() => bar.remove(), CFG.badgeFadeMs);
    }
  }

  function showToast(modelName) {
    const toast = document.createElement("div");
    toast.className = "squeeze-router-toast";
    toast.innerHTML = `
      <span class="squeeze-router-toast-icon">🚀</span>
      <span class="squeeze-router-toast-text">Routed to <span class="model-name">Gemini ${modelName.toUpperCase()}</span></span>
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("visible"), 50);

    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 300);
    }, CFG.toastDurationMs);
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Late-init triggered when premium gate approves injection
  document.addEventListener("squeeze-premium-ready", init);

  // In development, premium-gate dispatches immediately, but let's fallback to onload
  if (window.__squeezeSmartRouterEnabled) {
    init();
  }

})();
