attribute vec3 position;
attribute vec2 texCoord;

varying vec2 vTexCoord1;
varying vec2 vTexCoord2;

void main() {
  vTexCoord1 = position.xy * 0.5 + 0.5;
  vTexCoord2 = texCoord;
  
  gl_Position = vec4(position, 1.0);
}