document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const statPrompts = document.getElementById("statPrompts");
  const statTokens = document.getElementById("statTokens");
  const statCost = document.getElementById("statCost");
  const infoEngine = document.getElementById("infoEngine");
  const infoMode = document.getElementById("infoMode");
  const statusBadge = document.getElementById("statusBadge");

  // Settings form elements
  const settingsForm = document.getElementById("settingsForm");
  const ruleStripGreetings = document.getElementById("ruleStripGreetings");
  const ruleSimplifyPhrases = document.getElementById("ruleSimplifyPhrases");
  const ruleAbbreviate = document.getElementById("ruleAbbreviate");
  const ruleStripArticles = document.getElementById("ruleStripArticles");
  const rulePolishMarkdown = document.getElementById("rulePolishMarkdown");
  const saveFeedback = document.getElementById("saveFeedback");

  // Vault form elements
  const vaultPreferences = document.getElementById("vaultPreferences");
  const vaultPrefAlwaysInject = document.getElementById("vaultPrefAlwaysInject");
  const vaultSmartTriggers = document.getElementById("vaultSmartTriggers");
  const vaultDropZone = document.getElementById("vaultDropZone");
  const vaultFileInput = document.getElementById("vaultFileInput");
  const vaultBrowseLink = document.getElementById("vaultBrowseLink");
  const vaultFileList = document.getElementById("vaultFileList");
  const vaultServerUrl = document.getElementById("vaultServerUrl");
  const vaultTestServerBtn = document.getElementById("vaultTestServerBtn");
  const vaultServerStatus = document.getElementById("vaultServerStatus");
  const vaultServerEnabled = document.getElementById("vaultServerEnabled");

  // Feature Toggles on Dashboard
  const toggleOptimizer = document.getElementById("toggleOptimizer");
  const togglePdf = document.getElementById("togglePdf");
  const toggleVault = document.getElementById("toggleVault");
  const toggleTransfer = document.getElementById("toggleTransfer");
  const toggleDuplicate = document.getElementById("toggleDuplicate");
  const toggleRouter = document.getElementById("toggleRouter");

  // Meter elements
  const meterFill = document.getElementById("meterFill");
  const meterLabel = document.getElementById("meterLabel");

  let vaultFiles = [];

  const modeLabels = {
    squeeze: "Squeeze Mode",
    balanced: "Balanced Mode",
    polish: "Polish Mode"
  };

  function loadSettings() {
    chrome.storage.local.get([
      "optimizationMode",
      "ruleStripGreetings",
      "ruleSimplifyPhrases",
      "ruleAbbreviate",
      "ruleStripArticles",
      "rulePolishMarkdown",
      "stats_promptsOptimized",
      "stats_tokensSaved",
      "stats_costSaved",
      "vaultPreferences",
      "vaultPrefAlwaysInject",
      "vaultSmartTriggers",
      "vaultFiles",
      "vaultServerUrl",
      "vaultServerEnabled",
      "routerAutoSwitch"
    ], (data) => {
      const mode = data.optimizationMode || "balanced";
      const radio = document.querySelector(`input[name="optimizationMode"][value="${mode}"]`);
      if (radio) radio.checked = true;

      if (ruleStripGreetings) ruleStripGreetings.checked = data.ruleStripGreetings !== false;
      if (ruleSimplifyPhrases) ruleSimplifyPhrases.checked = data.ruleSimplifyPhrases !== false;
      if (ruleAbbreviate) ruleAbbreviate.checked = data.ruleAbbreviate !== false;
      if (ruleStripArticles) ruleStripArticles.checked = data.ruleStripArticles !== false;
      if (rulePolishMarkdown) rulePolishMarkdown.checked = data.rulePolishMarkdown !== false;

      const promptsVal = data.stats_promptsOptimized || 0;
      const tokensVal = data.stats_tokensSaved || 0;
      const costVal = data.stats_costSaved || 0;

      if (statPrompts) statPrompts.textContent = formatNumber(promptsVal);
      if (statTokens) statTokens.textContent = formatNumber(tokensVal);
      if (statCost) {
        statCost.textContent = costVal > 0 && costVal < 0.01 ? `$${costVal.toFixed(4)}` : `$${costVal.toFixed(2)}`;
      }

      if (infoEngine) infoEngine.textContent = "Local Heuristics";
      if (infoMode) infoMode.textContent = (modeLabels[mode] || "Balanced").split(" ")[0];

      if (statusBadge) {
        statusBadge.className = "status";
        const textSpan = statusBadge.querySelector(".text");
        if (textSpan) textSpan.textContent = "Ready";
      }

      if (vaultPreferences) vaultPreferences.value = data.vaultPreferences || "";
      if (vaultPrefAlwaysInject) vaultPrefAlwaysInject.checked = data.vaultPrefAlwaysInject !== false;
      if (vaultSmartTriggers) vaultSmartTriggers.checked = data.vaultSmartTriggers !== false;
      
      vaultFiles = data.vaultFiles || [];
      renderVaultFiles();

      if (vaultServerUrl) vaultServerUrl.value = data.vaultServerUrl || "";
      if (vaultServerEnabled) vaultServerEnabled.checked = !!data.vaultServerEnabled;
      updateConnectorStatus(data.vaultServerEnabled ? "Online" : "Offline");

      // Update Squeeze Meter
      let pct = 0;
      if (tokensVal > 0) {
        pct = Math.min(85, Math.max(15, Math.round((tokensVal / (tokensVal + (promptsVal * 150))) * 100)));
      }
      if (meterFill) meterFill.style.width = `${pct}%`;
      if (meterLabel) meterLabel.textContent = `Squeezed ${pct}%`;

      // Update Dashboard Feature Toggles
      const isOptimizerOn = data.ruleStripGreetings !== false || data.ruleSimplifyPhrases !== false;
      const isPdfOn = data.ruleStripArticles !== false;
      const isVaultOn = data.vaultSmartTriggers !== false;
      const isTransferOn = data.vaultPrefAlwaysInject !== false;
      const isDupOn = data.ruleAbbreviate !== false;
      const isRouterOn = !!data.routerAutoSwitch;

      if (toggleOptimizer) toggleOptimizer.classList.toggle("on", isOptimizerOn);
      if (togglePdf) togglePdf.classList.toggle("on", isPdfOn);
      if (toggleVault) toggleVault.classList.toggle("on", isVaultOn);
      if (toggleTransfer) toggleTransfer.classList.toggle("on", isTransferOn);
      if (toggleDuplicate) toggleDuplicate.classList.toggle("on", isDupOn);
      if (toggleRouter) toggleRouter.classList.toggle("on", isRouterOn);
    });
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  }

  // Dashboard Toggle Handlers
  if (toggleOptimizer) {
    toggleOptimizer.addEventListener("click", () => {
      const isOn = toggleOptimizer.classList.contains("on");
      chrome.storage.local.set({
        ruleStripGreetings: !isOn,
        ruleSimplifyPhrases: !isOn
      }, () => loadSettings());
    });
  }

  if (togglePdf) {
    togglePdf.addEventListener("click", () => {
      const isOn = togglePdf.classList.contains("on");
      chrome.storage.local.set({ ruleStripArticles: !isOn }, () => loadSettings());
    });
  }

  if (toggleVault) {
    toggleVault.addEventListener("click", () => {
      const isOn = toggleVault.classList.contains("on");
      chrome.storage.local.set({ vaultSmartTriggers: !isOn }, () => loadSettings());
    });
  }

  if (toggleTransfer) {
    toggleTransfer.addEventListener("click", () => {
      const isOn = toggleTransfer.classList.contains("on");
      chrome.storage.local.set({ vaultPrefAlwaysInject: !isOn }, () => loadSettings());
    });
  }

  if (toggleDuplicate) {
    toggleDuplicate.addEventListener("click", () => {
      const isOn = toggleDuplicate.classList.contains("on");
      chrome.storage.local.set({ ruleAbbreviate: !isOn }, () => loadSettings());
    });
  }

  if (toggleRouter) {
    toggleRouter.addEventListener("click", () => {
      const isOn = toggleRouter.classList.contains("on");
      chrome.storage.local.set({ routerAutoSwitch: !isOn }, () => loadSettings());
    });
  }

  // Tabs Switching
  tabs.forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      const tabId = tabBtn.getAttribute("data-tab");
      tabs.forEach((b) => b.classList.remove("active", "on"));
      tabBtn.classList.add("active", "on");

      tabPanes.forEach((pane) => pane.classList.remove("active"));
      const targetPane = document.getElementById(`${tabId}Tab`);
      if (targetPane) targetPane.classList.add("active");
    });
  });

  // Settings Form Submit
  if (settingsForm) {
    settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const selectedRadio = document.querySelector('input[name="optimizationMode"]:checked');
      const modeVal = selectedRadio ? selectedRadio.value : "balanced";

      chrome.storage.local.set({
        optimizationMode: modeVal,
        ruleStripGreetings: ruleStripGreetings ? ruleStripGreetings.checked : true,
        ruleSimplifyPhrases: ruleSimplifyPhrases ? ruleSimplifyPhrases.checked : true,
        ruleAbbreviate: ruleAbbreviate ? ruleAbbreviate.checked : true,
        ruleStripArticles: ruleStripArticles ? ruleStripArticles.checked : true,
        rulePolishMarkdown: rulePolishMarkdown ? rulePolishMarkdown.checked : true
      }, () => {
        loadSettings();
        if (saveFeedback) {
          saveFeedback.classList.add("show");
          setTimeout(() => saveFeedback.classList.remove("show"), 2500);
        }
      });
    });
  }

  // Vault Event Listeners
  if (vaultPreferences) {
    vaultPreferences.addEventListener("input", () => {
      chrome.storage.local.set({ vaultPreferences: vaultPreferences.value });
    });
  }

  if (vaultPrefAlwaysInject) {
    vaultPrefAlwaysInject.addEventListener("change", () => {
      chrome.storage.local.set({ vaultPrefAlwaysInject: vaultPrefAlwaysInject.checked });
    });
  }

  if (vaultSmartTriggers) {
    vaultSmartTriggers.addEventListener("change", () => {
      chrome.storage.local.set({ vaultSmartTriggers: vaultSmartTriggers.checked });
    });
  }

  if (vaultBrowseLink && vaultFileInput) {
    vaultBrowseLink.addEventListener("click", (e) => {
      e.preventDefault();
      vaultFileInput.click();
    });

    vaultFileInput.addEventListener("change", (e) => {
      handleUploadedFiles(e.target.files);
    });
  }

  if (vaultDropZone) {
    vaultDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      vaultDropZone.classList.add("dragover");
    });
    vaultDropZone.addEventListener("dragleave", () => {
      vaultDropZone.classList.remove("dragover");
    });
    vaultDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      vaultDropZone.classList.remove("dragover");
      handleUploadedFiles(e.dataTransfer.files);
    });
  }

  function handleUploadedFiles(files) {
    const promises = Array.from(files).map((file) => {
      return new Promise((resolve) => {
        const ext = file.name.split(".").pop().toLowerCase();
        if (!["txt", "md", "json"].includes(ext)) return resolve(null);

        const reader = new FileReader();
        reader.onload = (evt) => resolve({ name: file.name, content: evt.target.result, size: file.size });
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      });
    });

    Promise.all(promises).then((results) => {
      const validFiles = results.filter((f) => f !== null);
      if (validFiles.length === 0) return;

      const map = new Map();
      vaultFiles.forEach((f) => map.set(f.name, f));
      validFiles.forEach((f) => map.set(f.name, f));

      vaultFiles = Array.from(map.values());
      chrome.storage.local.set({ vaultFiles }, () => renderVaultFiles());
    });
  }

  function renderVaultFiles() {
    if (!vaultFileList) return;
    vaultFileList.innerHTML = "";

    if (vaultFiles.length === 0) {
      const li = document.createElement("li");
      li.className = "empty-list-msg";
      li.textContent = "No files uploaded to the vault yet.";
      vaultFileList.appendChild(li);
      return;
    }

    vaultFiles.forEach((file, index) => {
      const li = document.createElement("li");
      li.className = "vault-file-item";
      const sizeStr = formatBytes(file.size);
      li.innerHTML = `
        <div class="file-item-info">
          <span class="file-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span class="file-item-size" style="opacity:0.6; margin-left:6px;">${sizeStr}</span>
        </div>
        <button type="button" class="file-delete-btn" data-index="${index}" style="background:none; border:none; color:#ff8585; cursor:pointer;">
          &times;
        </button>
      `;

      li.querySelector(".file-delete-btn").addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-index"));
        vaultFiles.splice(idx, 1);
        chrome.storage.local.set({ vaultFiles }, () => renderVaultFiles());
      });

      vaultFileList.appendChild(li);
    });
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  if (vaultServerUrl) {
    vaultServerUrl.addEventListener("input", () => {
      chrome.storage.local.set({ vaultServerUrl: vaultServerUrl.value.trim() });
    });
  }

  if (vaultServerEnabled) {
    vaultServerEnabled.addEventListener("change", () => {
      chrome.storage.local.set({ vaultServerEnabled: vaultServerEnabled.checked });
      updateConnectorStatus(vaultServerEnabled.checked ? "Online" : "Offline");
    });
  }

  if (vaultTestServerBtn) {
    vaultTestServerBtn.addEventListener("click", () => {
      const url = vaultServerUrl ? vaultServerUrl.value.trim() : "";
      if (!url) return updateConnectorStatus("Offline");

      updateConnectorStatus("Testing...");
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3500);

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Squeeze connection verification probe." }),
        signal: controller.signal
      })
        .then((res) => {
          clearTimeout(id);
          updateConnectorStatus(res.ok ? "Online" : "Error");
        })
        .catch(() => {
          clearTimeout(id);
          const fallbackCtrl = new AbortController();
          const fallbackId = setTimeout(() => fallbackCtrl.abort(), 2000);
          fetch(url, { signal: fallbackCtrl.signal })
            .then(() => {
              clearTimeout(fallbackId);
              updateConnectorStatus("Online");
            })
            .catch(() => {
              clearTimeout(fallbackId);
              updateConnectorStatus("Error");
            });
        });
    });
  }

  function updateConnectorStatus(status) {
    if (!vaultServerStatus) return;
    vaultServerStatus.className = "connector-status";
    if (status === "Online") {
      vaultServerStatus.classList.add("status-online");
      vaultServerStatus.textContent = "Connected";
    } else if (status === "Testing...") {
      vaultServerStatus.classList.add("status-offline");
      vaultServerStatus.textContent = "Connecting...";
    } else if (status === "Error") {
      vaultServerStatus.classList.add("status-error");
      vaultServerStatus.textContent = "Failed";
    } else {
      vaultServerStatus.classList.add("status-offline");
      vaultServerStatus.textContent = "Offline";
    }
  }

  // Premium Form Handling
  const premiumForm = document.getElementById("premiumForm");
  if (premiumForm) {
    premiumForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pKey = document.getElementById("premiumKey");
      const rSwitch = document.getElementById("routerAutoSwitch");
      const pFeedback = document.getElementById("premiumFeedback");

      const keyVal = pKey ? pKey.value.trim() : "";
      const autoSwitch = !!rSwitch && rSwitch.checked;
      const isValid = keyVal.startsWith("SQ-PRO-") || keyVal === "developer";
      const expiry = Date.now() + 31536000000;

      chrome.storage.local.set({
        premiumKey: keyVal,
        premiumExpiry: isValid ? expiry : 0,
        routerAutoSwitch: autoSwitch
      }, () => {
        updatePremiumUI(keyVal);
        if (pFeedback) {
          pFeedback.classList.add("show");
          setTimeout(() => pFeedback.classList.remove("show"), 2500);
        }
      });
    });
  }

  function updatePremiumUI(keyValOverride) {
    chrome.storage.local.get([
      "premiumKey",
      "routerAutoSwitch",
      "router_suggestionsShown",
      "router_switchesApplied"
    ], (data) => {
      const keyVal = keyValOverride !== undefined ? keyValOverride : (data.premiumKey || "");
      const isValid = keyVal.startsWith("SQ-PRO-") || keyVal === "developer";

      const pStatus = document.getElementById("premiumStatus");
      const rControls = document.getElementById("routerControls");
      const pKey = document.getElementById("premiumKey");
      const rSwitch = document.getElementById("routerAutoSwitch");
      const statSwitches = document.getElementById("statRouterSwitches");
      const statShown = document.getElementById("statRouterShown");

      if (pKey) pKey.value = keyVal;
      if (rSwitch) rSwitch.checked = !!data.routerAutoSwitch;

      if (isValid) {
        if (pStatus) {
          pStatus.textContent = "Active";
          pStatus.style.color = "#8af0d4";
          pStatus.style.borderColor = "rgba(138, 240, 212, 0.4)";
          pStatus.style.background = "linear-gradient(90deg, rgba(47, 165, 136, 0.25), rgba(47, 165, 136, 0.08))";
        }
        if (rControls) rControls.style.display = "block";
      } else {
        if (pStatus) {
          pStatus.textContent = "Inactive";
          pStatus.style.color = "#ffe08a";
          pStatus.style.borderColor = "rgba(255, 224, 138, 0.4)";
          pStatus.style.background = "linear-gradient(90deg, rgba(217, 165, 58, 0.25), rgba(217, 165, 58, 0.08))";
        }
        if (rControls) rControls.style.display = "none";
      }

      if (statSwitches) statSwitches.textContent = data.router_switchesApplied || 0;
      if (statShown) statShown.textContent = data.router_suggestionsShown || 0;
    });
  }

  loadSettings();
  updatePremiumUI();
});