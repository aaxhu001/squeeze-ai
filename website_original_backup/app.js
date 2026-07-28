/**
 * Squeeze Landing Page - Minimal Client Logic
 * Handles theme toggling, scroll reveal, typing simulation,
 * live sandbox squeezer, token calculations, and ambient canvas.
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 1. Theme Configuration & Toggling
  // ==========================================
  const htmlEl = document.documentElement;
  const themeToggleBtn = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const footerThemeBtns = document.querySelectorAll('.theme-seg-btn');
  
  const moonIconPath = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';
  const sunIconPath = 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42';
  
  // Initialize theme
  let currentTheme = localStorage.getItem('squeeze-theme') || 'dark';
  setTheme(currentTheme);
  
  function setTheme(theme) {
    htmlEl.setAttribute('data-theme', theme);
    currentTheme = theme;
    localStorage.setItem('squeeze-theme', theme);
    
    // Update header toggle icon
    if (theme === 'dark') {
      themeIcon.innerHTML = `<path d="${moonIconPath}"/>`;
    } else {
      themeIcon.innerHTML = `<circle cx="12" cy="12" r="5"/><path d="${sunIconPath}"/>`;
    }
    
    // Update footer segment buttons
    footerThemeBtns.forEach(btn => {
      if (btn.getAttribute('data-theme') === theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  
  // Header toggle click
  themeToggleBtn.addEventListener('click', () => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  });
  
  // Footer segment selectors
  footerThemeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedTheme = btn.getAttribute('data-theme');
      setTheme(selectedTheme);
    });
  });

  // ==========================================
  // 2. Advanced Interactive Ambient Canvas (Constellation & Shockwaves)
  // ==========================================
  const canvas = document.getElementById('shapegrid-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    
    const particles = [];
    const particleCount = 42;
    const maxDistance = 150;
    const shockwaves = [];
    const floatingTokens = [];
    const tokenWords = ['[TRIMMED]', '⚡', 'token', 'context', '35%', 'lean', 'prompt'];

    let mouse = { x: null, y: null, active: false };

    // Floating Token blueprint
    class FloatingToken {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * width;
        this.y = height + Math.random() * 100;
        this.vy = -(Math.random() * 0.4 + 0.2);
        this.vx = (Math.random() - 0.5) * 0.3;
        this.text = tokenWords[Math.floor(Math.random() * tokenWords.length)];
        this.size = Math.random() * 3 + 9; // font size
        this.alpha = Math.random() * 0.15 + 0.08;
      }

      update() {
        this.y += this.vy;
        this.x += this.vx;

        // Mouse deflector force
        if (mouse.active) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const force = (140 - dist) / 140;
            this.x -= (dx / dist) * force * 1.5;
            this.y -= (dy / dist) * force * 1.5;
          }
        }

        if (this.y < -30) {
          this.reset();
        }
      }

      draw() {
        const theme = htmlEl.getAttribute('data-theme');
        ctx.font = `${this.size}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = theme === 'dark' 
          ? `rgba(181, 96, 63, ${this.alpha * 0.7})` 
          : `rgba(181, 96, 63, ${this.alpha * 0.5})`;
        ctx.fillText(this.text, this.x, this.y);
      }
    }
    
    // Interactive Node Particle blueprint
    class InteractiveParticle {
      constructor() {
        this.reset();
      }
      
      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.baseVx = (Math.random() - 0.5) * 0.6;
        this.baseVy = (Math.random() - 0.5) * 0.6;
        this.vx = this.baseVx;
        this.vy = this.baseVy;
        this.radius = Math.random() * 1.8 + 1.2;
      }
      
      update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // Soft dampening back to base speed
        this.vx += (this.baseVx - this.vx) * 0.02;
        this.vy += (this.baseVy - this.vy) * 0.02;

        // Screen boundary bounce
        if (this.x < 0 || this.x > width) this.baseVx *= -1;
        if (this.y < 0 || this.y > height) this.baseVy *= -1;
        
        // Mouse Gravity Magnet attraction
        if (mouse.active) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 190) {
            const force = (190 - dist) / 190;
            this.vx += (dx / dist) * force * 0.25;
            this.vy += (dy / dist) * force * 0.25;
          }
        }

        // React to shockwaves (click bursts)
        shockwaves.forEach(wave => {
          const dx = this.x - wave.x;
          const dy = this.y - wave.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const diff = Math.abs(dist - wave.radius);
          if (diff < 40 && wave.radius < wave.maxRadius) {
            const force = (40 - diff) / 40;
            this.vx += (dx / (dist || 1)) * force * 2.5;
            this.vy += (dy / (dist || 1)) * force * 2.5;
          }
        });
      }
      
      draw() {
        const theme = htmlEl.getAttribute('data-theme');
        const particleOpacity = theme === 'dark' ? 0.35 : 0.25;
        
        ctx.fillStyle = theme === 'dark' ? `rgba(181, 96, 63, ${particleOpacity})` : `rgba(181, 96, 63, ${particleOpacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Initialize Particles & Floating Tokens
    for (let i = 0; i < particleCount; i++) {
      particles.push(new InteractiveParticle());
    }
    for (let i = 0; i < 14; i++) {
      floatingTokens.push(new FloatingToken());
    }
    
    // Mouse event tracking
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    });
    
    window.addEventListener('mouseleave', () => {
      mouse.x = null;
      mouse.y = null;
      mouse.active = false;
    });

    // Click to create Shockwave Ripple
    window.addEventListener('click', (e) => {
      // Don't trigger shockwave if clicking interactive buttons or inputs
      if (e.target.closest('button, a, input, textarea, select')) return;
      shockwaves.push({
        x: e.clientX,
        y: e.clientY,
        radius: 5,
        maxRadius: 220,
        alpha: 0.6
      });
    });
    
    // Resize listener
    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });
    
    // Render loop
    function loop() {
      ctx.clearRect(0, 0, width, height);
      
      const theme = htmlEl.getAttribute('data-theme');
      const accentRGB = '181, 96, 63';
      
      // 1. Draw Subtle Mouse Spotlight Aura (Subtle UI accent matching brand)
      if (mouse.active) {
        const glowRadius = theme === 'dark' ? 160 : 130;
        const glowOpacity = theme === 'dark' ? 0.025 : 0.018; // Very subtle, clean ambient glow
        
        const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, glowRadius);
        grad.addColorStop(0, `rgba(${accentRGB}, ${glowOpacity})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Draw & Update Floating Tokens
      floatingTokens.forEach(t => {
        t.update();
        t.draw();
      });
      
      // 3. Draw & Update Shockwaves
      for (let w = shockwaves.length - 1; w >= 0; w--) {
        const wave = shockwaves[w];
        wave.radius += 4.5;
        wave.alpha -= 0.012;

        if (wave.alpha <= 0 || wave.radius >= wave.maxRadius) {
          shockwaves.splice(w, 1);
          continue;
        }

        ctx.strokeStyle = `rgba(${accentRGB}, ${wave.alpha * 0.4})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4. Update and Draw Constellation Web
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        p1.update();
        p1.draw();
        
        // Connect near cursor (subtle opacity)
        if (mouse.active) {
          const dx = p1.x - mouse.x;
          const dy = p1.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const lineOpacity = (1 - (dist / 140)) * (theme === 'dark' ? 0.12 : 0.08);
            ctx.strokeStyle = `rgba(${accentRGB}, ${lineOpacity})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }

        // Connect near particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < maxDistance) {
            const lineOpacity = (1 - (dist / maxDistance)) * (theme === 'dark' ? 0.12 : 0.07);
            ctx.strokeStyle = `rgba(${accentRGB}, ${lineOpacity})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      
      requestAnimationFrame(loop);
    }
    loop();
  }

  // ==========================================
  // 3. Scroll Reveal Animations
  // ==========================================
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -20px 0px'
  });
  
  revealElements.forEach(el => revealObserver.observe(el));

  // ==========================================
  // 4. Mockup UI Typing/Pruning Simulation
  // ==========================================
  const mockPromptText = document.getElementById('mockPromptText');
  const mockStatPrompts = document.getElementById('mockStatPrompts');
  const mockStatCost = document.getElementById('mockStatCost');
  const mockRuleAbbreviate = document.getElementById('mockRuleAbbreviate');
  const mockModeBtnSqueeze = document.querySelector('.ext-modes [data-mode="squeeze"]');
  const mockModeBtnBalanced = document.querySelector('.ext-modes [data-mode="balanced"]');
  const mockSqueezeBtn = document.getElementById('mockSqueezeBtn');
  
  if (mockPromptText) {
    const originalText = "Hey Claude, hope you're doing well! Here is the React dashboard component code again. I made a tiny tweak to the login button style. Could you please review it and check for any bugs? Thanks so much!\n\n```jsx\n// [2,400 lines of unchanged React dashboard code copy-pasted here for the 3rd time in this thread...]\n```";
    const balancedText = "Here is the React dashboard component code. I made a tiny tweak to the login button style. Review it and check for bugs.\n\n[Deduplicated: 2,400 lines of unchanged code trimmed to keep prompt cache stable]";
    const squeezedText = "React dashboard component code. Tweak to login button style. Review, check for bugs.\n\n[Trimmed: 2,400 lines duplicate code pruned]";
    
    let step = 0;
    
    // Simulate interactive widget squeeze action
    setInterval(() => {
      if (step === 0) {
        // Transition to Balanced
        mockPromptText.style.opacity = '0.5';
        if (mockSqueezeBtn) mockSqueezeBtn.classList.add('active');
        setTimeout(() => {
          mockPromptText.textContent = balancedText;
          mockPromptText.style.opacity = '1';
          mockStatPrompts.textContent = "125";
          mockStatCost.textContent = "$14.23";
        }, 300);
        step = 1;
      } else if (step === 1) {
        // Switch mock to Squeeze Mode
        mockPromptText.style.opacity = '0.5';
        if (mockSqueezeBtn) mockSqueezeBtn.classList.add('active');
        if (mockModeBtnBalanced) mockModeBtnBalanced.classList.remove('active');
        if (mockModeBtnSqueeze) mockModeBtnSqueeze.classList.add('active');
        if (mockRuleAbbreviate) {
          mockRuleAbbreviate.checked = true;
          mockRuleAbbreviate.parentElement.style.color = 'rgb(var(--fg-bright))';
        }
        
        setTimeout(() => {
          mockPromptText.textContent = squeezedText;
          mockPromptText.style.opacity = '1';
          mockStatPrompts.textContent = "126";
          mockStatCost.textContent = "$14.28";
        }, 300);
        step = 2;
      } else {
        // Reset to original state
        mockPromptText.style.opacity = '0.5';
        if (mockSqueezeBtn) mockSqueezeBtn.classList.remove('active');
        if (mockModeBtnSqueeze) mockModeBtnSqueeze.classList.remove('active');
        if (mockModeBtnBalanced) mockModeBtnBalanced.classList.add('active');
        if (mockRuleAbbreviate) {
          mockRuleAbbreviate.checked = false;
          mockRuleAbbreviate.parentElement.style.color = 'rgb(var(--fg-base))';
        }
        
        setTimeout(() => {
          mockPromptText.textContent = originalText;
          mockPromptText.style.opacity = '1';
        }, 300);
        step = 0;
      }
    }, 7000);
  }

  // ==========================================
  // 5. Interactive Squeezer Sandbox Logic
  // ==========================================
  const squeezerInput = document.getElementById('squeezerInput');
  const squeezerOutput = document.getElementById('squeezerOutput');
  const rawTokenCount = document.getElementById('rawTokenCount');
  const squeezedTokenCount = document.getElementById('squeezedTokenCount');
  const squeezerSavings = document.getElementById('squeezerSavings');
  
  const presetBtns = document.querySelectorAll('.squeezer-tab');
  const modeLabels = document.querySelectorAll('.mode-radio-label');
  
  const presets = {
    polite: "Hello Claude, I hope you are having a wonderful day! Please could you write a typescript function that maps the active user profiles? Thanks so much in advance!",
    filler: "In order to optimize our database, we should check if there are index columns. This is because in the event that there are no indexes, the query will run slow. Please check and let me know.",
    shorthand: "Please write a database helper function that retrieves the active user profile data from the profiles database table. Let me know if that makes sense, thanks!",
    custom: ""
  };
  
  let activePreset = 'polite';
  let activeMode = 'balanced';
  
  // Set initial preset text
  if (squeezerInput) {
    squeezerInput.value = presets[activePreset];
    runSqueeze();
  }
  
  // Listen to preset tab clicks
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      activePreset = btn.getAttribute('data-preset');
      if (activePreset !== 'custom') {
        squeezerInput.value = presets[activePreset];
        squeezerInput.readOnly = false;
      } else {
        squeezerInput.value = "";
        squeezerInput.placeholder = "Type your own verbose prompt here...";
        squeezerInput.readOnly = false;
        squeezerInput.focus();
      }
      runSqueeze();
    });
  });
  
  // Listen to optimization mode radios
  modeLabels.forEach(label => {
    label.addEventListener('click', (e) => {
      modeLabels.forEach(l => l.classList.remove('active'));
      label.classList.add('active');
      
      const radio = label.querySelector('input');
      activeMode = radio.value;
      runSqueeze();
    });
  });
  
  // Listen to textarea input
  if (squeezerInput) {
    squeezerInput.addEventListener('input', () => {
      // Auto switch preset tab to "custom" if text doesn't match presets
      let isPreset = false;
      Object.keys(presets).forEach(key => {
        if (key !== 'custom' && presets[key] === squeezerInput.value) {
          isPreset = true;
        }
      });
      
      if (!isPreset) {
        presetBtns.forEach(b => {
          if (b.getAttribute('data-preset') === 'custom') {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
        activePreset = 'custom';
      }
      runSqueeze();
    });
  }
  
  // Simulated squeeze logic
  function runSqueeze() {
    const input = squeezerInput.value;
    if (!input) {
      squeezerOutput.textContent = "";
      rawTokenCount.textContent = "0 chars";
      squeezedTokenCount.textContent = "0 chars";
      squeezerSavings.textContent = "0% Trimmed";
      return;
    }
    
    let output = input;
    
    // Balanced Mode optimizations
    if (activeMode === 'balanced' || activeMode === 'squeeze') {
      // Clean greetings & endings
      const greetingRegex = /^(hello|hi|hey|dear)\s+(claude|assistant|ai|bot)?(?:,\s*)?(?:hope you are having a wonderful day|hope you're doing well|good morning|good afternoon|good evening)?(?:[!\.,\s]+)?/i;
      const startingPoliteness = /^(please\s+could\s+you|could\s+you\s+please|can\s+you|please|would\s+you\s+mind)\s+/i;
      const endingPoliteness = /(?:thanks\s+so\s+much|thanks\s+in\s+advance|thank\s+you|thanks|let\s+me\s+know|let\s+me\s+know\s+if\s+that\s+makes\s+sense)?(?:[!\.,\s]*)$/i;
      
      output = output.replace(greetingRegex, '');
      output = output.replace(startingPoliteness, '');
      
      // Simplify verbose phrases
      const verboseReplacements = [
        { regex: /in\s+order\s+to/gi, rep: 'to' },
        { regex: /this\s+is\s+because/gi, rep: 'because' },
        { regex: /in\s+the\s+event\s+that/gi, rep: 'if' },
        { regex: /due\s+to\s+the\s+fact\s+that/gi, rep: 'because' },
        { regex: /a\s+large\s+number\s+of/gi, rep: 'many' },
        { regex: /at\s+this\s+point\s+in\s+time/gi, rep: 'now' }
      ];
      
      verboseReplacements.forEach(item => {
        output = output.replace(item.regex, item.rep);
      });
      
      output = output.replace(endingPoliteness, '');
      output = output.trim();
      
      // Capitalize first letter of output if it was trimmed
      if (output.length > 0) {
        output = output.charAt(0).toUpperCase() + output.slice(1);
      }
    }
    
    // Squeeze Mode aggressive optimizations (on top of balanced)
    if (activeMode === 'squeeze') {
      // Abbreviate common technical words
      const techAbbreviations = [
        { regex: /\btypescript\b/gi, rep: 'TS' },
        { regex: /\bjavascript\b/gi, rep: 'JS' },
        { regex: /\bfunction\b/gi, rep: 'fn' },
        { regex: /\bdatabase\b/gi, rep: 'DB' },
        { regex: /\bactive\s+user\s+profiles\b/gi, rep: 'active users' },
        { regex: /\bhelper\b/gi, rep: 'util' },
        { regex: /\bretrieves\b/gi, rep: 'gets' },
        { regex: /\bapplication\b/gi, rep: 'app' },
        { regex: /\bconfiguration\b/gi, rep: 'config' }
      ];
      
      techAbbreviations.forEach(item => {
        output = output.replace(item.regex, item.rep);
      });
      
      // Strip articles ("a", "an", "the")
      output = output.replace(/\b(the|a|an)\s+/gi, '');
    }
    
    // Polish Mode optimizations
    if (activeMode === 'polish') {
      // Normalize space gaps and bullet layouts
      output = output.replace(/[ \t]+/g, ' '); // collapse double spaces
      output = output.replace(/\n\s*\n\s*\n/g, '\n\n'); // collapse triple linebreaks
      output = output.replace(/^\s*\*+/gm, '-'); // replace * lists with -
    }
    
    // Update dashboard values
    const rawLen = input.length;
    const optLen = output.length;
    const reduction = rawLen > 0 ? Math.max(0, Math.round(((rawLen - optLen) / rawLen) * 100)) : 0;
    
    rawTokenCount.textContent = `${rawLen} chars`;
    squeezedTokenCount.textContent = `${optLen} chars`;
    squeezerSavings.textContent = `${reduction}% Trimmed`;
    squeezerOutput.textContent = output;
  }

  // ==========================================
  // 6. Interactive Savings Calculator
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
    const size = parseInt(sliderPromptSize.value, 10);
    const count = parseInt(sliderPromptCount.value, 10);
    const rate = parseInt(sliderReductionRate.value, 10);
    
    // Update slider readouts
    valPromptSize.textContent = `${size.toLocaleString()} tokens`;
    valPromptCount.textContent = `${count} prompts`;
    valReductionRate.textContent = `${rate}% saved`;
    
    // Perform Math: 30 days per month
    // Claude Sonnet 5 input token cost: $3.00 per 1,000,000 tokens
    const totalInputTokensPerMonth = size * count * 30;
    const tokensSavedMonthly = totalInputTokensPerMonth * (rate / 100);
    const cashSavedMonthly = (tokensSavedMonthly / 1000000) * 3.00;
    
    // Format values
    if (tokensSavedMonthly >= 1000000) {
      monthlyTokensVal.textContent = `${(tokensSavedMonthly / 1000000).toFixed(2)}M`;
    } else {
      monthlyTokensVal.textContent = `${Math.round(tokensSavedMonthly / 100).toLocaleString()}K`;
    }
    
    monthlySavingsVal.textContent = `$${cashSavedMonthly.toFixed(2)}`;
  }
  
  if (sliderPromptSize && sliderPromptCount && sliderReductionRate) {
    sliderPromptSize.addEventListener('input', updateCalculator);
    sliderPromptCount.addEventListener('input', updateCalculator);
    sliderReductionRate.addEventListener('input', updateCalculator);
    
    // Run initial calc
    updateCalculator();
  }

  // ==========================================
  // 7. VIP Waitlist Modal & Database Storage
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

  // Configurable Private Webhook / Database Endpoint
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

  // Open modal listeners
  openWaitlistBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openWaitlist();
    });
  });

  // Close modal listeners
  if (closeWaitlistModalBtn) closeWaitlistModalBtn.addEventListener('click', closeWaitlist);
  if (successCloseBtn) successCloseBtn.addEventListener('click', closeWaitlist);

  // Close on backdrop click
  if (waitlistModal) {
    waitlistModal.addEventListener('click', (e) => {
      if (e.target === waitlistModal) {
        closeWaitlist();
      }
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && waitlistModal && waitlistModal.classList.contains('active')) {
      closeWaitlist();
    }
  });

  // Form submission & Private Backend Transmission
  if (waitlistForm) {
    let isSubmitting = false;

    waitlistForm.addEventListener('submit', async (e) => {
      if (waitlistError) waitlistError.style.display = 'none';

      const email = waitlistEmail ? waitlistEmail.value.trim() : '';
      const whatsapp = waitlistWhatsapp ? waitlistWhatsapp.value.trim() : '';

      // Validation
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

      // UI Loading state
      setSubmittingState(true);

      // Format whatsapp input safely so leading '+' sign never triggers formula parse errors (#ERROR!) in Google Sheets
      let safeWhatsapp = whatsapp;
      if (safeWhatsapp.startsWith('+')) {
        safeWhatsapp = "'" + safeWhatsapp;
      }

      try {
        // Send via fetch as well for maximum reliability
        if (WAITLIST_CONFIG.endpointUrl) {
          const params = new URLSearchParams();
          params.append('email', email);
          params.append('whatsapp', safeWhatsapp);
          params.append('timestamp', new Date().toLocaleString());

          fetch(WAITLIST_CONFIG.endpointUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
          }).catch(err => console.log('Fetch submit notice:', err));
        }

        // Allow form target POST to proceed to hidden iframe, then transition UX
        setTimeout(() => {
          waitlistForm.reset();
          setSubmittingState(false);
          if (waitlistFormContainer) waitlistFormContainer.style.display = 'none';
          if (waitlistSuccess) waitlistSuccess.style.display = 'block';
        }, 650);

      } catch (err) {
        console.error('Waitlist submission error:', err);
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
});

