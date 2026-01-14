/**
 * Shared DOM query and manipulation helpers
 * Consolidates repeated patterns from across renderer scripts
 */

/**
 * Safe getElementById wrapper with optional fallback
 * @param {string} id - Element ID to query
 * @param {Element} root - Optional root element (default: document)
 * @returns {Element|null} - Found element or null
 */
function byId(id, root = document) {
  try {
    return root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`);
  } catch (_) {
    return null;
  }
}

/**
 * Safe querySelector wrapper
 * @param {string} selector - CSS selector
 * @param {Element} root - Optional root element (default: document)
 * @returns {Element|null} - Found element or null
 */
function query(selector, root = document) {
  try {
    return root.querySelector(selector);
  } catch (_) {
    return null;
  }
}

/**
 * Safe querySelectorAll wrapper
 * @param {string} selector - CSS selector
 * @param {Element} root - Optional root element (default: document)
 * @returns {Element[]} - Array of found elements (empty array on error)
 */
function queryAll(selector, root = document) {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch (_) {
    return [];
  }
}

/**
 * Set element text content safely
 * @param {string|Element} idOrElement - Element ID or element reference
 * @param {string} text - Text content to set
 */
function setText(idOrElement, text) {
  try {
    const el = typeof idOrElement === 'string' ? byId(idOrElement) : idOrElement;
    if (el) el.textContent = String(text);
  } catch (_) {}
}

/**
 * Set element HTML safely
 * @param {string|Element} idOrElement - Element ID or element reference
 * @param {string} html - HTML content to set
 */
function setHtml(idOrElement, html) {
  try {
    const el = typeof idOrElement === 'string' ? byId(idOrElement) : idOrElement;
    if (el) el.innerHTML = html;
  } catch (_) {}
}

/**
 * Show/hide element
 * @param {string|Element} idOrElement - Element ID or element reference
 * @param {boolean} visible - True to show, false to hide
 */
function setVisible(idOrElement, visible) {
  try {
    const el = typeof idOrElement === 'string' ? byId(idOrElement) : idOrElement;
    if (el) el.hidden = !visible;
  } catch (_) {}
}

/**
 * Toggle element visibility
 * @param {string|Element} idOrElement - Element ID or element reference
 * @returns {boolean} - New visibility state
 */
function toggleVisible(idOrElement) {
  try {
    const el = typeof idOrElement === 'string' ? byId(idOrElement) : idOrElement;
    if (el) {
      el.hidden = !el.hidden;
      return !el.hidden;
    }
  } catch (_) {}
  return false;
}

/**
 * Add event listener with safe cleanup
 * @param {string|Element} idOrElement - Element ID or element reference
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @returns {Function|null} - Cleanup function or null
 */
function on(idOrElement, event, handler) {
  try {
    const el = typeof idOrElement === 'string' ? byId(idOrElement) : idOrElement;
    if (el) {
      el.addEventListener(event, handler);
      return () => el.removeEventListener(event, handler);
    }
  } catch (_) {}
  return null;
}

/**
 * Safe value getter
 * @param {string|Element} idOrElement - Element ID or element reference
 * @param {*} defaultValue - Default value if element not found
 * @returns {*} - Element value or default
 */
function getValue(idOrElement, defaultValue = '') {
  try {
    const el = typeof idOrElement === 'string' ? byId(idOrElement) : idOrElement;
    return el ? el.value : defaultValue;
  } catch (_) {
    return defaultValue;
  }
}

/**
 * Safe value setter
 * @param {string|Element} idOrElement - Element ID or element reference
 * @param {*} value - Value to set
 */
function setValue(idOrElement, value) {
  try {
    const el = typeof idOrElement === 'string' ? byId(idOrElement) : idOrElement;
    if (el) el.value = value;
  } catch (_) {}
}

/**
 * Safe checked state getter
 * @param {string|Element} idOrElement - Element ID or element reference
 * @returns {boolean} - Checked state
 */
function isChecked(idOrElement) {
  try {
    const el = typeof idOrElement === 'string' ? byId(idOrElement) : idOrElement;
    return el ? !!el.checked : false;
  } catch (_) {
    return false;
  }
}

/**
 * Safe checked state setter
 * @param {string|Element} idOrElement - Element ID or element reference
 * @param {boolean} checked - Checked state
 */
function setChecked(idOrElement, checked) {
  try {
    const el = typeof idOrElement === 'string' ? byId(idOrElement) : idOrElement;
    if (el) el.checked = !!checked;
  } catch (_) {}
}

/**
 * Safe disabled state setter
 * @param {string|Element} idOrElement - Element ID or element reference
 * @param {boolean} disabled - Disabled state
 */
function setDisabled(idOrElement, disabled) {
  try {
    const el = typeof idOrElement === 'string' ? byId(idOrElement) : idOrElement;
    if (el) el.disabled = !!disabled;
  } catch (_) {}
}

/**
 * Batch add event listeners on multiple elements
 * @param {Object} bindings - { elementId: { event: handler } }
 * @returns {Function} - Cleanup function
 */
function bindMany(bindings) {
  const cleanups = [];
  try {
    for (const [id, events] of Object.entries(bindings)) {
      const el = byId(id);
      if (el) {
        for (const [event, handler] of Object.entries(events)) {
          el.addEventListener(event, handler);
          cleanups.push(() => el.removeEventListener(event, handler));
        }
      }
    }
  } catch (_) {}
  return () => cleanups.forEach(fn => { try { fn(); } catch (_) {} });
}

// Export for use in renderer scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    byId,
    query,
    queryAll,
    setText,
    setHtml,
    setVisible,
    toggleVisible,
    on,
    getValue,
    setValue,
    isChecked,
    setChecked,
    setDisabled,
    bindMany
  };
}

// Also expose globally for inline scripts
if (typeof window !== 'undefined') {
  window.DomHelpers = {
    byId,
    query,
    queryAll,
    setText,
    setHtml,
    setVisible,
    toggleVisible,
    on,
    getValue,
    setValue,
    isChecked,
    setChecked,
    setDisabled,
    bindMany
  };
}
