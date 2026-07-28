/**
 * Squeeze AI - Magic UI / SkyAgent Inspired Interactive Client Logic
 * Handles Theme Toggling, Interactive Canvas, Navbar Scroll Highlighting,
 * Live Prompt Optimizer, Token Calculator, FAQ Accordion, and Google Sheets Waitlist.
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 1. Theme Configuration & Persistence
  // ==========================================
  const htmlEl = document.documentElement;
  const themeToggleBtn = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  
  const moonIconPath = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';
  const sunIconPath = 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42';
  
  let currentTheme = localStorage.getItem('squeeze-theme') || 'dark';
  setTheme(currentTheme);
  
  function setTheme(theme) {
    htmlEl.setAttribute('data-theme', theme);
    currentTheme = theme;
    localStorage.setItem('squeeze-theme', theme);
    
    if (themeIcon) {
      if (theme === 'dark') {
        themeIcon.innerHTML = `<path d="${moonIconPath}"/>`;
      } else {
        themeIcon.innerHTML = `<circle cx="12" cy="12" r="4"/><path d="${sunIconPath}"/>`;
      }
    }
  }
  
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
  }

  // ==========================================
  // 2. Subtle Background Canvas Engine
  // ==========================================
  const canvas = document.getElementById('shapegrid-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    
    const particles = [];
    const particleCount = 30;
    const maxDistance = 140;
    const mouse = { x: null, y: null, active: false };

    class MicroParticle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.radius = Math.random() * 1.5 + 1;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;

        if (mouse.active) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const force = (140 - dist) / 140;
            this.x += (dx / dist) * force * 0.5;
            this.y += (dy / dist) * force * 0.5;
          }
        }
      }

      draw() {
        const theme = htmlEl.getAttribute('data-theme');
        const alpha = theme === 'dark' ? 0.25 : 0.18;
        ctx.fillStyle = `rgba(181, 96, 63, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new MicroParticle());
    }

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    });

    window.addEventListener('mouseleave', () => {
      mouse.active = false;
    });

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    function renderCanvas() {
      ctx.clearRect(0, 0, width, height);

      const theme = htmlEl.getAttribute('data-theme');
      const accentRGB = '181, 96, 63';

      if (mouse.active) {
        const glowRadius = 140;
        const glowOpacity = theme === 'dark' ? 0.025 : 0.015;
        const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, glowRadius);
        grad.addColorStop(0, `rgba(${accentRGB}, ${glowOpacity})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        p1.update();
        p1.draw();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const lineOpacity = (1 - (dist / maxDistance)) * (theme === 'dark' ? 0.08 : 0.04);
            ctx.strokeStyle = `rgba(${accentRGB}, ${lineOpacity})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(renderCanvas);
    }
    renderCanvas();
  }

  // ==========================================
  // 3. Navbar Scroll Active Link Highlighting
  // ==========================================
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    let current = '';
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      const sectionHeight = section.offsetHeight;
      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      } else if (!current && link.getAttribute('href') === '#top') {
        link.classList.add('active');
      }
    });
  });

  // ==========================================
  // 4. Hero Showcase Claude Simulator Mode Selector
  // ==========================================
  const modePillBtns = document.querySelectorAll('.mode-pill-btn');
  const heroStatTokens = document.getElementById('heroStatTokens');
  const heroStatTrim = document.getElementById('heroStatTrim');

  const heroSamplePrompts = {
    squeeze: {
      text: `Review React dashboard component code for bugs:

\`\`\`jsx
// [2,400 lines of unchanged React dashboard code copy-pasted here for 3rd time...]
\`\`\``,
      tokens: '2,150',
      trim: '52%'
    },
    balanced: {
      text: `Hey Claude, hope you're doing well! Here is the React dashboard component code again. I made a tiny tweak to the login button style. Could you please review it and check for any bugs? Thanks so much!

\`\`\`jsx
// [2,400 lines of unchanged React dashboard code copy-pasted here for 3rd time...]
\`\`\``,
      tokens: '1,480',
      trim: '35%'
    },
    polish: {
      text: `Review React dashboard component login button style tweak for bugs:

\`\`\`jsx
// [2,400 lines unchanged]
\`\`\``,
      tokens: '840',
      trim: '68%'
    }
  };

  modePillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modePillBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.getAttribute('data-mode');
      const mockPromptText = document.getElementById('mockPromptText');
      if (mockPromptText && heroSamplePrompts[mode]) {
        mockPromptText.textContent = heroSamplePrompts[mode].text;
        if (heroStatTokens) heroStatTokens.textContent = heroSamplePrompts[mode].tokens;
        if (heroStatTrim) heroStatTrim.textContent = heroSamplePrompts[mode].trim;
      }
    });
  });

  // ==========================================
  // 5. Interactive Live Prompt Squeezer Sandbox
  // ==========================================
  const sandboxInput = document.getElementById('sandboxInput');
  const sandboxOutput = document.getElementById('sandboxOutput');
  const rawCharCount = document.getElementById('rawCharCount');
  const optCharCount = document.getElementById('optCharCount');
  const trimPercent = document.getElementById('trimPercent');

  function optimizeSandboxPrompt() {
    if (!sandboxInput || !sandboxOutput) return;

    let input = sandboxInput.value;
    let output = input;

    // Pleasantry & Greeting Trimming Rules
    const greetings = /^(hey|hello|hi|good morning|good evening|dear|greetings)\s+(claude|assistant|ai|gpt|there)?[\s,!]*/gi;
    const fillers = /\b(hope you are doing well|hope you're well|hope this finds you well|how are you|could you please|would you mind|can you kindly|i would appreciate it if you could|thanks so much|thank you very much|thanks in advance|best regards|sincerely)\b[\s,!]*/gi;

    output = output.replace(greetings, '');
    output = output.replace(fillers, '');
    output = output.replace(/[ \t]+/g, ' '); // Collapse double spaces
    output = output.trim();

    if (output.length > 0) {
      output = output.charAt(0).toUpperCase() + output.slice(1);
    } else {
      output = '(Empty prompt after trimming)';
    }

    const origLen = input.length;
    const optLen = output.length;
    const reduction = origLen > 0 ? Math.max(0, Math.round(((origLen - optLen) / origLen) * 100)) : 0;

    sandboxOutput.textContent = output;
    if (rawCharCount) rawCharCount.textContent = `${origLen} chars`;
    if (optCharCount) optCharCount.textContent = `${optLen} chars`;
    if (trimPercent) trimPercent.textContent = `${reduction}%`;
  }

  if (sandboxInput) {
    sandboxInput.addEventListener('input', optimizeSandboxPrompt);
    // Initial run
    optimizeSandboxPrompt();
  }

  // ==========================================
  // 6. Token Savings Calculator
  // ==========================================
  const sliderPromptSize = document.getElementById('promptSize');
  const sliderPromptCount = document.getElementById('promptCount');
  const sliderReductionRate = document.getElementById('reductionRate');

  const valPromptSize = document.getElementById('promptSizeVal');
  const valPromptCount = document.getElementById('promptCountVal');
  const valReductionRate = document.getElementById('reductionRateVal');

  const monthlyTokensVal = document.getElementById('monthlyTokensVal');
  const monthlySavingsVal = document.getElementById('monthlySavingsVal');

  function updateCalculator() {
    if (!sliderPromptSize || !sliderPromptCount || !sliderReductionRate) return;

    const size = parseInt(sliderPromptSize.value, 10);
    const count = parseInt(sliderPromptCount.value, 10);
    const rate = parseInt(sliderReductionRate.value, 10);

    valPromptSize.textContent = `${size.toLocaleString()} tokens`;
    valPromptCount.textContent = `${count} prompts`;
    valReductionRate.textContent = `${rate}% saved`;

    // Math: 30 days per month, Sonnet 5 input token cost: $3.00 per 1,000,000 tokens
    const totalInputTokensPerMonth = size * count * 30;
    const tokensSavedMonthly = totalInputTokensPerMonth * (rate / 100);
    const cashSavedMonthly = (tokensSavedMonthly / 1000000) * 3.00;

    if (tokensSavedMonthly >= 1000000) {
      monthlyTokensVal.textContent = `${(tokensSavedMonthly / 1000000).toFixed(2)}M`;
    } else {
      monthlyTokensVal.textContent = `${Math.round(tokensSavedMonthly / 1000).toLocaleString()}K`;
    }

    monthlySavingsVal.textContent = `$${cashSavedMonthly.toFixed(2)}`;
  }

  if (sliderPromptSize && sliderPromptCount && sliderReductionRate) {
    sliderPromptSize.addEventListener('input', updateCalculator);
    sliderPromptCount.addEventListener('input', updateCalculator);
    sliderReductionRate.addEventListener('input', updateCalculator);
    updateCalculator();
  }

  // ==========================================
  // 7. Interactive FAQ Accordion
  // ==========================================
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        // Close other items
        faqItems.forEach(otherItem => otherItem.classList.remove('active'));

        // Toggle current
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });

  // ==========================================
  // 8. VIP Waitlist Modal & Google Sheet Webhook
  // ==========================================
  const waitlistModal = document.getElementById('waitlistModal');
  const openWaitlistBtns = document.querySelectorAll('.open-waitlist-btn');
  const closeWaitlistModalBtn = document.getElementById('closeWaitlistModal');
  const successCloseBtn = document.getElementById('successCloseBtn');

  const waitlistFormContainer = document.getElementById('waitlistFormContainer');
  const waitlistSuccess = document.getElementById('waitlistSuccess');
  const waitlistForm = document.getElementById('waitlistForm');
  const waitlistEmail = document.getElementById('waitlistEmail');
  const waitlistWhatsapp = document.getElementById('waitlistWhatsapp');
  const waitlistError = document.getElementById('waitlistError');
  const waitlistSubmitBtn = document.getElementById('waitlistSubmitBtn');

  const WAITLIST_CONFIG = {
    endpointUrl: 'https://script.google.com/macros/s/AKfycbygh9Fc9EhLGmV5XnpiJ6mE5DjQT0fiB0dKEwnUXJEnDiSVTn7ATlpA6NRSk6VerJwWyg/exec'
  };

  function openWaitlist() {
    if (!waitlistModal) return;
    waitlistModal.classList.add('active');
    waitlistModal.setAttribute('aria-hidden', 'false');
    if (waitlistFormContainer) waitlistFormContainer.style.display = 'block';
    if (waitlistSuccess) waitlistSuccess.style.display = 'none';
    if (waitlistError) waitlistError.style.display = 'none';
    setTimeout(() => {
      if (waitlistEmail) waitlistEmail.focus();
    }, 150);
  }

  function closeWaitlist() {
    if (!waitlistModal) return;
    waitlistModal.classList.remove('active');
    waitlistModal.setAttribute('aria-hidden', 'true');
  }

  openWaitlistBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openWaitlist();
    });
  });

  if (closeWaitlistModalBtn) closeWaitlistModalBtn.addEventListener('click', closeWaitlist);
  if (successCloseBtn) successCloseBtn.addEventListener('click', closeWaitlist);

  if (waitlistModal) {
    waitlistModal.addEventListener('click', (e) => {
      if (e.target === waitlistModal) {
        closeWaitlist();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && waitlistModal && waitlistModal.classList.contains('active')) {
      closeWaitlist();
    }
  });

  // Form submission handling
  if (waitlistForm) {
    waitlistForm.addEventListener('submit', async (e) => {
      if (waitlistError) waitlistError.style.display = 'none';

      const email = waitlistEmail ? waitlistEmail.value.trim() : '';
      const whatsapp = waitlistWhatsapp ? waitlistWhatsapp.value.trim() : '';

      if (!email || !email.includes('@') || !email.includes('.')) {
        e.preventDefault();
        showError('Please enter a valid email address.');
        return;
      }

      if (!whatsapp || whatsapp.length < 7) {
        e.preventDefault();
        showError('Please enter a valid WhatsApp number with country code (e.g. +1 or +91).');
        return;
      }

      // UI Submitting state
      setSubmittingState(true);

      // Prefix leading plus with quote so Google Sheets formats as plain text without #ERROR!
      let safeWhatsapp = whatsapp;
      if (safeWhatsapp.startsWith('+')) {
        safeWhatsapp = "'" + safeWhatsapp;
      }

      try {
        if (WAITLIST_CONFIG.endpointUrl) {
          const params = new URLSearchParams();
          params.append('email', email);
          params.append('whatsapp', safeWhatsapp);
          params.append('timestamp', new Date().toLocaleString());

          fetch(WAITLIST_CONFIG.endpointUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
          }).catch(err => console.log('Fetch submit notice:', err));
        }

        setTimeout(() => {
          waitlistForm.reset();
          setSubmittingState(false);
          if (waitlistFormContainer) waitlistFormContainer.style.display = 'none';
          if (waitlistSuccess) waitlistSuccess.style.display = 'block';
        }, 650);

      } catch (err) {
        console.error('Waitlist submit error:', err);
        setSubmittingState(false);
        if (waitlistFormContainer) waitlistFormContainer.style.display = 'none';
        if (waitlistSuccess) waitlistSuccess.style.display = 'block';
      }
    });
  }

  function showError(msg) {
    if (waitlistError) {
      waitlistError.textContent = msg;
      waitlistError.style.display = 'block';
    }
  }

  function setSubmittingState(isSubmitting) {
    if (!waitlistSubmitBtn) return;
    const btnText = waitlistSubmitBtn.querySelector('.btn-text');
    const btnLoader = waitlistSubmitBtn.querySelector('.btn-loader');
    
    waitlistSubmitBtn.disabled = isSubmitting;
    if (isSubmitting) {
      if (btnText) btnText.style.display = 'none';
      if (btnLoader) btnLoader.style.display = 'inline-block';
    } else {
      if (btnText) btnText.style.display = 'inline-block';
      if (btnLoader) btnLoader.style.display = 'none';
    }
  }

  // ==========================================
  // 9. Interactive Installation Guide Component
  // ==========================================
  const primaryTabBtns = document.querySelectorAll('.install-tab-btn');
  const subTabBtns = document.querySelectorAll('.subtab-btn');
  const installPanels = document.querySelectorAll('.install-panel');
  const claudeSubtabsRow = document.getElementById('claudeSubtabsRow');
  const toastPopup = document.getElementById('toastPopup');
  const copyMasterPromptBtn = document.getElementById('copyMasterPromptBtn');

  function showToast(msg) {
    if (!toastPopup) return;
    toastPopup.textContent = msg;
    toastPopup.classList.add('show');
    setTimeout(() => {
      toastPopup.classList.remove('show');
    }, 2500);
  }

  // Primary Tabs Switcher
  primaryTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      primaryTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tab = btn.getAttribute('data-tab');

      // Hide all panels
      installPanels.forEach(panel => panel.style.display = 'none');

      if (tab === 'claude') {
        if (claudeSubtabsRow) claudeSubtabsRow.style.display = 'flex';
        // Check active subtab
        const activeSubtab = document.querySelector('.subtab-btn.active');
        const subtabVal = activeSubtab ? activeSubtab.getAttribute('data-subtab') : 'claude-desktop';
        const targetPanel = document.getElementById(`panel-${subtabVal}`);
        if (targetPanel) targetPanel.style.display = 'block';
      } else {
        if (claudeSubtabsRow) claudeSubtabsRow.style.display = 'none';
        const targetPanel = document.getElementById(`panel-${tab}`);
        if (targetPanel) targetPanel.style.display = 'block';
      }
    });
  });

  // Claude Subtabs Switcher
  subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      subTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const subtab = btn.getAttribute('data-subtab');

      installPanels.forEach(panel => {
        if (panel.id === 'panel-claude-desktop' || panel.id === 'panel-claude-code') {
          panel.style.display = 'none';
        }
      });

      const targetPanel = document.getElementById(`panel-${subtab}`);
      if (targetPanel) targetPanel.style.display = 'block';
    });
  });

  // 1-Click Code Snippet Copy Buttons
  const codeCopyBtns = document.querySelectorAll('.code-copy-btn');
  codeCopyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const container = btn.closest('.code-box-container');
      if (container) {
        const codeText = container.querySelector('code') ? container.querySelector('code').innerText : container.innerText;
        navigator.clipboard.writeText(codeText.trim()).then(() => {
          showToast('Copied to clipboard! ✓');
        }).catch(err => console.error('Copy failed:', err));
      }
    });
  });

  // Master System Prompt Copy Button
  const MASTER_SYSTEM_PROMPT = `You are an expert on **Squeeze AI**, the local-first context compression layer and prompt optimizer designed for AI models (Claude, ChatGPT, Gemini, Cursor IDE, and AI Agents). 

Squeeze AI is a privacy-first, client-side context optimization engine. It sits between user prompts/code payloads and LLMs to eliminate token waste, trim conversational pleasantries, compress JSON payloads, and deduplicate multi-turn code blocks before requests hit the model.

INSTRUCTIONS FOR YOU (THE LLM):
When asked to "Squeeze this prompt" or operate in "Squeeze Mode":
1. Remove all greetings, pleasantries, and sign-offs ("Hey Claude", "Hope you're well", "Thanks in advance").
2. Preserve 100% of the underlying technical requirements and code logic.
3. Output the optimized, token-efficient version cleanly.`;

  if (copyMasterPromptBtn) {
    copyMasterPromptBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(MASTER_SYSTEM_PROMPT).then(() => {
        showToast('Master Squeeze System Prompt copied! ✓');
      }).catch(err => console.error('Copy prompt failed:', err));
    });
  }

  // ==========================================
  // 10. Search Modal (Cmd + K / Ctrl + K)
  // ==========================================
  const searchTriggerBtn = document.getElementById('searchTriggerBtn');
  const searchModal = document.getElementById('searchModal');
  const closeSearchModal = document.getElementById('closeSearchModal');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  function openSearch() {
    if (!searchModal) return;
    searchModal.classList.add('active');
    searchModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      if (searchInput) searchInput.focus();
    }, 100);
  }

  function closeSearch() {
    if (!searchModal) return;
    searchModal.classList.remove('active');
    searchModal.setAttribute('aria-hidden', 'true');
  }

  if (searchTriggerBtn) searchTriggerBtn.addEventListener('click', openSearch);
  if (closeSearchModal) closeSearchModal.addEventListener('click', closeSearch);

  if (searchModal) {
    searchModal.addEventListener('click', (e) => {
      if (e.target === searchModal) closeSearch();
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch();
    }
  });

  if (searchInput && searchResults) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      const items = searchResults.querySelectorAll('.search-result-item');

      items.forEach(item => {
        const text = item.innerText.toLowerCase();
        if (!q || text.includes(q)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }
});


