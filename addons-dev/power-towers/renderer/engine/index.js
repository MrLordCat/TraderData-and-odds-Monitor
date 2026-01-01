/**
 * Power Towers TD - WebGL Render Engine
 * 
 * Main export file for the WebGL engine.
 * All subsystems available through this module.
 */

const { GLContext } = require('./core/gl-context');
const { ShaderManager, SHADERS } = require('./core/shader-manager');
const { TextureManager } = require('./core/texture-manager');
const { SpriteBatch } = require('./rendering/sprite-batch');
const { ShapeRenderer } = require('./rendering/shape-renderer');
const { ParticleSystem } = require('./rendering/particle-system');
const { ObjectPool, PoolManager } = require('./systems/object-pool');

module.exports = {
  // Core
  GLContext,
  ShaderManager,
  SHADERS,
  TextureManager,
  
  // Rendering
  SpriteBatch,
  ShapeRenderer,
  ParticleSystem,
  
  // Systems
  ObjectPool,
  PoolManager,
};
