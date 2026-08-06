// Premium Gate — Feature Flag Controller
// Checks license key validity and enables premium features.
// Standalone module — does NOT depend on Squeeze.
//
// DEV MODE: Hardcoded to true for development/testing.
// Flip DEV_MODE to false before shipping to production.

(function() {
  "use strict";

  const DEV_MODE = true; // ← Set to false for production release

  function validateAndActivate() {
    if (DEV_MODE) {
      // Development: enable everything immediately
      window.__squeezeSmartRouterEnabled = true;
      document.dispatchEvent(new CustomEvent("squeeze-premium-ready"));
      return;
    }

    // Production: check license key in storage
    chrome.storage.local.get(["premiumKey", "premiumExpiry"], (data) => {
      if (!data.premiumKey) {
        window.__squeezeSmartRouterEnabled = false;
        return;
      }

      // Validate key format: SQ-PRO-XXXXXXXXXXXX (12 alphanumeric)
      const validFormat = /^SQ-PRO-[A-Z0-9]{12}$/.test(data.premiumKey);
      const notExpired = data.premiumExpiry && Date.now() < data.premiumExpiry;

      if (validFormat && notExpired) {
        window.__squeezeSmartRouterEnabled = true;
        document.dispatchEvent(new CustomEvent("squeeze-premium-ready"));
      } else {
        window.__squeezeSmartRouterEnabled = false;

        // Notify if key expired (for UI to show renewal prompt)
        if (validFormat && !notExpired) {
          document.dispatchEvent(new CustomEvent("squeeze-premium-expired"));
        }
      }
    });
  }

  // Listen for key activation/changes while page is open
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.premiumKey || changes.premiumExpiry) {
      validateAndActivate();
    }
  });

  // Run on load
  validateAndActivate();

})();
