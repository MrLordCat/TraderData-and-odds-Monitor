/**
 * Power Towers TD - Tower Renderer
 * 
 * Renders towers with WC3-style visuals, turrets, and indicators.
 */

// Pre-allocated color constants (avoid object creation in hot path)
const ELEMENT_COLORS = {
  fire: { base: '#8B0000', accent: '#FF4500', glow: '#FF6B35' },
  ice: { base: '#1a3a5c', accent: '#00BFFF', glow: '#87CEEB' },
  lightning: { base: '#4a4a00', accent: '#FFD700', glow: '#FFFF88' },
  nature: { base: '#2d5a27', accent: '#32CD32', glow: '#90EE90' },
  dark: { base: '#2a1a3a', accent: '#8B008B', glow: '#DA70D6' },
  none: { base: '#3a3a3a', accent: '#718096', glow: '#A0AEC0' }
};

const ATTACK_TYPE_VISUALS = {
  base: { platformScale: 1.0, bodyScale: 1.0 },
  siege: { platformScale: 1.15, bodyScale: 1.1 },
  normal: { platformScale: 1.0, bodyScale: 0.95 },
  magic: { platformScale: 1.0, bodyScale: 1.0 },
  piercing: { platformScale: 0.95, bodyScale: 0.9 }
};

const ATTACK_TYPE_COLORS = {
  siege: { r: 1.0, g: 0.4, b: 0.2 },
  normal: { r: 0.3, g: 0.6, b: 0.9 },
  magic: { r: 0.6, g: 0.3, b: 0.8 },
  piercing: { r: 0.9, g: 0.8, b: 0.2 }
};

const DEFAULT_ATTACK_COLOR = { r: 0.5, g: 0.5, b: 0.5 };

/**
 * Mixin for tower rendering methods
 * @param {Class} Base - Base GameRenderer class
 */
function TowerRendererMixin(Base) {
  return class extends Base {
    
    /**
     * Render all towers
     */
    _renderTowers(data) {
      if (!data.towers || data.towers.length === 0) return;
      
      const camera = this.camera;
      
      this.shapeRenderer.begin('triangles', camera);
      
      for (const tower of data.towers) {
        this._renderTowerWC3Style(tower, data.selectedTower === tower);
      }
      
      this.shapeRenderer.end();
    }
    
    /**
     * Render tower in Warcraft 3 style
     */
    _renderTowerWC3Style(tower, isSelected) {
      const camera = this.camera;
      const x = tower.x;
      const y = tower.y;
      const baseSize = (tower.size || 20);
      const level = tower.level || 1;
      const attackType = tower.attackTypeId || 'base';
      
      const element = tower.elementPath || 'none';
      const colors = ELEMENT_COLORS[element] || ELEMENT_COLORS.none;
      const atkVisuals = ATTACK_TYPE_VISUALS[attackType] || ATTACK_TYPE_VISUALS.base;
      const baseColor = this._parseColor(colors.base);
      const accentColor = this._parseColor(colors.accent);
      const glowColor = this._parseColor(colors.glow);
      
      // Selection ring
      if (isSelected) {
        this.shapeRenderer.circleOutline(x, y, baseSize * 0.8, 3 / camera.zoom, 1, 0.84, 0, 0.9);
      }
      
      // === BASE PLATFORM ===
      const platformScale = atkVisuals.platformScale;
      this.shapeRenderer.circle(x + 2, y + 3, baseSize * 0.55 * platformScale, 0, 0, 0, 0.4);
      
      if (attackType === 'siege') {
        this.shapeRenderer.circle(x, y, baseSize * 0.6, 0.25, 0.22, 0.2, 1);
        this.shapeRenderer.circle(x, y, baseSize * 0.55, 0.35, 0.32, 0.3, 1);
        this.shapeRenderer.circleOutline(x, y, baseSize * 0.58, 2 / camera.zoom, 0.4, 0.35, 0.3, 0.8);
      } else {
        this.shapeRenderer.circle(x, y, baseSize * 0.55 * platformScale, 0.3, 0.28, 0.25, 1);
        this.shapeRenderer.circle(x, y, baseSize * 0.48 * platformScale, 0.4, 0.38, 0.35, 1);
      }
      
      // === TOWER BODY ===
      const bodySize = baseSize * 0.4 * atkVisuals.bodyScale;
      this.shapeRenderer.circle(x, y, bodySize, baseColor.r, baseColor.g, baseColor.b, 1);
      this.shapeRenderer.circle(x, y, bodySize * 0.85, baseColor.r * 1.2, baseColor.g * 1.2, baseColor.b * 1.2, 1);
      this.shapeRenderer.circleOutline(x, y, bodySize * 0.7, 2 / camera.zoom, 
        accentColor.r, accentColor.g, accentColor.b, 0.8);
      
      // === TURRET ===
      const rotation = tower.rotation || 0;
      this._renderTowerTurret(x, y, baseSize, rotation, attackType, accentColor, glowColor, camera);
      
      // === CENTER ORB ===
      const orbPulse = Math.sin(this.time * 0.005) * 0.2 + 0.8;
      
      if (attackType === 'magic') {
        this._renderMagicOrb(x, y, bodySize, tower, accentColor, glowColor, camera);
      } else {
        this.shapeRenderer.circle(x, y, bodySize * 0.3, glowColor.r * orbPulse, glowColor.g * orbPulse, glowColor.b * orbPulse, 1);
        this.shapeRenderer.circle(x, y, bodySize * 0.15, 1, 1, 1, 0.6);
      }
      
      // === ATTACK TYPE INDICATOR ===
      if (attackType !== 'base') {
        this._renderAttackTypeIndicator(x, y, baseSize, attackType, camera);
      }
      
      // === LEVEL INDICATORS ===
      if (level > 1) {
        const indicatorRadius = baseSize * 0.6;
        const numDots = Math.min(level - 1, 5);
        for (let i = 0; i < numDots; i++) {
          const angle = -Math.PI / 2 + (i - (numDots - 1) / 2) * 0.4;
          const dx = x + Math.cos(angle) * indicatorRadius;
          const dy = y + Math.sin(angle) * indicatorRadius;
          this.shapeRenderer.circle(dx, dy, 2.5 / camera.zoom, 1, 0.9, 0.3, 1);
        }
      }
      
      // === ELEMENT TIER GLOW ===
      if (tower.elementTier && tower.elementTier > 0) {
        const tierGlow = Math.sin(this.time * 0.003) * 0.2 + 0.6;
        this.shapeRenderer.circleOutline(x, y, baseSize * 0.65 + tower.elementTier * 2, 
          1 / camera.zoom, glowColor.r, glowColor.g, glowColor.b, tierGlow * 0.5);
      }
      
      // === ENERGY BAR ===
      this._renderEnergyBar({
        x: x,
        y: y + baseSize * 0.7,
        width: baseSize * 1.2,
        current: tower.currentEnergy || 0,
        max: tower.maxEnergy || 100,
        type: 'consumer',
        showEmptyWarning: true
      });
      
      // === MAGIC CHARGE BAR (below energy bar) ===
      if (attackType === 'magic' && tower.magicState) {
        this._renderMagicChargeBar({
          x: x,
          y: y + baseSize * 0.7 + 8,
          width: baseSize * 1.2,
          current: tower.magicState.currentCharge || 0,
          max: tower.magicState.shotCost || 1,
          isCharging: tower.magicState.isCharging,
        });
      }
    }
    
    /**
     * Render magic tower central orb with charge effects
     */
    _renderMagicOrb(x, y, bodySize, tower, accentColor, glowColor, camera) {
      const chargeProgress = tower.magicState?.chargeProgress || 0;
      const isCharging = tower.magicState?.isCharging || false;
      const isReady = chargeProgress >= 1.0;
      
      // Central orb pulse - intensifies with charge
      const basePulse = Math.sin(this.time * 0.004) * 0.3 + 0.7;
      const chargePulse = isCharging ? Math.sin(this.time * 0.02) * 0.2 + 0.8 : 1;
      const magicPulse = basePulse * (0.7 + chargeProgress * 0.3) * chargePulse;
      
      // Orb size grows with charge
      const orbSize = bodySize * (0.4 + chargeProgress * 0.15);
      this.shapeRenderer.circle(x, y, orbSize, glowColor.r * magicPulse, glowColor.g * magicPulse, glowColor.b * magicPulse, 0.9);
      this.shapeRenderer.circle(x, y, bodySize * 0.25, 1, 1, 1, 0.7);
      
      // Orbiting particles - speed and count based on charge
      const orbitSpeed = 0.004 + chargeProgress * 0.006;
      const particleCount = 3 + Math.floor(chargeProgress * 3);
      for (let i = 0; i < particleCount; i++) {
        const orbitAngle = this.time * orbitSpeed + (i * Math.PI * 2 / particleCount);
        const orbitDist = bodySize * (0.8 + chargeProgress * 0.2);
        const px = x + Math.cos(orbitAngle) * orbitDist;
        const py = y + Math.sin(orbitAngle) * orbitDist;
        const particleSize = (2 + chargeProgress * 1.5) / camera.zoom;
        const particleAlpha = 0.6 + chargeProgress * 0.4;
        this.shapeRenderer.circle(px, py, particleSize, accentColor.r, accentColor.g, accentColor.b, particleAlpha);
      }
      
      // Charge glow ring when charging
      if (isCharging || chargeProgress > 0.5) {
        const ringAlpha = chargeProgress * 0.4;
        const ringSize = bodySize * 0.7 + Math.sin(this.time * 0.01) * 2;
        this.shapeRenderer.circleOutline(x, y, ringSize, 2 / camera.zoom, 
          accentColor.r, accentColor.g, accentColor.b, ringAlpha);
      }
      
      // Ready to fire visual (pulsing outer ring)
      if (isReady) {
        const readyPulse = Math.sin(this.time * 0.015) * 0.3 + 0.7;
        this.shapeRenderer.circleOutline(x, y, bodySize * 1.1, 3 / camera.zoom,
          1, 0.8, 1, readyPulse * 0.6);
      }
    }
    
    /**
     * Render magic charge bar with purple theme
     */
    _renderMagicChargeBar(opts) {
      const { x, y, width, current, max, isCharging } = opts;
      const camera = this.camera;
      const fillPct = max > 0 ? Math.min(1, current / max) : 0;
      
      const barHeight = 4;
      const barX = x - width / 2;
      const barY = y;
      
      // Background (darker purple tint)
      this.shapeRenderer.rect(barX - 1, barY - 1, width + 2, barHeight + 2, 0, 0, 0, 0.7);
      this.shapeRenderer.rect(barX, barY, width, barHeight, 0.15, 0.1, 0.2, 1);
      
      if (fillPct > 0) {
        // Purple charge fill
        const pulse = isCharging ? Math.sin(this.time * 0.015) * 0.2 + 0.8 : 1;
        
        // Gradient from blue-purple (empty) to bright purple (full)
        const r = 0.55 + fillPct * 0.35;
        const g = 0.25 + fillPct * 0.25;
        const b = 0.9 + fillPct * 0.1;
        
        this.shapeRenderer.rect(barX, barY, width * fillPct, barHeight, 
          r * pulse, g * pulse, b * pulse, 1);
        
        // Glow effect when nearly full
        if (fillPct >= 0.8) {
          const glow = Math.sin(this.time * 0.01) * 0.3 + 0.5;
          this.shapeRenderer.rect(barX, barY, width * fillPct, barHeight,
            1, 0.8, 1, glow * 0.3);
        }
      }
      
      // Border (purple tint)
      this.shapeRenderer.rectOutline(barX, barY, width, barHeight, 1 / camera.zoom, 0.4, 0.2, 0.5, 0.8);
      
      // "Charged" indicator when ready
      if (fillPct >= 1.0) {
        for (let i = 0; i < 2; i++) {
          const sparkleX = barX + width * (0.3 + i * 0.4) + Math.sin(this.time * 0.02 + i) * 3;
          const sparkleY = barY + barHeight / 2 + Math.cos(this.time * 0.02 + i) * 2;
          const sparkleAlpha = Math.sin(this.time * 0.015 + i * Math.PI) * 0.3 + 0.5;
          this.shapeRenderer.circle(sparkleX, sparkleY, 2 / camera.zoom, 1, 0.8, 1, sparkleAlpha);
        }
      }
    }
    
    /**
     * Render tower turret by attack type
     */
    _renderTowerTurret(x, y, baseSize, rotation, attackType, accentColor, glowColor, camera) {
      const turretLen = baseSize * 0.5;
      const turretWidth = 4 / camera.zoom;
      
      switch (attackType) {
        case 'siege':
          this._renderSiegeTurret(x, y, turretLen, turretWidth, rotation, accentColor, glowColor, camera);
          break;
        case 'normal':
          this._renderNormalTurret(x, y, turretLen, turretWidth, rotation, accentColor, glowColor, camera);
          break;
        case 'magic':
          this._renderMagicTurret(x, y, turretLen, turretWidth, rotation, accentColor, glowColor, camera);
          break;
        case 'piercing':
          this._renderPiercingTurret(x, y, turretLen, turretWidth, rotation, accentColor, glowColor, camera);
          break;
        default:
          this._renderDefaultTurret(x, y, turretLen, turretWidth, rotation, accentColor, glowColor, camera);
      }
    }
    
    _renderSiegeTurret(x, y, turretLen, turretWidth, rotation, accentColor, glowColor, camera) {
      const spread = 0.25;
      const barrelWidth = turretWidth * 1.4;
      
      for (const offset of [-spread, spread]) {
        const r = rotation + offset;
        const tx = x + Math.cos(r) * turretLen * 0.2;
        const ty = y + Math.sin(r) * turretLen * 0.2;
        const tex = x + Math.cos(r) * turretLen * 0.9;
        const tey = y + Math.sin(r) * turretLen * 0.9;
        
        this.shapeRenderer.line(tx, ty, tex, tey, barrelWidth + 3, 0.15, 0.15, 0.15, 1);
        this.shapeRenderer.line(tx, ty, tex, tey, barrelWidth, accentColor.r * 0.8, accentColor.g * 0.8, accentColor.b * 0.8, 1);
        this.shapeRenderer.circle(tex, tey, 4 / camera.zoom, glowColor.r, glowColor.g, glowColor.b, 0.7);
      }
      
      this.shapeRenderer.circle(x + Math.cos(rotation) * turretLen * 0.15, 
                                 y + Math.sin(rotation) * turretLen * 0.15, 
                                 5 / camera.zoom, 0.3, 0.3, 0.35, 1);
    }
    
    _renderNormalTurret(x, y, turretLen, turretWidth, rotation, accentColor, glowColor, camera) {
      const tx = x + Math.cos(rotation) * turretLen * 0.3;
      const ty = y + Math.sin(rotation) * turretLen * 0.3;
      const tex = x + Math.cos(rotation) * turretLen;
      const tey = y + Math.sin(rotation) * turretLen;
      
      this.shapeRenderer.line(tx, ty, tex, tey, turretWidth, 0.2, 0.2, 0.2, 1);
      this.shapeRenderer.line(tx, ty, tex, tey, turretWidth - 1, accentColor.r, accentColor.g, accentColor.b, 1);
      
      const scopeX = x + Math.cos(rotation) * turretLen * 0.5;
      const scopeY = y + Math.sin(rotation) * turretLen * 0.5;
      const perpAngle = rotation + Math.PI / 2;
      const scopeOffset = 3 / camera.zoom;
      this.shapeRenderer.circle(scopeX + Math.cos(perpAngle) * scopeOffset, 
                                 scopeY + Math.sin(perpAngle) * scopeOffset, 
                                 2.5 / camera.zoom, 0.2, 0.5, 0.8, 1);
      
      this.shapeRenderer.circle(tex, tey, 3 / camera.zoom, glowColor.r, glowColor.g, glowColor.b, 0.9);
      this.shapeRenderer.circleOutline(tex, tey, 5 / camera.zoom, 1 / camera.zoom, 
        glowColor.r, glowColor.g, glowColor.b, 0.5);
    }
    
    _renderMagicTurret(x, y, turretLen, turretWidth, rotation, accentColor, glowColor, camera) {
      const streamCount = 2;
      const streamPulse = Math.sin(this.time * 0.008) * 0.3 + 0.7;
      
      for (let i = 0; i < streamCount; i++) {
        const streamAngle = rotation + (i - 0.5) * 0.4;
        const streamLen = turretLen * (0.7 + Math.sin(this.time * 0.01 + i) * 0.2);
        const sex = x + Math.cos(streamAngle) * streamLen;
        const sey = y + Math.sin(streamAngle) * streamLen;
        
        this.shapeRenderer.line(x, y, sex, sey, 2 / camera.zoom, 
          glowColor.r * streamPulse, glowColor.g * streamPulse, glowColor.b * streamPulse, 0.6);
        this.shapeRenderer.circle(sex, sey, 2.5 / camera.zoom, 
          accentColor.r, accentColor.g, accentColor.b, streamPulse);
      }
    }
    
    _renderPiercingTurret(x, y, turretLen, turretWidth, rotation, accentColor, glowColor, camera) {
      const spearLen = turretLen * 1.3;
      const tx = x + Math.cos(rotation) * turretLen * 0.1;
      const ty = y + Math.sin(rotation) * turretLen * 0.1;
      const tex = x + Math.cos(rotation) * spearLen;
      const tey = y + Math.sin(rotation) * spearLen;
      
      this.shapeRenderer.line(tx, ty, tex, tey, turretWidth - 1, 0.2, 0.2, 0.2, 1);
      this.shapeRenderer.line(tx, ty, tex, tey, turretWidth - 2, accentColor.r, accentColor.g, accentColor.b, 1);
      
      const tipLen = 6 / camera.zoom;
      const tipSpread = 0.4;
      for (const side of [-1, 1]) {
        const tipAngle = rotation + Math.PI + (tipSpread * side);
        const tipX = tex + Math.cos(tipAngle) * tipLen;
        const tipY = tey + Math.sin(tipAngle) * tipLen;
        this.shapeRenderer.line(tex, tey, tipX, tipY, 2 / camera.zoom, 
          glowColor.r, glowColor.g, glowColor.b, 1);
      }
      
      this.shapeRenderer.circle(tex, tey, 2 / camera.zoom, 1, 1, 1, 0.9);
    }
    
    _renderDefaultTurret(x, y, turretLen, turretWidth, rotation, accentColor, glowColor, camera) {
      const tx = x + Math.cos(rotation) * turretLen * 0.3;
      const ty = y + Math.sin(rotation) * turretLen * 0.3;
      const tex = x + Math.cos(rotation) * turretLen;
      const tey = y + Math.sin(rotation) * turretLen;
      
      this.shapeRenderer.line(tx, ty, tex, tey, turretWidth + 2, 0.2, 0.2, 0.2, 1);
      this.shapeRenderer.line(tx, ty, tex, tey, turretWidth, accentColor.r, accentColor.g, accentColor.b, 1);
      this.shapeRenderer.circle(tex, tey, 3 / camera.zoom, glowColor.r, glowColor.g, glowColor.b, 0.8);
    }
    
    /**
     * Render attack type indicator
     */
    _renderAttackTypeIndicator(x, y, baseSize, attackType, camera) {
      const ix = x - baseSize * 0.45;
      const iy = y + baseSize * 0.45;
      const iconSize = 4 / camera.zoom;
      
      const color = ATTACK_TYPE_COLORS[attackType] || DEFAULT_ATTACK_COLOR;
      
      this.shapeRenderer.circle(ix, iy, iconSize + 1, 0, 0, 0, 0.5);
      this.shapeRenderer.circle(ix, iy, iconSize, color.r, color.g, color.b, 0.9);
      
      switch (attackType) {
        case 'siege':
          for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2;
            const sx = ix + Math.cos(a) * iconSize * 0.6;
            const sy = iy + Math.sin(a) * iconSize * 0.6;
            this.shapeRenderer.circle(sx, sy, 1 / camera.zoom, 1, 1, 1, 0.9);
          }
          break;
        case 'normal':
          this.shapeRenderer.circle(ix, iy, iconSize * 0.4, 1, 1, 1, 0.9);
          break;
        case 'magic':
          this.shapeRenderer.circle(ix, iy, iconSize * 0.3, 1, 1, 1, 0.9);
          break;
        case 'piercing':
          this.shapeRenderer.circle(ix, iy, iconSize * 0.35, 1, 1, 1, 0.9);
          break;
      }
    }
  };
}

module.exports = { TowerRendererMixin, ELEMENT_COLORS, ATTACK_TYPE_COLORS };
