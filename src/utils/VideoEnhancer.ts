/**
 * VideoEnhancer - WebGL-based real-time video enhancement
 * 
 * Applies GPU-accelerated sharpening, color vibrancy, and contrast
 * enhancement to video streams for improved perceived quality.
 */

// Vertex shader - simple passthrough
const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

// Fragment shader with sharpening, vibrance, and contrast
const FRAGMENT_SHADER = `
  precision mediump float;
  
  uniform sampler2D u_texture;
  uniform vec2 u_textureSize;
  uniform float u_sharpness;
  uniform float u_vibrance;
  uniform float u_contrast;
  
  varying vec2 v_texCoord;
  
  void main() {
    vec2 texel = 1.0 / u_textureSize;
    
    // Sample center and neighboring pixels for sharpening
    vec4 center = texture2D(u_texture, v_texCoord);
    vec4 top = texture2D(u_texture, v_texCoord + vec2(0.0, -texel.y));
    vec4 bottom = texture2D(u_texture, v_texCoord + vec2(0.0, texel.y));
    vec4 left = texture2D(u_texture, v_texCoord + vec2(-texel.x, 0.0));
    vec4 right = texture2D(u_texture, v_texCoord + vec2(texel.x, 0.0));
    
    // Unsharp mask: enhance = center + sharpness * (center - blur)
    vec4 blur = (top + bottom + left + right) * 0.25;
    vec4 sharpened = center + u_sharpness * (center - blur);
    
    // Vibrance: selective saturation that avoids over-saturating already vivid colors
    float avg = (sharpened.r + sharpened.g + sharpened.b) / 3.0;
    float maxChannel = max(max(sharpened.r, sharpened.g), sharpened.b);
    float saturation = maxChannel - avg;
    float vibranceAmount = u_vibrance * (1.0 - saturation * 2.0);
    vec3 vibrant = mix(vec3(avg), sharpened.rgb, 1.0 + vibranceAmount);
    
    // Contrast adjustment
    vec3 contrasted = (vibrant - 0.5) * (1.0 + u_contrast) + 0.5;
    
    // Clamp to valid range
    gl_FragColor = vec4(clamp(contrasted, 0.0, 1.0), center.a);
  }
`;

interface EnhancementSettings {
    sharpness: number;  // 0.0 - 1.0
    vibrance: number;   // 0.0 - 0.5
    contrast: number;   // 0.0 - 0.3
}

export class VideoEnhancer {
    private gl: WebGLRenderingContext | null = null;
    private program: WebGLProgram | null = null;
    private texture: WebGLTexture | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private animationFrameId: number | null = null;
    private isActive = false;
    private isMobile = false;
    private lastVideoWidth = 0;
    private lastVideoHeight = 0;

    // Adaptive settings based on resolution
    private settings: EnhancementSettings = {
        sharpness: 0.5,
        vibrance: 0.12,
        contrast: 0.08
    };

    constructor() {
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Check if WebGL is supported
     */
    static isSupported(): boolean {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch {
            return false;
        }
    }

    /**
     * Initialize the enhancer with a canvas element
     */
    initialize(canvas: HTMLCanvasElement): boolean {
        this.canvas = canvas;

        const gl = canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            depth: false,
            preserveDrawingBuffer: false,
            powerPreference: this.isMobile ? 'low-power' : 'high-performance'
        }) as WebGLRenderingContext | null;

        if (!gl) {
            console.warn('[VideoEnhancer] WebGL not supported');
            return false;
        }

        this.gl = gl;

        // Compile shaders
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

        if (!vertexShader || !fragmentShader) {
            console.warn('[VideoEnhancer] Failed to compile shaders');
            return false;
        }

        // Create program
        const program = gl.createProgram();
        if (!program) return false;

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.warn('[VideoEnhancer] Failed to link program');
            return false;
        }

        this.program = program;

        // Set up geometry (fullscreen quad)
        const positions = new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1
        ]);
        const texCoords = new Float32Array([
            0, 1, 1, 1, 0, 0,
            0, 0, 1, 1, 1, 0
        ]);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        const positionLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        const texCoordLoc = gl.getAttribLocation(program, 'a_texCoord');
        gl.enableVertexAttribArray(texCoordLoc);
        gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

        // Create texture
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.useProgram(program);

        console.log('[VideoEnhancer] Initialized successfully');
        return true;
    }

    /**
     * Compile a shader
     */
    private compileShader(type: number, source: string): WebGLShader | null {
        if (!this.gl) return null;

        const shader = this.gl.createShader(type);
        if (!shader) return null;

        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.warn('[VideoEnhancer] Shader compile error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    /**
     * Calculate adaptive enhancement strength based on video resolution
     */
    private updateSettingsForResolution(width: number, height: number): void {
        if (width === this.lastVideoWidth && height === this.lastVideoHeight) return;

        this.lastVideoWidth = width;
        this.lastVideoHeight = height;

        const pixels = width * height;

        // Adaptive strength: stronger for low-res, subtler for high-res
        if (pixels < 480 * 360) {
            // Very low res (below 480p)
            this.settings = { sharpness: 0.8, vibrance: 0.15, contrast: 0.10 };
        } else if (pixels < 1280 * 720) {
            // SD to 720p
            this.settings = { sharpness: 0.6, vibrance: 0.12, contrast: 0.08 };
        } else if (pixels < 1920 * 1080) {
            // 720p to 1080p
            this.settings = { sharpness: 0.4, vibrance: 0.10, contrast: 0.06 };
        } else {
            // 1080p and above
            this.settings = { sharpness: 0.25, vibrance: 0.08, contrast: 0.04 };
        }

        console.log(`[VideoEnhancer] Resolution ${width}x${height}, settings:`, this.settings);
    }

    /**
     * Start the enhancement render loop
     */
    start(video: HTMLVideoElement): void {
        if (this.isActive) return;
        this.isActive = true;

        const targetFPS = this.isMobile ? 30 : 60;
        const frameInterval = 1000 / targetFPS;
        let lastFrameTime = 0;

        const render = (timestamp: number) => {
            if (!this.isActive) return;

            // Throttle to target FPS
            if (timestamp - lastFrameTime < frameInterval) {
                this.animationFrameId = requestAnimationFrame(render);
                return;
            }
            lastFrameTime = timestamp;

            this.renderFrame(video);
            this.animationFrameId = requestAnimationFrame(render);
        };

        this.animationFrameId = requestAnimationFrame(render);
        console.log(`[VideoEnhancer] Started at ${targetFPS} FPS`);
    }

    /**
     * Render a single enhanced frame
     */
    private renderFrame(video: HTMLVideoElement): void {
        if (!this.gl || !this.program || !this.texture || !this.canvas) return;
        if (video.readyState < 2) return; // Not enough data

        const gl = this.gl;
        const { videoWidth, videoHeight } = video;

        if (videoWidth === 0 || videoHeight === 0) return;

        // Update canvas size if needed
        if (this.canvas.width !== videoWidth || this.canvas.height !== videoHeight) {
            this.canvas.width = videoWidth;
            this.canvas.height = videoHeight;
            gl.viewport(0, 0, videoWidth, videoHeight);
        }

        // Update adaptive settings
        this.updateSettingsForResolution(videoWidth, videoHeight);

        // Upload video frame to texture
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

        // Set uniforms
        gl.uniform2f(gl.getUniformLocation(this.program, 'u_textureSize'), videoWidth, videoHeight);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_sharpness'), this.settings.sharpness);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_vibrance'), this.settings.vibrance);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_contrast'), this.settings.contrast);

        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /**
     * Stop the enhancement render loop
     */
    stop(): void {
        this.isActive = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        console.log('[VideoEnhancer] Stopped');
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        this.stop();

        if (this.gl && this.texture) {
            this.gl.deleteTexture(this.texture);
        }
        if (this.gl && this.program) {
            this.gl.deleteProgram(this.program);
        }

        this.gl = null;
        this.program = null;
        this.texture = null;
        this.canvas = null;

        console.log('[VideoEnhancer] Destroyed');
    }

    /**
     * Check if enhancer is currently active
     */
    isRunning(): boolean {
        return this.isActive;
    }
}

export default VideoEnhancer;
