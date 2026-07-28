// Squeeze Dashboard & Options Script

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements - Navigation
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  // DOM Elements - Dashboard Stats
  const statPrompts = document.getElementById("statPrompts");
  const statTokens = document.getElementById("statTokens");
  const statCost = document.getElementById("statCost");
  const infoEngine = document.getElementById("infoEngine");
  const infoMode = document.getElementById("infoMode");
  const statusBadge = document.getElementById("statusBadge");

  // DOM Elements - Settings Form
  const settingsForm = document.getElementById("settingsForm");
  const apiProviderSelect = document.getElementById("apiProvider");
  const apiKeyInput = document.getElementById("apiKey");
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");
  const providerHelper = document.getElementById("providerHelper");
  const saveFeedback = document.getElementById("saveFeedback");
  
  // Model input
  const ollamaModelInput = document.getElementById("ollamaModel");

  // Provider Helpers Config
  const helpers = {
    openrouter: 'Requires an OpenRouter API key. Create a free key at <a href="https://openrouter.ai/keys" target="_blank" style="color: var(--neon-cyan); text-decoration: none;">openrouter.ai/keys</a>.',
    anthropic: 'Requires an Anthropic Console API key (sk-ant-...). Standard API rates apply.',
    openai: 'Requires an OpenAI developer API key (sk-...). Standard API rates apply.'
  };

  // Helper Maps for display text
  const providerNames = {
    openrouter: "OpenRouter API",
    anthropic: "Anthropic API",
    openai: "OpenAI API"
  };

  const modeNames = {
    squeeze: "Squeeze (Max Savings)",
    balanced: "Balanced Conciseness",
    polish: "Polish & Enhance"
  };

  // 1. Tab Navigation Logic
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      
      // Toggle button states
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      // Toggle panes
      tabPanes.forEach(pane => pane.classList.remove("active"));
      document.getElementById(`${tabId}Tab`).classList.add("active");
    });
  });

  // 2. Toggle API Key Visibility
  togglePasswordBtn.addEventListener("click", () => {
    const type = apiKeyInput.getAttribute("type") === "password" ? "text" : "password";
    apiKeyInput.setAttribute("type", type);
    
    if (type === "text") {
      togglePasswordBtn.style.color = "var(--neon-cyan)";
    } else {
      togglePasswordBtn.style.color = "var(--text-dim)";
    }
  });

  // 3. Dynamic Helper Text and Default Models on Provider Change
  apiProviderSelect.addEventListener("change", () => {
    const provider = apiProviderSelect.value;
    providerHelper.innerHTML = helpers[provider] || "";
    
    // Automatically swap default model names to save user typing
    if (provider === "openrouter") {
      ollamaModelInput.value = "openrouter/free";
    } else if (provider === "anthropic") {
      ollamaModelInput.value = "claude-3-5-haiku-20241022";
    } else if (provider === "openai") {
      ollamaModelInput.value = "gpt-4o-mini";
    }
  });

  // 4. Load Saved Settings and Stats
  function loadSettingsAndStats() {
    chrome.storage.local.get([
      "apiProvider",
      "apiKey",
      "optimizationMode",
      "ollamaModel",
      "stats_promptsOptimized",
      "stats_tokensSaved",
      "stats_costSaved",
      "premiumKey",
      "premiumExpiry",
      "routerAutoSwitch",
      "router_suggestionsShown",
      "router_switchesApplied"
    ], (data) => {
      // Set Form Values
      const activeProvider = data.apiProvider || "openrouter";
      apiProviderSelect.value = activeProvider;
      providerHelper.innerHTML = helpers[activeProvider] || "";

      if (data.apiKey) {
        apiKeyInput.value = data.apiKey;
      } else {
        apiKeyInput.value = "";
      }
      
      if (data.ollamaModel) {
        ollamaModelInput.value = data.ollamaModel;
      } else {
        ollamaModelInput.value = "openrouter/free";
      }

      if (data.optimizationMode) {
        const checkedRadio = document.querySelector(`input[name="optimizationMode"][value="${data.optimizationMode}"]`);
        if (checkedRadio) checkedRadio.checked = true;
      }

      // Render Stats
      const promptsVal = data.stats_promptsOptimized || 0;
      const tokensVal = data.stats_tokensSaved || 0;
      const costVal = data.stats_costSaved || 0;

      statPrompts.textContent = formatNumber(promptsVal);
      statTokens.textContent = formatNumber(tokensVal);
      if (costVal > 0 && costVal < 0.01) {
        statCost.textContent = `$${costVal.toFixed(4)}`;
      } else {
        statCost.textContent = `$${costVal.toFixed(2)}`;
      }

      // Render Info Box
      const activeMode = data.optimizationMode || "balanced";
      infoEngine.textContent = providerNames[activeProvider] || activeProvider;
      infoMode.textContent = modeNames[activeMode].split(" ")[0];

      // Status Badge Update
      if (!data.apiKey) {
        statusBadge.className = "status-badge warning";
        statusBadge.querySelector(".text").textContent = "Setup Required";
      } else {
        statusBadge.className = "status-badge";
        statusBadge.querySelector(".text").textContent = "Ready";
      }

      // Premium State UI Handling
      const key = data.premiumKey || "";
      const hasPremium = key.startsWith("SQ-PRO-") || key === "developer";
      const premiumStatus = document.getElementById("premiumStatus");
      const routerControls = document.getElementById("routerControls");
      const premiumKeyInput = document.getElementById("premiumKey");
      const routerAutoSwitchInput = document.getElementById("routerAutoSwitch");
      const statRouterSwitches = document.getElementById("statRouterSwitches");
      const statRouterShown = document.getElementById("statRouterShown");

      if (premiumKeyInput) premiumKeyInput.value = key;
      if (routerAutoSwitchInput) routerAutoSwitchInput.checked = !!data.routerAutoSwitch;

      if (hasPremium) {
        if (premiumStatus) {
          premiumStatus.textContent = "Premium Active";
          premiumStatus.style.borderColor = "var(--neon-emerald)";
          premiumStatus.style.background = "rgba(52, 211, 153, 0.08)";
          premiumStatus.style.color = "var(--neon-emerald)";
        }
        if (routerControls) routerControls.style.display = "block";
      } else {
        if (premiumStatus) {
          premiumStatus.textContent = "Inactive";
          premiumStatus.style.borderColor = "rgba(224, 154, 46, 0.2)";
          premiumStatus.style.background = "rgba(224, 154, 46, 0.08)";
          premiumStatus.style.color = "var(--neon-purple)";
        }
        if (routerControls) routerControls.style.display = "none";
      }

      if (statRouterSwitches) statRouterSwitches.textContent = formatNumber(data.router_switchesApplied || 0);
      if (statRouterShown) statRouterShown.textContent = formatNumber(data.router_suggestionsShown || 0);
    });
  }

  // Number Formatter (e.g. 1500 -> 1.5K)
  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  }

  // 5. Save Form Submission
  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const provider = apiProviderSelect.value;
    const key = apiKeyInput.value.trim();
    const mode = document.querySelector('input[name="optimizationMode"]:checked').value;
    const modelName = ollamaModelInput.value.trim() || "meta-llama/llama-3-8b-instruct:free";

    chrome.storage.local.set({
      apiProvider: provider,
      apiKey: key,
      optimizationMode: mode,
      ollamaModel: modelName
    }, () => {
      // Reload stats/badge state
      loadSettingsAndStats();
      
      // Save Button Feedback animation
      saveFeedback.classList.add("show");
      setTimeout(() => {
        saveFeedback.classList.remove("show");
      }, 2500);
    });
  });

  // 6. Premium Save Form Submission
  const premiumForm = document.getElementById("premiumForm");
  const premiumFeedback = document.getElementById("premiumFeedback");

  premiumForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const premiumKeyInput = document.getElementById("premiumKey");
    const routerAutoSwitchInput = document.getElementById("routerAutoSwitch");
    
    const key = premiumKeyInput ? premiumKeyInput.value.trim() : "";
    const autoSwitch = routerAutoSwitchInput ? routerAutoSwitchInput.checked : false;

    const isValid = key.startsWith("SQ-PRO-") || key === "developer";
    const expiry = Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 year expiry

    chrome.storage.local.set({
      premiumKey: key,
      premiumExpiry: isValid ? expiry : 0,
      routerAutoSwitch: autoSwitch
    }, () => {
      loadSettingsAndStats();

      if (premiumFeedback) {
        premiumFeedback.classList.add("show");
        setTimeout(() => {
          premiumFeedback.classList.remove("show");
        }, 2500);
      }
    });
  });

  // Initial Load
  loadSettingsAndStats();
});
