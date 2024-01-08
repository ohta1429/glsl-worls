precision mediump float;

uniform sampler2D textureUnit;
uniform vec2 resolution;
uniform vec2 mouse;
uniform bool press;
uniform float velocitySpeed; // 加速度係数
uniform float velocityAttenuation; // 加速度減衰
uniform float distanceScale; // カーソルとの距離係数
uniform float heightAttenuation; // 高さの減衰

varying vec2 vTexCoord;

void main() {
  // 中心が原点の座標系（マウスカーソルとの距離計測用）
  vec2 texCoord = vTexCoord * 2.0 - 1.0;

  // カーソルとの距離が近い場所に高さを追加するための値を算出
  float mouseDistance = max(1.0 - length(texCoord - mouse) * distanceScale, 0.0);

  // ラプラシアンフィルタで加速度を求める
  vec2 fragment = 1.0 / resolution;
  vec4 current = texture2D(textureUnit, vTexCoord);
  vec4 top     = texture2D(textureUnit, vTexCoord + vec2(0.0, 1.0) * fragment);
  vec4 bottom  = texture2D(textureUnit, vTexCoord - vec2(0.0, 1.0) * fragment);
  vec4 left    = texture2D(textureUnit, vTexCoord - vec2(1.0, 0.0) * fragment);
  vec4 right   = texture2D(textureUnit, vTexCoord + vec2(1.0, 0.0) * fragment);
  float accel = -current.r * 4.0 + top.r + bottom.r + left.r + right.r;

  // 高さが伝播する速度（加速度）を補正
  accel *= velocitySpeed;

  // 現在の速度（velocity）に加速度（accel）を足す
  float velocity = current.y + accel;

  // 求めた速度に減衰を掛ける
  velocity *= velocityAttenuation;

  // 現在の高さ（height）に速度を加算
  float height = current.x + velocity;

  // カーソル付近に高さを足すことで波紋が出るようにする
  // if (press) {
  //   height += mouseDistance;
  // }

  // マウスの動きで波紋エフェクトを付ける
  height += mouseDistance;

  // 飽和しないように高さにも減衰を掛ける
  height *= heightAttenuation;

  // R に高さ、G に速度を出力する
  gl_FragColor = vec4(height, velocity, 0.0, 1.0);
}