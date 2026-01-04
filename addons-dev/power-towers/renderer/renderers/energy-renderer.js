/**
 * Power Towers TD - Energy Renderer
 * 
 * Renders energy system: nodes, buildings, connections, bars.
 */

const CONFIG = require('../../core/config');

// Pre-allocated building type colors (avoid object creation in hot path)
const BUILDING_TYPE_COLORS = {
  'base-generator': { base: '#2d5a27', accent: '#4CAF50', glow: '#7fff7f' },
  'bio-generator': { base: '#1a4a1a', accent: '#2e7d32', glow: '#81c784' },
  'wind-generator': { base: '#37474f', accent: '#78909c', glow: '#b0bec5' },
  'solar-generator': { base: '#e65100', accent: '#ff9800', glow: '#ffcc02' },
  'water-generator': { base: '#01579b', accent: '#0288d1', glow: '#4fc3f7' },
  'basic-battery': { base: '#1a3a5c', accent: '#2196F3', glow: '#6fc3ff' },
  'power-transfer': { base: '#5c3a1a', accent: '#FF9800', glow: '#ffcc66' }
};

/**
 * Mixin for energy rendering methods
 * @param {Class} Base - Base GameRenderer class
 */
function EnergyRendererMixin(Base) {
  return class extends Base {
    
    /**
     * Render energy source nodes (map pickups)
     */
    _renderEnergyNodes(data) {
      if (!data.energyNodes || data.energyNodes.length === 0) return;
      
      const gridSize = CONFIG.GRID_SIZE;
      
      this.shapeRenderer.begin('triangles', this.camera);
      
      for (const node of data.energyNodes) {
        const x = node.x * gridSize + gridSize / 2;
        const y = node.y * gridSize + gridSize / 2;
        
        // Pulsing glow
        const pulse = 0.5 + 0.5 * Math.sin(this.frameCount * 0.05);
        const glowRadius = gridSize * (0.4 + pulse * 0.2);
        
        // Glow effect (multiple circles with decreasing alpha)
        this.shapeRenderer.circle(x, y, glowRadius, 0.29, 0.56, 0.85, 0.3 * pulse);
        this.shapeRenderer.circle(x, y, glowRadius * 0.6, 0.39, 0.66, 0.95, 0.5 * pulse);
        
        // Core
        this.shapeRenderer.circle(x, y, gridSize * 0.2, 0.6, 0.8, 1, 1);
      }
      
      this.shapeRenderer.end();
    }
    
    /**
     * Render spawn portal
     */
    _renderSpawnPortal(data) {
      if (!data.waypoints || data.waypoints.length === 0) return;
      
      const spawn = data.waypoints[0];
      const gridSize = CONFIG.GRID_SIZE;
      const x = spawn.x;
      const y = spawn.y;
      
      this.shapeRenderer.begin('triangles', this.camera);
      
      // Animated portal effect
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 0.003);
      
      // Outer ring
      this.shapeRenderer.circleOutline(x, y, gridSize * 0.8 + pulse * 5, 3 / this.camera.zoom, 0.9, 0.2, 0.2, 0.6);
      
      // Inner glow
      this.shapeRenderer.circle(x, y, gridSize * 0.5 + pulse * 3, 0.8, 0.1, 0.1, 0.4);
      
      // Core
      this.shapeRenderer.circle(x, y, gridSize * 0.3, 1, 0.3, 0.3, 0.8);
      
      this.shapeRenderer.end();
    }
    
    /**
     * Render player base (destination)
     */
    _renderBase(data) {
      if (!data.waypoints || data.waypoints.length < 2) return;
      
      const base = data.waypoints[data.waypoints.length - 1];
      const gridSize = CONFIG.GRID_SIZE;
      
      this.shapeRenderer.begin('triangles', this.camera);
      
      // Base platform
      this.shapeRenderer.circle(base.x, base.y, gridSize * 0.6, 0.2, 0.5, 0.2, 0.8);
      this.shapeRenderer.circleOutline(base.x, base.y, gridSize * 0.6, 2 / this.camera.zoom, 0.3, 0.7, 0.3, 1);
      
      // Shield effect (pulsing)
      const pulse = 0.5 + 0.5 * Math.sin(this.frameCount * 0.03);
      this.shapeRenderer.circleOutline(base.x, base.y, gridSize * 0.8 + pulse * 3, 2 / this.camera.zoom, 0.3, 0.8, 0.3, 0.3 * pulse);
      
      this.shapeRenderer.end();
    }
    
    /**
     * Render energy network connections
     */
    _renderEnergyConnections(data) {
      if (!data.energyNetwork?.connections) return;
      
      this.shapeRenderer.begin('triangles', this.camera);
      
      for (const conn of data.energyNetwork.connections) {
        const fromX = conn.fromX;
        const fromY = conn.fromY;
        const toX = conn.toX;
        const toY = conn.toY;
        
        if (!fromX || !fromY || !toX || !toY) continue;
        
        // Connection line color based on active state
        const isActive = conn.active;
        const baseColor = isActive 
          ? { r: 0.3, g: 0.9, b: 1.0 }
          : { r: 0.4, g: 0.4, b: 0.5 };
        
        // Animated energy flow pulse
        const pulse = Math.sin(this.time * 0.005) * 0.3 + 0.7;
        const alpha = isActive ? pulse * 0.8 : 0.4;
        
        // Main connection line
        this.shapeRenderer.line(fromX, fromY, toX, toY, 3 / this.camera.zoom, 
          baseColor.r, baseColor.g, baseColor.b, alpha);
        
        // Glow outline
        this.shapeRenderer.line(fromX, fromY, toX, toY, 5 / this.camera.zoom, 
          baseColor.r, baseColor.g, baseColor.b, alpha * 0.3);
        
        // Animated energy particles along the line (if active)
        if (isActive) {
          const dx = toX - fromX;
          const dy = toY - fromY;
          const len = Math.sqrt(dx * dx + dy * dy);
          const particleCount = Math.max(2, Math.floor(len / 40));
          
          for (let i = 0; i < particleCount; i++) {
            const t = ((this.time * 0.002 + i / particleCount) % 1);
            const px = fromX + dx * t;
            const py = fromY + dy * t;
            
            this.shapeRenderer.circle(px, py, 3 / this.camera.zoom, 0.5, 1, 1, 0.9);
          }
        }
        
        // Connection endpoints
        this.shapeRenderer.circle(fromX, fromY, 5 / this.camera.zoom, baseColor.r, baseColor.g, baseColor.b, 0.8);
        this.shapeRenderer.circle(toX, toY, 5 / this.camera.zoom, baseColor.r, baseColor.g, baseColor.b, 0.8);
      }
      
      this.shapeRenderer.end();
    }
    
    /**
     * Render connection range preview for selected building
     */
    _renderConnectionRange(building) {
      const gridSize = CONFIG.GRID_SIZE;
      const rangeInTiles = building.getEffectiveRange?.() || building.range || 4;
      const range = rangeInTiles * gridSize;
      
      const centerX = building.worldX ?? building.x;
      const centerY = building.worldY ?? building.y;
      
      this.shapeRenderer.begin('triangles', this.camera);
      this.shapeRenderer.circle(centerX, centerY, range, 0.3, 0.8, 1, 0.1);
      this.shapeRenderer.circleOutline(centerX, centerY, range, 2 / this.camera.zoom, 0.3, 0.8, 1, 0.5);
      this.shapeRenderer.end();
    }
    
    /**
     * Render energy buildings (generators, batteries, relays)
     */
    _renderEnergyBuildings(data) {
      if (!data.energyBuildings || data.energyBuildings.length === 0) return;
      
      const camera = this.camera;
      const gridSize = CONFIG.GRID_SIZE;
      
      this.shapeRenderer.begin('triangles', camera);
      
      for (const building of data.energyBuildings) {
        const bx = building.worldX ?? building.x;
        const by = building.worldY ?? building.y;
        if (bx === undefined || by === undefined) continue;
        
        const gw = building.gridWidth || 1;
        const gh = building.gridHeight || 1;
        const shape = building.shape || 'rect';
        const buildingType = building.type || 'base-generator';
        const fillPct = building.fillPercent || 0;
        
        const c = BUILDING_TYPE_COLORS[buildingType] || BUILDING_TYPE_COLORS['base-generator'];
        const baseColor = this._parseColor(c.base);
        const accentColor = this._parseColor(c.accent);
        const glowColor = this._parseColor(c.glow);
        
        // Calculate building dimensions
        const w = gw * gridSize;
        const h = gh * gridSize;
        const cx = bx;
        const cy = by;
        
        // Ground shadow
        this.shapeRenderer.rect(cx - w/2 + 3, cy - h/2 + 3, w, h, 0, 0, 0, 0.4);
        
        if (shape === 'L' && gw === 2) {
          this._renderLShapedBuilding(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct);
        } else if (gw === 2 && gh === 2) {
          this._renderLargeBattery(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct);
        } else {
          this._renderEnergyBuildingByType(cx, cy, gridSize, buildingType, baseColor, accentColor, glowColor, fillPct);
        }
        
        // Energy bar under building
        this._renderEnergyBar({
          x: cx,
          y: cy + h / 2 + 4,
          width: Math.max(w * 0.8, 24),
          current: building.stored || building.energy || 0,
          max: building.capacity || building.maxEnergy || 100,
          type: building.nodeType || 'generator',
          showGenIcon: building.nodeType === 'generator' && building.generation > 0
        });
        
        // Pulse glow effect
        const pulse = Math.sin(this.time * 0.004) * 0.3 + 0.5;
        const glowRadius = Math.max(w, h) / 2 + 5;
        this.shapeRenderer.circleOutline(cx, cy, glowRadius, 2 / camera.zoom, 
          glowColor.r, glowColor.g, glowColor.b, pulse * 0.4);
      }
      
      this.shapeRenderer.end();
    }
    
    /**
     * Render L-shaped bio generator
     */
    _renderLShapedBuilding(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct) {
      const s = gridSize;
      
      const cells = [
        { x: cx - s/2, y: cy - s/2 },
        { x: cx - s/2, y: cy + s/2 },
        { x: cx + s/2, y: cy + s/2 }
      ];
      
      // Draw each cell
      for (const cell of cells) {
        this.shapeRenderer.rect(cell.x - s/2 + 1, cell.y - s/2 + 1, s - 2, s - 2, 
          baseColor.r, baseColor.g, baseColor.b, 1);
        this.shapeRenderer.rect(cell.x - s/2 + 3, cell.y - s/2 + 3, s - 6, s - 6,
          baseColor.r * 1.2, baseColor.g * 1.2, baseColor.b * 1.2, 1);
      }
      
      // Main bio tank
      const tankX = cx - s/2;
      const tankY = cy + s/2;
      this.shapeRenderer.circle(tankX, tankY, s * 0.35, accentColor.r * 0.6, accentColor.g * 0.6, accentColor.b * 0.6, 1);
      this.shapeRenderer.circle(tankX, tankY, s * 0.25, accentColor.r, accentColor.g, accentColor.b, 0.9);
      
      // Fill level
      if (fillPct > 0) {
        const fillH = s * 0.35 * fillPct;
        this.shapeRenderer.rect(tankX - s * 0.15, tankY + s * 0.15 - fillH, s * 0.3, fillH,
          glowColor.r, glowColor.g, glowColor.b, 0.8);
      }
      
      // Tree/leaf decorations
      const leafX = cx - s/2;
      const leafY = cy - s/2;
      this.shapeRenderer.circle(leafX - 3, leafY - 2, 5, 0.2, 0.5, 0.2, 1);
      this.shapeRenderer.circle(leafX + 3, leafY - 3, 4, 0.25, 0.55, 0.25, 1);
      this.shapeRenderer.circle(leafX, leafY + 2, 4, 0.3, 0.6, 0.3, 1);
      
      // Processing unit
      const procX = cx + s/2;
      const procY = cy + s/2;
      this.shapeRenderer.rect(procX - s * 0.25, procY - s * 0.25, s * 0.5, s * 0.5,
        accentColor.r * 0.4, accentColor.g * 0.4, accentColor.b * 0.4, 1);
      
      // Spinning gear
      const gearAngle = this.time * 0.003;
      for (let i = 0; i < 4; i++) {
        const a = gearAngle + i * Math.PI / 2;
        const gx = procX + Math.cos(a) * s * 0.15;
        const gy = procY + Math.sin(a) * s * 0.15;
        this.shapeRenderer.rect(gx - 2, gy - 2, 4, 4, accentColor.r * 0.7, accentColor.g * 0.7, accentColor.b * 0.7, 1);
      }
      
      // Connection pipes
      this.shapeRenderer.rect(cx - s/2 - 2, cy, 4, s, accentColor.r * 0.5, accentColor.g * 0.5, accentColor.b * 0.5, 1);
      this.shapeRenderer.rect(cx, cy + s/2 - 2, s, 4, accentColor.r * 0.5, accentColor.g * 0.5, accentColor.b * 0.5, 1);
    }
    
    /**
     * Render large 2x2 battery
     */
    _renderLargeBattery(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct) {
      const s = gridSize;
      const w = s * 2 - 4;
      const h = s * 2 - 4;
      
      // Main housing
      this.shapeRenderer.rect(cx - w/2, cy - h/2, w, h, baseColor.r, baseColor.g, baseColor.b, 1);
      
      // Inner structure - 4 battery cells
      const cellSize = s * 0.7;
      const cellGap = s * 0.15;
      const positions = [
        { x: cx - cellSize/2 - cellGap, y: cy - cellSize/2 - cellGap },
        { x: cx + cellGap, y: cy - cellSize/2 - cellGap },
        { x: cx - cellSize/2 - cellGap, y: cy + cellGap },
        { x: cx + cellGap, y: cy + cellGap }
      ];
      
      for (let i = 0; i < 4; i++) {
        const p = positions[i];
        this.shapeRenderer.rect(p.x, p.y, cellSize, cellSize, 
          baseColor.r * 0.6, baseColor.g * 0.6, baseColor.b * 0.6, 1);
        this.shapeRenderer.rect(p.x + 2, p.y + 2, cellSize - 4, cellSize - 4,
          accentColor.r * 0.3, accentColor.g * 0.3, accentColor.b * 0.3, 1);
        if (fillPct > 0) {
          const fillH = (cellSize - 6) * fillPct;
          this.shapeRenderer.rect(p.x + 3, p.y + cellSize - 3 - fillH, cellSize - 6, fillH,
            accentColor.r, accentColor.g, accentColor.b, 0.9);
        }
      }
      
      // Central connector
      this.shapeRenderer.circle(cx, cy, s * 0.2, accentColor.r * 0.8, accentColor.g * 0.8, accentColor.b * 0.8, 1);
      
      // Lightning bolt icon
      const boltSize = s * 0.15;
      this.shapeRenderer.line(cx, cy - boltSize, cx - boltSize * 0.3, cy, 2, 1, 1, 0.2, 1);
      this.shapeRenderer.line(cx - boltSize * 0.3, cy, cx + boltSize * 0.3, cy, 2, 1, 1, 0.2, 1);
      this.shapeRenderer.line(cx + boltSize * 0.3, cy, cx, cy + boltSize, 2, 1, 1, 0.2, 1);
      
      // Border
      this.shapeRenderer.rectOutline(cx - w/2, cy - h/2, w, h, 2, 0.1, 0.1, 0.1, 0.7);
    }
    
    /**
     * Render energy building by type
     */
    _renderEnergyBuildingByType(cx, cy, gridSize, buildingType, baseColor, accentColor, glowColor, fillPct) {
      switch (buildingType) {
        case 'solar-generator':
          this._renderSolarPanel(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct);
          break;
        case 'wind-generator':
          this._renderWindTurbine(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct);
          break;
        case 'water-generator':
          this._renderHydroGenerator(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct);
          break;
        case 'power-transfer':
          this._renderPowerRelay(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct);
          break;
        case 'basic-battery':
          this._renderSmallBattery(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct);
          break;
        case 'base-generator':
        default:
          this._renderBaseGenerator(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct);
          break;
      }
    }
    
    /**
     * Base Generator - Industrial turbine
     */
    _renderBaseGenerator(cx, cy, s, baseColor, accentColor, glowColor, fillPct) {
      const size = s * 0.8;
      
      this.shapeRenderer.circle(cx, cy, size * 0.85, baseColor.r * 0.4, baseColor.g * 0.4, baseColor.b * 0.4, 1);
      this.shapeRenderer.circle(cx, cy, size * 0.7, baseColor.r, baseColor.g, baseColor.b, 1);
      this.shapeRenderer.circle(cx, cy, size * 0.55, baseColor.r * 0.8, baseColor.g * 0.8, baseColor.b * 0.8, 1);
      
      // Rotating turbine
      const gearAngle = this.time * 0.003;
      for (let i = 0; i < 6; i++) {
        const a = gearAngle + (i * Math.PI / 3);
        const gx = cx + Math.cos(a) * size * 0.35;
        const gy = cy + Math.sin(a) * size * 0.35;
        this.shapeRenderer.rect(gx - 3, gy - 3, 6, 6, accentColor.r, accentColor.g, accentColor.b, 1);
      }
      
      // Center core
      this.shapeRenderer.circle(cx, cy, size * 0.2, accentColor.r, accentColor.g, accentColor.b, 1);
      const spark = Math.sin(this.time * 0.008) * 0.5 + 0.5;
      this.shapeRenderer.circle(cx, cy, size * 0.12, glowColor.r, glowColor.g, glowColor.b, spark);
    }
    
    /**
     * Solar Panel
     */
    _renderSolarPanel(cx, cy, s, baseColor, accentColor, glowColor, fillPct) {
      const size = s * 0.85;
      
      // Support stand
      this.shapeRenderer.rect(cx - 3, cy + size * 0.2, 6, size * 0.4, 0.2, 0.2, 0.2, 1);
      
      // Panel frame
      this.shapeRenderer.rect(cx - size * 0.5, cy - size * 0.4, size, size * 0.6, 0.15, 0.15, 0.15, 1);
      
      // Solar cells
      const panelW = size * 0.9;
      const panelH = size * 0.5;
      this.shapeRenderer.rect(cx - panelW/2, cy - size * 0.35, panelW, panelH, 
        baseColor.r * 0.5, baseColor.g * 0.5, baseColor.b * 0.5, 1);
      
      // Grid lines
      for (let i = 1; i < 4; i++) {
        const y = cy - size * 0.35 + (panelH / 4) * i;
        this.shapeRenderer.rect(cx - panelW/2, y - 1, panelW, 2, 0.1, 0.1, 0.1, 0.8);
      }
      for (let i = 1; i < 4; i++) {
        const x = cx - panelW/2 + (panelW / 4) * i;
        this.shapeRenderer.rect(x - 1, cy - size * 0.35, 2, panelH, 0.1, 0.1, 0.1, 0.8);
      }
      
      // Sun reflection
      const pulse = Math.sin(this.time * 0.003) * 0.3 + 0.7;
      this.shapeRenderer.rect(cx - panelW * 0.2, cy - size * 0.3, panelW * 0.15, panelH * 0.3, 
        glowColor.r, glowColor.g, glowColor.b, pulse * 0.4);
      
      // Status LED
      this.shapeRenderer.circle(cx + size * 0.35, cy + size * 0.25, 3, glowColor.r, glowColor.g, glowColor.b, pulse);
    }
    
    /**
     * Wind Turbine
     */
    _renderWindTurbine(cx, cy, s, baseColor, accentColor, glowColor, fillPct) {
      const size = s * 0.8;
      
      // Base
      this.shapeRenderer.circle(cx, cy + size * 0.3, size * 0.35, baseColor.r * 0.5, baseColor.g * 0.5, baseColor.b * 0.5, 1);
      
      // Tower
      this.shapeRenderer.rect(cx - 4, cy - size * 0.1, 8, size * 0.6, 0.4, 0.4, 0.45, 1);
      this.shapeRenderer.rect(cx - 3, cy - size * 0.1, 6, size * 0.6, 0.5, 0.5, 0.55, 1);
      
      // Nacelle
      this.shapeRenderer.circle(cx, cy - size * 0.25, size * 0.22, baseColor.r, baseColor.g, baseColor.b, 1);
      this.shapeRenderer.circle(cx, cy - size * 0.25, size * 0.15, accentColor.r, accentColor.g, accentColor.b, 1);
      
      // Rotating blades
      const bladeAngle = this.time * 0.005;
      const bladeLength = size * 0.75;
      const hubY = cy - size * 0.25;
      
      for (let i = 0; i < 3; i++) {
        const a = bladeAngle + (i * Math.PI * 2 / 3);
        const bx = cx + Math.cos(a) * bladeLength;
        const by = hubY + Math.sin(a) * bladeLength;
        
        this.shapeRenderer.line(cx, hubY, bx, by, 7, 0.85, 0.85, 0.9, 1);
        this.shapeRenderer.line(cx, hubY, bx, by, 4, 0.95, 0.95, 1, 1);
        this.shapeRenderer.circle(bx, by, 2, 1, 1, 1, 0.7);
      }
      
      // Center hub
      this.shapeRenderer.circle(cx, hubY, size * 0.1, 0.25, 0.25, 0.3, 1);
      this.shapeRenderer.circle(cx, hubY, size * 0.06, 0.4, 0.4, 0.45, 1);
    }
    
    /**
     * Hydro Generator
     */
    _renderHydroGenerator(cx, cy, s, baseColor, accentColor, glowColor, fillPct) {
      const size = s * 0.8;
      
      // Water base
      const waveOffset = Math.sin(this.time * 0.004) * 3;
      this.shapeRenderer.rect(cx - size * 0.5, cy + size * 0.1, size, size * 0.3, 
        accentColor.r * 0.3, accentColor.g * 0.5, accentColor.b * 0.8, 0.7);
      
      // Building frame
      this.shapeRenderer.rect(cx - size * 0.4, cy - size * 0.35, size * 0.8, size * 0.5, 
        baseColor.r, baseColor.g, baseColor.b, 1);
      
      // Water wheel
      const wheelAngle = this.time * 0.003;
      const wheelR = size * 0.3;
      this.shapeRenderer.circle(cx, cy, wheelR, baseColor.r * 0.6, baseColor.g * 0.6, baseColor.b * 0.6, 1);
      
      // Wheel spokes
      for (let i = 0; i < 8; i++) {
        const a = wheelAngle + (i * Math.PI / 4);
        const sx = cx + Math.cos(a) * wheelR * 0.9;
        const sy = cy + Math.sin(a) * wheelR * 0.9;
        this.shapeRenderer.line(cx, cy, sx, sy, 3, accentColor.r, accentColor.g, accentColor.b, 1);
      }
      
      // Center hub
      this.shapeRenderer.circle(cx, cy, size * 0.1, accentColor.r, accentColor.g, accentColor.b, 1);
      
      // Water droplets
      const dropY = cy + size * 0.2 + waveOffset;
      this.shapeRenderer.circle(cx - size * 0.25, dropY, 4, glowColor.r, glowColor.g, glowColor.b, 0.6);
      this.shapeRenderer.circle(cx + size * 0.2, dropY - 2, 3, glowColor.r, glowColor.g, glowColor.b, 0.5);
    }
    
    /**
     * Power Relay
     */
    _renderPowerRelay(cx, cy, s, baseColor, accentColor, glowColor, fillPct) {
      const size = s * 0.8;
      
      // Base
      this.shapeRenderer.circle(cx, cy + size * 0.2, size * 0.4, baseColor.r * 0.5, baseColor.g * 0.5, baseColor.b * 0.5, 1);
      
      // Column
      this.shapeRenderer.rect(cx - 5, cy - size * 0.2, 10, size * 0.5, baseColor.r, baseColor.g, baseColor.b, 1);
      
      // Antenna dish
      const dishY = cy - size * 0.35;
      this.shapeRenderer.circle(cx, dishY, size * 0.25, accentColor.r * 0.7, accentColor.g * 0.7, accentColor.b * 0.7, 1);
      this.shapeRenderer.circle(cx, dishY, size * 0.18, accentColor.r, accentColor.g, accentColor.b, 1);
      
      // Antenna spike
      this.shapeRenderer.line(cx, dishY, cx, dishY - size * 0.25, 3, accentColor.r, accentColor.g, accentColor.b, 1);
      
      // Signal rings
      const pulse = Math.sin(this.time * 0.006) * 0.5 + 0.5;
      this.shapeRenderer.circleOutline(cx, dishY, size * 0.35 + pulse * 5, 2, glowColor.r, glowColor.g, glowColor.b, pulse * 0.5);
      this.shapeRenderer.circleOutline(cx, dishY, size * 0.45 + pulse * 8, 2, glowColor.r, glowColor.g, glowColor.b, pulse * 0.3);
    }
    
    /**
     * Small Battery
     */
    _renderSmallBattery(cx, cy, s, baseColor, accentColor, glowColor, fillPct) {
      const size = s * 0.8;
      
      // Shadow
      this.shapeRenderer.rect(cx - size * 0.4 + 2, cy - size * 0.35 + 2, size * 0.8, size * 0.7, 0, 0, 0, 0.3);
      
      // Body
      this.shapeRenderer.rect(cx - size * 0.4, cy - size * 0.35, size * 0.8, size * 0.7, baseColor.r, baseColor.g, baseColor.b, 1);
      
      // Terminal
      this.shapeRenderer.rect(cx - size * 0.15, cy - size * 0.45, size * 0.3, size * 0.12, 
        baseColor.r * 0.8, baseColor.g * 0.8, baseColor.b * 0.8, 1);
      
      // Inner chamber
      this.shapeRenderer.rect(cx - size * 0.3, cy - size * 0.25, size * 0.6, size * 0.5, 
        accentColor.r * 0.2, accentColor.g * 0.2, accentColor.b * 0.2, 1);
      
      // Energy fill
      if (fillPct > 0) {
        const fillH = size * 0.45 * fillPct;
        this.shapeRenderer.rect(cx - size * 0.25, cy + size * 0.2 - fillH, size * 0.5, fillH,
          accentColor.r, accentColor.g, accentColor.b, 0.9);
      }
      
      // Charge indicator lights
      const litCount = Math.floor(fillPct * 4);
      for (let i = 0; i < 4; i++) {
        const lx = cx - size * 0.25 + (size * 0.5 / 3) * i;
        const isLit = i < litCount;
        this.shapeRenderer.circle(lx, cy + size * 0.28, 3, 
          isLit ? glowColor.r : 0.2, isLit ? glowColor.g : 0.2, isLit ? glowColor.b : 0.2, isLit ? 1 : 0.5);
      }
    }
    
    /**
     * Unified energy bar renderer
     */
    _renderEnergyBar(opts) {
      const { x, y, width, current, max, type, showGenIcon, showEmptyWarning } = opts;
      const camera = this.camera;
      const fillPct = max > 0 ? Math.min(1, current / max) : 0;
      
      const barHeight = 5;
      const barX = x - width / 2;
      const barY = y;
      
      // Background
      this.shapeRenderer.rect(barX - 1, barY - 1, width + 2, barHeight + 2, 0, 0, 0, 0.7);
      this.shapeRenderer.rect(barX, barY, width, barHeight, 0.15, 0.15, 0.2, 1);
      
      if (fillPct > 0) {
        let fillColor;
        let pulseCondition;
        
        switch (type) {
          case 'generator':
            fillColor = { r: 0.3, g: 0.9, b: 0.4 };
            pulseCondition = fillPct >= 0.9;
            break;
          case 'storage':
            fillColor = { r: 0.3, g: 0.7, b: 1.0 };
            pulseCondition = fillPct >= 0.9;
            break;
          case 'relay':
            fillColor = { r: 1.0, g: 0.7, b: 0.3 };
            pulseCondition = false;
            break;
          case 'consumer':
          default:
            if (fillPct < 0.25) {
              fillColor = { r: 1.0, g: 0.2, b: 0.2 };
              pulseCondition = true;
            } else if (fillPct < 0.5) {
              fillColor = { r: 1.0, g: 0.6, b: 0.2 };
              pulseCondition = false;
            } else {
              fillColor = { r: 0.2, g: 0.8, b: 1.0 };
              pulseCondition = false;
            }
            break;
        }
        
        const pulse = pulseCondition ? Math.sin(this.time * 0.01) * 0.25 + 0.75 : 1;
        
        this.shapeRenderer.rect(barX, barY, width * fillPct, barHeight, 
          fillColor.r * pulse, fillColor.g * pulse, fillColor.b * pulse, 1);
        
        if (type !== 'consumer' && fillPct >= 0.5) {
          this.shapeRenderer.rect(barX, barY, width * fillPct, barHeight, 
            fillColor.r, fillColor.g, fillColor.b, 0.25);
        }
      }
      
      // Border
      this.shapeRenderer.rectOutline(barX, barY, width, barHeight, 1 / camera.zoom, 0.3, 0.3, 0.3, 0.8);
      
      // Generation indicator
      if (showGenIcon) {
        const iconX = barX + width + 4;
        const iconY = barY + barHeight / 2;
        this.shapeRenderer.rect(iconX - 1, iconY - 3, 2, 6, 0.5, 1, 0.5, 1);
        this.shapeRenderer.rect(iconX - 3, iconY - 1, 6, 2, 0.5, 1, 0.5, 1);
      }
      
      // Empty warning
      if (showEmptyWarning && fillPct === 0) {
        const blink = Math.sin(this.time * 0.02) > 0;
        if (blink) {
          this.shapeRenderer.rect(x - 2, barY - 8, 4, 6, 1, 0.3, 0.3, 1);
          this.shapeRenderer.rect(x - 1.5, barY - 1, 3, 2, 1, 0.3, 0.3, 1);
        }
      }
    }
  };
}

module.exports = { EnergyRendererMixin };
