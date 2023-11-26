precision lowp float;

uniform sampler2D textureUnit0;
uniform sampler2D textureUnit1;
uniform float ratio; // 変化の割合い @@@

varying vec2 vTexCoord;
varying float vProgress;

void main() {
  if(vProgress > 0.1 && distance(gl_PointCoord, vec2(0.5, 0.5)) > 0.5) {
    discard;
  }

  // テクスチャからそれぞれサンプリング（抽出）する @@@
  vec4 samplerColor0 = texture2D(textureUnit0, vTexCoord);
  vec4 samplerColor1 = texture2D(textureUnit1, vTexCoord);

  // 割合いに応じて色を線形補間する @@@
  vec4 outColor = mix(samplerColor0, samplerColor1, ratio);
  gl_FragColor = outColor;
}