/**
 * Power Towers TD - Stat Detail Builder
 * Unified builder for stat detail popup HTML
 */

const { formatPercent, formatNumber, formatInt } = require('./format-helpers');

/**
 * Detail line builder
 */
class DetailBuilder {
  constructor() {
    this.lines = [];
  }
  
  /**
   * Add a detail line
   * @param {string} label - Label text
   * @param {string|number} value - Value to display
   * @param {string} className - Optional CSS class (detail-base, detail-level, detail-upgrade, detail-final, etc.)
   * @returns {DetailBuilder} this for chaining
   */
  line(label, value, className = 'detail-value') {
    this.lines.push(`<div class="detail-line"><span class="detail-label">${label}</span><span class="${className}">${value}</span></div>`);
    return this;
  }
  
  /**
   * Add base value line
   */
  base(label, value) {
    return this.line(label, value, 'detail-base');
  }
  
  /**
   * Add level bonus line
   * @param {number} level - Current level
   * @param {number} bonusPercent - Bonus percentage (e.g., 5 for 5%)
   * @param {string|number} resultValue - Resulting value after level bonus
   */
  level(level, bonusPercent, resultValue) {
    return this.line(`Level ${level} (+${bonusPercent}%):`, resultValue, 'detail-level');
  }
  
  /**
   * Add upgrade bonus line
   * @param {number} upgLevel - Upgrade level
   * @param {number} bonusPercent - Bonus percentage
   * @param {string|number} resultValue - Resulting value
   */
  upgrade(upgLevel, bonusPercent, resultValue) {
    if (upgLevel > 0) {
      return this.line(`Upgrades Lv.${upgLevel} (+${bonusPercent}%):`, resultValue, 'detail-upgrade');
    }
    return this;
  }
  
  /**
   * Add type modifier line
   * @param {string} typeName - Type name (e.g., "Siege")
   * @param {number} modifier - Modifier value (e.g., 1.5)
   * @param {string|number} resultValue - Resulting value
   */
  type(typeName, modifier, resultValue) {
    const className = modifier > 1 ? 'detail-value' : (modifier < 1 ? 'detail-value penalty' : 'detail-value');
    return this.line(`${typeName} (×${formatNumber(modifier, 2)}):`, resultValue, className);
  }
  
  /**
   * Add biome modifier line
   * @param {string} biomeName - Biome name
   * @param {number} modifier - Modifier value
   * @param {string|number} resultValue - Resulting value
   */
  biome(biomeName, modifier, resultValue) {
    if (modifier !== 1) {
      const className = modifier > 1 ? 'detail-biome bonus' : 'detail-biome penalty';
      const pctText = formatPercent(modifier);
      return this.line(`Biome ${biomeName} (${pctText}):`, resultValue, className);
    }
    return this;
  }
  
  /**
   * Add custom modifier line with color
   * @param {string} label - Label text (e.g., "🔥 Combo (5):")
   * @param {string} modifier - Modifier text (e.g., "+25%")
   * @param {string|number} resultValue - Resulting value
   * @param {string} color - Custom color (default: green)
   */
  custom(label, modifier, resultValue, color = '#4caf50') {
    this.lines.push(`<div class="detail-line"><span class="detail-label">${label}</span><span class="detail-value" style="color:${color}">${modifier} → ${resultValue}</span></div>`);
    return this;
  }
  
  /**
   * Add final value line
   */
  final(value) {
    return this.line('Final:', value, 'detail-final');
  }
  
  /**
   * Add formula line
   * @param {string} formula - Formula text
   */
  formula(formula) {
    this.lines.push(`<div class="detail-formula">${formula}</div>`);
    return this;
  }
  
  /**
   * Add separator line
   */
  separator() {
    this.lines.push('<div class="detail-separator"></div>');
    return this;
  }
  
  /**
   * Add header line
   * @param {string} text - Header text
   */
  header(text) {
    this.lines.push(`<div class="detail-header">${text}</div>`);
    return this;
  }
  
  /**
   * Add indented line
   * @param {string} label - Label text
   * @param {string|number} value - Value
   * @param {string} className - CSS class
   */
  indented(label, value, className = 'detail-value') {
    this.lines.push(`<div class="detail-line" style="padding-left:12px"><span class="detail-label">${label}</span><span class="${className}">${value}</span></div>`);
    return this;
  }
  
  /**
   * Add conditional line (only if condition is true)
   * @param {boolean} condition - Whether to add line
   * @param {Function} builder - Function that adds the line
   */
  when(condition, builder) {
    if (condition) {
      builder(this);
    }
    return this;
  }
  
  /**
   * Build final HTML
   * @returns {string} HTML string
   */
  build() {
    return this.lines.join('');
  }
}

/**
 * Create new detail builder
 * @returns {DetailBuilder}
 */
function createDetailBuilder() {
  return new DetailBuilder();
}

/**
 * Build standard stat detail popup
 * @param {Object} options - Options
 * @param {string} options.statName - Stat name for formula
 * @param {number} options.baseValue - Base value
 * @param {number} options.level - Tower/building level
 * @param {number} options.typeMod - Attack type modifier
 * @param {number} options.upgradeLevel - Upgrade level
 * @param {number} options.upgradePercent - Percent per upgrade level
 * @param {number} options.finalValue - Final calculated value
 * @param {boolean} options.isFloat - Format as float or int
 * @param {number} options.biomeBonus - Biome bonus multiplier
 * @param {number} options.levelBonusPercent - Level bonus percent per level (default 1)
 * @returns {string} HTML string
 */
function buildStatDetail(options) {
  const {
    statName = 'STAT',
    baseValue,
    level = 1,
    typeMod = 1,
    upgradeLevel = 0,
    upgradePercent = 0.05,
    finalValue,
    isFloat = false,
    biomeBonus = 1,
    levelBonusPercent = 1
  } = options;
  
  const fmt = (v) => isFloat ? formatNumber(v, 2) : formatInt(v);
  
  const levelBonus = 1 + (level - 1) * (levelBonusPercent / 100);
  const afterType = baseValue * typeMod;
  const afterLevel = afterType * levelBonus;
  const upgradeBonus = upgradeLevel * upgradePercent;
  const afterUpgrade = afterLevel * (1 + upgradeBonus);
  const afterBiome = afterUpgrade * biomeBonus;
  
  const builder = createDetailBuilder()
    .base('Base:', fmt(baseValue))
    .type('Type', typeMod, fmt(afterType))
    .level(level, Math.round((levelBonus - 1) * 100), fmt(afterLevel))
    .upgrade(upgradeLevel, Math.round(upgradeBonus * 100), fmt(afterUpgrade));
  
  if (biomeBonus !== 1) {
    builder.biome('', biomeBonus, fmt(afterBiome));
  }
  
  let formula = `(Base × Type) × Lvl% × Upg%`;
  if (biomeBonus !== 1) {
    formula += ' × Biome';
  }
  
  builder
    .final(fmt(finalValue || afterBiome))
    .formula(formula);
  
  return builder.build();
}

/**
 * Build crit stat detail
 * @param {Object} options - { baseCrit, upgradeLevel, finalCrit, isCritDamage }
 */
function buildCritDetail(options) {
  const { baseCrit, upgradeLevel = 0, finalCrit, isCritDamage = false } = options;
  
  const basePercent = Math.round(baseCrit * 100);
  const upgradeBonus = isCritDamage ? upgradeLevel * 10 : upgradeLevel;
  const finalPercent = Math.round(finalCrit * 100);
  
  return createDetailBuilder()
    .base('Base:', `${basePercent}%`)
    .line(`Upgrades (+${upgradeBonus}%):`, `+${upgradeBonus}%`, 'detail-upgrade')
    .final(`${finalPercent}%`)
    .formula(isCritDamage ? 'Base + (Lv × 10%)' : 'Base + Upgrades (cap 75%)')
    .build();
}

/**
 * Build energy building capacity detail
 * @param {Object} options - { stored, baseCap, level, upgradeLevel, finalCap }
 */
function buildCapacityDetail(options) {
  const { stored, baseCap, level, upgradeLevel = 0, finalCap } = options;
  const levelBonus = 1 + (level - 1) * 0.02;
  
  const builder = createDetailBuilder()
    .line('Current:', `${stored}/${finalCap}`, 'detail-value')
    .base('Base cap:', formatInt(baseCap))
    .level(level, Math.round((levelBonus - 1) * 100), `×${formatNumber(levelBonus, 2)}`);
  
  if (upgradeLevel > 0) {
    builder.upgrade(upgradeLevel, upgradeLevel * 10, `×${formatNumber(1 + upgradeLevel * 0.1, 2)}`);
  }
  
  return builder
    .final(formatInt(finalCap))
    .formula('Base × Lvl% × Upg%')
    .build();
}

module.exports = {
  DetailBuilder,
  createDetailBuilder,
  buildStatDetail,
  buildCritDetail,
  buildCapacityDetail
};
