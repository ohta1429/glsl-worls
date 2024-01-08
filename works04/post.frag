precision mediump float;
uniform sampler2D textureUnit1;
uniform sampler2D textureUnit2;
uniform vec2 resolution;

varying vec2 vTexCoord1;
varying vec2 vTexCoord2;

void main() {
  vec4 samplerColor = texture2D(textureUnit1, vTexCoord1);
  vec2 uv = vTexCoord2 + samplerColor.r * 0.1;

  // テクスチャから色をサンプリング（抽出）する
  vec4 samplerColor2 = texture2D(textureUnit2, uv);
  samplerColor2.rgb *= 1.0;
  
  gl_FragColor = samplerColor2;
}