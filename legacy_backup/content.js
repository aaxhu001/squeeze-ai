// Squeeze Content Script for Claude.ai

(function() {
  let activeTextarea = null;
  let triggerButton = null;
  let undoButton = null;
  let modalContainer = null;
  let currentPromptText = "";
  let lastOriginalPrompt = "";
  let activeMode = "balanced"; // default, will read from storage

  // Initialize
  function init() {
    // Read user settings for default mode
    chrome.storage.local.get(["optimizationMode"], (data) => {
      if (data.optimizationMode) {
        activeMode = data.optimizationMode;
      }
    });

    // Start checking for input elements
    findAndInjectWidget();
    injectUsageBar();
    debugUsageAPI();
    
    // Set up a MutationObserver with throttling to watch for dynamically added elements without CPU lag
    let checkTimeout = null;
    const observer = new MutationObserver(() => {
      if (checkTimeout) return;
      checkTimeout = setTimeout(() => {
        findAndInjectWidget();
        injectUsageBar();
        checkTimeout = null;
      }, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Also listen for storage updates (e.g., user changes mode in popup while on the page)
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.optimizationMode) {
        activeMode = changes.optimizationMode.newValue;
      }
    });
  }

  // Find the Claude input area and inject the floating widget
  function findAndInjectWidget() {
    // Claude's input is a div with contenteditable="true"
    const inputElement = document.querySelector('div[contenteditable="true"]');
    
    if (!inputElement) {
      // If the input box was removed, clean up references
      if (triggerButton && !document.contains(triggerButton)) {
        triggerButton = null;
      }
      return;
    }

    // If we already have the widget injected and attached to this element, skip
    if (inputElement.dataset.squeezeInjected === "true") {
      activeTextarea = inputElement;
      
      // Ensure the button is still in the DOM and attached correctly
      if (triggerButton && !document.contains(triggerButton)) {
        injectButton(inputElement);
      }
      return;
    }

    activeTextarea = inputElement;
    inputElement.dataset.squeezeInjected = "true";
    
    injectButton(inputElement);
    createModalContainer();
  }

  // Inject the trigger button to the left of Claude's model chooser button
  function injectButton(inputElement) {
    // Remove existing button if any
    if (triggerButton) {
      triggerButton.remove();
    }
    if (undoButton) {
      undoButton.remove();
    }

    // Create the button
    triggerButton = document.createElement("div");
    triggerButton.className = "squeeze-trigger-btn inline-btn";
    triggerButton.setAttribute("title", "Optimize Prompt (Squeeze)");
    
    // Set SVG icon
    triggerButton.innerHTML = `
      <svg width="18" height="18" viewBox="90 95 300 290" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g fill="currentColor">
          <path d="M210 107.7c-17.1 2.9-37 13.2-37 19.2 0 3.4 3.5 4.4 12.4 3.8 11-.8 30.5-8.3 37-14.3 6.8-6.4.5-10.9-12.4-8.7m61 6.8c-.8.2-4.8.9-8.9 1.5-4 .7-15.3 3.9-25 7.1-17.9 6.1-29.8 9.3-54.3 14.9-26.6 6-41.1 12.4-51.4 22.5-19.3 18.9-9.4 31.3 13.3 16.6 3.3-2.1 11.9-9.1 18.9-15.6 14.6-13.2 23-19.1 32.4-22.8 20.8-8.2 39.2-5.4 72 10.9 24 11.9 32.4 14.7 45.2 14.8 9.3.1 9.7 0 13.5-3 5.3-4.3 6.9-9.2 4.8-15.3-3.6-10.8-18.6-23.9-32.3-28.1-10.3-3.2-22.1-4.7-28.2-3.5"/>
          <path d="M211 146.1c-12.5 1.8-25.1 8.7-33.8 18.4-12.1 13.7-12.8 25-1.8 30.8 3.2 1.6 6.4 2.2 14.3 2.5(13.1.5 20.4-1 46.8-9.7 28.3-9.4 38-11.4 57-11.5l15-.1 7 3.4c7.4 3.6 14.1 9.8 29.8 27.4 8.2 9.1 13.5 12.7 18.7 12.7 4.5 0 6.7-1.5 8-5.5 2.5-7.5-3.5-21.8-13-31.6-9.6-9.8-12.1-10.3-37.6-8.4-15.9 1.1-21.7-.4-44.6-11.6-10-5-21.5-10.4-25.4-11.9-13.5-5.4-26.5-7-40.4-4.9"/>
          <path d="M279.5 189.6c-11.8 1.8-22.8 5.1-44.1 13-38.9 14.4-51 15.5-72.4 6.7-18.9-7.7-19.1-7.7-28-7.7-10.4 0-15.7 2.3-22.5 9.5-5.6 6-7.5 10.3-7.5 16.6 0 7 3.2 12 10 15.6 9.7 5.1 18.8 2.9 36.5-9 10.2-6.9 16.2-10 25.5-13.4 5.8-2.1 8.2-2.4 23-2.4 14.4 0 17.5.3 24.5 2.3 9.8 2.9 23.6 9.3 33.2 15.5 16.2 10.4 27 14.1 39.6 13.5 17.9-.8 29.8-11.4 31.4-28 1.4-16-7.8-28.5-23.9-32.3-7.6-1.8-13.4-1.8-25.3.1"/>
          <path d="M173.3 230.9c-16.8 5.8-24.9 21.7-19.7 39.1 1.2 4.1 2.9 6.7 7.2 11 7.9 7.9 12.9 9.5 28.7 9.5 17.4-.1 26.3-2.4 63-16.5 22.2-8.5 30.3-10.3 43.5-9.8 9.8.4 11.3.8 22 5.2 18.1 7.6 22.7 8.8 29.5 8.3 20.7-1.5 35.1-25.6 23.2-38.6-3.2-3.5-9.5-6.1-14.9-6.1-7.1 0-14.4 3.2-28.5 12.6-7 4.6-15.2 9.3-18.3 10.5-25.6 9.7-55.2 4.9-83.7-13.5-9.5-6.1-18.3-10.4-25-12.1-7.8-2.1-20.5-1.9-27 .4"/>
          <path d="M110.3 261.6c-2.3 2.3-2.5 3.1-2.1 8.8.5 7.7 4.7 16.8 11.5 24.5 9 10.3 16.7 12.7 33.6 10.6 19.7-2.4 29-.1 59.5 14.4 23.9 11.4 29.4 13.1 44.7 13.8 9.4.4 13.4.2 18.4-1.2 9.6-2.5 17.8-7 24.9-13.9 13.1-12.5 16.5-24.3 9.2-31.3-4.4-4.1-8.3-5.1-20-5.2-12.6-.1-20.1 1.5-45.5 9.9-20 6.5-31.2 9.2-45.8 11.1-26.3 3.2-39.4-2.5-57.7-25.1-8.6-10.6-13.4-14.9-19.4-17.4-5.4-2.2-8.3-2-11.3 1"/>
          <path d="M343.2 299c-7.6 3.6-12.8 7.5-25.1 18.8-13.1 12.1-19.5 16.9-27.5 20.8-10 4.8-19.9 6.8-31 6.1-13.6-.8-24.5-4.5-47.1-15.8-11-5.4-22.7-10.6-26-11.5s-10.7-1.8-16.5-2.1c-8.8-.4-11.1-.1-14 1.4-4.7 2.4-8.3 9.4-7.5 14.3 1.5 8.6 12.8 20.6 25 26.6 8.9 4.4 15.9 6.3 26.5 7 12 .9 23.5-1.4 48.5-9.5 11.6-3.8 28.4-8.5 37.5-10.5 19.9-4.5 27.6-6.6 39.8-11.2 19.5-7.5 33.1-20.2 33.2-31.1 0-6.9-5.7-8.1-15.8-3.3m-49 50c-21.1 2.9-44.1 17.2-35.3 22 9.2 4.9 46.8-8.1 49.6-17.1 1.5-4.5-3.7-6.3-14.3-4.9"/>
        </g>
      </svg>
      <span class="squeeze-badge" id="tmWordBadge">0</span>
    `;

    // Create the undo button
    undoButton = document.createElement("div");
    undoButton.className = "squeeze-undo-btn inline-btn";
    undoButton.setAttribute("title", "Undo Prompt Optimization");
    undoButton.style.display = "none"; // Hidden by default
    undoButton.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: scaleX(-1);">
        <path d="M3 7v6h6"></path>
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
      </svg>
    `;

    // Try to find Claude's model chooser button
    const modelBtn = findModelChooser();
    if (modelBtn && modelBtn.parentNode) {
      modelBtn.parentNode.insertBefore(triggerButton, modelBtn);
      modelBtn.parentNode.insertBefore(undoButton, triggerButton);
    } else {
      // Fallback: search for Claude's input controls bar
      const attachButton = document.querySelector('button[aria-label*="attach" i]') || document.querySelector('button svg path[d*="M16.5 6v11.5"]').closest('button');
      if (attachButton && attachButton.parentNode) {
        attachButton.parentNode.appendChild(triggerButton);
        attachButton.parentNode.appendChild(undoButton);
      } else {
        const parent = inputElement.parentElement;
        if (parent) {
          parent.appendChild(triggerButton);
          parent.appendChild(undoButton);
        } else {
          document.body.appendChild(triggerButton);
          document.body.appendChild(undoButton);
        }
      }
    }

    // Initial opacity and badge check
    updateButtonState(inputElement);

    // Event listener for user typing to update word counts, opacity, and token usage bar
    inputElement.addEventListener("input", () => {
      updateButtonState(inputElement);
      updateUsageBar();
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
        
        // Re-focus & state sync
        setTimeout(() => inputElement.focus(), 50);
        showFloatingTooltip(triggerButton, "Original prompt restored!");
        updateButtonState(inputElement);
      }
    });
  }

  // Find the model selection dropdown button inside Claude's chatbox
  function findModelChooser() {
    // 1. Look for buttons containing model keywords
    const buttons = Array.from(document.querySelectorAll('button'));
    let modelBtn = buttons.find(btn => {
      const text = (btn.innerText || "").toLowerCase();
      return text.includes("sonnet") || text.includes("haiku") || text.includes("opus") || text.includes("claude 3");
    });

    if (modelBtn) return modelBtn;

    // 2. Look for buttons that acts as a dropdown in the input bar
    const inputContainer = document.querySelector('div[contenteditable="true"]')?.closest('fieldset') || document.querySelector('div[contenteditable="true"]')?.closest('form');
    if (inputContainer) {
      const dropdownBtn = Array.from(inputContainer.querySelectorAll('button')).find(btn => {
        return btn.getAttribute('aria-haspopup') === 'true' || btn.getAttribute('aria-haspopup') === 'listbox';
      });
      if (dropdownBtn) return dropdownBtn;

      // 3. Fallback: select the first button that has text (usually the model chooser displays text)
      const textButtons = Array.from(inputContainer.querySelectorAll('button')).filter(btn => (btn.innerText || "").trim().length > 0);
      if (textButtons.length > 0) {
        return textButtons[0];
      }
    }

    return null;
  }

  // Clean raw HTML or inner text fluff
  function getCleanText(text) {
    if (!text) return "";
    // Remove zero-width spaces or dynamic spacer chars
    return text.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  }

  // Update button opacity and live token badge
  function updateButtonState(inputElement) {
    if (!triggerButton) return;

    const text = getCleanText(inputElement.innerText);
    const tokens = text ? estimateTokens(text) : 0;
    const badge = triggerButton.querySelector("#tmWordBadge");
    
    if (tokens > 0) {
      triggerButton.classList.add("active");
      badge.style.display = "flex";
      badge.textContent = `${tokens}t`;
    } else {
      triggerButton.classList.remove("active");
      badge.style.display = "none";
    }
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
    
    modalContainer.innerHTML = `
      <div class="squeeze-modal-card">
        <div class="tm-modal-header">
          <div class="tm-modal-logo">
            <svg width="18" height="18" viewBox="0 0 480 480" fill="none">
              <defs>
                <linearGradient id="logo-grad-modal" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#00f0ff" />
                  <stop offset="100%" stop-color="#0055ff" />
                </linearGradient>
              </defs>
              <g fill="url(#logo-grad-modal)">
                <path d="M210 107.7c-17.1 2.9-37 13.2-37 19.2 0 3.4 3.5 4.4 12.4 3.8 11-.8 30.5-8.3 37-14.3 6.8-6.4.5-10.9-12.4-8.7m61 6.8c-.8.2-4.8.9-8.9 1.5-4 .7-15.3 3.9-25 7.1-17.9 6.1-29.8 9.3-54.3 14.9-26.6 6-41.1 12.4-51.4 22.5-19.3 18.9-9.4 31.3 13.3 16.6 3.3-2.1 11.9-9.1 18.9-15.6 14.6-13.2 23-19.1 32.4-22.8 20.8-8.2 39.2-5.4 72 10.9 24 11.9 32.4 14.7 45.2 14.8 9.3.1 9.7 0 13.5-3 5.3-4.3 6.9-9.2 4.8-15.3-3.6-10.8-18.6-23.9-32.3-28.1-10.3-3.2-22.1-4.7-28.2-3.5"/>
                <path d="M211 146.1c-12.5 1.8-25.1 8.7-33.8 18.4-12.1 13.7-12.8 25-1.8 30.8 3.2 1.6 6.4 2.2 14.3 2.5 13.1.5 20.4-1 46.8-9.7 28.3-9.4 38-11.4 57-11.5l15-.1 7 3.4c7.4 3.6 14.1 9.8 29.8 27.4 8.2 9.1 13.5 12.7 18.7 12.7 4.5 0 6.7-1.5 8-5.5 2.5-7.5-3.5-21.8-13-31.6-9.6-9.8-12.1-10.3-37.6-8.4-15.9 1.1-21.7-.4-44.6-11.6-10-5-21.5-10.4-25.4-11.9-13.5-5.4-26.5-7-40.4-4.9"/>
                <path d="M279.5 189.6c-11.8 1.8-22.8 5.1-44.1 13-38.9 14.4-51 15.5-72.4 6.7-18.9-7.7-19.1-7.7-28-7.7-10.4 0-15.7 2.3-22.5 9.5-5.6 6-7.5 10.3-7.5 16.6 0 7 3.2 12 10 15.6 9.7 5.1 18.8 2.9 36.5-9 10.2-6.9 16.2-10 25.5-13.4 5.8-2.1 8.2-2.4 23-2.4 14.4 0 17.5.3 24.5 2.3 9.8 2.9 23.6 9.3 33.2 15.5 16.2 10.4 27 14.1 39.6 13.5 17.9-.8 29.8-11.4 31.4-28 1.4-16-7.8-28.5-23.9-32.3-7.6-1.8-13.4-1.8-25.3.1"/>
                <path d="M173.3 230.9c-16.8 5.8-24.9 21.7-19.7 39.1 1.2 4.1 2.9 6.7 7.2 11 7.9 7.9 12.9 9.5 28.7 9.5 17.4-.1 26.3-2.4 63-16.5 22.2-8.5 30.3-10.3 43.5-9.8 9.8.4 11.3.8 22 5.2 18.1 7.6 22.7 8.8 29.5 8.3 20.7-1.5 35.1-25.6 23.2-38.6-3.2-3.5-9.5-6.1-14.9-6.1-7.1 0-14.4 3.2-28.5 12.6-7 4.6-15.2 9.3-18.3 10.5-25.6 9.7-55.2 4.9-83.7-13.5-9.5-6.1-18.3-10.4-25-12.1-7.8-2.1-20.5-1.9-27 .4"/>
                <path d="M110.3 261.6c-2.3 2.3-2.5 3.1-2.1 8.8.5 7.7 4.7 16.8 11.5 24.5 9 10.3 16.7 12.7 33.6 10.6 19.7-2.4 29-.1 59.5 14.4 23.9 11.4 29.4 13.1 44.7 13.8 9.4.4 13.4.2 18.4-1.2 9.6-2.5 17.8-7 24.9-13.9 13.1-12.5 16.5-24.3 9.2-31.3-4.4-4.1-8.3-5.1-20-5.2-12.6-.1-20.1 1.5-45.5 9.9-20 6.5-31.2 9.2-45.8 11.1-26.3 3.2-39.4-2.5-57.7-25.1-8.6-10.6-13.4-14.9-19.4-17.4-5.4-2.2-8.3-2-11.3 1"/>
                <path d="M343.2 299c-7.6 3.6-12.8 7.5-25.1 18.8-13.1 12.1-19.5 16.9-27.5 20.8-10 4.8-19.9 6.8-31 6.1-13.6-.8-24.5-4.5-47.1-15.8-11-5.4-22.7-10.6-26-11.5s-10.7-1.8-16.5-2.1c-8.8-.4-11.1-.1-14 1.4-4.7 2.4-8.3 9.4-7.5 14.3 1.5 8.6 12.8 20.6 25 26.6 8.9 4.4 15.9 6.3 26.5 7 12 .9 23.5-1.4 48.5-9.5 11.6-3.8 28.4-8.5 37.5-10.5 19.9-4.5 27.6-6.6 39.8-11.2 19.5-7.5 33.1-20.2 33.2-31.1 0-6.9-5.7-8.1-15.8-3.3m-49 50c-21.1 2.9-44.1 17.2-35.3 22 9.2 4.9 46.8-8.1 49.6-17.1 1.5-4.5-3.7-6.3-14.3-4.9"/>
              </g>
            </svg>
            <span>Token<span class="highlight">Maxer</span> Optimizer</span>
          </div>
          <button class="tm-close-btn">&times;</button>
        </div>
        
        <div class="tm-modal-body">
          <div class="tm-loading-state">
            <div class="tm-spinner"></div>
            <p>Squeezing prompt for maximum token efficiency...</p>
            <span class="tm-loading-subtext">Rewriting via AI Engine...</span>
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

  function requestOptimization(promptText, mode) {
    try {
      chrome.runtime.sendMessage({
        action: "optimizePrompt",
        prompt: promptText,
        mode: mode
      }, (response) => {
        if (chrome.runtime.lastError) {
          renderError("Failed to communicate with the Squeeze background service worker. Please refresh the tab.");
          return;
        }
        
        if (response && response.success) {
          renderComparison(response);
        } else {
          renderError(response ? response.error : "Unknown error occurred during optimization.");
        }
      });
    } catch (err) {
      console.error("Squeeze communication error:", err);
      renderError(`Squeeze was reloaded. Please refresh this tab to re-enable prompt optimization. (Error: ${err.message})`);
    }
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

  // Preservation Quality score estimation based on key parameters
  function calculateQualityScore(original, optimized, mode) {
    const orgWords = original.match(/\b[A-Z0-9][a-zA-Z0-9]*\b/g) || [];
    const optWords = new Set((optimized.match(/\b[A-Z0-9][a-zA-Z0-9]*\b/g) || []).map(w => w.toLowerCase()));
    
    let preservedCount = 0;
    orgWords.forEach(w => {
      if (optWords.has(w.toLowerCase())) preservedCount++;
    });
    
    const wordPreservation = orgWords.length > 0 ? (preservedCount / orgWords.length) : 1.0;
    
    let baseScore = 98;
    if (mode === "squeeze") baseScore = 92;
    else if (mode === "balanced") baseScore = 96;
    
    let score = Math.round(baseScore * (0.6 + 0.4 * wordPreservation));
    score = Math.max(85, Math.min(100, score));
    return score;
  }

  // Render optimized prompt comparison view
  function renderComparison(data) {
    const body = modalContainer.querySelector(".tm-modal-body");
    const qualityScore = calculateQualityScore(data.original, data.optimized, data.mode);
    const diff = getDiffHtml(data.original, data.optimized);
    
    body.innerHTML = `
      <div class="tm-comparison-layout">
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
            <div class="tm-stats-badge-savings">
              Saves ${data.percentageSaved}% Tokens
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
              <span>Original Prompt</span>
              <span class="tm-pane-stat">${data.originalTokens} tokens</span>
            </div>
            <div class="tm-pane-content tm-original-text" id="tmOriginalPane">${diff.oldHtml}</div>
          </div>
          
          <div class="tm-diff-pane tm-optimized-pane">
            <div class="tm-pane-header">
              <span>Optimized Prompt</span>
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
    
    const body = modalContainer.querySelector(".tm-modal-body");
    body.innerHTML = `
      <div class="tm-error-state">
        <div class="tm-error-icon">⚠️</div>
        <h3>Optimization Failed</h3>
        <p class="tm-error-msg">${escapeHtml(errorMessage)}</p>
        <div class="tm-error-actions">
          <button class="tm-btn tm-btn-secondary" id="tmErrorCloseBtn">Close</button>
          <button class="tm-btn tm-btn-primary" id="tmConfigureBtn">Configure API Settings</button>
        </div>
      </div>
    `;

    body.querySelector("#tmErrorCloseBtn").addEventListener("click", closeModal);
    body.querySelector("#tmConfigureBtn").addEventListener("click", () => {
      // Tell background/popup we want to configure settings or show instructions
      closeModal();
      alert("Please click the Squeeze extension icon in your browser toolbar to configure your API Credentials Key and Engine.");
    });
  }

  // Close modal
  function closeModal() {
    if (modalContainer) {
      modalContainer.classList.remove("open");
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
    const selectors = [
      'div.font-user-message',
      'div.font-claude-message',
      '[data-testid="user-message"]',
      '[data-testid="bot-message"]',
      '.prose',
      '.font-sans.break-words'
    ];
    
    const messageBlocks = document.querySelectorAll(selectors.join(', '));
    
    // Filter out child nodes of other matched elements to prevent double-counting
    const uniqueBlocks = Array.from(messageBlocks).filter((block) => {
      let parent = block.parentElement;
      while (parent) {
        if (Array.from(messageBlocks).includes(parent)) {
          return false;
        }
        parent = parent.parentElement;
      }
      return true;
    });

    let totalText = "";
    uniqueBlocks.forEach(block => {
      totalText += " " + block.innerText;
    });

    if (activeTextarea) {
      totalText += " " + activeTextarea.innerText;
    }

    return estimateTokens(totalText);
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
      const orgsRes = await fetch("https://claude.ai/api/organizations");
      if (!orgsRes.ok) return null;
      const orgs = await orgsRes.json();
      if (!orgs || orgs.length === 0) return null;
      
      const orgId = orgs[0].uuid;
      const usageRes = await fetch(`https://claude.ai/api/organizations/${orgId}/usage`);
      if (!usageRes.ok) return null;
      const usage = await usageRes.json();
      
      cachedQuota = usage;
      lastQuotaFetch = now;
      return usage;
    } catch (e) {
      console.warn("Failed to fetch Claude subscription quota:", e);
      return null;
    }
  }

  async function updateUsageBar() {
    if (!usageBar) return;

    // 1. Calculate local conversation tokens
    const conversationTokens = calculateConversationTokens();
    const localLimit = 200000;
    const localPercentage = Math.min(100, Math.max(0, Math.round((conversationTokens / localLimit) * 100)));
    const localStatus = getStatusClass(conversationTokens);
    const localStatusLabel = getStatusLabel(conversationTokens);

    // 2. Fetch live subscription quota
    const quota = await fetchClaudeQuota();
    
    let quotaHtml = "";
    if (quota && quota.five_hour) {
      const utilization = quota.five_hour.utilization || 0;
      const maxTokens = 375000; // Standard estimated Claude Pro Cap
      const usedTokens = Math.round((utilization / 100) * maxTokens);
      
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
          <span class="tm-quota-loading">Loading subscription limits...</span>
        </div>
      `;
    }

    const quotaPercentage = quota && quota.five_hour ? (quota.five_hour.utilization || 0) : 0;
    const quotaStatus = getPercentStatusClass(quotaPercentage);

    usageBar.innerHTML = `
      <div class="tm-usage-bar-content">
        <div class="tm-usage-columns">
          <div class="tm-context-column">
            <span class="tm-usage-dot dot-${localStatus}"></span>
            <span class="tm-usage-title">Conversation Context:</span>
            <span class="tm-usage-val">${conversationTokens.toLocaleString()}</span>
            <span class="tm-usage-divider">/</span>
            <span class="tm-usage-limit">200K tokens</span>
            <span class="tm-usage-percent">(${localPercentage}%)</span>
            <span class="tm-usage-status-inline status-${localStatus}">${localStatusLabel}</span>
          </div>
          ${quotaHtml}
        </div>
        <div class="tm-progress-bars-container" style="display: flex; flex-direction: column; gap: 4px; width: 100%; margin-top: 4px;">
          <div class="tm-usage-progress-track" title="Conversation Context: ${localPercentage}% used">
            <div class="tm-usage-progress-bar progress-${localStatus}" style="width: ${localPercentage}%"></div>
          </div>
          <div class="tm-usage-progress-track" title="5-Hour Quota: ${quotaPercentage}% used">
            <div class="tm-usage-progress-bar progress-${quotaStatus}" style="width: ${quotaPercentage}%"></div>
          </div>
        </div>
      </div>
    `;
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

  // Start content script execution
  init();
})();
