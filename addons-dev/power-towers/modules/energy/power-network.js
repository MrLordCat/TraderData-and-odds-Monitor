/**
 * Power Towers TD - Power Network System
 * 
 * Manages energy flow between generators, storage, transfer and consumers.
 * 
 * Connection rules:
 * - All buildings have 1 input / 1 output channel by default
 * - Power Transfer has multiple channels (2/2 default, upgradeable)
 * - Energy flows: Generator → Storage/Transfer → Tower
 */

const { GameEvents } = require('../../core/event-bus');

/**
 * Power Network - manages all power connections and energy flow
 */
class PowerNetwork {
  constructor(eventBus) {
    this.eventBus = eventBus;
    
    // All power nodes (buildings)
    this.nodes = new Map(); // id -> PowerNode
    
    // Connections between nodes
    this.connections = []; // { from: id, to: id, channel: number }
    
    // Network update interval (ticks per second)
    this.tickRate = 10;
    this.tickAccumulator = 0;
  }

  init() {
    this.eventBus.on('power:connect', (data) => this.connect(data.from, data.to));
    this.eventBus.on('power:disconnect', (data) => this.disconnect(data.from, data.to));
    this.eventBus.on('building:placed', (building) => this.onBuildingPlaced(building));
    this.eventBus.on('building:removed', (building) => this.onBuildingRemoved(building));
  }

  /**
   * Register a power node (generator, storage, transfer, consumer)
   */
  registerNode(node) {
    this.nodes.set(node.id, node);
    console.log(`[PowerNetwork] Registered node: ${node.id} (${node.type})`);
  }

  /**
   * Unregister a power node
   */
  unregisterNode(nodeId) {
    // Remove all connections to/from this node
    this.connections = this.connections.filter(
      c => c.from !== nodeId && c.to !== nodeId
    );
    this.nodes.delete(nodeId);
  }

  /**
   * Connect two nodes
   */
  connect(fromId, toId) {
    const from = this.nodes.get(fromId);
    const to = this.nodes.get(toId);
    
    if (!from || !to) {
      console.warn('[PowerNetwork] Cannot connect: node not found');
      return false;
    }

    // Check if already connected
    if (this.connections.some(c => c.from === fromId && c.to === toId)) {
      console.warn('[PowerNetwork] Already connected');
      return false;
    }

    // Check channel availability
    const fromOutputUsed = this.connections.filter(c => c.from === fromId).length;
    const toInputUsed = this.connections.filter(c => c.to === toId).length;

    if (fromOutputUsed >= from.outputChannels) {
      console.warn('[PowerNetwork] No output channels available on source');
      return false;
    }
    if (toInputUsed >= to.inputChannels) {
      console.warn('[PowerNetwork] No input channels available on target');
      return false;
    }

    // Check range
    const dist = this.getDistance(from, to);
    if (dist > from.range) {
      console.warn('[PowerNetwork] Target out of range');
      return false;
    }

    // Create connection
    this.connections.push({
      from: fromId,
      to: toId,
      channel: fromOutputUsed
    });

    console.log(`[PowerNetwork] Connected: ${fromId} → ${toId}`);
    this.eventBus.emit('power:connected', { from: fromId, to: toId });
    return true;
  }

  /**
   * Disconnect two nodes
   */
  disconnect(fromId, toId) {
    const idx = this.connections.findIndex(c => c.from === fromId && c.to === toId);
    if (idx >= 0) {
      this.connections.splice(idx, 1);
      this.eventBus.emit('power:disconnected', { from: fromId, to: toId });
      return true;
    }
    return false;
  }

  /**
   * Get distance between two nodes
   */
  getDistance(nodeA, nodeB) {
    const dx = nodeA.gridX - nodeB.gridX;
    const dy = nodeA.gridY - nodeB.gridY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Update network - process energy flow
   */
  update(deltaTime) {
    this.tickAccumulator += deltaTime;
    const tickInterval = 1 / this.tickRate;
    
    while (this.tickAccumulator >= tickInterval) {
      this.tickAccumulator -= tickInterval;
      this.processTick(tickInterval);
    }
  }

  /**
   * Process one tick of energy flow
   */
  processTick(dt) {
    // 1. Update all generators (produce energy)
    for (const node of this.nodes.values()) {
      if (node.nodeType === 'generator') {
        node.generate(dt);
      }
    }

    // 2. Process energy transfer through connections
    for (const conn of this.connections) {
      const from = this.nodes.get(conn.from);
      const to = this.nodes.get(conn.to);
      
      if (!from || !to) continue;

      // Calculate how much can be transferred
      const available = Math.min(from.getAvailableOutput(dt), from.stored);
      const canReceive = to.getAvailableInput(dt);
      const transfer = Math.min(available, canReceive);

      if (transfer > 0) {
        from.stored -= transfer;
        to.receiveEnergy(transfer);
      }
    }

    // 3. Update storage decay (batteries)
    for (const node of this.nodes.values()) {
      if (node.nodeType === 'storage') {
        node.applyDecay(dt);
      }
    }

    // 4. Emit network state
    this.emitNetworkState();
  }

  /**
   * Emit current network state
   */
  emitNetworkState() {
    const state = {
      nodes: [],
      connections: this.connections.length,
      totalGeneration: 0,
      totalStorage: 0,
      totalCapacity: 0
    };

    for (const node of this.nodes.values()) {
      state.nodes.push(node.getState());
      if (node.nodeType === 'generator') {
        state.totalGeneration += node.generation;
      }
      state.totalStorage += node.stored || 0;
      state.totalCapacity += node.capacity || 0;
    }

    this.eventBus.emit('power:network-state', state);
  }

  /**
   * Get nodes in range of a position
   */
  getNodesInRange(gridX, gridY, range) {
    const result = [];
    for (const node of this.nodes.values()) {
      const dx = node.gridX - gridX;
      const dy = node.gridY - gridY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range) {
        result.push({ node, distance: dist });
      }
    }
    return result.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Get available connections for a node
   */
  getAvailableConnections(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return { inputs: [], outputs: [] };

    const usedOutputs = this.connections.filter(c => c.from === nodeId).length;
    const usedInputs = this.connections.filter(c => c.to === nodeId).length;

    const inputs = [];
    const outputs = [];

    // Find potential input sources
    if (usedInputs < node.inputChannels) {
      for (const other of this.nodes.values()) {
        if (other.id === nodeId) continue;
        const otherUsedOutputs = this.connections.filter(c => c.from === other.id).length;
        if (otherUsedOutputs < other.outputChannels) {
          const dist = this.getDistance(node, other);
          if (dist <= other.range) {
            inputs.push({ node: other, distance: dist });
          }
        }
      }
    }

    // Find potential output targets
    if (usedOutputs < node.outputChannels) {
      for (const other of this.nodes.values()) {
        if (other.id === nodeId) continue;
        const otherUsedInputs = this.connections.filter(c => c.to === other.id).length;
        if (otherUsedInputs < other.inputChannels) {
          const dist = this.getDistance(node, other);
          if (dist <= node.range) {
            outputs.push({ node: other, distance: dist });
          }
        }
      }
    }

    return { inputs, outputs };
  }

  /**
   * On building placed
   */
  onBuildingPlaced(building) {
    // Buildings auto-register themselves
  }

  /**
   * On building removed
   */
  onBuildingRemoved(building) {
    if (building.powerNodeId) {
      this.unregisterNode(building.powerNodeId);
    }
  }

  /**
   * Get render data for visualization
   */
  getRenderData() {
    return {
      nodes: Array.from(this.nodes.values()).map(n => n.getRenderData()),
      connections: this.connections.map(c => {
        const from = this.nodes.get(c.from);
        const to = this.nodes.get(c.to);
        return {
          from: { x: from?.worldX || 0, y: from?.worldY || 0 },
          to: { x: to?.worldX || 0, y: to?.worldY || 0 },
          active: from?.stored > 0
        };
      })
    };
  }

  reset() {
    this.nodes.clear();
    this.connections = [];
  }

  destroy() {
    this.reset();
  }
}

module.exports = { PowerNetwork };
