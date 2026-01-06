/**
 * Power Towers TD - Entity Renderer
 * 
 * Renders game entities: towers, enemies, projectiles, effects.
 */

const CONFIG = require('../../core/config/index');

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
 * Mixin for entity rendering methods
 * @param {Class} Base - Base GameRenderer class
 */
function EntityRendererMixin(Base) {
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
        const magicPulse = Math.sin(this.time * 0.004) * 0.3 + 0.7;
        this.shapeRenderer.circle(x, y, bodySize * 0.4, glowColor.r * magicPulse, glowColor.g * magicPulse, glowColor.b * magicPulse, 0.9);
        this.shapeRenderer.circle(x, y, bodySize * 0.25, 1, 1, 1, 0.7);
        
        // Orbiting particles
        for (let i = 0; i < 3; i++) {
          const orbitAngle = this.time * 0.006 + (i * Math.PI * 2 / 3);
          const orbitDist = bodySize * 0.9;
          const px = x + Math.cos(orbitAngle) * orbitDist;
          const py = y + Math.sin(orbitAngle) * orbitDist;
          this.shapeRenderer.circle(px, py, 2.5 / camera.zoom, accentColor.r, accentColor.g, accentColor.b, 0.8);
        }
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
    }
    
    /**
     * Render tower turret by attack type
     */
    _renderTowerTurret(x, y, baseSize, rotation, attackType, accentColor, glowColor, camera) {
      const turretLen = baseSize * 0.5;
      const turretWidth = 4 / camera.zoom;
      
      switch (attackType) {
        case 'siege': {
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
          break;
        }
        
        case 'normal': {
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
          break;
        }
        
        case 'magic': {
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
          break;
        }
        
        case 'piercing': {
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
          break;
        }
        
        default: {
          const tx = x + Math.cos(rotation) * turretLen * 0.3;
          const ty = y + Math.sin(rotation) * turretLen * 0.3;
          const tex = x + Math.cos(rotation) * turretLen;
          const tey = y + Math.sin(rotation) * turretLen;
          
          this.shapeRenderer.line(tx, ty, tex, tey, turretWidth + 2, 0.2, 0.2, 0.2, 1);
          this.shapeRenderer.line(tx, ty, tex, tey, turretWidth, accentColor.r, accentColor.g, accentColor.b, 1);
          this.shapeRenderer.circle(tex, tey, 3 / camera.zoom, glowColor.r, glowColor.g, glowColor.b, 0.8);
          break;
        }
      }
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
    
    /**
     * Render enemies
     */
    _renderEnemies(data) {
      if (!data.enemies) return;
      
      const camera = this.camera;
      const time = this.frameCount * 0.05;
      
      this.shapeRenderer.begin('triangles', camera);
      
      for (const enemy of data.enemies) {
        if (!camera.isVisible(enemy.x - enemy.size * 2, enemy.y - enemy.size * 2, enemy.size * 4, enemy.size * 4)) continue;
        
        const color = this._parseColor(enemy.color);
        const size = enemy.size;
        
        // Status effects
        const hasBurn = this._hasStatusEffect(enemy, 'burn');
        const hasPoison = this._hasStatusEffect(enemy, 'poison');
        const hasSlow = this._hasStatusEffect(enemy, 'slow');
        const hasFreeze = this._hasStatusEffect(enemy, 'freeze');
        const hasShock = this._hasStatusEffect(enemy, 'shock');
        const hasCurse = this._hasStatusEffect(enemy, 'curse');
        
        // Shadow
        this.shapeRenderer.circle(enemy.x, enemy.y + size * 0.8, size * 0.8, 0, 0, 0, 0.3);
        
        // Body with status tint
        let bodyR = color.r, bodyG = color.g, bodyB = color.b;
        if (hasFreeze) {
          bodyR = bodyR * 0.5 + 0.2;
          bodyG = bodyG * 0.5 + 0.4;
          bodyB = 0.9;
        } else if (hasBurn) {
          const flicker = Math.sin(time * 6) * 0.15;
          bodyR = Math.min(1, bodyR + 0.3 + flicker);
          bodyG = bodyG * 0.7;
          bodyB = bodyB * 0.5;
        }
        this.shapeRenderer.circle(enemy.x, enemy.y, size, bodyR, bodyG, bodyB, 1);
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size, 1 / camera.zoom, 0, 0, 0, 0.4);
        
        // Render status effect visuals
        this._renderEnemyStatusEffects(enemy, size, time, hasBurn, hasPoison, hasSlow, hasFreeze, hasShock, hasCurse);
        
        // Health bar
        const hpRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : (enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1);
        const barWidth = size * 2;
        const barHeight = 4;
        const barY = enemy.y - size - 8;
        
        this.shapeRenderer.rect(enemy.x - barWidth/2, barY, barWidth, barHeight, 0.2, 0.2, 0.2, 0.8);
        
        const hpColor = hpRatio > 0.5 ? { r: 0.3, g: 0.8, b: 0.3 } :
                        hpRatio > 0.25 ? { r: 0.9, g: 0.7, b: 0.2 } :
                        { r: 0.9, g: 0.3, b: 0.3 };
        this.shapeRenderer.rect(enemy.x - barWidth/2, barY, barWidth * Math.max(0, hpRatio), barHeight, hpColor.r, hpColor.g, hpColor.b, 1);
      }
      
      this.shapeRenderer.end();
    }
    
    /**
     * Render enemy status effect visuals
     */
    _renderEnemyStatusEffects(enemy, size, time, hasBurn, hasPoison, hasSlow, hasFreeze, hasShock, hasCurse) {
      const camera = this.camera;
      
      // BURN
      if (hasBurn) {
        const burnEffect = this._getStatusEffect(enemy, 'burn');
        const stacks = burnEffect?.stacks || 1;
        for (let i = 0; i < Math.min(stacks, 5); i++) {
          const angle = (time * 3 + i * (Math.PI * 2 / stacks)) % (Math.PI * 2);
          const flameX = enemy.x + Math.cos(angle) * (size + 3);
          const flameY = enemy.y + Math.sin(angle) * (size + 3);
          const flicker = Math.sin(time * 10 + i * 2) * 2;
          this.shapeRenderer.circle(flameX, flameY - flicker, 3, 1, 0.5, 0.1, 0.9);
          this.shapeRenderer.circle(flameX, flameY - flicker, 5, 1, 0.3, 0, 0.3);
        }
        const fireAlpha = 0.3 + Math.sin(time * 8) * 0.1;
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 2, 2 / camera.zoom, 1, 0.4, 0.1, fireAlpha);
      }
      
      // POISON
      if (hasPoison) {
        const poisonEffect = this._getStatusEffect(enemy, 'poison');
        const stacks = poisonEffect?.stacks || 1;
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 3, 2 / camera.zoom, 0.3, 0.8, 0.2, 0.5);
        for (let i = 0; i < Math.min(stacks * 2, 6); i++) {
          const bubbleTime = (time * 2 + i * 0.5) % 3;
          const bubbleY = enemy.y + size - bubbleTime * 8;
          const bubbleX = enemy.x + Math.sin(time * 3 + i * 1.5) * (size * 0.5);
          const bubbleAlpha = Math.max(0, 1 - bubbleTime / 3);
          const bubbleSize = 2 + bubbleTime * 0.5;
          this.shapeRenderer.circle(bubbleX, bubbleY, bubbleSize, 0.4, 0.9, 0.3, bubbleAlpha * 0.7);
        }
      }
      
      // SLOW
      if (hasSlow && !hasFreeze) {
        const slowAlpha = 0.4 + Math.sin(time * 4) * 0.1;
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 2, 2 / camera.zoom, 0.4, 0.7, 0.95, slowAlpha);
        for (let i = 0; i < 3; i++) {
          const angle = time * 2 + i * (Math.PI * 2 / 3);
          const crystalX = enemy.x + Math.cos(angle) * (size + 4);
          const crystalY = enemy.y + Math.sin(angle) * (size + 4);
          this.shapeRenderer.circle(crystalX, crystalY, 2, 0.7, 0.9, 1, 0.6);
        }
      }
      
      // FREEZE
      if (hasFreeze) {
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 1, 3 / camera.zoom, 0.6, 0.9, 1, 0.8);
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 4, 2 / camera.zoom, 0.4, 0.7, 1, 0.4);
        for (let i = 0; i < 6; i++) {
          const angle = i * (Math.PI / 3);
          const crystalX = enemy.x + Math.cos(angle) * (size + 5);
          const crystalY = enemy.y + Math.sin(angle) * (size + 5);
          this.shapeRenderer.circle(crystalX, crystalY, 3, 0.8, 0.95, 1, 0.7);
        }
      }
      
      // SHOCK
      if (hasShock) {
        const sparkAlpha = 0.5 + Math.sin(time * 20) * 0.3;
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 2, 2 / camera.zoom, 1, 1, 0.3, sparkAlpha);
        for (let i = 0; i < 4; i++) {
          const angle = (time * 15 + i * (Math.PI / 2)) % (Math.PI * 2);
          const boltX = enemy.x + Math.cos(angle) * (size + 6);
          const boltY = enemy.y + Math.sin(angle) * (size + 6);
          if (Math.random() > 0.5) {
            this.shapeRenderer.circle(boltX, boltY, 2, 1, 1, 0.5, 0.8);
          }
        }
      }
      
      // CURSE
      if (hasCurse) {
        const curseAlpha = 0.3 + Math.sin(time * 2) * 0.1;
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 4, 3 / camera.zoom, 0.4, 0.1, 0.5, curseAlpha);
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 6, 2 / camera.zoom, 0.3, 0, 0.4, curseAlpha * 0.5);
      }
    }
    
    /**
     * Check if enemy has status effect
     */
    _hasStatusEffect(enemy, type) {
      return enemy.statusEffects?.some(e => e.type === type) || false;
    }
    
    /**
     * Get status effect data
     */
    _getStatusEffect(enemy, type) {
      if (enemy.statusEffects && enemy.statusEffects.length > 0) {
        return enemy.statusEffects.find(e => e.type === type);
      }
      return null;
    }
    
    /**
     * Render projectiles
     */
    _renderProjectiles(data) {
      if (!data.projectiles) return;
      
      this.shapeRenderer.begin('triangles', this.camera);
      
      for (const proj of data.projectiles) {
        const color = this._parseColor(proj.color || '#fff');
        const size = proj.size || 4;
        
        // Trail
        if (proj.trail && proj.trail.length > 1) {
          for (let i = 1; i < proj.trail.length; i++) {
            const alpha = i / proj.trail.length * 0.5;
            this.shapeRenderer.line(
              proj.trail[i-1].x, proj.trail[i-1].y,
              proj.trail[i].x, proj.trail[i].y,
              2 / this.camera.zoom, color.r, color.g, color.b, alpha
            );
          }
          const last = proj.trail[proj.trail.length - 1];
          this.shapeRenderer.line(last.x, last.y, proj.x, proj.y, 2 / this.camera.zoom, color.r, color.g, color.b, 0.5);
        }
        
        // Body
        this.shapeRenderer.circle(proj.x, proj.y, size, color.r, color.g, color.b, 1);
        this.shapeRenderer.circle(proj.x, proj.y, size * 2, color.r, color.g, color.b, 0.3);
        
        // Particle trail
        this.particles.emit('trail', proj.x, proj.y, {
          count: 1,
          startColor: [color.r, color.g, color.b, 0.5],
          endColor: [color.r, color.g, color.b, 0],
        });
      }
      
      this.shapeRenderer.end();
    }
    
    /**
     * Render visual effects
     */
    _renderEffects(data) {
      if (!data.effects) return;
      
      this.shapeRenderer.begin('triangles', this.camera);
      
      for (const effect of data.effects) {
        const progress = effect.elapsed / effect.duration;
        const alpha = 1 - progress;
        
        switch (effect.type) {
          case 'explosion':
            const expandedRadius = effect.radius * (0.5 + progress * 0.5);
            const color = this._parseColor(effect.color || '#ff6600');
            this.shapeRenderer.circle(effect.x, effect.y, expandedRadius, color.r, color.g * 0.6, 0, alpha * 0.5);
            this.shapeRenderer.circle(effect.x, effect.y, expandedRadius * 0.6, color.r, color.g, 0, alpha * 0.8);
            this.shapeRenderer.circle(effect.x, effect.y, expandedRadius * 0.3, 1, 1, 0.8, alpha);
            break;
          
          // === FOCUS FIRE BURST (Normal Attack) ===
          case 'focus-fire-burst':
            const burstSize = effect.size * (0.3 + progress * 0.7);
            const burstColor = this._parseColor(effect.color || '#ffd700');
            // Outer golden ring
            this.shapeRenderer.circle(effect.x, effect.y, burstSize, burstColor.r, burstColor.g, burstColor.b, alpha * 0.3);
            // Inner bright core
            this.shapeRenderer.circle(effect.x, effect.y, burstSize * 0.5, 1, 1, 0.8, alpha * 0.6);
            // Center flash
            this.shapeRenderer.circle(effect.x, effect.y, burstSize * 0.2, 1, 1, 1, alpha);
            break;
            
          case 'lightning':
            if (effect.target) {
              const segments = 5;
              let prevX = effect.x;
              let prevY = effect.y;
              const dx = (effect.target.x - effect.x) / segments;
              const dy = (effect.target.y - effect.y) / segments;
              
              for (let i = 1; i <= segments; i++) {
                const nextX = effect.x + dx * i + (i < segments ? (Math.random() - 0.5) * 20 : 0);
                const nextY = effect.y + dy * i + (i < segments ? (Math.random() - 0.5) * 20 : 0);
                this.shapeRenderer.line(prevX, prevY, nextX, nextY, 3 / this.camera.zoom, 0.8, 0.9, 1, alpha);
                prevX = nextX;
                prevY = nextY;
              }
            }
            break;
            
          case 'ice':
            const iceRadius = effect.radius || 30;
            this.shapeRenderer.circle(effect.x, effect.y, iceRadius * (1 - progress * 0.3), 0.6, 0.85, 1, alpha * 0.5);
            break;
            
          case 'nature':
          case 'poison':
            const natureRadius = effect.radius || 25;
            this.shapeRenderer.circle(effect.x, effect.y, natureRadius, 0.2, 0.7, 0.3, alpha * 0.4);
            break;
        }
      }
      
      this.shapeRenderer.end();
    }
    
    /**
     * Render damage numbers
     */
    _renderDamageNumbers(data) {
      // Clear text canvas ONCE at the start
      this.textCtx.clearRect(0, 0, this.width, this.height);
      
      // Render damage numbers if any
      if (data.damageNumbers && data.damageNumbers.length > 0) {
        for (const num of data.damageNumbers) {
          const screen = this.camera.worldToScreen(num.x, num.y);
          
          this.textCtx.save();
          this.textCtx.globalAlpha = num.alpha;
          
          const fontSize = (num.fontSize || 14) * (num.scale || 1);
          this.textCtx.font = `bold ${fontSize}px Arial, sans-serif`;
          this.textCtx.textAlign = 'center';
          this.textCtx.textBaseline = 'middle';
          
          let text;
          if (num.type === 'dot' && num.prefix) {
            text = `${num.prefix}${num.value}`;
          } else {
            text = num.isCrit ? `${num.value}!` : String(num.value);
          }
          
          this.textCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
          this.textCtx.lineWidth = num.type === 'dot' ? 2 : 3;
          this.textCtx.strokeText(text, screen.x, screen.y);
          
          this.textCtx.fillStyle = num.color || '#fff';
          this.textCtx.fillText(text, screen.x, screen.y);
          
          this.textCtx.restore();
        }
      }
      
      // NOTE: Don't call _drawTextOverlay here - it's called after loot numbers
    }
    
    /**
     * Render loot numbers (gold gained from kills)
     */
    _renderLootNumbers(data) {
      // Render loot on same canvas (already cleared by _renderDamageNumbers)
      if (data.lootNumbers) {
        const { lootNumbers, coinParticles } = data.lootNumbers;
        
        // Render coin particles first (behind numbers)
        if (coinParticles && coinParticles.length > 0) {
          this._renderCoinParticles(coinParticles);
        }
        
        // Render loot numbers
        if (lootNumbers && lootNumbers.length > 0) {
          for (const num of lootNumbers) {
            const screen = this.camera.worldToScreen(num.x, num.y);
            
            this.textCtx.save();
            this.textCtx.globalAlpha = num.alpha;
            
            const fontSize = (num.fontSize || 13) * (num.scale || 1);
            this.textCtx.font = `bold ${fontSize}px Arial, sans-serif`;
            this.textCtx.textAlign = 'center';
            this.textCtx.textBaseline = 'middle';
            
            // Build text with prefix (coin icon)
            const prefix = num.prefix || '🪙';
            const text = `${prefix}+${num.value}`;
            
            // Apply coin bob to Y position
            const bobOffset = num.coinBob || 0;
            const screenY = screen.y + bobOffset;
            
            // Draw shadow/outline
            this.textCtx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            this.textCtx.lineWidth = 3;
            this.textCtx.strokeText(text, screen.x, screenY);
            
            // Draw text
            this.textCtx.fillStyle = num.color || '#ffd700';
            this.textCtx.fillText(text, screen.x, screenY);
            
            // Extra glow for crit bonus
            if (num.type === 'crit_bonus') {
              this.textCtx.globalAlpha = num.alpha * 0.3;
              this.textCtx.fillStyle = '#ffffff';
              this.textCtx.fillText(text, screen.x, screenY);
            }
            
            this.textCtx.restore();
          }
        }
      }
      
      // Draw text overlay ONCE after all text is rendered
      this._drawTextOverlay();
    }
    
    /**
     * Render coin particles
     */
    _renderCoinParticles(particles) {
      if (!particles || particles.length === 0) return;
      
      for (const coin of particles) {
        const screen = this.camera.worldToScreen(coin.x, coin.y);
        
        this.textCtx.save();
        this.textCtx.globalAlpha = coin.alpha;
        
        // Translate to coin position for rotation
        this.textCtx.translate(screen.x, screen.y);
        
        // Apply rotation (squeeze effect to simulate 3D flip)
        const squeeze = Math.cos(coin.rotation);
        this.textCtx.scale(squeeze * coin.scale, coin.scale);
        
        // Draw coin
        const size = coin.size || 8;
        const color = coin.isBonus ? '#fff700' : '#ffd700';
        
        // Coin circle
        this.textCtx.beginPath();
        this.textCtx.arc(0, 0, size / 2, 0, Math.PI * 2);
        this.textCtx.fillStyle = color;
        this.textCtx.fill();
        
        // Coin outline
        this.textCtx.strokeStyle = '#b8860b';
        this.textCtx.lineWidth = 1;
        this.textCtx.stroke();
        
        // Inner circle (coin detail)
        if (Math.abs(squeeze) > 0.3) {
          this.textCtx.beginPath();
          this.textCtx.arc(0, 0, size / 4, 0, Math.PI * 2);
          this.textCtx.strokeStyle = '#daa520';
          this.textCtx.lineWidth = 1;
          this.textCtx.stroke();
        }
        
        this.textCtx.restore();
      }
    }
    
    /**
     * Draw text overlay
     */
    _drawTextOverlay() {
      if (this.textOverlayCanvas) {
        const overlayCtx = this.textOverlayCanvas.getContext('2d');
        if (overlayCtx) {
          overlayCtx.clearRect(0, 0, this.width, this.height);
          overlayCtx.drawImage(this.textCanvas, 0, 0);
        }
      }
    }
  };
}

module.exports = { EntityRendererMixin };
