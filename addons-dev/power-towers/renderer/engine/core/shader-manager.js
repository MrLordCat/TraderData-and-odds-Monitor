/**
 * Power Towers TD - Shader Manager
 * 
 * Compiles, caches, and manages WebGL shaders.
 * Includes built-in shaders for sprites, particles, shapes.
 */

// ============================================
// BUILT-IN SHADERS
// ============================================

const SHADERS = {
  // Sprite batch shader - renders textured quads
  sprite: {
    vertex: `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      attribute vec4 a_color;
      
      uniform mat3 u_projection;
      
      varying vec2 v_texCoord;
      varying vec4 v_color;
      
      void main() {
        vec3 pos = u_projection * vec3(a_position, 1.0);
        gl_Position = vec4(pos.xy, 0.0, 1.0);
        v_texCoord = a_texCoord;
        v_color = a_color;
      }
    `,
    fragment: `
      precision mediump float;
      
      varying vec2 v_texCoord;
      varying vec4 v_color;
      
      uniform sampler2D u_texture;
      
      void main() {
        vec4 texColor = texture2D(u_texture, v_texCoord);
        gl_FragColor = texColor * v_color;
      }
    `
  },
  
  // Color-only shader (no texture) - for shapes
  color: {
    vertex: `
      attribute vec2 a_position;
      attribute vec4 a_color;
      
      uniform mat3 u_projection;
      
      varying vec4 v_color;
      
      void main() {
        vec3 pos = u_projection * vec3(a_position, 1.0);
        gl_Position = vec4(pos.xy, 0.0, 1.0);
        v_color = a_color;
      }
    `,
    fragment: `
      precision mediump float;
      
      varying vec4 v_color;
      
      void main() {
        gl_FragColor = v_color;
      }
    `
  },
  
  // Particle shader with point sprites
  particle: {
    vertex: `
      attribute vec2 a_position;
      attribute vec4 a_color;
      attribute float a_size;
      
      uniform mat3 u_projection;
      uniform float u_pointScale;
      
      varying vec4 v_color;
      
      void main() {
        vec3 pos = u_projection * vec3(a_position, 1.0);
        gl_Position = vec4(pos.xy, 0.0, 1.0);
        gl_PointSize = a_size * u_pointScale;
        v_color = a_color;
      }
    `,
    fragment: `
      precision mediump float;
      
      varying vec4 v_color;
      uniform sampler2D u_texture;
      
      void main() {
        vec4 texColor = texture2D(u_texture, gl_PointCoord);
        gl_FragColor = texColor * v_color;
      }
    `
  },
  
  // Circle shader (SDF-based, sharp edges)
  circle: {
    vertex: `
      attribute vec2 a_position;
      attribute vec2 a_center;
      attribute float a_radius;
      attribute vec4 a_color;
      attribute float a_borderWidth;
      attribute vec4 a_borderColor;
      
      uniform mat3 u_projection;
      
      varying vec2 v_localPos;
      varying float v_radius;
      varying vec4 v_color;
      varying float v_borderWidth;
      varying vec4 v_borderColor;
      
      void main() {
        vec3 pos = u_projection * vec3(a_position, 1.0);
        gl_Position = vec4(pos.xy, 0.0, 1.0);
        v_localPos = a_position - a_center;
        v_radius = a_radius;
        v_color = a_color;
        v_borderWidth = a_borderWidth;
        v_borderColor = a_borderColor;
      }
    `,
    fragment: `
      precision mediump float;
      
      varying vec2 v_localPos;
      varying float v_radius;
      varying vec4 v_color;
      varying float v_borderWidth;
      varying vec4 v_borderColor;
      
      void main() {
        float dist = length(v_localPos);
        float innerRadius = v_radius - v_borderWidth;
        
        // Smooth edges (anti-aliasing)
        float aa = 1.0 / v_radius;
        
        if (dist > v_radius) {
          discard;
        } else if (dist > innerRadius) {
          // Border
          float alpha = 1.0 - smoothstep(v_radius - aa, v_radius, dist);
          gl_FragColor = vec4(v_borderColor.rgb, v_borderColor.a * alpha);
        } else {
          // Fill
          gl_FragColor = v_color;
        }
      }
    `
  },
  
  // Glow effect (post-process)
  glow: {
    vertex: `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `,
    fragment: `
      precision mediump float;
      
      varying vec2 v_texCoord;
      uniform sampler2D u_texture;
      uniform vec2 u_resolution;
      uniform float u_intensity;
      uniform vec3 u_glowColor;
      
      void main() {
        vec4 color = texture2D(u_texture, v_texCoord);
        
        // Simple blur for glow
        vec2 pixel = 1.0 / u_resolution;
        vec4 blur = vec4(0.0);
        
        for (float x = -2.0; x <= 2.0; x += 1.0) {
          for (float y = -2.0; y <= 2.0; y += 1.0) {
            blur += texture2D(u_texture, v_texCoord + vec2(x, y) * pixel);
          }
        }
        blur /= 25.0;
        
        vec3 glow = blur.rgb * u_glowColor * u_intensity;
        gl_FragColor = vec4(color.rgb + glow, color.a);
      }
    `
  }
};


class ShaderManager {
  constructor(glContext) {
    this.glContext = glContext;
    this.gl = glContext.gl;
    
    // Compiled programs cache
    this.programs = new Map();
    
    // Currently active program
    this.activeProgram = null;
    
    // Compile built-in shaders
    this._compileBuiltins();
  }
  
  /**
   * Compile built-in shaders
   */
  _compileBuiltins() {
    for (const [name, source] of Object.entries(SHADERS)) {
      this.compile(name, source.vertex, source.fragment);
    }
    console.log(`[ShaderManager] Compiled ${Object.keys(SHADERS).length} built-in shaders`);
  }
  
  /**
   * Compile shader program
   */
  compile(name, vertexSource, fragmentSource) {
    const gl = this.gl;
    
    // Compile vertex shader
    const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexSource, name);
    if (!vertexShader) return null;
    
    // Compile fragment shader
    const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentSource, name);
    if (!fragmentShader) {
      gl.deleteShader(vertexShader);
      return null;
    }
    
    // Link program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    // Check link status
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(`[ShaderManager] Link error in '${name}':`, gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }
    
    // Cleanup shaders (linked into program)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    
    // Cache attribute and uniform locations
    const programData = {
      program,
      attributes: this._getAttributes(program),
      uniforms: this._getUniforms(program),
    };
    
    this.programs.set(name, programData);
    return programData;
  }
  
  /**
   * Compile individual shader
   */
  _compileShader(type, source, name) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const typeName = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
      console.error(`[ShaderManager] Compile error in '${name}' ${typeName}:`, gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
  
  /**
   * Get all attribute locations
   */
  _getAttributes(program) {
    const gl = this.gl;
    const attributes = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveAttrib(program, i);
      attributes[info.name] = gl.getAttribLocation(program, info.name);
    }
    
    return attributes;
  }
  
  /**
   * Get all uniform locations
   */
  _getUniforms(program) {
    const gl = this.gl;
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      // Handle array uniforms
      const name = info.name.replace('[0]', '');
      uniforms[name] = gl.getUniformLocation(program, info.name);
    }
    
    return uniforms;
  }
  
  /**
   * Use shader program
   */
  use(name) {
    const programData = this.programs.get(name);
    if (!programData) {
      console.error(`[ShaderManager] Shader '${name}' not found`);
      return null;
    }
    
    if (this.activeProgram !== programData) {
      this.gl.useProgram(programData.program);
      this.activeProgram = programData;
      this.glContext.stats.shaderSwitches++;
    }
    
    return programData;
  }
  
  /**
   * Get shader program
   */
  get(name) {
    return this.programs.get(name);
  }
  
  /**
   * Set uniform value
   */
  setUniform(name, type, value) {
    if (!this.activeProgram) return;
    
    const location = this.activeProgram.uniforms[name];
    if (location === undefined) return;
    
    const gl = this.gl;
    
    switch (type) {
      case '1f': gl.uniform1f(location, value); break;
      case '2f': gl.uniform2f(location, value[0], value[1]); break;
      case '3f': gl.uniform3f(location, value[0], value[1], value[2]); break;
      case '4f': gl.uniform4f(location, value[0], value[1], value[2], value[3]); break;
      case '1i': gl.uniform1i(location, value); break;
      case 'mat3': gl.uniformMatrix3fv(location, false, value); break;
      case 'mat4': gl.uniformMatrix4fv(location, false, value); break;
    }
  }
  
  /**
   * Destroy all shaders
   */
  destroy() {
    const gl = this.gl;
    for (const [_, data] of this.programs) {
      gl.deleteProgram(data.program);
    }
    this.programs.clear();
    this.activeProgram = null;
  }
}

module.exports = { ShaderManager, SHADERS };
