/**
 * Power Towers TD - Effects Renderer
 * 
 * Renders projectiles, visual effects, ground zones,
 * damage numbers, loot numbers and coin particles.
 */

/**
 * Mixin for effects rendering methods
 * @param {Class} Base - Base GameRenderer class
 */
function EffectsRendererMixin(Base) {
  return class extends Base {
    
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
            this._renderExplosionEffect(effect, progress, alpha);
            break;
          
          case 'focus-fire-burst':
            this._renderFocusFireBurst(effect, progress, alpha);
            break;
            
          case 'lightning':
            this._renderLightningEffect(effect, progress, alpha);
            break;
            
          case 'ice':
            this._renderIceEffect(effect, progress, alpha);
            break;
            
          case 'nature':
          case 'poison':
            this._renderNatureEffect(effect, progress, alpha);
            break;
            
          case 'armor-shred':
            this._renderArmorShredEffect(effect, progress, alpha);
            break;
            
          case 'ground-zone-spawn':
            this._renderGroundZoneSpawnEffect(effect, progress, alpha);
            break;
        }
      }
      
      this.shapeRenderer.end();
    }
    
    _renderExplosionEffect(effect, progress, alpha) {
      const expandedRadius = effect.radius * (0.5 + progress * 0.5);
      const color = this._parseColor(effect.color || '#ff6600');
      this.shapeRenderer.circle(effect.x, effect.y, expandedRadius, color.r, color.g * 0.6, 0, alpha * 0.5);
      this.shapeRenderer.circle(effect.x, effect.y, expandedRadius * 0.6, color.r, color.g, 0, alpha * 0.8);
      this.shapeRenderer.circle(effect.x, effect.y, expandedRadius * 0.3, 1, 1, 0.8, alpha);
    }
    
    _renderFocusFireBurst(effect, progress, alpha) {
      const burstSize = effect.size * (0.3 + progress * 0.7);
      const burstColor = this._parseColor(effect.color || '#ffd700');
      // Outer golden ring
      this.shapeRenderer.circle(effect.x, effect.y, burstSize, burstColor.r, burstColor.g, burstColor.b, alpha * 0.3);
      // Inner bright core
      this.shapeRenderer.circle(effect.x, effect.y, burstSize * 0.5, 1, 1, 0.8, alpha * 0.6);
      // Center flash
      this.shapeRenderer.circle(effect.x, effect.y, burstSize * 0.2, 1, 1, 1, alpha);
    }
    
    _renderLightningEffect(effect, progress, alpha) {
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
    }
    
    _renderIceEffect(effect, progress, alpha) {
      const iceRadius = effect.radius || 30;
      this.shapeRenderer.circle(effect.x, effect.y, iceRadius * (1 - progress * 0.3), 0.6, 0.85, 1, alpha * 0.5);
    }
    
    _renderNatureEffect(effect, progress, alpha) {
      const natureRadius = effect.radius || 25;
      this.shapeRenderer.circle(effect.x, effect.y, natureRadius, 0.2, 0.7, 0.3, alpha * 0.4);
    }
    
    _renderArmorShredEffect(effect, progress, alpha) {
      const shredRadius = effect.radius || 30;
      const shredColor = this._parseColor(effect.color || '#ff4444');
      // Red pulse indicating armor break
      this.shapeRenderer.circle(effect.x, effect.y, shredRadius * (0.5 + progress * 0.5), shredColor.r, shredColor.g * 0.3, shredColor.b * 0.3, alpha * 0.4);
    }
    
    _renderGroundZoneSpawnEffect(effect, progress, alpha) {
      const spawnRadius = effect.radius * (progress * 1.2);
      const spawnColor = this._parseColor(effect.color || '#8B4513');
      // Expanding ring effect
      this.shapeRenderer.circle(effect.x, effect.y, spawnRadius, spawnColor.r, spawnColor.g, spawnColor.b, alpha * 0.5);
    }
    
    /**
     * Render ground zones (Siege craters)
     */
    _renderGroundZones(data) {
      if (!data.groundZones || data.groundZones.length === 0) return;
      
      this.shapeRenderer.begin('triangles', this.camera);
      
      for (const zone of data.groundZones) {
        const progress = 1 - (zone.duration / zone.maxDuration);
        const alpha = 0.3 * (1 - progress * 0.5); // Fade as expires
        
        const color = this._parseColor(zone.color || '#8B4513');
        
        // Main crater circle
        this.shapeRenderer.circle(zone.x, zone.y, zone.radius, color.r * 0.6, color.g * 0.5, color.b * 0.3, alpha);
        
        // Inner dark center
        this.shapeRenderer.circle(zone.x, zone.y, zone.radius * 0.5, color.r * 0.3, color.g * 0.2, color.b * 0.1, alpha * 1.5);
        
        // Edge highlight
        this.shapeRenderer.circle(zone.x, zone.y, zone.radius * 0.9, color.r * 0.7, color.g * 0.6, color.b * 0.4, alpha * 0.3);
        
        // Pulsing slow indicator
        const pulsePhase = (this.time * 3) % 1;
        const pulseRadius = zone.radius * (0.3 + pulsePhase * 0.2);
        this.shapeRenderer.circle(zone.x, zone.y, pulseRadius, 0.2, 0.4, 0.6, (1 - pulsePhase) * 0.3);
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

module.exports = { EffectsRendererMixin };
