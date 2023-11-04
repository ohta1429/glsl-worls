
attribute vec3 position;
attribute vec4 color;
attribute float size;

uniform float pointScale;
uniform float time;

varying vec4 vColor;

void main() {
  vec3 pos = position;
  pos.x += sin( pos.x + time ) * 0.5;

  vec4 c = color;
  c.x += sin( pos.x + time ) * 0.5;
  vColor = c;

  gl_Position = vec4(pos, 1.0);

  gl_PointSize = size * pointScale;
}

