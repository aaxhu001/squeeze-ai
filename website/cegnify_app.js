/**
 * SQUEEZE AI - Interactive Application Engine with Webflow IX2 Animations
 */

document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initParallaxTilt();
  initHeroSimulator();
  initFeatureShowcase();
  initInstallGuideTabs();
  initRoiCalculator();
  initCounterAnimation();
  initPricingToggle();
  initSandboxModal();
  initMobileMenu();
  initDropdownMenu();
  initCopyButtons();
});

/* ==========================================================================
   0. Webflow IX2 IntersectionObserver Scroll Reveal System
   ========================================================================== */
function initScrollReveal() {
  const animatedElements = document.querySelectorAll('[data-animate]');
  if (!animatedElements.length) return;

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -60px 0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  animatedElements.forEach(el => observer.observe(el));
}

/* ==========================================================================
   0.1 Subtle 3D Mouse Parallax Tilt Effect
   ========================================================================== */
function initParallaxTilt() {
  const tiltCard = document.querySelector('.simulator-window');
  if (!tiltCard) return;

  tiltCard.addEventListener('mousemove', (e) => {
    const rect = tiltCard.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -4; // max 4 deg
    const rotateY = ((x - centerX) / centerX) * 4;

    tiltCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  });

  tiltCard.addEventListener('mouseleave', () => {
    tiltCard.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)`;
  });
}

/* ==========================================================================
   1. Hero Interactive Simulator (Mode Switcher & Diff Updates)
   ========================================================================== */
function initHeroSimulator() {
  const modeBtns = document.querySelectorAll('.sim-mode-btn');
  const tokensVal = document.getElementById('sim-tokens-val');
  const trimRateVal = document.getElementById('sim-trim-val');
  const codeBox = document.getElementById('sim-code-box');

  if (!modeBtns.length || !tokensVal || !trimRateVal || !codeBox) return;

  const modeData = {
    squeeze: {
      tokens: '3,840',
      trim: '82%',
      html: `<span class="diff-del">Hey Claude, hope you are having an amazing day! </span>
I have updated the user authentication controller. Please review the modified logic:

<span class="diff-del">// [2,400 lines of unchanged AuthController.ts code copy-pasted here...]</span>
<span class="diff-add">// [Squeeze Hash: a8f9c21e - 2,400 lines deduplicated]</span>

<span class="diff-add">+ async function validateJwt(token: string) { ... }</span>`
    },
    balanced: {
      tokens: '1,480',
      trim: '45%',
      html: `<span class="diff-del">Hey Claude, hope you are doing well! </span>
Here is the React dashboard component code. I made a tiny tweak to the login button.

<span class="diff-del">// [1,200 lines of unchanged React dashboard code copy-pasted...]</span>
<span class="diff-add">// [Squeeze Hash: c4b19d02 - 1,200 lines deduplicated]</span>

export function LoginButton() {
  return &lt;button className="btn-primary"&gt;Login&lt;/button&gt;;
}`
    },
    polish: {
      tokens: '620',
      trim: '22%',
      html: `<span class="diff-del">Good morning! Could you please help me check this function?</span>
Please check this TypeScript function for potential edge-case errors:

function calculateTax(amount: number) {
  return amount * 0.2;
}`
    }
  };

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.dataset.mode;
      if (modeData[mode]) {
        tokensVal.textContent = modeData[mode].tokens;
        trimRateVal.textContent = modeData[mode].trim;
        codeBox.style.opacity = '0';
        setTimeout(() => {
          codeBox.innerHTML = modeData[mode].html;
          codeBox.style.opacity = '1';
        }, 150);
      }
    });
  });
}

/* ==========================================================================
   2. Feature Showcase Steps & Synced Custom Cards
   ========================================================================== */
function initFeatureShowcase() {
  const steps = document.querySelectorAll('.feature-item-step');
  const cards = document.querySelectorAll('.feature-card-visual');
  const progressFill = document.querySelector('.feature-progress-fill');
  
  if (!steps.length || !cards.length || !progressFill) return;

  let currentIndex = 0;
  let autoTimer = null;

  function setActiveStep(index) {
    currentIndex = index;

    steps.forEach((step, i) => {
      if (i === index) step.classList.add('active');
      else step.classList.remove('active');
    });

    cards.forEach((card, i) => {
      if (i === index) card.classList.add('active');
      else card.classList.remove('active');
    });

    const fillPercent = ((index + 1) / steps.length) * 100;
    progressFill.style.height = `${fillPercent}%`;
  }

  steps.forEach((step, index) => {
    step.addEventListener('click', () => {
      setActiveStep(index);
      resetTimer();
    });
  });

  function startTimer() {
    autoTimer = setInterval(() => {
      const nextIndex = (currentIndex + 1) % steps.length;
      setActiveStep(nextIndex);
    }, 5000);
  }

  function resetTimer() {
    if (autoTimer) clearInterval(autoTimer);
    startTimer();
  }

  startTimer();
}

/* ==========================================================================
   3. Installation Guide Tab & Subtab Switcher
   ========================================================================== */
function initInstallGuideTabs() {
  const primaryTabs = document.querySelectorAll('.install-tab-btn');
  const subtabsRow = document.getElementById('claudeSubtabsRow');
  const subtabs = document.querySelectorAll('.subtab-btn');
  const panels = document.querySelectorAll('.install-panel');

  if (!primaryTabs.length || !panels.length) return;

  primaryTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      primaryTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.dataset.tab;

      if (subtabsRow) {
        if (targetTab === 'claude') {
          subtabsRow.style.display = 'flex';
        } else {
          subtabsRow.style.display = 'none';
        }
      }

      panels.forEach(panel => {
        if (targetTab === 'claude') {
          const activeSubtab = document.querySelector('.subtab-btn.active')?.dataset.subtab || 'claude-code';
          panel.style.display = (panel.id === `panel-${activeSubtab}`) ? 'block' : 'none';
        } else {
          panel.style.display = (panel.id === `panel-${targetTab}`) ? 'block' : 'none';
        }
      });
    });
  });

  subtabs.forEach(sbtn => {
    sbtn.addEventListener('click', () => {
      subtabs.forEach(sb => sb.classList.remove('active'));
      sbtn.classList.add('active');

      const subtabTarget = sbtn.dataset.subtab;
      panels.forEach(panel => {
        if (panel.id === `panel-${subtabTarget}`) {
          panel.style.display = 'block';
        } else if (panel.id.startsWith('panel-claude-')) {
          panel.style.display = 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   4. Interactive ROI Calculator
   ========================================================================== */
function initRoiCalculator() {
  const slider = document.getElementById('roi-spend-slider');
  const spendValEl = document.getElementById('roi-spend-val');
  const savedDollarsEl = document.getElementById('roi-saved-dollars');
  const savedTokensEl = document.getElementById('roi-saved-tokens');

  if (!slider || !spendValEl || !savedDollarsEl || !savedTokensEl) return;

  slider.addEventListener('input', (e) => {
    const spend = parseInt(e.target.value, 10);
    spendValEl.textContent = `$${spend.toLocaleString()}`;

    const savedDollars = Math.round(spend * 0.45);
    const savedTokens = Math.round(spend * 45000);

    savedDollarsEl.textContent = `$${savedDollars.toLocaleString()}`;
    savedTokensEl.textContent = `${(savedTokens / 1000000).toFixed(1)}M`;
  });
}

/* ==========================================================================
   5. Impact Counter Animation
   ========================================================================== */
function initCounterAnimation() {
  const counterEl = document.getElementById('impact-counter');
  if (!counterEl) return;

  const targetNum = 42973210;
  let hasAnimated = false;

  function animateCounter() {
    const duration = 2500;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.floor(easeProgress * targetNum);

      counterEl.textContent = currentVal.toLocaleString('en-US');

      if (progress < 1) requestAnimationFrame(update);
      else counterEl.textContent = targetNum.toLocaleString('en-US');
    }

    requestAnimationFrame(update);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasAnimated) {
        hasAnimated = true;
        animateCounter();
      }
    });
  }, { threshold: 0.3 });

  observer.observe(counterEl);
}

/* ==========================================================================
   6. Pricing Toggle Switcher
   ========================================================================== */
function initPricingToggle() {
  const billingToggle = document.getElementById('billing-toggle');
  const starterPrice = document.getElementById('price-starter');
  const proPrice = document.getElementById('price-pro');
  const enterprisePrice = document.getElementById('price-enterprise');

  if (!billingToggle || !starterPrice || !proPrice || !enterprisePrice) return;

  const prices = {
    monthly: { starter: '$0', pro: '$19', enterprise: '$99' },
    yearly: { starter: '$0', pro: '$15', enterprise: '$79' }
  };

  billingToggle.addEventListener('change', (e) => {
    const key = e.target.checked ? 'yearly' : 'monthly';
    starterPrice.textContent = prices[key].starter;
    proPrice.textContent = prices[key].pro;
    enterprisePrice.textContent = prices[key].enterprise;
  });
}

/* ==========================================================================
   7. Live Sandbox Modal & Compressor Logic
   ========================================================================== */
function initSandboxModal() {
  const cartBtn = document.getElementById('cart-btn');
  const cartModal = document.getElementById('cart-modal');
  const cartOverlay = document.getElementById('cart-overlay');
  const closeCartBtn = document.getElementById('close-cart-btn');
  const sandboxInput = document.getElementById('sandbox-input');
  const compressBtn = document.getElementById('sandbox-compress-btn');
  const sandboxResult = document.getElementById('sandbox-result');

  if (!cartBtn || !cartModal || !cartOverlay) return;

  cartBtn.addEventListener('click', () => {
    cartModal.classList.add('active');
    cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  function closeCart() {
    cartModal.classList.remove('active');
    cartOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);

  if (compressBtn && sandboxInput && sandboxResult) {
    compressBtn.addEventListener('click', () => {
      const text = sandboxInput.value.trim();
      if (!text) return;

      const origTokens = Math.ceil(text.length / 4);
      const compressedText = text
        .replace(/hey claude,?/gi, '')
        .replace(/hope you are having a (great|wonderful) day/gi, '')
        .replace(/could you please/gi, '')
        .replace(/thanks so much!/gi, '')
        .trim();

      const newTokens = Math.max(12, Math.ceil(compressedText.length / 4));
      const savedPct = (((origTokens - newTokens) / origTokens) * 100).toFixed(1);

      sandboxResult.innerHTML = `
        <div style="font-weight: 700; color: var(--primary-accent); margin-bottom: 8px;">
          ⚡ Squeezed ${origTokens} tokens down to ${newTokens} tokens (${savedPct}% saved)!
        </div>
        <div style="font-family: var(--font-mono); font-size: 0.8rem; background: rgba(0,0,0,0.4); padding: 8px; border-radius: 4px; color: #6EE7B7;">
          ${compressedText}
        </div>
      `;
    });
  }
}

/* ==========================================================================
   8. Mobile Navigation & Dropdowns
   ========================================================================== */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-toggle');
  const drawer = document.getElementById('mobile-drawer');

  if (!toggleBtn || !drawer) return;

  toggleBtn.addEventListener('click', () => {
    const isActive = drawer.classList.toggle('active');
    toggleBtn.classList.toggle('active');
    document.body.style.overflow = isActive ? 'hidden' : '';
  });
}

function initDropdownMenu() {
  const dropdownTrigger = document.querySelector('.dropdown-trigger');
  const dropdownMenu = document.querySelector('.dropdown-menu');

  if (!dropdownTrigger || !dropdownMenu) return;

  dropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!dropdownTrigger.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.remove('active');
    }
  });
}

/* ==========================================================================
   9. One-Click Copy Command Buttons
   ========================================================================== */
function initCopyButtons() {
  const copyBtns = document.querySelectorAll('.code-copy-btn, .action-copy-prompt-btn');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const textToCopy = btn.dataset.copyText || 'You are using Squeeze AI, the local context compression layer.';
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy);
        const origContent = btn.innerHTML;
        btn.innerHTML = `<span style="color: #10B981; font-weight: 700;">Copied! ✓</span>`;
        setTimeout(() => { btn.innerHTML = origContent; }, 2000);
      }
    });
  });
}
