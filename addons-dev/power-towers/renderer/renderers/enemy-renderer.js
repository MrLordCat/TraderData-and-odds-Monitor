/**
 * Power Towers TD - Enemy Renderer
 * 
 * Renders enemies with unique visual styles per type.
 * Includes special effects for Flying, Armored, Elite, Boss.
 */

/**
 * Mixin for enemy rendering methods
 * @param {Class} Base - Base GameRenderer class
 */
function EnemyRendererMixin(Base) {
  return class extends Base {
    
    /**
     * Render enemies with new visual system
     * Each enemy type has unique shape and visual style
     */
    _renderEnemies(data) {
      if (!data.enemies) return;
      
      const camera = this.camera;
      const time = this.frameCount * 0.05;
      
      this.shapeRenderer.begin('triangles', camera);
      
      for (const enemy of data.enemies) {
        if (!camera.isVisible(enemy.x - enemy.size * 2, enemy.y - enemy.size * 2, enemy.size * 4, enemy.size * 4)) continue;
        
        const color = this._parseColor(enemy.color);
        const size = enemy.size || 10;
        const type = enemy.type || 'basic';
        
        // Status effects
        const hasBurn = this._hasStatusEffect(enemy, 'burn');
        const hasPoison = this._hasStatusEffect(enemy, 'poison');
        const hasSlow = this._hasStatusEffect(enemy, 'slow');
        const hasFreeze = this._hasStatusEffect(enemy, 'freeze');
        const hasShock = this._hasStatusEffect(enemy, 'shock');
        const hasCurse = this._hasStatusEffect(enemy, 'curse');
        const hasBleed = this._hasStatusEffect(enemy, 'bleed');
        
        // Flying enemy positioning
        const isFlying = enemy.isFlying || false;
        const hoverOffset = isFlying ? (enemy.hoverHeight || 15) + Math.sin(time * 3) * 3 : 0;
        const renderY = enemy.y - hoverOffset;
        
        // Shadow (different for flying)
        if (isFlying) {
          const shadowScale = enemy.shadowScale || 0.6;
          const shadowOffset = enemy.shadowOffset || 20;
          this.shapeRenderer.circle(enemy.x, enemy.y + shadowOffset, size * shadowScale, 0, 0, 0, 0.15);
        } else {
          this.shapeRenderer.circle(enemy.x, enemy.y + size * 0.8, size * 0.8, 0, 0, 0, 0.3);
        }
        
        // Calculate body color with status tints
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
        
        // Armored enemy metallic override
        if (enemy.isArmored) {
          const metalShine = Math.sin(time * 2) * 0.1 + 0.5;
          bodyR = 0.4 + metalShine * 0.2;
          bodyG = 0.4 + metalShine * 0.2;
          bodyB = 0.45 + metalShine * 0.2;
        }
        
        // Elite enemy golden tint
        if (enemy.isElite) {
          bodyR = Math.min(1, bodyR * 1.2 + 0.2);
          bodyG = Math.min(1, bodyG * 1.1 + 0.15);
          bodyB = bodyB * 0.8;
        }
        
        // === RENDER ENEMY BODY BY TYPE ===
        this._renderEnemyBody(enemy, enemy.x, renderY, size, bodyR, bodyG, bodyB, type, time);
        
        // === SPECIAL TYPE EFFECTS ===
        
        // Elite glow
        if (enemy.isElite) {
          this._renderEliteEffect(enemy.x, renderY, size, time, camera);
        }
        
        // Flying wings
        if (isFlying) {
          this._renderFlyingWings(enemy, enemy.x, renderY, size, bodyR, bodyG, bodyB, time);
        }
        
        // Armored plates
        if (enemy.isArmored) {
          this._renderArmorPlates(enemy, enemy.x, renderY, size, time);
        }
        
        // Magic-Immune aura
        if (enemy.isMagicImmune) {
          this._renderMagicImmuneAura(enemy, enemy.x, renderY, size, time);
        }
        
        // Regenerating glow
        if (enemy.isRegenerating) {
          this._renderRegeneratingEffect(enemy, enemy.x, renderY, size, time);
        }
        
        // Shield bubble
        if (enemy.isShielded) {
          this._renderShieldBubble(enemy, enemy.x, renderY, size, time);
        }
        
        // Boss crown/indicator
        if (enemy.isBoss) {
          this._renderBossIndicator(enemy, enemy.x, renderY, size, time);
        }
        
        // Render status effect visuals
        this._renderEnemyStatusEffects(enemy, size, time, hasBurn, hasPoison, hasSlow, hasFreeze, hasShock, hasCurse);
        
        // Bleed effect
        if (hasBleed) {
          this._renderBleedEffect(enemy, enemy.x, renderY, size, time);
        }
        
        // === HEALTH BAR ===
        this._renderEnemyHealthBar(enemy, renderY, size);
      }
      
      this.shapeRenderer.end();
    }
    
    /**
     * Render enemy health bar (and armor bar for armored)
     */
    _renderEnemyHealthBar(enemy, renderY, size) {
      const hpRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : (enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1);
      const barWidth = size * 2;
      const barHeight = 4;
      const barY = renderY - size - 8;
      
      this.shapeRenderer.rect(enemy.x - barWidth/2, barY, barWidth, barHeight, 0.2, 0.2, 0.2, 0.8);
      
      const hpColor = hpRatio > 0.5 ? { r: 0.3, g: 0.8, b: 0.3 } :
                      hpRatio > 0.25 ? { r: 0.9, g: 0.7, b: 0.2 } :
                      { r: 0.9, g: 0.3, b: 0.3 };
      this.shapeRenderer.rect(enemy.x - barWidth/2, barY, barWidth * Math.max(0, hpRatio), barHeight, hpColor.r, hpColor.g, hpColor.b, 1);
      
      // Armor bar (for armored enemies)
      if (enemy.isArmored && enemy.armor !== undefined) {
        const armorRatio = enemy.armor / (enemy.maxArmor || 50);
        const armorBarY = barY - 5;
        this.shapeRenderer.rect(enemy.x - barWidth/2, armorBarY, barWidth, 3, 0.3, 0.3, 0.3, 0.8);
        this.shapeRenderer.rect(enemy.x - barWidth/2, armorBarY, barWidth * armorRatio, 3, 0.6, 0.6, 0.7, 1);
      }
    }
    
    /**
     * Render elite enemy glow and particles
     */
    _renderEliteEffect(x, y, size, time, camera) {
      const elitePulse = Math.sin(time * 4) * 0.2 + 0.8;
      this.shapeRenderer.circleOutline(x, y, size + 4, 2 / camera.zoom, 1, 0.85, 0.2, elitePulse * 0.6);
      
      // Star particles around elite
      for (let i = 0; i < 4; i++) {
        const angle = time * 2 + i * (Math.PI / 2);
        const dist = size + 6;
        const starX = x + Math.cos(angle) * dist;
        const starY = y + Math.sin(angle) * dist;
        this.shapeRenderer.circle(starX, starY, 2 / camera.zoom, 1, 0.9, 0.3, 0.8);
      }
    }
    
    /**
     * Render enemy body based on type
     */
    _renderEnemyBody(enemy, x, y, size, r, g, b, type, time) {
      const camera = this.camera;
      
      switch (type) {
        case 'minion':
        case 'basic':
          this._renderMinionBody(x, y, size, r, g, b, camera);
          break;
        case 'scout':
        case 'fast':
          this._renderScoutBody(enemy, x, y, size, r, g, b, time, camera);
          break;
        case 'brute':
        case 'tank':
          this._renderBruteBody(x, y, size, r, g, b, camera);
          break;
        case 'swarmling':
        case 'swarm':
          this._renderSwarmlingBody(x, y, size, r, g, b, camera);
          break;
        case 'boss':
          this._renderBossBody(x, y, size, r, g, b, time, camera);
          break;
        default:
          this.shapeRenderer.circle(x, y, size, r, g, b, 1);
          this.shapeRenderer.circleOutline(x, y, size, 1 / camera.zoom, 0, 0, 0, 0.4);
      }
    }
    
    _renderMinionBody(x, y, size, r, g, b, camera) {
      this.shapeRenderer.circle(x, y, size, r, g, b, 1);
      this.shapeRenderer.circle(x, y, size * 0.7, r * 1.2, g * 1.2, b * 1.2, 1);
      this.shapeRenderer.circleOutline(x, y, size, 1 / camera.zoom, 0, 0, 0, 0.5);
      // Antenna
      this.shapeRenderer.circle(x, y - size * 0.9, size * 0.25, r * 0.8, g * 0.8, b * 0.8, 1);
      // Eyes
      this.shapeRenderer.circle(x - size * 0.3, y - size * 0.2, size * 0.15, 1, 1, 1, 0.9);
      this.shapeRenderer.circle(x + size * 0.3, y - size * 0.2, size * 0.15, 1, 1, 1, 0.9);
      this.shapeRenderer.circle(x - size * 0.3, y - size * 0.2, size * 0.08, 0, 0, 0, 1);
      this.shapeRenderer.circle(x + size * 0.3, y - size * 0.2, size * 0.08, 0, 0, 0, 1);
    }
    
    _renderScoutBody(enemy, x, y, size, r, g, b, time, camera) {
      // Body (elongated ellipse approximation)
      this.shapeRenderer.circle(x, y, size * 0.8, r, g, b, 1);
      this.shapeRenderer.circle(x - size * 0.3, y, size * 0.5, r * 0.9, g * 0.9, b * 0.9, 1);
      this.shapeRenderer.circle(x + size * 0.4, y, size * 0.4, r * 1.1, g * 1.1, b * 1.1, 1);
      // Tail
      this.shapeRenderer.circle(x - size * 0.7, y, size * 0.25, r * 0.8, g * 0.8, b * 0.8, 1);
      // Speed lines (motion blur effect)
      const speedAlpha = 0.3 + Math.sin(time * 8) * 0.1;
      this.shapeRenderer.circle(x - size * 1.2, y, size * 0.15, r, g, b, speedAlpha);
      this.shapeRenderer.circle(x - size * 1.5, y, size * 0.1, r, g, b, speedAlpha * 0.5);
      // Eye
      this.shapeRenderer.circle(x + size * 0.5, y - size * 0.1, size * 0.12, 1, 0.8, 0, 1);
    }
    
    _renderBruteBody(x, y, size, r, g, b, camera) {
      const bruteSize = size * 1.2;
      // Main body (square-ish via multiple circles)
      this.shapeRenderer.circle(x, y, bruteSize, r * 0.8, g * 0.8, b * 0.8, 1);
      this.shapeRenderer.circle(x - bruteSize * 0.3, y - bruteSize * 0.3, bruteSize * 0.5, r, g, b, 1);
      this.shapeRenderer.circle(x + bruteSize * 0.3, y - bruteSize * 0.3, bruteSize * 0.5, r, g, b, 1);
      this.shapeRenderer.circle(x - bruteSize * 0.3, y + bruteSize * 0.3, bruteSize * 0.5, r, g, b, 1);
      this.shapeRenderer.circle(x + bruteSize * 0.3, y + bruteSize * 0.3, bruteSize * 0.5, r, g, b, 1);
      // Tusks
      this.shapeRenderer.circle(x - bruteSize * 0.6, y + bruteSize * 0.2, bruteSize * 0.15, 1, 1, 0.9, 1);
      this.shapeRenderer.circle(x + bruteSize * 0.6, y + bruteSize * 0.2, bruteSize * 0.15, 1, 1, 0.9, 1);
      // Angry eyes
      this.shapeRenderer.circle(x - bruteSize * 0.25, y - bruteSize * 0.2, bruteSize * 0.12, 1, 0.2, 0.2, 1);
      this.shapeRenderer.circle(x + bruteSize * 0.25, y - bruteSize * 0.2, bruteSize * 0.12, 1, 0.2, 0.2, 1);
      // Outline
      this.shapeRenderer.circleOutline(x, y, bruteSize, 2 / camera.zoom, 0, 0, 0, 0.6);
    }
    
    _renderSwarmlingBody(x, y, size, r, g, b, camera) {
      const swarmSize = size * 0.8;
      // Body segments
      this.shapeRenderer.circle(x + swarmSize * 0.3, y, swarmSize * 0.6, r, g, b, 1);
      this.shapeRenderer.circle(x, y, swarmSize * 0.5, r * 0.9, g * 0.9, b * 0.9, 1);
      this.shapeRenderer.circle(x - swarmSize * 0.4, y, swarmSize * 0.7, r * 0.85, g * 0.85, b * 0.85, 1);
      // Legs (simple dots)
      for (let i = 0; i < 3; i++) {
        const legX = x - swarmSize * 0.2 + i * swarmSize * 0.2;
        this.shapeRenderer.circle(legX, y + swarmSize * 0.5, swarmSize * 0.1, 0.2, 0.2, 0.2, 0.8);
        this.shapeRenderer.circle(legX, y - swarmSize * 0.5, swarmSize * 0.1, 0.2, 0.2, 0.2, 0.8);
      }
      // Antenna
      this.shapeRenderer.circle(x + swarmSize * 0.5, y - swarmSize * 0.3, swarmSize * 0.08, 0.3, 0.3, 0.3, 1);
      this.shapeRenderer.circle(x + swarmSize * 0.5, y + swarmSize * 0.3, swarmSize * 0.08, 0.3, 0.3, 0.3, 1);
    }
    
    _renderBossBody(x, y, size, r, g, b, time, camera) {
      const bossSize = size * 1.5;
      // Main body
      this.shapeRenderer.circle(x, y, bossSize, r * 0.7, g * 0.7, b * 0.7, 1);
      this.shapeRenderer.circle(x, y, bossSize * 0.85, r, g, b, 1);
      this.shapeRenderer.circle(x, y, bossSize * 0.6, r * 1.2, g * 1.2, b * 1.2, 1);
      // Spikes
      for (let i = 0; i < 8; i++) {
        const spikeAngle = (i / 8) * Math.PI * 2;
        const spikeX = x + Math.cos(spikeAngle) * bossSize * 0.9;
        const spikeY = y + Math.sin(spikeAngle) * bossSize * 0.9;
        this.shapeRenderer.circle(spikeX, spikeY, bossSize * 0.2, r * 0.6, g * 0.6, b * 0.6, 1);
      }
      // Glowing eyes
      const eyeGlow = Math.sin(time * 5) * 0.3 + 0.7;
      this.shapeRenderer.circle(x - bossSize * 0.3, y - bossSize * 0.2, bossSize * 0.2, 1, eyeGlow * 0.3, 0, 1);
      this.shapeRenderer.circle(x + bossSize * 0.3, y - bossSize * 0.2, bossSize * 0.2, 1, eyeGlow * 0.3, 0, 1);
      // Outline
      this.shapeRenderer.circleOutline(x, y, bossSize, 3 / camera.zoom, 0, 0, 0, 0.7);
    }
    
    /**
     * Render flying enemy wings
     */
    _renderFlyingWings(enemy, x, y, size, r, g, b, time) {
      const flapSpeed = enemy.wingFlapSpeed || 0.02;
      const wingSize = (enemy.wingSize || 0.8) * size;
      
      // Wing flap animation
      const flapPhase = Math.sin(time * 20 * flapSpeed / 0.02) * 0.5 + 0.5;
      const wingOffset = wingSize * (0.3 + flapPhase * 0.4);
      
      // Left wing
      this.shapeRenderer.circle(x - wingOffset, y - size * 0.2, wingSize * 0.6, r * 0.9, g * 0.9, b * 1.1, 0.7);
      this.shapeRenderer.circle(x - wingOffset * 0.6, y - size * 0.1, wingSize * 0.4, r * 0.8, g * 0.8, b * 1.2, 0.8);
      
      // Right wing
      this.shapeRenderer.circle(x + wingOffset, y - size * 0.2, wingSize * 0.6, r * 0.9, g * 0.9, b * 1.1, 0.7);
      this.shapeRenderer.circle(x + wingOffset * 0.6, y - size * 0.1, wingSize * 0.4, r * 0.8, g * 0.8, b * 1.2, 0.8);
      
      // Wind trail
      const trailAlpha = 0.2 + Math.sin(time * 4) * 0.1;
      this.shapeRenderer.circle(x, y + size * 0.8, size * 0.4, 0.8, 0.9, 1, trailAlpha);
      this.shapeRenderer.circle(x, y + size * 1.2, size * 0.25, 0.8, 0.9, 1, trailAlpha * 0.5);
    }
    
    /**
     * Render armor plates on armored enemy
     */
    _renderArmorPlates(enemy, x, y, size, time) {
      const camera = this.camera;
      const plateCount = enemy.armorPlateCount || 4;
      const armorRatio = (enemy.armor || 50) / (enemy.maxArmor || 50);
      
      // Metallic shine
      const shine = Math.sin(time * 2 + x * 0.1) * 0.15 + 0.85;
      
      // Armor plates around enemy
      for (let i = 0; i < plateCount; i++) {
        const angle = (i / plateCount) * Math.PI * 2 - Math.PI / 2;
        const plateX = x + Math.cos(angle) * size * 0.8;
        const plateY = y + Math.sin(angle) * size * 0.8;
        const plateSize = size * 0.35;
        
        // Plate color based on armor health
        const plateR = 0.5 * shine * armorRatio + 0.3;
        const plateG = 0.5 * shine * armorRatio + 0.3;
        const plateB = 0.55 * shine * armorRatio + 0.3;
        
        this.shapeRenderer.circle(plateX, plateY, plateSize, plateR, plateG, plateB, 0.9);
        this.shapeRenderer.circleOutline(plateX, plateY, plateSize, 1 / camera.zoom, 0.3, 0.3, 0.35, 0.8);
        
        // Damage cracks if armor is low
        if (armorRatio < 0.5) {
          const crackAlpha = (0.5 - armorRatio) * 2;
          this.shapeRenderer.circle(plateX, plateY, plateSize * 0.3, 0.5, 0.1, 0.1, crackAlpha);
        }
      }
      
      // Shield icon in center (small)
      this.shapeRenderer.circle(x, y - size * 0.1, size * 0.25, 0.6, 0.6, 0.65, 0.6);
    }
    
    /**
     * Render boss indicator (crown)
     */
    _renderBossIndicator(enemy, x, y, size, time) {
      const crownY = y - size - 8;
      const pulse = Math.sin(time * 3) * 0.2 + 0.8;
      
      // Crown base
      this.shapeRenderer.rect(x - size * 0.4, crownY, size * 0.8, size * 0.2, 1, 0.85, 0.2, pulse);
      
      // Crown points
      for (let i = 0; i < 3; i++) {
        const pointX = x - size * 0.3 + i * size * 0.3;
        const pointY = crownY - size * 0.15;
        this.shapeRenderer.circle(pointX, pointY, size * 0.1, 1, 0.9, 0.3, pulse);
      }
      
      // Gem in center
      this.shapeRenderer.circle(x, crownY + size * 0.05, size * 0.12, 1, 0.2, 0.2, 1);
    }
    
    /**
     * Render bleed effect
     */
    _renderBleedEffect(enemy, x, y, size, time) {
      const bleedEffect = this._getStatusEffect(enemy, 'bleed');
      const stacks = bleedEffect?.stacks || 1;
      
      // Blood drops
      for (let i = 0; i < Math.min(stacks * 2, 6); i++) {
        const dropTime = (time * 1.5 + i * 0.7) % 2;
        const dropY = y + dropTime * 15;
        const dropX = x + Math.sin(i * 2.3) * size * 0.5;
        const dropAlpha = Math.max(0, 1 - dropTime);
        const dropSize = 2 + (1 - dropTime) * 2;
        this.shapeRenderer.circle(dropX, dropY, dropSize, 0.7, 0.1, 0.1, dropAlpha * 0.8);
      }
      
      // Red outline
      this.shapeRenderer.circleOutline(x, y, size + 1, 1.5 / this.camera.zoom, 0.6, 0.1, 0.1, 0.4);
    }
    
    /**
     * Render enemy status effect visuals
     */
    _renderEnemyStatusEffects(enemy, size, time, hasBurn, hasPoison, hasSlow, hasFreeze, hasShock, hasCurse) {
      const camera = this.camera;
      
      if (hasBurn) this._renderBurnEffect(enemy, size, time, camera);
      if (hasPoison) this._renderPoisonEffect(enemy, size, time, camera);
      if (hasSlow && !hasFreeze) this._renderSlowEffect(enemy, size, time, camera);
      if (hasFreeze) this._renderFreezeEffect(enemy, size, time, camera);
      if (hasShock) this._renderShockEffect(enemy, size, time, camera);
      if (hasCurse) this._renderCurseEffect(enemy, size, time, camera);
    }
    
    _renderBurnEffect(enemy, size, time, camera) {
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
    
    _renderPoisonEffect(enemy, size, time, camera) {
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
    
    _renderSlowEffect(enemy, size, time, camera) {
      const slowAlpha = 0.4 + Math.sin(time * 4) * 0.1;
      this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 2, 2 / camera.zoom, 0.4, 0.7, 0.95, slowAlpha);
      for (let i = 0; i < 3; i++) {
        const angle = time * 2 + i * (Math.PI * 2 / 3);
        const crystalX = enemy.x + Math.cos(angle) * (size + 4);
        const crystalY = enemy.y + Math.sin(angle) * (size + 4);
        this.shapeRenderer.circle(crystalX, crystalY, 2, 0.7, 0.9, 1, 0.6);
      }
    }
    
    _renderFreezeEffect(enemy, size, time, camera) {
      this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 1, 3 / camera.zoom, 0.6, 0.9, 1, 0.8);
      this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 4, 2 / camera.zoom, 0.4, 0.7, 1, 0.4);
      for (let i = 0; i < 6; i++) {
        const angle = i * (Math.PI / 3);
        const crystalX = enemy.x + Math.cos(angle) * (size + 5);
        const crystalY = enemy.y + Math.sin(angle) * (size + 5);
        this.shapeRenderer.circle(crystalX, crystalY, 3, 0.8, 0.95, 1, 0.7);
      }
    }
    
    _renderShockEffect(enemy, size, time, camera) {
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
    
    _renderCurseEffect(enemy, size, time, camera) {
      const curseAlpha = 0.3 + Math.sin(time * 2) * 0.1;
      this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 4, 3 / camera.zoom, 0.4, 0.1, 0.5, curseAlpha);
      this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 6, 2 / camera.zoom, 0.3, 0, 0.4, curseAlpha * 0.5);
    }
    
    /**
     * Render magic-immune aura (purple anti-magic glow)
     */
    _renderMagicImmuneAura(enemy, x, y, size, time) {
      const camera = this.camera;
      const pulsePhase = Math.sin(time * 2) * 0.15 + 0.85;
      const auraRadius = size * 1.4 * pulsePhase;
      
      // Outer purple glow
      this.shapeRenderer.circleOutline(x, y, auraRadius, 3 / camera.zoom, 0.6, 0.4, 1, 0.4);
      
      // Inner lighter glow
      this.shapeRenderer.circleOutline(x, y, size + 2, 2 / camera.zoom, 0.8, 0.6, 1, 0.6);
      
      // Rotating runes
      const runeCount = 4;
      for (let i = 0; i < runeCount; i++) {
        const angle = time * 1 + (i / runeCount) * Math.PI * 2;
        const runeX = x + Math.cos(angle) * (size + 6);
        const runeY = y + Math.sin(angle) * (size + 6);
        const runeAlpha = 0.6 + Math.sin(time * 3 + i) * 0.2;
        this.shapeRenderer.circle(runeX, runeY, 2.5, 0.5, 0.2, 0.8, runeAlpha);
      }
      
      // Anti-magic particles (floating upward)
      for (let i = 0; i < 2; i++) {
        const particleTime = (time * 0.5 + i * 0.5) % 1;
        const particleY = y + size - particleTime * 15;
        const particleX = x + Math.sin(time * 2 + i * 2) * size * 0.4;
        const particleAlpha = (1 - particleTime) * 0.6;
        this.shapeRenderer.circle(particleX, particleY, 2, 0.7, 0.5, 1, particleAlpha);
      }
    }
    
    /**
     * Render regenerating enemy effect (green healing glow)
     */
    _renderRegeneratingEffect(enemy, x, y, size, time) {
      const camera = this.camera;
      
      // Pulsing green glow
      const glowPulse = Math.sin(time * 3) * 0.2 + 0.8;
      this.shapeRenderer.circleOutline(x, y, size + 3, 2 / camera.zoom, 0.3, 0.9, 0.3, 0.4 * glowPulse);
      
      // Extra pulse when recently healed
      if (enemy.lastRegenTime && Date.now() - enemy.lastRegenTime < 500) {
        const healPulse = 1 - (Date.now() - enemy.lastRegenTime) / 500;
        this.shapeRenderer.circleOutline(x, y, size + 5 + healPulse * 5, 2 / camera.zoom, 0.4, 1, 0.4, healPulse * 0.5);
      }
      
      // Rising healing particles
      for (let i = 0; i < 3; i++) {
        const particleTime = (time * 0.8 + i * 0.33) % 1;
        const particleY = y + size * 0.5 - particleTime * 20;
        const particleX = x + Math.sin(time * 1.5 + i * 2.1) * size * 0.5;
        const particleAlpha = (1 - particleTime) * 0.7;
        const particleSize = 2 + (1 - particleTime) * 1.5;
        this.shapeRenderer.circle(particleX, particleY, particleSize, 0.4, 1, 0.4, particleAlpha);
      }
      
      // + symbol indicator
      const plusAlpha = 0.5 + Math.sin(time * 4) * 0.2;
      const plusSize = size * 0.3;
      // Vertical bar
      this.shapeRenderer.rect(x - 1, y - size - 10 - plusSize/2, 2, plusSize, 0.3, 0.9, 0.3, plusAlpha);
      // Horizontal bar
      this.shapeRenderer.rect(x - plusSize/2, y - size - 10 - 1, plusSize, 2, 0.3, 0.9, 0.3, plusAlpha);
    }
    
    /**
     * Render shield bubble for shielded enemies
     */
    _renderShieldBubble(enemy, x, y, size, time) {
      const camera = this.camera;
      const shieldHealth = enemy.shieldHealth || 0;
      const maxShield = enemy.maxShieldHealth || 50;
      
      if (shieldHealth <= 0) {
        // Shield broken - show cracked effect briefly
        if (enemy.shieldBrokenTime && Date.now() - enemy.shieldBrokenTime < 500) {
          const breakProgress = (Date.now() - enemy.shieldBrokenTime) / 500;
          const breakAlpha = (1 - breakProgress) * 0.6;
          // Scattered fragments
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + breakProgress * 2;
            const dist = size * (1.3 + breakProgress * 0.5);
            const fragX = x + Math.cos(angle) * dist;
            const fragY = y + Math.sin(angle) * dist;
            this.shapeRenderer.circle(fragX, fragY, 3 * (1 - breakProgress), 0.3, 0.5, 1, breakAlpha);
          }
        }
        return;
      }
      
      const shieldRatio = shieldHealth / maxShield;
      const bubbleRadius = size * 1.3;
      
      // Outer bubble
      const bubbleAlpha = 0.3 + shieldRatio * 0.2 + Math.sin(time * 2) * 0.05;
      this.shapeRenderer.circleOutline(x, y, bubbleRadius, 2 / camera.zoom, 0.3, 0.5, 1, bubbleAlpha);
      
      // Inner glow based on shield health
      this.shapeRenderer.circle(x, y, bubbleRadius * 0.95, 0.3, 0.5, 0.9, 0.1 * shieldRatio);
      
      // Hexagon pattern effect
      const hexCount = 6;
      for (let i = 0; i < hexCount; i++) {
        const angle = (i / hexCount) * Math.PI * 2 + time * 0.5;
        const hexX = x + Math.cos(angle) * bubbleRadius * 0.7;
        const hexY = y + Math.sin(angle) * bubbleRadius * 0.7;
        const hexAlpha = 0.15 + Math.sin(time * 3 + i) * 0.05;
        this.shapeRenderer.circle(hexX, hexY, 3, 0.4, 0.6, 1, hexAlpha * shieldRatio);
      }
      
      // Shield bar above health bar
      const barWidth = size * 2;
      const barY = y - size - 13;
      this.shapeRenderer.rect(x - barWidth/2, barY, barWidth, 3, 0.2, 0.3, 0.5, 0.8);
      this.shapeRenderer.rect(x - barWidth/2, barY, barWidth * shieldRatio, 3, 0.3, 0.5, 1, 1);
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
  };
}

module.exports = { EnemyRendererMixin };
