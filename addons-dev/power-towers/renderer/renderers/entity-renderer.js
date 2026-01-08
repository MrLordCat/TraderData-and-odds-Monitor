/**
 * Power Towers TD - Entity Renderer (Modular)
 * 
 * Composes TowerRendererMixin, EnemyRendererMixin, EffectsRendererMixin
 * into a single EntityRendererMixin.
 */

const { TowerRendererMixin, ELEMENT_COLORS, ATTACK_TYPE_COLORS } = require('./tower-renderer');
const { EnemyRendererMixin } = require('./enemy-renderer');
const { EffectsRendererMixin } = require('./effects-renderer');

/**
 * Compose all entity rendering mixins
 * @param {Class} Base - Base GameRenderer class
 */
function EntityRendererMixin(Base) {
  // Apply mixins in order: Tower -> Enemy -> Effects
  return EffectsRendererMixin(
    EnemyRendererMixin(
      TowerRendererMixin(Base)
    )
  );
}

module.exports = { 
  EntityRendererMixin,
  // Re-export color constants for external use
  ELEMENT_COLORS,
  ATTACK_TYPE_COLORS
};
