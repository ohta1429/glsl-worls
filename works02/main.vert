precision lowp float;

attribute vec3 position;
attribute vec2 texCoord;
attribute float pointSize;
attribute float aIntensity;

uniform float ratio; // 変化の割合い @@@
uniform mat4 mvpMatrix;

varying vec2 vTexCoord;
varying float vProgress;

void main() {
  vTexCoord = texCoord;
  vec3 pos = position;
  const float cameraZ = 3.;

  // ratio が0.5のときにprogressが最大になるように
  float progress = vProgress = 1. - abs(2. * ratio - 1.);

  // texCoord - 0.5 => x: -0.5 ~ 0.5 y -0.5 ~ 0.5
  vec2 xyDirection = (texCoord - 0.5) * 2.0;  // -1 ~ 1
  
  float xyIntensity = 3.;

  pos.z = progress * aIntensity;
  pos.xy += xyDirection * xyIntensity * pos.z / cameraZ;

  float size = pointSize;
  gl_PointSize = clamp(size * pos.z * 5., pointSize, 50.);
  gl_Position = mvpMatrix * vec4(pos, 1.0);
}
