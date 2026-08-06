/**
 * SQUEEZE AI - Landing Page Interaction & Motion Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  initStickyNavbar();
  initWordRotator();
  initScrollReveal();
  initStatsCounter();
  initFaqAccordion();
  initInstallGuideTabs();
  initCopyButtons();
  initBlurFadeText();
  initTextRoll();
  initFeedbackCarousel();
});

/* ==========================================================================
   1. Sticky Glass Navbar Scroll Effect
   ========================================================================== */
function initStickyNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const handleScroll = () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

/* ==========================================================================
   2. Hero Section Word Rotator Animation
   ========================================================================== */
function initWordRotator() {
  const rotatorEl = document.getElementById('wordRotator');
  if (!rotatorEl) return;

  const words = ['context.', 'tokens.', 'chats.', 'logs.'];
  const STAGGER = 0.045;
  let currentIdx = 0;

  function renderWordSpans(word, isBottom = false) {
    const container = document.createElement('span');
    container.className = isBottom ? 'word-rotator-bottom' : 'word-rotator-top';
    if (isBottom) container.setAttribute('aria-hidden', 'true');

    for (let i = 0; i < word.length; i++) {
      const charSpan = document.createElement('span');
      charSpan.className = 'word-rotator-char';
      charSpan.style.transitionDelay = `${i * STAGGER}s`;
      charSpan.textContent = word[i] === ' ' ? '\u00A0' : word[i];
      container.appendChild(charSpan);
    }
    return container;
  }

  // Initial render of first word
  rotatorEl.textContent = '';
  let topEl = renderWordSpans(words[currentIdx], false);
  rotatorEl.appendChild(topEl);

  setInterval(() => {
    const nextIdx = (currentIdx + 1) % words.length;
    const currentWord = words[currentIdx];
    const nextWord = words[nextIdx];

    rotatorEl.textContent = '';
    topEl = renderWordSpans(currentWord, false);
    const bottomEl = renderWordSpans(nextWord, true);

    rotatorEl.appendChild(topEl);
    rotatorEl.appendChild(bottomEl);

    // Force reflow
    void rotatorEl.offsetWidth;

    // Trigger staggered roll
    rotatorEl.classList.add('rolling');

    setTimeout(() => {
      currentIdx = nextIdx;
      rotatorEl.classList.remove('rolling');
      rotatorEl.textContent = '';
      topEl = renderWordSpans(words[currentIdx], false);
      rotatorEl.appendChild(topEl);
    }, 850);

  }, 3000);
}

/* ==========================================================================
   3. IntersectionObserver Scroll Reveal System
   ========================================================================== */
function initScrollReveal() {
  const animatedElements = document.querySelectorAll('[data-animate]');
  if (!animatedElements.length) return;

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -40px 0px',
    threshold: 0.12
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.classList.add('is-visible');
        }, parseInt(delay));
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  animatedElements.forEach(el => observer.observe(el));
}

/* ==========================================================================
   4. Animated Stats Counter (Counting Up on Scroll)
   ========================================================================== */
function initStatsCounter() {
  const statNumbers = document.querySelectorAll('.stat-number');
  if (!statNumbers.length) return;

  const observerOptions = {
    threshold: 0.5
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const targetVal = parseFloat(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        const decimals = parseInt(el.dataset.decimal) || 0;
        const duration = 1500; // ms
        const startTime = performance.now();

        const updateCount = (currentTime) => {
          const elapsedTime = currentTime - startTime;
          const progress = Math.min(elapsedTime / duration, 1);
          // Ease-out quad formula
          const easeProgress = progress * (2 - progress);
          const currentVal = targetVal * easeProgress;

          el.textContent = currentVal.toFixed(decimals) + suffix;

          if (progress < 1) {
            requestAnimationFrame(updateCount);
          } else {
            el.textContent = targetVal.toFixed(decimals) + suffix;
          }
        };

        requestAnimationFrame(updateCount);
        obs.unobserve(el);
      }
    });
  }, observerOptions);

  statNumbers.forEach(num => observer.observe(num));
}

/* ==========================================================================
   5. FAQ Accordion Toggle System
   ========================================================================== */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  if (!faqItems.length) return;

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!question || !answer) return;

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all accordion items
      faqItems.forEach(i => {
        i.classList.remove('active');
        const a = i.querySelector('.faq-answer');
        if (a) a.style.maxHeight = '0px';
      });

      // Open clicked item if it was closed
      if (!isActive) {
        item.classList.add('active');
        answer.style.maxHeight = (answer.scrollHeight + 40) + 'px';
      }
    });
  });
}

/* ==========================================================================
   6. Installation Guide Subtab Switcher
   ========================================================================== */
function initInstallGuideTabs() {
  const tabBtns = document.querySelectorAll('.install-tab-btn');
  const panels = document.querySelectorAll('.install-panel');
  if (!tabBtns.length || !panels.length) return;

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      panels.forEach(panel => {
        if (panel.id === `tab-${targetTab}`) {
          panel.style.display = 'block';
          panel.classList.add('active');
        } else {
          panel.style.display = 'none';
          panel.classList.remove('active');
        }
      });
    });
  });
}

/* ==========================================================================
   7. Code Copy Buttons
   ========================================================================== */
function initCopyButtons() {
  const copyBtns = document.querySelectorAll('.code-copy-btn');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const textToCopy = btn.dataset.copyText;
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy);
        const origContent = btn.innerHTML;
        btn.innerHTML = `<span style="color: #10B981; font-weight: 700;">Copied! ✓</span>`;
        setTimeout(() => { btn.innerHTML = origContent; }, 2000);
      }
    });
  });
}

/* ==========================================================================
   8. BlurFadeText Staggered Word Reveal System
   ========================================================================== */
function initBlurFadeText() {
  const elements = document.querySelectorAll('.blur-fade');
  if (!elements.length) return;

  elements.forEach((el) => {
    const delay = parseFloat(el.dataset.delay || '0.12');
    let wordIndex = 0;

    function processNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (!text.trim()) return;

        const fragment = document.createDocumentFragment();
        const words = text.split(/(\s+)/);

        words.forEach((word) => {
          if (/\s+/.test(word)) {
            fragment.appendChild(document.createTextNode(word));
          } else if (word) {
            const span = document.createElement('span');
            span.className = 'blur-fade-word';
            span.textContent = word;
            span.style.transitionDelay = `${wordIndex * delay}s`;
            fragment.appendChild(span);
            wordIndex++;
          }
        });

        node.parentNode.replaceChild(fragment, node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.id === 'wordRotator' || node.classList.contains('word-rotator')) return;
        Array.from(node.childNodes).forEach(processNode);
      }
    }

    Array.from(el.childNodes).forEach(processNode);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.blur-fade-word').forEach((wordSpan) => {
          wordSpan.classList.add('in-view');
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  elements.forEach((el) => observer.observe(el));
}

/* ==========================================================================
   9. TextRoll Character Stagger Hover System
   ========================================================================== */
function initTextRoll() {
  const elements = document.querySelectorAll('.text-roll');
  if (!elements.length) return;

  const STAGGER = 0.045;

  elements.forEach((el) => {
    const text = el.textContent.trim();
    if (!text || el.querySelector('.text-roll-wrapper')) return;

    const center = el.hasAttribute('data-center');
    const length = text.length;
    const mid = (length - 1) / 2;

    el.textContent = '';

    const wrapper = document.createElement('span');
    wrapper.className = 'text-roll-wrapper';

    const topContainer = document.createElement('span');
    topContainer.className = 'text-roll-top';

    const bottomContainer = document.createElement('span');
    bottomContainer.className = 'text-roll-bottom';
    bottomContainer.setAttribute('aria-hidden', 'true');

    for (let i = 0; i < length; i++) {
      const char = text[i];
      const delay = center
        ? STAGGER * Math.abs(i - mid)
        : STAGGER * i;

      const topSpan = document.createElement('span');
      topSpan.className = 'text-roll-char';
      topSpan.style.transitionDelay = `${delay}s`;
      topSpan.textContent = char === ' ' ? '\u00A0' : char;
      topContainer.appendChild(topSpan);

      const bottomSpan = document.createElement('span');
      bottomSpan.className = 'text-roll-char';
      bottomSpan.style.transitionDelay = `${delay}s`;
      bottomSpan.textContent = char === ' ' ? '\u00A0' : char;
      bottomContainer.appendChild(bottomSpan);
    }

    wrapper.appendChild(topContainer);
    wrapper.appendChild(bottomContainer);
    el.appendChild(wrapper);
  });
}

/* ==========================================================================
   10. Cegnify-Style Feedback / Testimonial Carousel Engine
   ========================================================================== */
function initFeedbackCarousel() {
  const stack = document.getElementById('feedbackAvatarStack');
  const quoteEl = document.getElementById('feedbackQuote');
  const nameEl = document.getElementById('feedbackAuthorName');
  const roleEl = document.getElementById('feedbackAuthorRole');
  const prevBtn = document.getElementById('feedbackPrevBtn');
  const nextBtn = document.getElementById('feedbackNextBtn');

  if (!stack || !quoteEl) return;

  const feedbacks = [
    {
      quote: '"Squeeze completely stopped my Claude.ai rate limit warnings when debugging large API logs. It\'s an essential tool for my daily workflow."',
      name: 'Alex Rivera',
      role: 'Full-Stack Engineer'
    },
    {
      quote: '"Our workflow finally runs smoothly. Tasks are automated, information is organized, and decisions happen faster than ever."',
      name: 'Michael Reyes',
      role: 'Operations Manager'
    },
    {
      quote: '"Pasting entire JSON responses used to eat up my context window instantly. With Squeeze running locally, I get 3x more conversation turns."',
      name: 'Sarah Chen',
      role: 'Backend Developer'
    }
  ];

  let currentIndex = 1; // Start on middle active card (Michael Reyes)

  function updateDisplay(index) {
    currentIndex = index;
    const cards = stack.querySelectorAll('.feedback-avatar-card');

    cards.forEach((card, i) => {
      if (i === currentIndex) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    quoteEl.classList.add('switching');
    setTimeout(() => {
      quoteEl.textContent = feedbacks[currentIndex].quote;
      nameEl.textContent = feedbacks[currentIndex].name;
      roleEl.textContent = feedbacks[currentIndex].role;
      quoteEl.classList.remove('switching');
    }, 200);
  }

  // Avatar click handling
  const cards = stack.querySelectorAll('.feedback-avatar-card');
  cards.forEach((card, i) => {
    card.addEventListener('click', () => updateDisplay(i));
  });

  // Prev / Next button controls
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const newIdx = (currentIndex - 1 + feedbacks.length) % feedbacks.length;
      updateDisplay(newIdx);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const newIdx = (currentIndex + 1) % feedbacks.length;
      updateDisplay(newIdx);
    });
  }
}


