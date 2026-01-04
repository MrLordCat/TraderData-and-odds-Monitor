/**
 * Power Towers TD - Stat Detail Builder
 * Helper for building stat detail popup HTML
 */

/**
 * Create a detail popup builder
 * @returns {Object} Builder with fluent API
 */
function createDetailBuilder() {
  const lines = [];
  
  return {
    /**
     * Add a line with label and value
     * @param {string} label - Label text
     * @param {string} value - Value text
     * @param {string} [className] - Optional CSS class
     */
    line(label, value, className = '') {
      lines.push(`<div class="detail-line${className ? ' ' + className : ''}"><span>${label}</span><span>${value}</span></div>`);
      return this;
    },
    
    /**
     * Add a base stat line
     * @param {string} label - Label text  
     * @param {string} value - Base value
     */
    base(label, value) {
      return this.line(label, value, 'detail-base');
    },
    
    /**
     * Add a level bonus line
     * @param {number} level - Current level
     * @param {number|string} bonus - Bonus value or percentage
     * @param {string} [total] - Optional total after bonus
     */
    level(level, bonus, total) {
      if (level > 1) {
        const bonusStr = typeof bonus === 'number' ? `+${bonus}%` : bonus;
        this.line(`Level ${level}:`, bonusStr, 'detail-level');
      }
      if (total) {
        this.line('Total:', total, 'detail-value');
      }
      return this;
    },
    
    /**
     * Add a final total line
     * @param {string} value - Final value
     */
    final(value) {
      return this.line('Final:', value, 'detail-final');
    },
    
    /**
     * Add a separator
     */
    separator() {
      lines.push('<hr class="detail-separator">');
      return this;
    },
    
    /**
     * Build the final HTML
     * @returns {string} HTML string
     */
    build() {
      return lines.join('');
    }
  };
}

module.exports = { createDetailBuilder };
