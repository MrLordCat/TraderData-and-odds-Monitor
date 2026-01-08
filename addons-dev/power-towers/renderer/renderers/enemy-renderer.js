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
        
        // Ethereal aura transparency modifier
        const etherealAlpha = this._getEtherealAlpha(enemy);
        
        // === RENDER ENEMY BODY BY TYPE ===
        this._renderEnemyBody(enemy, enemy.x, renderY, size, bodyR, bodyG, bodyB, type, time, etherealAlpha);
        
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
        
        // Phasing ghost effect
        if (enemy.isPhasing) {
          this._renderPhasingEffect(enemy, enemy.x, renderY, size, time);
        }
        
        // Undead decay effect
        if (enemy.isUndead) {
          this._renderUndeadEffect(enemy, enemy.x, renderY, size, time);
        }
        
        // Splitter split indicator
        if (enemy.isSplitter && !enemy.isSplitChild) {
          this._renderSplitterIndicator(enemy, enemy.x, renderY, size, time);
        }
        
        // Boss crown/indicator
        if (enemy.isBoss) {
          this._renderBossIndicator(enemy, enemy.x, renderY, size, time);
        }
        
        // === WAVE AURA EFFECTS ===
        this._renderAuraEffects(enemy, enemy.x, renderY, size, time);
        
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
      
      // === SWARM MIND CONNECTIONS (after all enemies) ===
      this.shapeRenderer.begin('triangles', camera);
      this._renderSwarmMindConnections(data.enemies, time);
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
     * @param {number} alpha - Transparency multiplier (1 = opaque, 0.5 = ethereal)
     */
    _renderEnemyBody(enemy, x, y, size, r, g, b, type, time, alpha = 1) {
      const camera = this.camera;
      
      switch (type) {
        case 'minion':
        case 'basic':
          this._renderMinionBody(x, y, size, r, g, b, camera, alpha);
          break;
        case 'scout':
        case 'fast':
          this._renderScoutBody(enemy, x, y, size, r, g, b, time, camera, alpha);
          break;
        case 'brute':
        case 'tank':
          this._renderBruteBody(x, y, size, r, g, b, camera, alpha);
          break;
        case 'swarmling':
        case 'swarm':
          this._renderSwarmlingBody(x, y, size, r, g, b, camera, alpha);
          break;
        case 'boss':
          this._renderBossBody(x, y, size, r, g, b, time, camera, alpha);
          break;
        default:
          this.shapeRenderer.circle(x, y, size, r, g, b, alpha);
          this.shapeRenderer.circleOutline(x, y, size, 1 / camera.zoom, 0, 0, 0, 0.4 * alpha);
      }
    }
    
    _renderMinionBody(x, y, size, r, g, b, camera, alpha = 1) {
      this.shapeRenderer.circle(x, y, size, r, g, b, alpha);
      this.shapeRenderer.circle(x, y, size * 0.7, r * 1.2, g * 1.2, b * 1.2, alpha);
      this.shapeRenderer.circleOutline(x, y, size, 1 / camera.zoom, 0, 0, 0, 0.5 * alpha);
      // Antenna
      this.shapeRenderer.circle(x, y - size * 0.9, size * 0.25, r * 0.8, g * 0.8, b * 0.8, alpha);
      // Eyes
      this.shapeRenderer.circle(x - size * 0.3, y - size * 0.2, size * 0.15, 1, 1, 1, 0.9 * alpha);
      this.shapeRenderer.circle(x + size * 0.3, y - size * 0.2, size * 0.15, 1, 1, 1, 0.9 * alpha);
      this.shapeRenderer.circle(x - size * 0.3, y - size * 0.2, size * 0.08, 0, 0, 0, alpha);
      this.shapeRenderer.circle(x + size * 0.3, y - size * 0.2, size * 0.08, 0, 0, 0, alpha);
    }
    
    _renderScoutBody(enemy, x, y, size, r, g, b, time, camera, alpha = 1) {
      // Body (elongated ellipse approximation)
      this.shapeRenderer.circle(x, y, size * 0.8, r, g, b, alpha);
      this.shapeRenderer.circle(x - size * 0.3, y, size * 0.5, r * 0.9, g * 0.9, b * 0.9, alpha);
      this.shapeRenderer.circle(x + size * 0.4, y, size * 0.4, r * 1.1, g * 1.1, b * 1.1, alpha);
      // Tail
      this.shapeRenderer.circle(x - size * 0.7, y, size * 0.25, r * 0.8, g * 0.8, b * 0.8, alpha);
      // Speed lines (motion blur effect)
      const speedAlpha = (0.3 + Math.sin(time * 8) * 0.1) * alpha;
      this.shapeRenderer.circle(x - size * 1.2, y, size * 0.15, r, g, b, speedAlpha);
      this.shapeRenderer.circle(x - size * 1.5, y, size * 0.1, r, g, b, speedAlpha * 0.5);
      // Eye
      this.shapeRenderer.circle(x + size * 0.5, y - size * 0.1, size * 0.12, 1, 0.8, 0, alpha);
    }
    
    _renderBruteBody(x, y, size, r, g, b, camera, alpha = 1) {
      const bruteSize = size * 1.2;
      // Main body (square-ish via multiple circles)
      this.shapeRenderer.circle(x, y, bruteSize, r * 0.8, g * 0.8, b * 0.8, alpha);
      this.shapeRenderer.circle(x - bruteSize * 0.3, y - bruteSize * 0.3, bruteSize * 0.5, r, g, b, alpha);
      this.shapeRenderer.circle(x + bruteSize * 0.3, y - bruteSize * 0.3, bruteSize * 0.5, r, g, b, alpha);
      this.shapeRenderer.circle(x - bruteSize * 0.3, y + bruteSize * 0.3, bruteSize * 0.5, r, g, b, alpha);
      this.shapeRenderer.circle(x + bruteSize * 0.3, y + bruteSize * 0.3, bruteSize * 0.5, r, g, b, alpha);
      // Tusks
      this.shapeRenderer.circle(x - bruteSize * 0.6, y + bruteSize * 0.2, bruteSize * 0.15, 1, 1, 0.9, alpha);
      this.shapeRenderer.circle(x + bruteSize * 0.6, y + bruteSize * 0.2, bruteSize * 0.15, 1, 1, 0.9, alpha);
      // Angry eyes
      this.shapeRenderer.circle(x - bruteSize * 0.25, y - bruteSize * 0.2, bruteSize * 0.12, 1, 0.2, 0.2, alpha);
      this.shapeRenderer.circle(x + bruteSize * 0.25, y - bruteSize * 0.2, bruteSize * 0.12, 1, 0.2, 0.2, alpha);
      // Outline
      this.shapeRenderer.circleOutline(x, y, bruteSize, 2 / camera.zoom, 0, 0, 0, 0.6 * alpha);
    }
    
    _renderSwarmlingBody(x, y, size, r, g, b, camera, alpha = 1) {
      const swarmSize = size * 0.8;
      // Body segments
      this.shapeRenderer.circle(x + swarmSize * 0.3, y, swarmSize * 0.6, r, g, b, alpha);
      this.shapeRenderer.circle(x, y, swarmSize * 0.5, r * 0.9, g * 0.9, b * 0.9, alpha);
      this.shapeRenderer.circle(x - swarmSize * 0.4, y, swarmSize * 0.7, r * 0.85, g * 0.85, b * 0.85, alpha);
      // Legs (simple dots)
      for (let i = 0; i < 3; i++) {
        const legX = x - swarmSize * 0.2 + i * swarmSize * 0.2;
        this.shapeRenderer.circle(legX, y + swarmSize * 0.5, swarmSize * 0.1, 0.2, 0.2, 0.2, 0.8 * alpha);
        this.shapeRenderer.circle(legX, y - swarmSize * 0.5, swarmSize * 0.1, 0.2, 0.2, 0.2, 0.8 * alpha);
      }
      // Antenna
      this.shapeRenderer.circle(x + swarmSize * 0.5, y - swarmSize * 0.3, swarmSize * 0.08, 0.3, 0.3, 0.3, alpha);
      this.shapeRenderer.circle(x + swarmSize * 0.5, y + swarmSize * 0.3, swarmSize * 0.08, 0.3, 0.3, 0.3, alpha);
    }
    
    _renderBossBody(x, y, size, r, g, b, time, camera, alpha = 1) {
      const bossSize = size * 1.5;
      // Main body
      this.shapeRenderer.circle(x, y, bossSize, r * 0.7, g * 0.7, b * 0.7, alpha);
      this.shapeRenderer.circle(x, y, bossSize * 0.85, r, g, b, alpha);
      this.shapeRenderer.circle(x, y, bossSize * 0.6, r * 1.2, g * 1.2, b * 1.2, alpha);
      // Spikes
      for (let i = 0; i < 8; i++) {
        const spikeAngle = (i / 8) * Math.PI * 2;
        const spikeX = x + Math.cos(spikeAngle) * bossSize * 0.9;
        const spikeY = y + Math.sin(spikeAngle) * bossSize * 0.9;
        this.shapeRenderer.circle(spikeX, spikeY, bossSize * 0.2, r * 0.6, g * 0.6, b * 0.6, alpha);
      }
      // Glowing eyes
      const eyeGlow = Math.sin(time * 5) * 0.3 + 0.7;
      this.shapeRenderer.circle(x - bossSize * 0.3, y - bossSize * 0.2, bossSize * 0.2, 1, eyeGlow * 0.3, 0, alpha);
      this.shapeRenderer.circle(x + bossSize * 0.3, y - bossSize * 0.2, bossSize * 0.2, 1, eyeGlow * 0.3, 0, alpha);
      // Outline
      this.shapeRenderer.circleOutline(x, y, bossSize, 3 / camera.zoom, 0, 0, 0, 0.7 * alpha);
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
    
    // ===============================
    // WAVE AURA VISUAL EFFECTS
    // ===============================
    
    /**
     * Render all aura effects for an enemy
     * @param {Object} enemy - Enemy with auras array
     * @param {number} x - Enemy X position
     * @param {number} y - Enemy Y position (render position with hover offset)
     * @param {number} size - Enemy size
     * @param {number} time - Animation time
     */
    _renderAuraEffects(enemy, x, y, size, time) {
      if (!enemy.auras || enemy.auras.length === 0) return;
      
      for (const auraId of enemy.auras) {
        switch (auraId) {
          case 'haste':
            this._renderHasteAura(enemy, x, y, size, time);
            break;
          case 'fortified':
            this._renderFortifiedAura(enemy, x, y, size, time);
            break;
          case 'regeneration':
            this._renderRegenerationAura(enemy, x, y, size, time);
            break;
          case 'energized':
            this._renderEnergizedAura(enemy, x, y, size, time);
            break;
          case 'ethereal':
            // Ethereal is handled via transparency modifier in body rendering
            break;
          case 'berserker':
            this._renderBerserkerAura(enemy, x, y, size, time);
            break;
          case 'swarm_mind':
            // Swarm mind rendered separately with connections
            break;
        }
      }
    }
    
    /**
     * Render Haste aura - blue speed lines trailing behind
     */
    _renderHasteAura(enemy, x, y, size, time) {
      const camera = this.camera;
      
      // Speed lines behind the enemy
      const lineCount = 3;
      for (let i = 0; i < lineCount; i++) {
        const offset = (time * 4 + i * 0.5) % 1;
        const lineX = x - (1 - offset) * size * 2.5;
        const lineY = y + (i - 1) * size * 0.5;
        const lineAlpha = offset * 0.5;
        const lineWidth = size * 1.5 * (1 - offset * 0.5);
        
        this.shapeRenderer.rect(
          lineX, lineY - 1,
          lineWidth, 2,
          0.2, 0.6, 0.9, lineAlpha
        );
      }
      
      // Blue glow outline
      const glowPulse = Math.sin(time * 6) * 0.1 + 0.3;
      this.shapeRenderer.circleOutline(x, y, size * 1.15, 1.5 / camera.zoom, 0.3, 0.6, 0.9, glowPulse);
    }
    
    /**
     * Render Fortified aura - golden shield icon above enemy
     */
    _renderFortifiedAura(enemy, x, y, size, time) {
      const camera = this.camera;
      
      // Golden shimmer outline
      const shimmerPhase = Math.sin(time * 3) * 0.15 + 0.5;
      this.shapeRenderer.circleOutline(x, y, size * 1.2, 2 / camera.zoom, 0.9, 0.7, 0.2, shimmerPhase);
      
      // Shield icon above enemy (simplified triangle)
      const shieldY = y - size - 6;
      const shieldSize = 5;
      const shieldPulse = Math.sin(time * 2) * 0.1 + 0.9;
      
      // Shield shape (triangle pointing down)
      this.shapeRenderer.triangle(
        x, shieldY + shieldSize,      // Bottom point
        x - shieldSize, shieldY - shieldSize * 0.3,  // Top left
        x + shieldSize, shieldY - shieldSize * 0.3,  // Top right
        0.9, 0.75, 0.2, shieldPulse * 0.8
      );
      
      // Golden particles
      for (let i = 0; i < 2; i++) {
        const angle = time * 2 + i * Math.PI;
        const dist = size + 3;
        const pX = x + Math.cos(angle) * dist;
        const pY = y + Math.sin(angle) * dist;
        const pAlpha = Math.sin(time * 4 + i) * 0.3 + 0.4;
        this.shapeRenderer.circle(pX, pY, 2, 1, 0.85, 0.3, pAlpha);
      }
    }
    
    /**
     * Render Regeneration aura - green healing glow with + symbols
     */
    _renderRegenerationAura(enemy, x, y, size, time) {
      const camera = this.camera;
      
      // Green healing glow
      const glowPulse = Math.sin(time * 3) * 0.1 + 0.25;
      this.shapeRenderer.circle(x, y, size * 1.3, 0.2, 0.8, 0.3, glowPulse);
      
      // Rising heal particles
      const particleCount = 3;
      for (let i = 0; i < particleCount; i++) {
        const phase = (time * 1.5 + i * 0.8) % 2;
        if (phase > 1) continue; // Only show while rising
        
        const pX = x + Math.sin(i * 2.1) * size * 0.6;
        const pY = y + size * 0.5 - phase * size * 2;
        const pAlpha = (1 - phase) * 0.7;
        
        // Plus sign (two rectangles)
        this.shapeRenderer.rect(pX - 2, pY - 0.5, 4, 1, 0.3, 0.9, 0.3, pAlpha);
        this.shapeRenderer.rect(pX - 0.5, pY - 2, 1, 4, 0.3, 0.9, 0.3, pAlpha);
      }
    }
    
    /**
     * Render Energized aura - electric sparks around enemy (immune to slow)
     */
    _renderEnergizedAura(enemy, x, y, size, time) {
      const camera = this.camera;
      
      // Electric outline
      const sparkIntensity = Math.abs(Math.sin(time * 10)) * 0.3 + 0.4;
      this.shapeRenderer.circleOutline(x, y, size * 1.1, 1.5 / camera.zoom, 1, 0.95, 0.3, sparkIntensity);
      
      // Random sparks
      const sparkCount = 4;
      for (let i = 0; i < sparkCount; i++) {
        const sparkPhase = (time * 8 + i * 1.5) % 1;
        if (sparkPhase > 0.3) continue; // Quick flash
        
        const angle = (i / sparkCount) * Math.PI * 2 + time * 5;
        const dist = size * (1.0 + sparkPhase * 0.5);
        const sparkX = x + Math.cos(angle) * dist;
        const sparkY = y + Math.sin(angle) * dist;
        
        // Spark line
        const endX = sparkX + Math.cos(angle + 0.3) * 5;
        const endY = sparkY + Math.sin(angle + 0.3) * 5;
        
        this.shapeRenderer.rect(
          Math.min(sparkX, endX), Math.min(sparkY, endY),
          Math.abs(endX - sparkX) + 1, Math.abs(endY - sparkY) + 1,
          1, 1, 0.4, 0.8
        );
      }
    }
    
    /**
     * Render Berserker aura - red flames when below HP threshold
     */
    _renderBerserkerAura(enemy, x, y, size, time) {
      const camera = this.camera;
      
      // Check if berserking (below threshold)
      const hpRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 
                      (enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1);
      const threshold = enemy.berserkThreshold || 0.3;
      const isBerserking = hpRatio <= threshold;
      
      if (!isBerserking) {
        // Subtle red outline when not active
        this.shapeRenderer.circleOutline(x, y, size * 1.1, 1 / camera.zoom, 0.9, 0.3, 0.2, 0.2);
        return;
      }
      
      // Active berserker flames!
      const flameCount = 5;
      for (let i = 0; i < flameCount; i++) {
        const angle = (i / flameCount) * Math.PI * 2;
        const flamePhase = (time * 6 + i * 0.7) % 1;
        const flameHeight = flamePhase * size * 1.5;
        const flameX = x + Math.cos(angle) * size * 0.8;
        const flameY = y - flameHeight;
        const flameSize = (1 - flamePhase) * 4 + 2;
        
        // Orange-red gradient
        const r = 1;
        const g = 0.3 + (1 - flamePhase) * 0.4;
        const b = 0.1;
        const a = (1 - flamePhase) * 0.7;
        
        this.shapeRenderer.circle(flameX, flameY, flameSize, r, g, b, a);
      }
      
      // Intense red glow
      const glowPulse = Math.sin(time * 8) * 0.15 + 0.5;
      this.shapeRenderer.circleOutline(x, y, size * 1.2, 2.5 / camera.zoom, 1, 0.2, 0.1, glowPulse);
    }
    
    /**
     * Render Swarm Mind connections between enemies
     * This should be called after all enemies are rendered
     * @param {Object[]} enemies - All enemies with swarm_mind aura
     * @param {number} time - Animation time
     */
    _renderSwarmMindConnections(enemies, time) {
      if (!enemies || enemies.length < 2) return;
      
      const swarmEnemies = enemies.filter(e => e.auras?.includes('swarm_mind'));
      if (swarmEnemies.length < 2) return;
      
      const camera = this.camera;
      const connectionRange = 150; // Max distance for visual connection
      
      // Draw connections between nearby swarm enemies
      for (let i = 0; i < swarmEnemies.length; i++) {
        for (let j = i + 1; j < swarmEnemies.length; j++) {
          const e1 = swarmEnemies[i];
          const e2 = swarmEnemies[j];
          
          const dx = e2.x - e1.x;
          const dy = e2.y - e1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < connectionRange) {
            const alpha = (1 - dist / connectionRange) * 0.3;
            const pulse = Math.sin(time * 4 + i + j) * 0.1 + 0.5;
            
            // Draw pulsing line (using rect as line approximation)
            const angle = Math.atan2(dy, dx);
            const midX = (e1.x + e2.x) / 2;
            const midY = (e1.y + e2.y) / 2;
            
            // Connection points (energy flowing)
            const nodeCount = Math.floor(dist / 30);
            for (let n = 0; n <= nodeCount; n++) {
              const t = n / (nodeCount || 1);
              const nodeX = e1.x + dx * t;
              const nodeY = e1.y + dy * t;
              const nodePhase = (time * 3 + t * 5) % 1;
              const nodeAlpha = alpha * pulse * (0.5 + nodePhase * 0.5);
              
              this.shapeRenderer.circle(nodeX, nodeY, 2 / camera.zoom, 0.6, 0.3, 0.9, nodeAlpha);
            }
          }
        }
      }
      
      // Purple glow around swarm enemies
      for (const enemy of swarmEnemies) {
        const glowPulse = Math.sin(time * 3 + enemy.x * 0.01) * 0.1 + 0.3;
        const renderY = enemy.isFlying ? enemy.y - (enemy.hoverHeight || 15) : enemy.y;
        const size = enemy.size || 10;
        this.shapeRenderer.circleOutline(enemy.x, renderY, size * 1.15, 1.5 / camera.zoom, 0.5, 0.2, 0.8, glowPulse);
      }
    }
    
    /**
     * Get ethereal transparency modifier for enemy body
     * @param {Object} enemy - Enemy to check
     * @returns {number} Alpha multiplier (0.5 for ethereal, 1 for normal)
     */
    _getEtherealAlpha(enemy) {
      // Phasing enemies use their phasingAlpha
      if (enemy.isPhasing && enemy.phasingAlpha !== undefined) {
        return enemy.phasingAlpha;
      }
      
      // Corpse (Undead waiting to resurrect)
      if (enemy.isCorpse) {
        return 0.3;
      }
      
      // Ethereal aura
      if (enemy.auras?.includes('ethereal')) {
        return 0.5;
      }
      
      return 1.0;
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
    
    // ===============================
    // PHASING, UNDEAD, SPLITTER EFFECTS
    // ===============================
    
    /**
     * Render phasing ghost effect
     * Shows enemy becoming translucent/intangible
     */
    _renderPhasingEffect(enemy, x, y, size, time) {
      const camera = this.camera;
      const phasingState = enemy.phasingState || 'solid';
      const phasingAlpha = enemy.phasingAlpha !== undefined ? enemy.phasingAlpha : 1;
      
      // Ghost trail when phasing
      if (phasingState === 'phased' || phasingState === 'phasing_out') {
        // Ghostly afterimages
        for (let i = 1; i <= 3; i++) {
          const trailOffset = i * 8;
          const trailAlpha = (0.3 / i) * (1 - phasingAlpha);
          this.shapeRenderer.circle(
            x - Math.cos(enemy.angle || 0) * trailOffset,
            y - Math.sin(enemy.angle || 0) * trailOffset,
            size * (1 - i * 0.1),
            0.5, 0.8, 1, trailAlpha
          );
        }
      }
      
      // Phase aura - cyan/purple glow
      if (phasingState !== 'solid') {
        const pulsePhase = Math.sin(time * 6) * 0.2;
        const auraRadius = size * (1.2 + pulsePhase);
        const auraAlpha = 0.4 * (1 - phasingAlpha) + 0.1;
        
        // Inner glow
        this.shapeRenderer.circle(x, y, auraRadius, 0.4, 0.7, 1, auraAlpha * 0.3);
        
        // Outline
        this.shapeRenderer.circleOutline(x, y, auraRadius, 2 / camera.zoom, 0.5, 0.8, 1, auraAlpha);
        
        // Phase particles
        const particleCount = 4;
        for (let i = 0; i < particleCount; i++) {
          const angle = time * 2 + (i / particleCount) * Math.PI * 2;
          const dist = size * 1.3;
          const px = x + Math.cos(angle) * dist;
          const py = y + Math.sin(angle) * dist * 0.6;
          const pSize = 2 + Math.sin(time * 4 + i) * 1;
          this.shapeRenderer.circle(px, py, pSize, 0.6, 0.9, 1, auraAlpha * 0.8);
        }
      }
      
      // Phase transition effect
      if (phasingState === 'phasing_in' || phasingState === 'phasing_out') {
        const transitionPulse = Math.abs(Math.sin(time * 8));
        this.shapeRenderer.circleOutline(x, y, size * 1.4, 3 / camera.zoom, 0.6, 0.8, 1, transitionPulse * 0.5);
      }
      
      // Invulnerability indicator when fully phased
      if (phasingState === 'phased') {
        const shimmer = Math.sin(time * 10) * 0.3 + 0.7;
        // "Ghost" text indicator
        this.shapeRenderer.circleOutline(x, y - size - 12, 5, 1.5 / camera.zoom, 0.5, 0.8, 1, shimmer * 0.6);
      }
    }
    
    /**
     * Render undead decay effect
     * Shows necrotic energy and resurrection potential
     */
    _renderUndeadEffect(enemy, x, y, size, time) {
      const camera = this.camera;
      const hasResurrected = enemy.hasResurrected || false;
      const isCorpse = enemy.isCorpse || false;
      
      // Corpse state - waiting to resurrect
      if (isCorpse) {
        const corpseTimer = enemy.corpseTimer || 0;
        const pulseIntensity = Math.sin(time * 4) * 0.3 + 0.7;
        
        // Dark necrotic glow
        this.shapeRenderer.circle(x, y, size * 1.2, 0.2, 0.4, 0.2, 0.4 * pulseIntensity);
        
        // Soul rising effect
        const riseOffset = Math.sin(time * 2) * 3;
        for (let i = 0; i < 3; i++) {
          const soulY = y - size - 5 - i * 4 + riseOffset;
          const soulAlpha = 0.5 - i * 0.15;
          this.shapeRenderer.circle(x, soulY, 3 - i * 0.5, 0.3, 0.8, 0.3, soulAlpha);
        }
        
        // Resurrection progress ring
        if (enemy.corpseTimer !== undefined && enemy.resurrectDelay !== undefined) {
          const progress = 1 - (corpseTimer / enemy.resurrectDelay);
          this.shapeRenderer.circleOutline(x, y, size * 1.4, 3 / camera.zoom, 0.2, 0.9, 0.3, 0.6);
          // Progress arc (simplified as dots)
          const dotCount = Math.floor(progress * 8);
          for (let i = 0; i < dotCount; i++) {
            const angle = -Math.PI/2 + (i / 8) * Math.PI * 2;
            const dx = x + Math.cos(angle) * size * 1.4;
            const dy = y + Math.sin(angle) * size * 1.4;
            this.shapeRenderer.circle(dx, dy, 3, 0.3, 1, 0.4, 0.9);
          }
        }
        
        return; // Don't render normal effects for corpse
      }
      
      // Normal undead appearance
      // Green necrotic aura
      const necroticPulse = Math.sin(time * 3) * 0.1 + 0.2;
      this.shapeRenderer.circle(x, y, size * 1.15, 0.2, 0.5, 0.2, necroticPulse);
      
      // Decay particles
      const particleCount = 3;
      for (let i = 0; i < particleCount; i++) {
        const pTime = time + i * 1.5;
        const pY = y + (pTime % 2) * 10 - 10;
        const pX = x + Math.sin(pTime * 2 + i) * 5;
        const pAlpha = 0.4 * (1 - (pTime % 2) / 2);
        this.shapeRenderer.circle(pX, pY, 2, 0.3, 0.6, 0.2, pAlpha);
      }
      
      // Soul indicator (if can still resurrect)
      if (!hasResurrected) {
        const soulPulse = Math.sin(time * 2) * 0.2 + 0.8;
        const indicatorY = y - size - 10;
        
        // Soul orb
        this.shapeRenderer.circle(x, indicatorY, 4, 0.3, 0.9, 0.4, soulPulse * 0.7);
        this.shapeRenderer.circleOutline(x, indicatorY, 5, 1 / camera.zoom, 0.2, 0.7, 0.3, soulPulse * 0.5);
      } else {
        // Already resurrected - show "final death" marker
        const warnPulse = Math.sin(time * 4) * 0.3 + 0.5;
        this.shapeRenderer.circle(x, y - size - 10, 3, 0.8, 0.3, 0.3, warnPulse);
      }
    }
    
    /**
     * Render splitter division indicator
     * Shows enemy will split on death
     */
    _renderSplitterIndicator(enemy, x, y, size, time) {
      const camera = this.camera;
      
      // Pulsing split warning
      const splitPulse = Math.sin(time * 3) * 0.2 + 0.8;
      
      // Inner division lines
      const divisionAlpha = 0.3 * splitPulse;
      // Vertical line
      this.shapeRenderer.rect(x - 1, y - size * 0.6, 2, size * 1.2, 0.9, 0.6, 0.2, divisionAlpha);
      // Horizontal line
      this.shapeRenderer.rect(x - size * 0.6, y - 1, size * 1.2, 2, 0.9, 0.6, 0.2, divisionAlpha);
      
      // Split ready indicator (orbiting dots that will become children)
      const childCount = enemy.splitChildCount || 2;
      const orbitRadius = size * 1.3;
      for (let i = 0; i < childCount; i++) {
        const angle = time * 1.5 + (i / childCount) * Math.PI * 2;
        const orbX = x + Math.cos(angle) * orbitRadius;
        const orbY = y + Math.sin(angle) * orbitRadius;
        const orbPulse = Math.sin(time * 4 + i * 2) * 0.2 + 0.8;
        
        // Mini version indicator
        this.shapeRenderer.circle(orbX, orbY, 4, 0.9, 0.7, 0.3, orbPulse * 0.6);
        this.shapeRenderer.circleOutline(orbX, orbY, 5, 1 / camera.zoom, 1, 0.8, 0.4, orbPulse * 0.4);
      }
      
      // Outer containment ring
      this.shapeRenderer.circleOutline(x, y, orbitRadius + 3, 1.5 / camera.zoom, 0.9, 0.6, 0.2, 0.3 * splitPulse);
      
      // Warning glow when low HP
      const hpRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1;
      if (hpRatio < 0.3) {
        const urgentPulse = Math.sin(time * 8) * 0.3 + 0.7;
        this.shapeRenderer.circle(x, y, size * 1.5, 0.9, 0.5, 0.2, urgentPulse * 0.2);
        
        // Cracks appearing
        for (let i = 0; i < 4; i++) {
          const crackAngle = (i / 4) * Math.PI * 2;
          const crackLen = size * 0.8 * (1 - hpRatio * 2);
          const cx1 = x;
          const cy1 = y;
          const cx2 = x + Math.cos(crackAngle) * crackLen;
          const cy2 = y + Math.sin(crackAngle) * crackLen;
          // Draw crack as thin rect
          const dx = cx2 - cx1;
          const dy = cy2 - cy1;
          const len = Math.sqrt(dx*dx + dy*dy);
          if (len > 0) {
            this.shapeRenderer.rect(
              (cx1 + cx2) / 2 - 1, 
              (cy1 + cy2) / 2 - len/2, 
              2, len, 
              0.3, 0.2, 0.1, urgentPulse * 0.5
            );
          }
        }
      }
    }
  };
}

module.exports = { EnemyRendererMixin };
