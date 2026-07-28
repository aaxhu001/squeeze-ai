// Squeeze Content Script for Claude.ai

(function() {
  let activeTextarea = null;
  let triggerButton = null;
  let undoButton = null;
  let pdfButton = null;
  let modalContainer = null;
  let currentPromptText = "";
  let lastOriginalPrompt = "";
  let activeMode = "balanced"; // default, will read from storage
  let activeDuplicates = [];
  let currentOriginalPrompt = "";
  let currentPDFFile = null;

  // Safe check for valid Chrome extension context
  function isExtensionValid() {
    try {
      return typeof chrome !== "undefined" && chrome.runtime && !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  function safeGetURL(path) {
    try {
      if (isExtensionValid() && chrome.runtime.getURL) {
        return chrome.runtime.getURL(path);
      }
    } catch (e) {}
    return "";
  }

  function safeStorageGet(keys, cb) {
    if (!isExtensionValid()) return;
    try {
      chrome.storage.local.get(keys, (data) => {
        if (!isExtensionValid() || (chrome.runtime && chrome.runtime.lastError)) return;
        if (cb) cb(data || {});
      });
    } catch (e) {}
  }

  function safeStorageSet(data, cb) {
    if (!isExtensionValid()) return;
    try {
      chrome.storage.local.set(data, () => {
        if (!isExtensionValid() || (chrome.runtime && chrome.runtime.lastError)) return;
        if (cb) cb();
      });
    } catch (e) {}
  }

  function safeSendMessage(message, cb) {
    if (!isExtensionValid()) {
      if (cb) cb({ success: false, error: "Squeeze was reloaded. Please refresh this tab to re-enable prompt optimization." });
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (!isExtensionValid() || (chrome.runtime && chrome.runtime.lastError)) {
          if (cb) cb({ success: false, error: "Squeeze was reloaded. Please refresh this tab to re-enable prompt optimization." });
          return;
        }
        if (cb) cb(response);
      });
    } catch (err) {
      if (cb) cb({ success: false, error: "Squeeze was reloaded. Please refresh this tab to re-enable prompt optimization." });
    }
  }

  // Detect current AI host platform
  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("gemini.google.com")) return "gemini";
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) return "chatgpt";
    return "claude";
  }

  // Initialize
  function init() {
    if (!isExtensionValid()) return;

    // Set host platform dataset attribute on body for CSS targeting
    try {
      document.body.dataset.squeezePlatform = detectPlatform();
    } catch (e) {}

    // Read user settings for default mode
    safeStorageGet(["optimizationMode"], (data) => {
      if (data && data.optimizationMode) {
        activeMode = data.optimizationMode;
      }
    });

    // Start checking for input elements
    findAndInjectWidget();
    injectUsageBar();
    
    // Set up a MutationObserver with throttling to watch for dynamically added elements without CPU lag
    let checkTimeout = null;
    const observer = new MutationObserver(() => {
      if (!isExtensionValid()) {
        observer.disconnect();
        return;
      }
      if (checkTimeout) return;
      checkTimeout = setTimeout(() => {
        findAndInjectWidget();
        injectUsageBar();
        checkTimeout = null;
      }, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    try {
      // Also listen for storage updates (e.g., user changes mode in popup while on the page)
      if (isExtensionValid() && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes) => {
          if (!isExtensionValid()) return;
          if (changes.optimizationMode) {
            activeMode = changes.optimizationMode.newValue;
          }
          
          const vaultKeys = [
            "vaultPreferences",
            "vaultPrefAlwaysInject",
            "vaultSmartTriggers",
            "vaultFiles",
            "vaultServerUrl",
            "vaultServerEnabled"
          ];
          
          if (vaultKeys.some(key => changes[key] !== undefined)) {
            if (activeTextarea) {
              updateRealtimeVaultBadge(activeTextarea.innerText);
            }
          }
        });
      }
    } catch (e) {}
  }

  // Universal multi-platform input element finder (Claude, Gemini, ChatGPT)
  function findInputElement() {
    const platform = detectPlatform();
    if (platform === "chatgpt") {
      return document.querySelector('#prompt-textarea') ||
             document.querySelector('div[contenteditable="true"][id="prompt-textarea"]') ||
             document.querySelector('textarea#prompt-textarea') ||
             document.querySelector('div[contenteditable="true"]');
    }
    if (platform === "gemini") {
      return document.querySelector('rich-textarea div[contenteditable="true"]') ||
             document.querySelector('div[aria-label*="prompt" i]') ||
             document.querySelector('div[contenteditable="true"]') ||
             document.querySelector('textarea');
    }
    // Claude & default fallback
    return document.querySelector('div[contenteditable="true"]') ||
           document.querySelector('div[role="textbox"]') ||
           document.querySelector('.ProseMirror') ||
           document.querySelector('textarea');
  }

  // Find the input area and inject the floating widget (Claude, Gemini, ChatGPT)
  function findAndInjectWidget() {
    if (!isExtensionValid()) return;

    const inputElement = findInputElement();
    
    if (!inputElement) {
      if (triggerButton && !document.body.contains(triggerButton)) {
        triggerButton = null;
      }
      return;
    }

    // Check if buttons are currently mounted inside the active DOM body
    const isTriggerAttached = triggerButton && document.body.contains(triggerButton);
    const isPdfAttached = pdfButton && document.body.contains(pdfButton);

    if (inputElement.dataset.squeezeInjected === "true" && isTriggerAttached && isPdfAttached) {
      activeTextarea = inputElement;
      return;
    }

    activeTextarea = inputElement;
    inputElement.dataset.squeezeInjected = "true";
    
    injectButton(inputElement);
    createModalContainer();

    safeStorageGet(["pendingChatSummary"], (data) => {
      if (data && data.pendingChatSummary) {
        const summaryText = data.pendingChatSummary;
        safeStorageSet({ pendingChatSummary: null }, () => {
          setTimeout(() => {
            setContentEditableText(inputElement, summaryText);
            showFloatingTooltip(inputElement, "Context summary transferred from previous chat! Ready to send.");
          }, 400);
        });
      }
    });
  }

  // Inject the trigger button to the left of Claude's model chooser button
  function injectButton(inputElement) {
    // Remove existing button if any
    if (triggerButton) {
      triggerButton.remove();
    }
    if (pdfButton) {
      pdfButton.remove();
    }
    if (undoButton) {
      undoButton.remove();
    }

    // Create the button
    triggerButton = document.createElement("div");
    triggerButton.className = "squeeze-trigger-btn inline-btn";
    triggerButton.dataset.tooltip = "Optimize Prompt (Squeeze)";
    triggerButton.addEventListener("mouseenter", () => showHoverTooltip(triggerButton, triggerButton.dataset.tooltip));
    triggerButton.addEventListener("mouseleave", hideHoverTooltip);
    
    // Set SVG icon (Theme-adaptive prompt optimizer funnel)
    triggerButton.innerHTML = `
      <svg viewBox="0 0 512 512" width="16" height="16" style="display: block; color: inherit;">
        <rect x="120" y="140" width="272" height="48" rx="24" fill="currentColor"/>
        <rect x="144" y="212" width="224" height="48" rx="24" fill="currentColor" fill-opacity="0.8"/>
        <rect x="176" y="284" width="160" height="48" rx="24" fill="currentColor" fill-opacity="0.6"/>
        <rect x="208" y="356" width="96" height="48" rx="24" fill="currentColor" fill-opacity="0.4"/>
      </svg>
    `;

    // Create the PDF button
    pdfButton = document.createElement("div");
    pdfButton.className = "squeeze-pdf-btn inline-btn";
    pdfButton.dataset.tooltip = "Squeeze PDF & Insert";
    pdfButton.addEventListener("mouseenter", () => showHoverTooltip(pdfButton, pdfButton.dataset.tooltip));
    pdfButton.addEventListener("mouseleave", hideHoverTooltip);
    pdfButton.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    `;

    // Create the undo button
    undoButton = document.createElement("div");
    undoButton.className = "squeeze-undo-btn inline-btn";
    undoButton.dataset.tooltip = "Undo Prompt Optimization";
    undoButton.addEventListener("mouseenter", () => showHoverTooltip(undoButton, undoButton.dataset.tooltip));
    undoButton.addEventListener("mouseleave", hideHoverTooltip);
    undoButton.style.display = "none"; // Hidden by default
    undoButton.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: scaleX(-1);">
        <path d="M3 7v6h6"></path>
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
      </svg>
    `;

    // Create the context summary button (< summarise context >)
    let summaryButton = document.createElement("div");
    summaryButton.className = "squeeze-summary-btn inline-btn";
    summaryButton.dataset.tooltip = "< summarise context >";
    summaryButton.addEventListener("mouseenter", () => showHoverTooltip(summaryButton, summaryButton.dataset.tooltip));
    summaryButton.addEventListener("mouseleave", hideHoverTooltip);
    summaryButton.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        <line x1="9" y1="10" x2="15" y2="10"></line>
      </svg>
    `;
    summaryButton.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        const summaryText = generateHeuristicSummary();
        if (!summaryText || summaryText.trim().length < 20) {
          showFloatingTooltip(summaryButton, "No chat context to summarize yet!");
          return;
        }
        chrome.storage.local.set({ pendingChatSummary: summaryText }, () => {
          navigator.clipboard.writeText(summaryText).catch(() => {});
          showFloatingTooltip(summaryButton, "Context summarized! Opening fresh chat...");
          setTimeout(() => {
            const platform = detectPlatform();
            if (platform === "gemini") window.location.href = "https://gemini.google.com/app";
            else if (platform === "chatgpt") window.location.href = "https://chatgpt.com/";
            else window.location.href = "https://claude.ai/new";
          }, 1200);
        });
      } catch (err) {
        console.error("Summary error:", err);
        showFloatingTooltip(summaryButton, "Error summarizing context.");
      }
    });

    // Create the vault badge
    const vaultBadge = document.createElement("div");
    vaultBadge.id = "squeezeVaultBadge";
    vaultBadge.className = "squeeze-vault-badge inline-btn";
    vaultBadge.style.display = "none";
    vaultBadge.style.cursor = "default";

    // Group buttons in a single flex wrapper to prevent breaking Claude's layout
    let buttonsGroup = document.createElement("div");
    buttonsGroup.className = "squeeze-buttons-group";
    buttonsGroup.style.display = "inline-flex";
    buttonsGroup.style.alignItems = "center";
    buttonsGroup.style.gap = "6px";
    buttonsGroup.style.marginRight = "6px";
    buttonsGroup.style.flexShrink = "0";

    buttonsGroup.appendChild(vaultBadge);
    buttonsGroup.appendChild(undoButton);
    buttonsGroup.appendChild(summaryButton);
    buttonsGroup.appendChild(pdfButton);
    buttonsGroup.appendChild(triggerButton);

    // Try to find Claude/Gemini/ChatGPT input container or buttons
    const modelBtn = findModelChooser();
    if (modelBtn && modelBtn.parentNode) {
      modelBtn.parentNode.insertBefore(buttonsGroup, modelBtn);
    } else {
      const formContainer = inputElement.closest('form') ||
                            inputElement.closest('fieldset') ||
                            document.querySelector('form button[type="submit"]')?.parentNode ||
                            document.querySelector('button[aria-label*="Send" i]')?.parentNode ||
                            document.querySelector('button[aria-label*="attach" i]')?.parentNode;
      
      if (formContainer) {
        formContainer.insertBefore(buttonsGroup, formContainer.firstChild);
      } else if (inputElement.parentElement) {
        inputElement.parentElement.appendChild(buttonsGroup);
      }
    }

    // PDF button action handler
    pdfButton.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".pdf";
      fileInput.style.display = "none";
      
      fileInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (file) {
          handlePDFUpload(file);
        }
      });
      
      document.body.appendChild(fileInput);
      fileInput.click();
      setTimeout(() => fileInput.remove(), 1000);
    });

    // Initial opacity and badge check
    updateButtonState(inputElement);
    updateRealtimeVaultBadge(inputElement.innerText);

    // Event listener for user typing to update word counts, opacity, and token usage bar
    inputElement.addEventListener("input", () => {
      updateButtonState(inputElement);
      updateUsageBar();
      updateRealtimeVaultBadge(inputElement.innerText);
    });

    // Event listener for button click
    triggerButton.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const text = inputElement.innerText || inputElement.innerHTML;
      const cleanText = getCleanText(text);
      
      if (!cleanText || cleanText.length < 5) {
        showFloatingTooltip(triggerButton, "Type a prompt first!");
        return;
      }

      currentPromptText = cleanText;
      openOptimizationModal(cleanText);
    });

    // Undo action handler
    undoButton.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      if (lastOriginalPrompt) {
        // Clear and restore original lines
        inputElement.innerHTML = "";
        
        const lines = lastOriginalPrompt.split('\n');
        lines.forEach((line) => {
          const p = document.createElement('p');
          p.innerText = line;
          inputElement.appendChild(p);
        });
        
        // Dispatch InputEvents to let Claude sync state
        inputElement.dispatchEvent(new Event("input", { bubbles: true }));
        inputElement.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: lastOriginalPrompt }));
        inputElement.dispatchEvent(new Event("change", { bubbles: true }));
        
        // Hide undo button
        undoButton.style.display = "none";
        hideHoverTooltip();
        
        // Re-focus & state sync
        setTimeout(() => inputElement.focus(), 50);
        showFloatingTooltip(triggerButton, "Original prompt restored!");
        updateButtonState(inputElement);
      }
    });
  }

  // Find target anchor element inside host input container (Claude, Gemini, ChatGPT)
  function findModelChooser() {
    const inputElement = findInputElement();
    if (!inputElement) return null;

    const platform = detectPlatform();

    let container = inputElement.closest('form') ||
                    inputElement.closest('fieldset') ||
                    inputElement.closest('rich-textarea') ||
                    inputElement.closest('[class*="input"]') ||
                    inputElement.parentElement;

    let depth = 0;
    while (container && depth < 5) {
      const containerButtons = Array.from(container.querySelectorAll('button, div[role="button"]'));
      
      if (platform === "claude") {
        let modelBtn = containerButtons.find(btn => {
          const text = (btn.innerText || btn.getAttribute('aria-label') || "").toLowerCase();
          return (text.includes("sonnet") || text.includes("fable") || text.includes("haiku") || text.includes("opus") || text.includes("medium")) && !text.includes("chat with");
        });
        if (modelBtn) return modelBtn;
      }

      if (platform === "gemini") {
        let geminiBtn = containerButtons.find(btn => {
          const label = (btn.getAttribute('aria-label') || btn.innerText || "").toLowerCase();
          return label.includes("upload") || label.includes("file") || label.includes("plus") || label.includes("mic") || label.includes("tools");
        });
        if (geminiBtn) return geminiBtn;
      }

      if (platform === "chatgpt") {
        let chatgptBtn = containerButtons.find(btn => {
          const label = (btn.getAttribute('aria-label') || btn.getAttribute('data-testid') || btn.innerText || "").toLowerCase();
          return label.includes("attach") || label.includes("file") || label.includes("upload") || label.includes("voice") || label.includes("dictate");
        });
        if (chatgptBtn) return chatgptBtn;
      }

      const dropdownBtn = containerButtons.find(btn => {
        const text = (btn.innerText || "").toLowerCase();
        return (btn.getAttribute('aria-haspopup') === 'true' || btn.getAttribute('aria-haspopup') === 'listbox') && !text.includes("chat with");
      });

      if (dropdownBtn) return dropdownBtn;

      container = container.parentElement;
      depth++;
    }

    return null;
  }

  // Clean raw HTML or inner text fluff
  function getCleanText(text) {
    if (!text) return "";
    // Remove zero-width spaces or dynamic spacer chars
    return text.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  }

  // Update button opacity
  function updateButtonState(inputElement) {
    if (!triggerButton) return;

    const text = getCleanText(inputElement.innerText);
    const tokens = text ? estimateTokens(text) : 0;
    
    if (tokens > 0) {
      triggerButton.classList.add("active");
    } else {
      triggerButton.classList.remove("active");
    }
  }

  // Real-time Context Vault badge updater
  function updateRealtimeVaultBadge(text) {
    if (!isExtensionValid()) return;

    const cleanText = getCleanText(text);
    if (!cleanText) {
      hideVaultBadge();
      return;
    }
    
    try {
      chrome.storage.local.get([
        "vaultPreferences",
        "vaultPrefAlwaysInject",
        "vaultSmartTriggers",
        "vaultFiles",
        "vaultServerEnabled"
      ], (data) => {
        if (chrome.runtime.lastError || !data) return;
      const preferences = data.vaultPreferences || "";
      const alwaysInjectPref = data.vaultPrefAlwaysInject !== false;
      const smartTriggers = data.vaultSmartTriggers !== false;
      const files = data.vaultFiles || [];
      const serverEnabled = !!data.vaultServerEnabled;

      let attachedCount = 0;
      const items = [];

      // 1. Preferences
      if (preferences.trim() && alwaysInjectPref) {
        attachedCount++;
        items.push("Preferences");
      }

      // 2. Files
      if (files.length > 0) {
        const promptLower = cleanText.toLowerCase();
        
        for (const file of files) {
          let matched = false;
          if (smartTriggers) {
            const nameWithoutExt = file.name.replace(/\.[a-z0-9]+$/i, "");
            const tokens = nameWithoutExt.toLowerCase().split(/[^a-z0-9]+/);
            const keywords = tokens.filter(t => t.length >= 3 || ["db", "js", "go", "py"].includes(t));
            
            for (const kw of keywords) {
              const regex = new RegExp("\\b" + kw + "\\b", "i");
              if (regex.test(promptLower)) {
                matched = true;
                break;
              }
            }
          } else {
            matched = true;
          }

          if (matched && file.content) {
            attachedCount++;
            items.push(file.name);
          }
        }
      }

      // 3. Server
      if (serverEnabled) {
        attachedCount++;
        items.push("Local Server");
      }

      // Render badge
      const badge = document.getElementById("squeezeVaultBadge");
      if (badge) {
        if (attachedCount > 0) {
          badge.style.display = "inline-flex";
          badge.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; color: #da7040;">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span style="font-size: 0.72rem; font-weight: 600; color: #da7040;">Vault: ${attachedCount}</span>
          `;
          badge.setAttribute("title", `Vault Context Attached:\n- ${items.join("\n- ")}`);
        } else {
          badge.style.display = "none";
        }
      }
    });
    } catch (e) {}
  }

  function hideVaultBadge() {
    const badge = document.getElementById("squeezeVaultBadge");
    if (badge) badge.style.display = "none";
  }

  // Show a quick tooltip helper
  function showFloatingTooltip(targetEl, text) {
    const tooltip = document.createElement("div");
    tooltip.className = "squeeze-tooltip";
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    const rect = targetEl.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 8}px`;
    
    tooltip.classList.add("show");
    
    setTimeout(() => {
      tooltip.classList.remove("show");
      setTimeout(() => tooltip.remove(), 300);
    }, 2000);
  }

  let activeHoverTooltip = null;

  function showHoverTooltip(targetEl, text) {
    hideHoverTooltip();

    const tooltip = document.createElement("div");
    tooltip.className = "squeeze-tooltip";
    tooltip.textContent = text;
    document.body.appendChild(tooltip);

    const rect = targetEl.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 8}px`;
    
    requestAnimationFrame(() => {
      tooltip.classList.add("show");
    });

    activeHoverTooltip = tooltip;
  }

  function hideHoverTooltip() {
    if (activeHoverTooltip) {
      const tooltip = activeHoverTooltip;
      activeHoverTooltip = null;
      tooltip.classList.remove("show");
      setTimeout(() => tooltip.remove(), 150);
    }
  }

  // Create Modal Container
  function createModalContainer() {
    if (modalContainer) return;
    
    modalContainer = document.createElement("div");
    modalContainer.className = "squeeze-modal-container";
    document.body.appendChild(modalContainer);
    
    // Close modal on clicking backdrop
    modalContainer.addEventListener("click", (e) => {
      if (e.target === modalContainer) {
        closeModal();
      }
    });
  }

  // Open the optimization modal and request optimization
  function openOptimizationModal(text) {
    if (!modalContainer) createModalContainer();
    
    currentOriginalPrompt = text;
    activeDuplicates = checkCrossMessageDuplicates(text);
    
    const logoUrl = safeGetURL("icons/icon48.png");
    modalContainer.innerHTML = `
      <div class="squeeze-modal-card">
        <div class="tm-modal-header">
          <div class="tm-modal-logo">
            <img src="${logoUrl}" class="animating" width="22" height="22" alt="Squeeze Icon" style="vertical-align: middle;">
            <span>Squeeze <span class="highlight">Optimizer</span></span>
          </div>
          <button class="tm-close-btn">&times;</button>
        </div>
        
        <div class="tm-modal-body">
          <div class="tm-loading-state">
            <div class="tm-spinner"></div>
            <p>Squeezing prompt for maximum token efficiency...</p>
            <span class="tm-loading-subtext">Optimizing via Local Rules...</span>
          </div>
        </div>
      </div>
    `;
    
    modalContainer.classList.add("open");
    
    // Attach close listener
    modalContainer.querySelector(".tm-close-btn").addEventListener("click", closeModal);
    
    // Trigger prompt optimization request to background.js
    requestOptimization(text, activeMode);
  }

  function requestOptimization(promptText, mode, rawPDFTokens) {
    safeSendMessage({
      action: "optimizePrompt",
      prompt: promptText,
      mode: mode,
      rawPDFTokens: rawPDFTokens || 0
    }, (response) => {
      if (response && response.success) {
        renderComparison(response);
      } else {
        renderError(response ? response.error : "Failed to communicate with Squeeze background service worker. Please refresh the tab.");
      }
    });
  }

  // Longest Common Subsequence word-level diff generator
  function getDiffHtml(oldStr, newStr) {
    const oldWords = oldStr.trim().split(/(\s+)/);
    const newWords = newStr.trim().split(/(\s+)/);
    
    const dp = Array(oldWords.length + 1).fill(null).map(() => Array(newWords.length + 1).fill(0));
    
    for (let i = 1; i <= oldWords.length; i++) {
      for (let j = 1; j <= newWords.length; j++) {
        if (oldWords[i-1] === newWords[j-1]) {
          dp[i][j] = dp[i-1][j-1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
        }
      }
    }
    
    let i = oldWords.length, j = newWords.length;
    const oldDiff = [];
    const newDiff = [];
    
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldWords[i-1] === newWords[j-1]) {
        const word = oldWords[i-1];
        oldDiff.unshift(escapeHtml(word));
        newDiff.unshift(escapeHtml(word));
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
        const word = newWords[j-1];
        if (word.trim() === "") {
          newDiff.unshift(word);
        } else {
          newDiff.unshift(`<ins class="tm-diff-ins">${escapeHtml(word)}</ins>`);
        }
        j--;
      } else {
        const word = oldWords[i-1];
        if (word.trim() === "") {
          oldDiff.unshift(word);
        } else {
          oldDiff.unshift(`<del class="tm-diff-del">${escapeHtml(word)}</del>`);
        }
        i--;
      }
    }
    
    return {
      oldHtml: oldDiff.join(""),
      newHtml: newDiff.join("")
    };
  }

  // Preservation Quality score estimation — 100% dynamic calculation from content tokens
  function calculateQualityScore(original, optimized, mode) {
    if (!original || !optimized) return 100;
    
    // 1. If text is byte-identical (0% change), Intent Preservation is 100%
    if (original.trim() === optimized.trim()) {
      return 100;
    }

    // 2. Stopwords filter out conversational fluff/padding
    const stopWords = new Set(["a","an","the","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","should","could","may","might","must","shall","can","of","in","to","for","with","on","at","by","from","up","about","into","over","after","and","or","but","so","if","then","else","when","as","until","while","just","kind","sort","basically","really","quite","very"]);
    
    const orgTokens = (original.match(/\b[a-zA-Z0-9_-]{2,}\b/g) || [])
      .map(w => w.toLowerCase())
      .filter(w => !stopWords.has(w));
      
    const optTokenSet = new Set(
      (optimized.match(/\b[a-zA-Z0-9_-]{2,}\b/g) || []).map(w => w.toLowerCase())
    );

    if (orgTokens.length === 0) return 100;

    let preservedCount = 0;
    orgTokens.forEach(token => {
      if (optTokenSet.has(token)) preservedCount++;
    });

    const keyTokenPreservation = preservedCount / orgTokens.length;

    // 3. Dynamic Score Calculation
    let score = Math.round(75 + 25 * keyTokenPreservation);
    score = Math.max(70, Math.min(100, score));
    return score;
  }

  // Render optimized prompt comparison view
  function renderComparison(data) {
    const body = modalContainer.querySelector(".tm-modal-body");
    
    // Stop logo animation when optimization completes
    const logoImg = modalContainer.querySelector(".tm-modal-logo img");
    if (logoImg) {
      logoImg.classList.remove("animating");
    }

    const qualityScore = calculateQualityScore(data.original, data.optimized, data.mode);
    const diff = getDiffHtml(data.original, data.optimized);
    
    const rulesListHtml = data.rulesApplied && data.rulesApplied.length > 0 
      ? `<div class="tm-applied-rules-chips" style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;">
          ${data.rulesApplied.map(rule => `<span class="tm-rule-chip" style="font-size: 0.68rem; padding: 2px 8px; background: rgba(218, 112, 64, 0.08); border: 1px solid rgba(218, 112, 64, 0.15); color: var(--tm-neon-cyan); border-radius: 12px; font-weight: 500; text-shadow: 0 0 4px rgba(218, 112, 64, 0.2);">✓ ${rule}</span>`).join('')}
         </div>`
      : "";

    const contextChipsHtml = data.attachedContexts && data.attachedContexts.length > 0
      ? `<div class="tm-attached-context-chips" style="margin-top: 10px; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 8px;">
          <span style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Vault Context Injected:</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${data.attachedContexts.map(ctx => `<span class="tm-context-chip" style="font-size: 0.68rem; padding: 2px 8px; background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.15); color: #da7040; border-radius: 12px; font-weight: 500;">📂 ${ctx}</span>`).join('')}
          </div>
         </div>`
      : "";

    let dupWarningHtml = "";
    if (activeDuplicates && activeDuplicates.length > 0) {
      const count = activeDuplicates.length;
      const typeLabel = count === 1 ? "block" : "blocks";
      dupWarningHtml = `
        <div class="tm-dup-warning-banner" style="background: rgba(255, 59, 48, 0.08); border: 1px solid rgba(255, 59, 48, 0.25); padding: 12px; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-sizing: border-box; width: 100%;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: #ff5e84; line-height: 1.4;">
            <span style="font-size: 1.1rem;">⚠️</span>
            <span><strong>Duplicate Context:</strong> ${count} large ${typeLabel} in your prompt was already sent in this thread. Claude already has this context.</span>
          </div>
          <button class="tm-btn" id="tmStripDupsBtn" style="padding: 4px 10px; font-size: 0.72rem; border: 1px solid rgba(255, 94, 132, 0.4); border-radius: 4px; color: #ff5e84; background: rgba(255, 59, 48, 0.04); cursor: pointer; font-weight: 600; white-space: nowrap; transition: all 0.2s ease;">Strip Duplicates</button>
        </div>
      `;
    }

    let pdfSuccessHtml = "";
    if (currentPDFFile) {
      pdfSuccessHtml = `
        <div class="tm-pdf-success-banner" style="background: rgba(5, 242, 158, 0.08); border: 1px solid rgba(5, 242, 158, 0.2); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.78rem; color: #05f29e; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-sizing: border-box; width: 100%; line-height: 1.4;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.1rem;">📄</span>
            <span><strong>Extracted & Squeezed PDF:</strong> "${currentPDFFile.name}" (${data.originalTokens.toLocaleString()} ➔ ${data.optimizedTokens.toLocaleString()} tokens). Applied header/footer pruning & local optimization.</span>
          </div>
          <span style="background: rgba(5, 242, 158, 0.15); border: 1px solid rgba(5, 242, 158, 0.3); padding: 3px 10px; border-radius: 12px; font-weight: 700; white-space: nowrap;">Saved ${data.tokensSaved.toLocaleString()} tokens (${data.percentageSaved}%)</span>
        </div>
      `;
    }

    const leftHeaderLabel = currentPDFFile ? "Original PDF Content" : "Original Prompt";
    const rightHeaderLabel = currentPDFFile ? "Squeezed PDF Content" : "Optimized Prompt";

    body.innerHTML = `
      <div class="tm-comparison-layout">
        ${pdfSuccessHtml}
        ${dupWarningHtml}
        <!-- Settings Bar -->
        <div class="tm-options-bar">
          <div class="tm-mode-selector-group">
            <label>Mode:</label>
            <select id="tmModeSelect" class="tm-mini-select">
              <option value="squeeze" ${data.mode === "squeeze" ? "selected" : ""}>Squeeze (Max Savings)</option>
              <option value="balanced" ${data.mode === "balanced" || !data.mode ? "selected" : ""}>Balanced (Concise)</option>
              <option value="polish" ${data.mode === "polish" ? "selected" : ""}>Polish (Enhance)</option>
            </select>
          </div>
          <div class="tm-stats-badges">
            <div class="tm-stats-badge-savings ${data.percentageSaved < 3 ? 'minimal-savings' : ''}" style="${data.percentageSaved < 3 ? 'background: rgba(255, 255, 255, 0.06); color: var(--text-muted); border-color: rgba(255, 255, 255, 0.15);' : ''}">
              ${data.percentageSaved === 0 
                ? ((data.original && data.original.split(/\s+/).length < 20) ? 'Prompt Concise (0% Change)' : 'No Redundancy Triggered (0% Change)') 
                : (data.percentageSaved < 3 
                    ? `Minimal Edit (${data.percentageSaved}% Saved)` 
                    : `Saves ${data.percentageSaved}% Tokens`)}
            </div>
            <div class="tm-stats-badge-quality quality-${qualityScore >= 95 ? "safe" : (qualityScore >= 90 ? "moderate" : "heavy")}">
              ⚡ ${qualityScore}% Intent Preservation
            </div>
          </div>
        </div>

        <!-- Before / After Grid -->
        <div class="tm-diff-grid">
          <div class="tm-diff-pane">
            <div class="tm-pane-header">
              <span>${leftHeaderLabel}</span>
              <span class="tm-pane-stat">${data.originalTokens} tokens</span>
            </div>
            <div class="tm-pane-content tm-original-text" id="tmOriginalPane">${diff.oldHtml}</div>
          </div>
          
          <div class="tm-diff-pane tm-optimized-pane">
            <div class="tm-pane-header">
              <span>${rightHeaderLabel}</span>
              <div class="tm-toggle-group">
                <button class="tm-toggle-btn active" id="tmToggleDiff">Diff View</button>
                <button class="tm-toggle-btn" id="tmToggleEdit">Edit Raw</button>
              </div>
              <span class="tm-pane-stat glow-text">${data.optimizedTokens} tokens</span>
            </div>
            <div id="tmOptimizedWrapper" style="height: calc(100% - 32px); display: flex; flex-direction: column;">
              <div class="tm-pane-content tm-optimized-diff" id="tmOptimizedDiffPane">${diff.newHtml}</div>
              <textarea id="tmOptimizedInput" class="tm-pane-textarea" style="display: none;">${data.optimized}</textarea>
            </div>
          </div>
        </div>

        <!-- Savings summary card -->
        <div class="tm-savings-summary">
          <div class="tm-savings-icon">⚡</div>
          <div class="tm-savings-details">
            <span class="tm-savings-title">Optimization Complete!</span>
            <span class="tm-savings-desc">Saved <strong>${data.tokensSaved} tokens</strong> (${data.percentageSaved}% reduction) while preserving all context and commands.</span>
            ${rulesListHtml}
            ${contextChipsHtml}
          </div>
        </div>

        <!-- Modal Footer Actions -->
        <div class="tm-actions-footer">
          <button class="tm-btn tm-btn-secondary" id="tmDiscardBtn">Discard</button>
          <button class="tm-btn tm-btn-primary" id="tmApplyBtn">Apply & Squeeze</button>
        </div>
      </div>
    `;

    // Handle view toggle
    const toggleDiff = body.querySelector("#tmToggleDiff");
    const toggleEdit = body.querySelector("#tmToggleEdit");
    const originalPane = body.querySelector("#tmOriginalPane");
    const optimizedDiffPane = body.querySelector("#tmOptimizedDiffPane");
    const optimizedInput = body.querySelector("#tmOptimizedInput");

    toggleDiff.addEventListener("click", () => {
      toggleDiff.classList.add("active");
      toggleEdit.classList.remove("active");
      originalPane.innerHTML = diff.oldHtml;
      optimizedDiffPane.style.display = "block";
      optimizedInput.style.display = "none";
    });

    toggleEdit.addEventListener("click", () => {
      toggleEdit.classList.add("active");
      toggleDiff.classList.remove("active");
      originalPane.innerHTML = escapeHtml(data.original);
      optimizedDiffPane.style.display = "none";
      optimizedInput.style.display = "block";
      optimizedInput.focus();
    });

    // Handle Optimization Mode change inside modal (re-optimize!)
    const modeSelect = body.querySelector("#tmModeSelect");
    modeSelect.value = activeMode; // keep UI in sync
    
    modeSelect.addEventListener("change", () => {
      const newMode = modeSelect.value;
      activeMode = newMode;
      // Show loader again
      body.innerHTML = `
        <div class="tm-loading-state">
          <div class="tm-spinner"></div>
          <p>Re-optimizing prompt using ${newMode} mode...</p>
        </div>
      `;
      requestOptimization(data.original, newMode);
    });

    // Handle Discard click
    body.querySelector("#tmDiscardBtn").addEventListener("click", closeModal);

    // Handle Apply & Squeeze click
    body.querySelector("#tmApplyBtn").addEventListener("click", () => {
      const optimizedText = optimizedInput.value;
      lastOriginalPrompt = data.original;
      applyOptimizedText(optimizedText);
      if (undoButton) {
        undoButton.style.display = "inline-flex";
      }
      closeModal();
    });

    // Handle Strip Duplicates button click
    if (activeDuplicates && activeDuplicates.length > 0) {
      const stripBtn = body.querySelector("#tmStripDupsBtn");
      if (stripBtn) {
        stripBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          stripDuplicateBlocks();
        });
      }
    }
  }

  // Replace text in Claude and trigger react state update
  function applyOptimizedText(text) {
    if (activeTextarea) {
      setContentEditableText(activeTextarea, text);
      
      // Flash glowing green border on Claude's text area to visually indicate success
      const wrapper = activeTextarea.closest(".flex.flex-col") || activeTextarea.parentElement;
      if (wrapper) {
        wrapper.style.transition = "box-shadow 0.3s ease";
        wrapper.style.boxShadow = "0 0 15px rgba(5, 242, 158, 0.6)";
        setTimeout(() => {
          wrapper.style.boxShadow = "";
        }, 1200);
      }
    }
  }

  // Set contenteditable text with cursor and React state sync
  function setContentEditableText(el, text) {
    el.focus();
    try {
      // Use selection and execCommand to preserve react state and undo history
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Delete current text and insert new
      document.execCommand("delete", false, null);
      if (!document.execCommand("insertText", false, text)) {
        el.innerText = text;
      }
    } catch (e) {
      console.warn("execCommand failed, writing to innerText:", e);
      el.innerText = text;
    }
    
    // Dispatch events to satisfy React/Lexical/ProseMirror editors
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: text }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    
    // Re-focus
    setTimeout(() => el.focus(), 50);
  }

  // Render error message inside modal
  function renderError(errorMessage) {
    if (!modalContainer) return;
    
    // Stop logo animation when optimization fails
    const logoImg = modalContainer.querySelector(".tm-modal-logo img");
    if (logoImg) {
      logoImg.classList.remove("animating");
    }

    const body = modalContainer.querySelector(".tm-modal-body");
    body.innerHTML = `
      <div class="tm-error-state">
        <div class="tm-error-icon">⚠️</div>
        <h3>Optimization Failed</h3>
        <p class="tm-error-msg">${escapeHtml(errorMessage)}</p>
        <div class="tm-error-actions">
          <button class="tm-btn tm-btn-secondary" id="tmErrorCloseBtn">Close</button>
          <button class="tm-btn tm-btn-primary" id="tmConfigureBtn">Configure Rules</button>
        </div>
      </div>
    `;

    body.querySelector("#tmErrorCloseBtn").addEventListener("click", closeModal);
    body.querySelector("#tmConfigureBtn").addEventListener("click", () => {
      // Tell background/popup we want to configure settings or show instructions
      closeModal();
      alert("Please click the Squeeze Beta extension icon in your browser toolbar to configure your local optimization rules.");
    });
  }

  // Close modal
  function closeModal() {
    if (modalContainer) {
      modalContainer.classList.remove("open");
      currentPDFFile = null;
      // Delay cleaning content for transition
      setTimeout(() => {
        modalContainer.innerHTML = "";
      }, 300);
    }
  }

  // Real-Time Token Estimator
  function estimateTokens(text) {
    if (!text) return 0;
    const words = text.trim().split(/\s+/).length;
    const chars = text.length;
    const tokenEstChars = Math.ceil(chars / 4);
    const tokenEstWords = Math.ceil(words * 1.3);
    return Math.max(tokenEstChars, tokenEstWords);
  }

  // Scraping Claude's chat history messages to calculate current context size
  function calculateConversationTokens() {
    let totalText = "";

    // ── 1. User messages (the most reliable selectors on claude.ai) ──
    const userMsgSelectors = [
      '[data-testid="user-message"]',
      'div.font-user-message'
    ];
    const userBlocks = document.querySelectorAll(userMsgSelectors.join(', '));
    const seenUserBlocks = new Set();
    userBlocks.forEach(block => {
      // Deduplicate nested matches
      let parent = block.parentElement;
      let isNested = false;
      while (parent) {
        if (seenUserBlocks.has(parent)) { isNested = true; break; }
        parent = parent.parentElement;
      }
      if (isNested) return;
      seenUserBlocks.add(block);
      // Use innerText to capture rendered text (includes whitespace but not hidden elements)
      totalText += " " + (block.innerText || block.textContent || "");
    });

    // ── 2. Claude (assistant) messages — capture full content including code ──
    const claudeMsgSelectors = [
      '[data-testid="assistant-message"]',
      '[data-testid="bot-message"]',
      'div.font-claude-message'
    ];
    const claudeBlocks = document.querySelectorAll(claudeMsgSelectors.join(', '));
    const seenClaudeBlocks = new Set();
    claudeBlocks.forEach(block => {
      let parent = block.parentElement;
      let isNested = false;
      while (parent) {
        if (seenClaudeBlocks.has(parent)) { isNested = true; break; }
        parent = parent.parentElement;
      }
      if (isNested) return;
      seenClaudeBlocks.add(block);
      // Capture raw text including code blocks (pre elements)
      totalText += " " + (block.innerText || block.textContent || "");
    });

    // ── 3. Fallback: If neither selector matched (DOM changed), try .prose ──
    if (seenUserBlocks.size === 0 && seenClaudeBlocks.size === 0) {
      const fallbackBlocks = document.querySelectorAll('.prose, .font-sans.break-words');
      fallbackBlocks.forEach(block => {
        totalText += " " + (block.innerText || block.textContent || "");
      });
    }

    // ── 4. Add current input box content ──
    if (activeTextarea) {
      totalText += " " + (activeTextarea.innerText || activeTextarea.value || "");
    }

    // ── 5. System prompt overhead (Claude always has a hidden system prompt; est. ~2,000 tokens) ──
    const systemPromptOverhead = 2000;

    // ── 6. Attachment overhead (each file attachment in DOM costs tokens) ──
    let attachmentOverhead = 0;
    const attachmentEls = document.querySelectorAll('[data-testid*="attachment"], [aria-label*="attachment"], .file-attachment, [class*="file-preview"]');
    attachmentOverhead = attachmentEls.length * 500; // est. 500 tokens per attachment placeholder

    const promptTokens = estimateTokens(totalText);
    return promptTokens + systemPromptOverhead + attachmentOverhead;
  }

  let usageBar = null;

  function injectUsageBar() {
    const inputElement = document.querySelector('div[contenteditable="true"]');
    if (!inputElement) {
      if (usageBar) {
        usageBar.remove();
        usageBar = null;
      }
      return;
    }

    activeTextarea = inputElement;

    // Find the wrapper around the input box (fieldset or form or parent element)
    const wrapper = inputElement.closest('form') || inputElement.closest('fieldset') || inputElement.parentElement;
    if (!wrapper) return;

    if (!usageBar || !document.contains(usageBar)) {
      usageBar = document.createElement("div");
      usageBar.className = "squeeze-usage-bar";
      // Insert after the input wrapper card to place it directly below it
      wrapper.parentNode.insertBefore(usageBar, wrapper.nextSibling);
    }

    updateUsageBar();
  }

  let cachedQuota = null;
  let lastQuotaFetch = 0;

  async function fetchClaudeQuota() {
    const now = Date.now();
    // Cache for 30 seconds to prevent rate-limiting (429 errors)
    if (cachedQuota && (now - lastQuotaFetch < 30000)) {
      return cachedQuota;
    }

    try {
      const orgsRes = await fetch("/api/organizations");
      if (!orgsRes.ok) return null;
      const orgs = await orgsRes.json();
      if (!orgs || orgs.length === 0) return null;
      
      const orgId = orgs[0].uuid;
      const usageRes = await fetch(`/api/organizations/${orgId}/usage`);
      if (!usageRes.ok) return null;
      const usage = await usageRes.json();
      
      cachedQuota = usage;
      lastQuotaFetch = now;
      return usage;
    } catch (e) {
      // Fail silently without console.warn/error to prevent noisy Chrome extension dashboard errors
      return null;
    }
  }

  // Heuristic Code & Goal Extractor for Thread Context Summarization
  // Synthesis-first approach: extracts Goals, Decisions, Bugs, Next Steps, Code State
  function generateHeuristicSummary() {
    const userSelectors = ['[data-testid="user-message"]', 'div.font-user-message'];
    const claudeSelectors = ['[data-testid="assistant-message"]', '[data-testid="bot-message"]', 'div.font-claude-message'];

    // ── Parse all turns ──
    const turns = [];

    const allBlocks = document.querySelectorAll([...userSelectors, ...claudeSelectors].join(', '));
    const seenBlocks = new Set();

    allBlocks.forEach(block => {
      // Dedup nested
      let parent = block.parentElement;
      let nested = false;
      while (parent) {
        if (seenBlocks.has(parent)) { nested = true; break; }
        parent = parent.parentElement;
      }
      if (nested) return;
      seenBlocks.add(block);

      const isUser = !!(block.closest('[data-testid="user-message"]') ||
                        block.classList.contains('font-user-message') ||
                        block.getAttribute('data-testid') === 'user-message');

      // Text without code blocks
      const tempBlock = block.cloneNode(true);
      tempBlock.querySelectorAll('pre').forEach(pre => pre.remove());
      const rawText = (tempBlock.innerText || tempBlock.textContent || "").trim();

      // Code blocks
      const codeBlocks = [];
      block.querySelectorAll('pre').forEach(pre => {
        const codeEl = pre.querySelector('code');
        if (codeEl) {
          let language = "code";
          codeEl.classList.forEach(cls => {
            if (cls.startsWith('language-')) language = cls.replace('language-', '');
          });
          let codeText = (codeEl.innerText || "").trim();
          if (codeText.length > 3000) {
            // Truncate at last newline before limit
            const cutIdx = codeText.lastIndexOf('\n', 3000);
            codeText = codeText.substring(0, cutIdx > 0 ? cutIdx : 3000) +
              "\n// ... [truncated by Squeeze]";
          }
          codeBlocks.push({ language, code: codeText });
        }
      });

      if (rawText || codeBlocks.length > 0) {
        turns.push({ sender: isUser ? 'user' : 'claude', text: rawText, codeBlocks });
      }
    });

    if (turns.length === 0) {
      return "No conversation found to summarize.";
    }

    // ── Helper: clip text at sentence boundary ──
    function clipAtSentence(text, maxLen) {
      if (text.length <= maxLen) return text;
      // Try to cut at last sentence boundary (. ! ?) before maxLen
      const clip = text.substring(0, maxLen);
      const lastSentEnd = Math.max(clip.lastIndexOf('. '), clip.lastIndexOf('! '), clip.lastIndexOf('? '), clip.lastIndexOf('\n'));
      return lastSentEnd > maxLen * 0.6
        ? text.substring(0, lastSentEnd + 1).trim() + " ..."
        : clip.trim() + " ...";
    }

    // ── 1. Goal extraction: first 2 user turns ──
    const firstUserTurns = turns.filter(t => t.sender === 'user').slice(0, 2);
    let goalsText = firstUserTurns.map(t => clipAtSentence(t.text, 300)).join('\n');

    // ── 2. Decisions & Findings: Claude turns with result language ──
    const decisionKeywords = /\b(?:fixed|resolved|implemented|added|updated|changed|the fix|the solution|confirmed|verified|we decided|the approach|completed)\b/i;
    const decisionTurns = turns.filter(t => t.sender === 'claude' && decisionKeywords.test(t.text));
    const recentDecisions = decisionTurns.slice(-3); // last 3 findings

    // ── 3. Bug / Issue extraction from Claude turns ──
    const bugKeywords = /\b(?:bug|error|issue|problem|fail|broken|crash|incorrect|mismatch|not working|regression)\b/i;
    const bugLines = [];
    turns.forEach(t => {
      if (t.sender === 'claude') {
        t.text.split(/\n/).forEach(line => {
          if (bugKeywords.test(line) && line.trim().length > 15) {
            bugLines.push(line.trim());
          }
        });
      }
    });
    const uniqueBugLines = [...new Set(bugLines)].slice(0, 5);

    // ── 4. Next Steps: last Claude turn action items ──
    const lastClaudeTurn = [...turns].reverse().find(t => t.sender === 'claude');
    let nextStepsText = "";
    if (lastClaudeTurn) {
      // Look for numbered/bulleted list items or lines starting with action verbs
      const actionLines = lastClaudeTurn.text.split(/\n/).filter(line => {
        return /^\s*(?:\d+\.|[-*•]|Next|Now|Then|Finally|To |You can|Run|Reload|Check|Fix|Update)\s/i.test(line) && line.trim().length > 10;
      });
      if (actionLines.length > 0) {
        nextStepsText = actionLines.slice(0, 5).join('\n');
      } else {
        nextStepsText = clipAtSentence(lastClaudeTurn.text, 350);
      }
    }

    // ── 5. Latest code state ──
    const latestCodeByLanguage = {};
    turns.forEach(t => {
      t.codeBlocks.forEach(cb => {
        latestCodeByLanguage[cb.language] = cb.code;
      });
    });

    // ── Build output ──
    let summary = `## Context Transfer Summary (Generated by Squeeze)\n\n`;
    summary += `> This summary was synthesized from ${turns.length} turns of conversation to preserve key decisions, findings, and next steps — not just recent messages.\n\n`;

    if (goalsText) {
      summary += `### 🎯 Original Goals\n${goalsText}\n\n`;
    }

    if (recentDecisions.length > 0) {
      summary += `### ✅ Decisions & Findings\n`;
      recentDecisions.forEach(t => {
        summary += `- ${clipAtSentence(t.text, 250)}\n`;
      });
      summary += '\n';
    }

    if (uniqueBugLines.length > 0) {
      summary += `### 🐛 Bugs / Issues Identified\n`;
      uniqueBugLines.forEach(line => {
        summary += `- ${clipAtSentence(line, 150)}\n`;
      });
      summary += '\n';
    }

    if (nextStepsText) {
      summary += `### ⏭️ Last Known Next Steps\n${nextStepsText}\n\n`;
    }

    if (Object.keys(latestCodeByLanguage).length > 0) {
      summary += `### 💻 Current Code State\n`;
      for (const [lang, code] of Object.entries(latestCodeByLanguage)) {
        summary += `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
      }
    }

    summary += `*Paste this into a new chat to continue with full context. Generated by Squeeze Context Summarizer.*`;

    // Hard cap at 8,000 chars — always clip at sentence boundary
    if (summary.length > 8000) {
      summary = clipAtSentence(summary, 7900) +
        "\n\n... [Summary clipped to 2,000 token budget by Squeeze]\n\n*Paste this into a new chat to continue with full context.*";
    }

    return summary;
  }

  function injectSummaryPrompt() {
    if (activeTextarea) {
      const prompt = "Please write a highly condensed summary of our project goals, constraints, and the latest working code we have developed. Format it as a single, copyable markdown prompt that I can paste into a fresh chat to continue our work with zero lost context. Keep it extremely token-efficient.";
      setContentEditableText(activeTextarea, prompt);
      showFloatingTooltip(activeTextarea, "Prompt injected! Asking Claude costs 1 context read here but lets you copy the result to a new chat to save 70%+ on all future turns.");
    } else {
      alert("Please focus Claude's input field first.");
    }
  }

  function copyHeuristicSummaryAndRedirect() {
    try {
      const summaryText = generateHeuristicSummary();
      navigator.clipboard.writeText(summaryText)
        .then(() => {
          showFloatingTooltip(document.querySelector("#tmHeuristicSummaryBtn") || activeTextarea, "Copied local summary! Opening fresh chat...");
          setTimeout(() => {
            window.location.href = "https://claude.ai/new";
          }, 1500);
        })
        .catch(err => {
          console.error("Clipboard copy failed:", err);
          alert("Failed to copy summary to clipboard automatically. Please try again.");
        });
    } catch (e) {
      console.error("Failed to generate summary:", e);
      alert("Error generating summary context: " + e.message);
    }
  }

  // PDF Parsing and Extraction Handler
  async function handlePDFUpload(file) {
    if (!modalContainer) createModalContainer();
    
    currentPDFFile = file;
    
    // Open modal in loading/extracting state
    const logoUrl = safeGetURL("icons/icon48.png");
    modalContainer.innerHTML = `
      <div class="squeeze-modal-card">
        <div class="tm-modal-header">
          <div class="tm-modal-logo">
            <img src="${logoUrl}" class="animating" width="22" height="22" alt="Squeeze Icon" style="vertical-align: middle;">
            <span>Squeeze <span class="highlight">Optimizer</span></span>
          </div>
          <button class="tm-close-btn">&times;</button>
        </div>
        
        <div class="tm-modal-body">
          <div class="tm-loading-state">
            <div class="tm-spinner"></div>
            <p id="tmPDFStatusText">Extracting text from PDF file...</p>
            <span class="tm-loading-subtext" id="tmPDFSubtext">Initializing PDF.js parser...</span>
          </div>
        </div>
      </div>
    `;
    
    modalContainer.classList.add("open");
    modalContainer.querySelector(".tm-close-btn").addEventListener("click", closeModal);
    
    const statusText = modalContainer.querySelector("#tmPDFStatusText");
    const subtext = modalContainer.querySelector("#tmPDFSubtext");
    
    try {
      if (typeof pdfjsLib === "undefined") {
        throw new Error("PDF.js library failed to load in page context.");
      }
      
      pdfjsLib.GlobalWorkerOptions.workerSrc = safeGetURL('pdf.worker.min.js');
      
      subtext.innerText = "Reading file data...";
      const arrayBuffer = await file.arrayBuffer();
      
      subtext.innerText = "Loading document structure...";
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      const numPages = pdf.numPages;
      const pageLinesList = [];
      const lineFrequency = {};
      
      function normalizeLine(line) {
        if (/https?:\/\/|www\./i.test(line)) return line;
        return line
          .replace(/\bpage\s+\d+(\s+of\s+\d+)?\b/gi, 'PAGE_NUM')  // "Page 3 of 40" -> placeholder
          .replace(/\b\d+\b/g, 'NUM')                              // any other lone numbers
          .trim();
      }
      
      for (let i = 1; i <= numPages; i++) {
        statusText.innerText = `Extracting text from PDF (Page ${i} of ${numPages})...`;
        subtext.innerText = `Parsing layout objects...`;
        
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const items = textContent.items;
        const linesMap = {};
        
        items.forEach(item => {
          if (!item.str || item.str.trim() === '') return;
          // Group items within 2px vertical window
          const y = Math.round(item.transform[5] / 2) * 2;
          if (!linesMap[y]) {
            linesMap[y] = [];
          }
          linesMap[y].push(item);
        });
        
        const sortedY = Object.keys(linesMap).map(Number).sort((a, b) => b - a);
        const pageLines = [];
        
        sortedY.forEach(y => {
          const rowItems = linesMap[y].sort((a, b) => a.transform[4] - b.transform[4]);
          const lineText = rowItems.map(item => item.str).join(' ').trim();
          if (lineText) {
            pageLines.push(lineText);
            const normalized = normalizeLine(lineText);
            lineFrequency[normalized] = (lineFrequency[normalized] || 0) + 1;
          }
        });
        
        pageLinesList.push(pageLines);
      }
      
      // Identify repeated lines (Headers/Footers appearing on > 50% of pages)
      const repeatedNormalized = new Set();
      if (numPages > 1) {
        for (const [normText, count] of Object.entries(lineFrequency)) {
          if (count > numPages * 0.5) {
            repeatedNormalized.add(normText);
          }
        }
      }
      
      // Build cleaned pages
      let extractedPagesText = [];
      let pageNumbersRemoved = 0;
      
      pageLinesList.forEach((pageLines) => {
        const cleanedLines = pageLines.filter(line => !repeatedNormalized.has(normalizeLine(line)));
        
        const finalLines = cleanedLines.filter(line => {
          const isPageNumber = /^\s*(?:page\s+)?\d+(?:\s+of\s+\d+)?\s*$/i.test(line);
          if (isPageNumber) {
            pageNumbersRemoved++;
            return false;
          }
          return true;
        });
        
        extractedPagesText.push(finalLines.join('\n'));
      });
      
      let rawExtractedText = extractedPagesText.join('\n\n').trim();
      const rawPDFTokens = estimateTokens(rawExtractedText);
      
      // Check for scanned / empty PDF
      if (rawExtractedText.length < 20) {
        throw new Error("SCANNED_PDF_DETECTED");
      }
      
      // Apply cleanups (whitespace collapse, trim paragraphs)
      let cleanedText = rawExtractedText.split('\n')
        .map(line => line.trim())
        .join('\n');
        
      cleanedText = cleanedText.replace(/[^\S\r\n]+/g, ' ');
      cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim();
      
      statusText.innerText = "Squeezing extracted content...";
      subtext.innerText = "Applying local prompt optimization...";
      
      // Run the standard optimization pass
      currentOriginalPrompt = cleanedText;
      currentPromptText = cleanedText;
      activeDuplicates = checkCrossMessageDuplicates(cleanedText);
      
      requestOptimization(cleanedText, activeMode, rawPDFTokens);
    } catch (err) {
      console.error("PDF extraction error:", err);
      let errMsg = "Failed to parse PDF document.";
      if (err.message === "SCANNED_PDF_DETECTED") {
        errMsg = "This PDF appears to be a scanned image or contains no extractable text. Squeeze cannot extract text from images.";
      } else {
        errMsg = "Error parsing PDF: " + err.message;
      }
      
      const body = modalContainer.querySelector(".tm-modal-body");
      body.innerHTML = `
        <div class="tm-dup-warning-banner" style="background: rgba(255, 59, 48, 0.08); border: 1px solid rgba(255, 59, 48, 0.25); padding: 20px; border-radius: 12px; margin: 10px 0; text-align: center; box-sizing: border-box; width: 100%;">
          <div style="font-size: 1.8rem; margin-bottom: 10px;">⚠️</div>
          <div style="font-size: 0.85rem; color: #ff5e84; line-height: 1.5; font-weight: 600; margin-bottom: 15px;">
            ${errMsg}
          </div>
          <button class="tm-btn" id="tmPDFErrorCloseBtn" style="padding: 6px 16px; font-size: 0.78rem; border: 1px solid rgba(255, 94, 132, 0.4); border-radius: 6px; color: #ff5e84; background: rgba(255, 59, 48, 0.04); cursor: pointer; font-weight: 600;">Close</button>
        </div>
      `;
      body.querySelector("#tmPDFErrorCloseBtn").addEventListener("click", closeModal);
    }
  }

  // Get all previous user messages from the DOM
  function getPreviousUserMessages() {
    const userMsgElems = document.querySelectorAll('[data-testid="user-message"], div.font-user-message');
    const messages = [];
    userMsgElems.forEach(el => {
      messages.push(el.innerText.trim());
    });
    return messages;
  }

  // Cross-message duplication analyzer
  function checkCrossMessageDuplicates(newPrompt) {
    const prevMessages = getPreviousUserMessages();
    if (prevMessages.length === 0) return [];

    const duplicates = [];
    
    // 1. Extract code blocks
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;
    const blocksToCheck = [];
    
    while ((match = codeBlockRegex.exec(newPrompt)) !== null) {
      const codeBlock = match[0];
      if (codeBlock.length > 100) {
        const innerCode = codeBlock.replace(/^```\w*\n|```$/g, "").trim();
        blocksToCheck.push({ original: codeBlock, content: innerCode, type: "code block" });
      }
    }
    
    // 2. Extract large paragraphs
    const promptWithoutCode = newPrompt.replace(codeBlockRegex, "");
    const paragraphs = promptWithoutCode.split(/\n\s*\n+/);
    paragraphs.forEach(p => {
      const trimmed = p.trim();
      if (trimmed.length > 150) {
        blocksToCheck.push({ original: p, content: trimmed, type: "text paragraph" });
      }
    });

    // 3. Check for duplicates in chat history
    blocksToCheck.forEach(block => {
      const normalizedContent = block.content.toLowerCase().replace(/\s+/g, " ");
      
      for (const prevMsg of prevMessages) {
        const normalizedPrev = prevMsg.toLowerCase().replace(/\s+/g, " ");
        if (normalizedPrev.includes(normalizedContent)) {
          duplicates.push(block);
          break;
        }
      }
    });
    
    return duplicates;
  }

  // Strip matched duplicates and re-run optimization
  function stripDuplicateBlocks() {
    let strippedPrompt = currentOriginalPrompt;
    activeDuplicates.forEach(dup => {
      strippedPrompt = strippedPrompt.replace(dup.original, "");
    });
    
    strippedPrompt = strippedPrompt.replace(/\n\s*\n+/g, "\n\n").trim();
    
    // Reset state
    activeDuplicates = [];
    currentOriginalPrompt = strippedPrompt;
    currentPromptText = strippedPrompt;
    
    showFloatingTooltip(modalContainer.querySelector("#tmStripDupsBtn") || modalContainer, "Duplicate blocks stripped!");
    requestOptimization(strippedPrompt, activeMode);
  }

  async function updateUsageBar() {
    if (!usageBar) return;

    const platform = detectPlatform();
    let localLimit = 200000;
    let limitLabel = "200K tokens";
    let modelName = "Claude";
    if (platform === "gemini") {
      localLimit = 1000000;
      limitLabel = "1M tokens";
      modelName = "Gemini";
    } else if (platform === "chatgpt") {
      localLimit = 128000;
      limitLabel = "128K tokens";
      modelName = "ChatGPT";
    }

    // 1. Calculate local conversation tokens
    const conversationTokens = calculateConversationTokens();
    const localPercentage = Math.min(100, Math.max(0, Math.round((conversationTokens / localLimit) * 100)));
    const localStatus = getStatusClass(conversationTokens);
    const localStatusLabel = getStatusLabel(conversationTokens);

    // 2. Fetch or format platform subscription quota
    let quotaHtml = "";
    let quotaPercentage = 0;
    let quotaStatus = "safe";

    if (platform === "claude") {
      const quota = await fetchClaudeQuota();
      if (quota && quota.five_hour) {
        const utilization = quota.five_hour.utilization || 0;
        const maxTokens = 375000; // Standard estimated Claude Pro Cap
        const usedTokens = Math.round((utilization / 100) * maxTokens);
        quotaPercentage = utilization;
        quotaStatus = getPercentStatusClass(quotaPercentage);
        
        // Calculate countdown timer
        let resetString = "Resetting soon";
        if (quota.five_hour.resets_at) {
          const resetTime = new Date(quota.five_hour.resets_at);
          const diffMs = resetTime - Date.now();
          if (diffMs > 0) {
            const diffHrs = Math.floor(diffMs / 3600000);
            const diffMins = Math.round((diffMs % 3600000) / 60000);
            resetString = `Reset in: ${diffHrs}h ${diffMins}m`;
          }
        }

        quotaHtml = `
          <div class="tm-quota-column">
            <span class="tm-usage-dot dot-${getStatusClass(usedTokens * 2.5)}"></span>
            <span class="tm-quota-title">5-Hour Quota:</span>
            <span class="tm-quota-val">${usedTokens.toLocaleString()}</span>
            <span class="tm-quota-divider">/</span>
            <span class="tm-quota-limit">${maxTokens.toLocaleString()} tokens</span>
            <span class="tm-quota-percent">(${utilization}%)</span>
            <span class="tm-quota-reset">${resetString}</span>
          </div>
        `;
      } else {
        quotaHtml = `
          <div class="tm-quota-column">
            <span class="tm-quota-loading">Claude Quota Active</span>
          </div>
        `;
      }
    } else if (platform === "gemini") {
      quotaPercentage = localPercentage;
      quotaStatus = localStatus;
      quotaHtml = `
        <div class="tm-quota-column">
          <span class="tm-usage-dot dot-safe"></span>
          <span class="tm-quota-title">Host Model:</span>
          <span class="tm-quota-val" style="color: #4285f4; font-weight: 600;">Gemini 1.5 Pro / Flash</span>
          <span class="tm-quota-divider">|</span>
          <span class="tm-quota-limit" style="color: #ffb700;">1M Max Window</span>
        </div>
      `;
    } else if (platform === "chatgpt") {
      quotaPercentage = localPercentage;
      quotaStatus = localStatus;
      quotaHtml = `
        <div class="tm-quota-column">
          <span class="tm-usage-dot dot-safe"></span>
          <span class="tm-quota-title">Host Model:</span>
          <span class="tm-quota-val" style="color: #10a37f; font-weight: 600;">GPT-4o / ChatGPT</span>
          <span class="tm-quota-divider">|</span>
          <span class="tm-quota-limit" style="color: #ffb700;">128K Max Window</span>
        </div>
      `;
    }

    let nudgeHtml = "";
    if (conversationTokens > 30000) {
      nudgeHtml = `
        <div class="tm-summary-nudge">
          <span class="tm-nudge-icon">⚡</span>
          <span class="tm-nudge-text">High Context depth (${conversationTokens.toLocaleString()} tokens). Starting a new chat will cut latency and costs by 70%+!</span>
          <div class="tm-nudge-actions">
            <button class="tm-nudge-btn" id="tmPromptSummaryBtn" title="Injects a summarization prompt. Costs 1 context read here but saves on all future responses.">Ask AI to Summarize</button>
            <button class="tm-nudge-btn tm-btn-gold" id="tmHeuristicSummaryBtn">Copy Local Summary & New Chat</button>
          </div>
          <div class="tm-nudge-note" style="font-size: 0.65rem; color: rgba(255, 255, 255, 0.4); margin-top: 5px; line-height: 1.3; text-align: center; width: 100%;">
            * Note: Asking AI costs 1 context read in this thread but allows copying a custom summary into a fresh chat.
          </div>
        </div>
      `;
    }

    usageBar.innerHTML = `
      <div class="tm-usage-bar-content">
        <div class="tm-usage-columns">
          <div class="tm-context-column">
            <span class="tm-usage-dot dot-${localStatus}"></span>
            <span class="tm-usage-title">Conversation Context:</span>
            <span class="tm-usage-val">${conversationTokens.toLocaleString()}</span>
            <span class="tm-usage-divider">/</span>
            <span class="tm-usage-limit">${limitLabel}</span>
            <span class="tm-usage-percent">(${localPercentage}%)</span>
            <span class="tm-usage-status-inline status-${localStatus}">${localStatusLabel}</span>
          </div>
          ${quotaHtml}
        </div>
        <div class="tm-progress-bars-container" style="display: flex; flex-direction: column; gap: 4px; width: 100%; margin-top: 4px;">
          <div class="tm-usage-progress-track" title="Conversation Context: ${localPercentage}% used">
            <div class="tm-usage-progress-bar progress-${localStatus}" style="width: ${localPercentage}%"></div>
          </div>
          <div class="tm-usage-progress-track" title="Host Model Quota: ${quotaPercentage}% used">
            <div class="tm-usage-progress-bar progress-${quotaStatus}" style="width: ${quotaPercentage}%"></div>
          </div>
        </div>
        ${nudgeHtml}
      </div>
    `;

    if (conversationTokens > 30000) {
      const askBtn = usageBar.querySelector("#tmPromptSummaryBtn");
      const localBtn = usageBar.querySelector("#tmHeuristicSummaryBtn");
      
      if (askBtn) {
        askBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          injectSummaryPrompt();
        });
      }
      
      if (localBtn) {
        localBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          copyHeuristicSummaryAndRedirect();
        });
      }
    }
  }

  function getPercentStatusClass(percent) {
    if (percent < 25) return "safe";
    if (percent < 60) return "moderate";
    if (percent < 85) return "heavy";
    return "critical";
  }

  function getStatusClass(tokens) {
    if (tokens < 40000) return "safe";
    if (tokens < 100000) return "moderate";
    if (tokens < 160000) return "heavy";
    return "critical";
  }

  // Formatting utility inside calculations
  function getStatusLabel(tokens) {
    if (tokens < 40000) return "Safe Context";
    if (tokens < 100000) return "Moderate Context";
    if (tokens < 160000) return "Heavy Context";
    return "Critical Context (Start New Chat)";
  }

  // Simple HTML escaper
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Item 4 - Isolated Duplicate Context Test Harness (QA Debug Tool)
  window.SqueezeTestDuplicateStripper = function(promptText, mockHistoryMessages) {
    const historyArray = Array.isArray(mockHistoryMessages) ? mockHistoryMessages : [mockHistoryMessages];
    console.log("=== SQUEEZE DUPLICATE STRIPPER TEST HARNESS ===");
    console.log("Input Prompt:", promptText);
    console.log("Mock History Messages:", historyArray);

    const duplicates = [];
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;
    const blocksToCheck = [];
    
    while ((match = codeBlockRegex.exec(promptText)) !== null) {
      const codeBlock = match[0];
      const innerCode = codeBlock.replace(/^```\w*\n|```$/g, "").trim();
      blocksToCheck.push({ original: codeBlock, content: innerCode, type: "code block" });
    }
    
    const promptWithoutCode = promptText.replace(codeBlockRegex, "");
    const paragraphs = promptWithoutCode.split(/\n\s*\n+/);
    paragraphs.forEach(p => {
      const trimmed = p.trim();
      if (trimmed.length > 20) {
        blocksToCheck.push({ original: p, content: trimmed, type: "text paragraph" });
      }
    });

    blocksToCheck.forEach(block => {
      const normContent = block.content.toLowerCase().replace(/\s+/g, " ");
      for (const msg of historyArray) {
        const normMsg = msg.toLowerCase().replace(/\s+/g, " ");
        if (normMsg.includes(normContent)) {
          duplicates.push(block);
          break;
        }
      }
    });

    console.log("Duplicates Found:", duplicates);
    let stripped = promptText;
    duplicates.forEach(d => {
      stripped = stripped.replace(d.original, "");
    });
    stripped = stripped.replace(/\n\s*\n+/g, "\n\n").trim();
    console.log("Stripped Result:", stripped);
    console.log("===============================================");
    return { duplicatesFound: duplicates.length, original: promptText, stripped: stripped };
  };

  // Start content script execution
  init();
})();
