/**
 * NY.gov CAPTCHA Hotfix & Debug Agent
 * 
 * This script fixes the BotDetect CAPTCHA visibility bug and 
 * injects a DebugAgent for logging verification events.
 * 
 * Usage: Paste into browser console or inject via bookmarklet/extension
 */

(function() {
  'use strict';

  // ========================
  // Debug Agent Implementation
  // ========================
  class DebugAgent {
    constructor() {
      this.logs = [];
      this.startTime = Date.now();
      console.log('[DebugAgent] Initialized at', new Date().toISOString());
    }

    trace(event, payload = {}) {
      const entry = {
        event,
        payload,
        timestamp: new Date().toISOString(),
        elapsed: Date.now() - this.startTime
      };
      this.logs.push(entry);
      console.log('[DebugAgent]', JSON.stringify(entry, null, 2));
      return entry;
    }

    exportLogs() {
      return JSON.stringify(this.logs, null, 2);
    }

    downloadLogs() {
      const blob = new Blob([this.exportLogs()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nygov-debug-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // ========================
  // CAPTCHA Visibility Fix
  // ========================
  function fixCaptchaVisibility() {
    const captchaSelectors = [
      '#c_customerdetails_captchaformlayout_captcha_CaptchaImage',
      '[id*="CaptchaImage"]',
      '.BDC_CaptchaImage',
      'img[src*="BotDetectCaptcha"]'
    ];

    let fixed = false;

    captchaSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el.offsetWidth === 0 || el.offsetHeight === 0) {
          el.style.cssText = `
            width: 250px !important;
            height: 50px !important;
            display: inline-block !important;
            visibility: visible !important;
            opacity: 1 !important;
          `;
          
          // Fix parent containers too
          let parent = el.parentElement;
          let depth = 0;
          while (parent && depth < 3) {
            if (parent.offsetWidth === 0 || parent.offsetHeight === 0) {
              parent.style.cssText = `
                min-width: 260px !important;
                min-height: 60px !important;
                display: block !important;
                visibility: visible !important;
              `;
            }
            parent = parent.parentElement;
            depth++;
          }
          
          fixed = true;
          window.debugAgent?.trace('captcha.visibility.fixed', {
            selector,
            elementId: el.id,
            naturalWidth: el.naturalWidth,
            naturalHeight: el.naturalHeight
          });
        }
      });
    });

    return fixed;
  }

  // ========================
  // Form Submission Interceptor
  // ========================
  function interceptFormSubmission() {
    const form = document.querySelector('form');
    if (!form) return;

    // Wrap ASP.NET's __doPostBack
    const originalDoPostBack = window.__doPostBack;
    if (originalDoPostBack) {
      window.__doPostBack = function(eventTarget, eventArgument) {
        window.debugAgent?.trace('form.submit.attempt', {
          eventTarget,
          eventArgument,
          captchaValue: getCaptchaValue(),
          hiddenTokens: getHiddenTokens()
        });
        return originalDoPostBack.call(this, eventTarget, eventArgument);
      };
      
      window.debugAgent?.trace('form.intercept.installed', { method: '__doPostBack' });
    }

    // Also intercept native submit
    form.addEventListener('submit', function(e) {
      window.debugAgent?.trace('form.submit.native', {
        captchaValue: getCaptchaValue(),
        hiddenTokens: getHiddenTokens()
      });
    }, true);
  }

  function getCaptchaValue() {
    const input = document.querySelector('[id*="CaptchaCodeTextBox"]') || 
                  document.querySelector('input[name*="captcha"]');
    return input ? input.value : null;
  }

  function getHiddenTokens() {
    const tokens = {};
    document.querySelectorAll('input[type="hidden"]').forEach(input => {
      if (input.id.includes('VCID') || 
          input.name.includes('captcha') || 
          input.name.includes('token')) {
        tokens[input.name || input.id] = input.value?.substring(0, 32) + '...';
      }
    });
    return tokens;
  }

  // ========================
  // reCAPTCHA Polyfill (if switching to reCAPTCHA)
  // ========================
  function injectRecaptchaWidget(siteKey) {
    // Check if reCAPTCHA is already loaded
    if (typeof grecaptcha !== 'undefined') {
      window.debugAgent?.trace('recaptcha.already.loaded');
      return;
    }

    window.debugAgent?.trace('recaptcha.inject.start', { siteKey });

    // Create the widget container
    const container = document.createElement('div');
    container.id = 'recaptcha-widget';
    container.className = 'recaptcha-widget';
    container.style.cssText = 'margin: 10px 0;';

    // Create hidden token input
    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.id = 'recaptchaToken';
    tokenInput.name = 'recaptchaToken';

    // Find where to insert (near CAPTCHA area)
    const captchaArea = document.querySelector('[id*="captchaFormLayout"]') ||
                        document.querySelector('.BDC_CaptchaDiv');
    if (captchaArea) {
      captchaArea.parentNode.insertBefore(container, captchaArea);
      captchaArea.parentNode.insertBefore(tokenInput, captchaArea);
    }

    // Load reCAPTCHA script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?onload=onRecaptchaReady&render=explicit`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    // Callback when reCAPTCHA loads
    window.onRecaptchaReady = function() {
      window.debugAgent?.trace('recaptcha.loaded');
      
      grecaptcha.render('recaptcha-widget', {
        sitekey: siteKey,
        callback: function(token) {
          window.latestRecaptchaToken = token;
          document.getElementById('recaptchaToken').value = token;
          window.debugAgent?.trace('recaptcha.verification.success', {
            tokenLength: token.length
          });
        },
        'expired-callback': function() {
          window.latestRecaptchaToken = '';
          document.getElementById('recaptchaToken').value = '';
          window.debugAgent?.trace('recaptcha.verification.expired');
        },
        'error-callback': function() {
          window.debugAgent?.trace('recaptcha.verification.error');
        }
      });
    };
  }

  // ========================
  // Network Request Monitor
  // ========================
  function monitorNetworkRequests() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      window.debugAgent?.trace('network.fetch.start', { url });
      
      try {
        const response = await originalFetch.apply(this, args);
        window.debugAgent?.trace('network.fetch.complete', {
          url,
          status: response.status,
          ok: response.ok
        });
        return response;
      } catch (error) {
        window.debugAgent?.trace('network.fetch.error', {
          url,
          error: error.message
        });
        throw error;
      }
    };

    // Also monitor XHR
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._debugUrl = url;
      window.debugAgent?.trace('network.xhr.open', { method, url });
      return originalXHROpen.call(this, method, url, ...rest);
    };
  }

  // ========================
  // Error Handler
  // ========================
  function installErrorHandler() {
    window.addEventListener('error', function(event) {
      window.debugAgent?.trace('error.uncaught', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    window.addEventListener('unhandledrejection', function(event) {
      window.debugAgent?.trace('error.promise.rejection', {
        reason: event.reason?.toString()
      });
    });
  }

  // ========================
  // Main Initialization
  // ========================
  function init() {
    // Create global debug agent
    window.debugAgent = new DebugAgent();
    
    // Log page info
    window.debugAgent.trace('page.load', {
      url: window.location.href,
      title: document.title,
      userAgent: navigator.userAgent
    });

    // Fix CAPTCHA visibility
    const captchaFixed = fixCaptchaVisibility();
    window.debugAgent.trace('captcha.fix.result', { fixed: captchaFixed });

    // Set up monitoring
    interceptFormSubmission();
    monitorNetworkRequests();
    installErrorHandler();

    // Create UI controls
    createDebugPanel();

    console.log('%c[NY.gov Hotfix] Loaded successfully!', 'color: green; font-weight: bold;');
    console.log('Use window.debugAgent.downloadLogs() to export debug data');
  }

  function createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'nygov-debug-panel';
    panel.innerHTML = `
      <div style="
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: #1a1a2e;
        color: #eee;
        padding: 10px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 12px;
        z-index: 999999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      ">
        <strong>🔧 Debug Agent Active</strong><br>
        <button id="debug-download" style="margin-top: 5px; cursor: pointer;">📥 Download Logs</button>
        <button id="debug-fix-captcha" style="margin-top: 5px; cursor: pointer;">🔄 Re-fix CAPTCHA</button>
        <span id="debug-log-count" style="margin-left: 10px;">0 events</span>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('debug-download').onclick = () => window.debugAgent.downloadLogs();
    document.getElementById('debug-fix-captcha').onclick = () => {
      fixCaptchaVisibility();
      window.debugAgent.trace('captcha.fix.manual');
    };

    // Update log count periodically
    setInterval(() => {
      const count = window.debugAgent?.logs?.length || 0;
      document.getElementById('debug-log-count').textContent = `${count} events`;
    }, 1000);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
