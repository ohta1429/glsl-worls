
/** ===========================================================================
 * ラプラシアンフィルタのカーネルを使うと、波動方程式と呼ばれる波の伝搬のシミュ
 * レーションを行うことができます。
 * フレームバッファを２つ用意し、相互に書き込みと参照を切り替えながら連続して処
 * 理することで、テクスチャを巨大なバッファ（大きな配列ようなイメージ）として使
 * うことができます。
 * ここでは高さ情報をフレームバッファに書き込み続けることで更新し、それを参照し
 * たポストプロセスで画面に波の高さを出力しています。
 * ========================================================================= */

import { WebGLUtility, ShaderProgram } from '../lib/webgl.js';
import { Pane } from '../lib/tweakpane-4.0.0.min.js';

// バッファのサイズに対して適用する除数
const BUFFER_SCALE = 4;

window.addEventListener('DOMContentLoaded', async () => {
  const app = new WebGLApp();
  window.addEventListener('resize', app.resize, false);
  app.init('webgl-canvas');
  await app.load();
  app.setup();
  app.render();
}, false);

class WebGLApp {
  /**
   * @constructor
   */
  constructor() {
    // 汎用的なプロパティ
    this.canvas = null;
    this.gl = null;
    this.running = false;

    // this を固定するためメソッドをバインドする
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);

    // 各種パラメータや uniform 変数用
    this.previousTime = 0;    // 直前のフレームのタイムスタンプ
    this.timeScale = 1.0;     // 時間の進み方に対するスケール
    this.uTime = 0.0;         // uniform 変数 time 用
    this.uMouse = [0.0, 0.0]; // uniform 変数 mouse 用

    this.uPress = false;
    this.uVelocitySpeed = 0.5; // 加速度係数
    this.uVelocityAttenuation = 0.9; // 加速度減衰
    this.uDistanceScale = 50.0; // カーソルとの距離係数
    this.uHeightAttenuation = 0.99; // 高さの減衰

    // tweakpane を初期化
    const pane = new Pane();
    pane.addBlade({
      view: 'slider',
      label: 'velocity-speed',
      min: 0.0,
      max: 0.5,
      value: this.uVelocitySpeed,
    })
    .on('change', (v) => {
      this.uVelocitySpeed = v.value;
    });
    pane.addBlade({
      view: 'slider',
      label: 'velocity-attenuation',
      min: 0.5,
      max: 1.0,
      value: this.uVelocityAttenuation,
    })
    .on('change', (v) => {
      this.uVelocityAttenuation = v.value;
    });
    pane.addBlade({
      view: 'slider',
      label: 'distance-scale',
      min: 1.0,
      max: 100.0,
      value: this.uDistanceScale,
    })
    .on('change', (v) => {
      this.uDistanceScale = v.value;
    });
    pane.addBlade({
      view: 'slider',
      label: 'height-attenuation',
      min: 0.9,
      max: 1.0,
      value: this.uHeightAttenuation,
    })
    .on('change', (v) => {
      this.uHeightAttenuation = v.value;
    });
  }
  /**
   * シェーダやテクスチャ用の画像など非同期で読み込みする処理を行う。
   * @return {Promise}
   */
  async load() {
    // 波紋シミュレーション用のシェーダ
    const mainVs = await WebGLUtility.loadFile('./main.vert');
    const mainFs = await WebGLUtility.loadFile('./main.frag');
    this.mainShaderProgram = new ShaderProgram(this.gl, {
      vertexShaderSource: mainVs,
      fragmentShaderSource: mainFs,
      attribute: [
        'position',
      ],
      stride: [
        3,
      ],
      uniform: [
        'textureUnit',
        'resolution',
        'mouse',
        'press',
        'velocitySpeed',
        'velocityAttenuation',
        'distanceScale',
        'heightAttenuation',
      ],
      type: [
        'uniform1i',
        'uniform2fv',
        'uniform2fv',
        'uniform1i',
        'uniform1f',
        'uniform1f',
        'uniform1f',
        'uniform1f',
      ],
    });

    // ポストプロセス用のシェーダ
    const postVs = await WebGLUtility.loadFile('./post.vert');
    const postFs = await WebGLUtility.loadFile('./post.frag');
    this.postShaderProgram = new ShaderProgram(this.gl, {
      vertexShaderSource: postVs,
      fragmentShaderSource: postFs,
      attribute: [
        'position',
        'texCoord',
      ],
      stride: [
        3,
        2,
      ],
      uniform: [
        'textureUnit1',
        'textureUnit2',
        'resolution',
      ],
      type: [
        'uniform1i',
        'uniform1i',
        'uniform2fv',
      ],
    });

    // 画像を読み込み、テクスチャを生成する
    const source = './sea.jpg';
    this.texture = await WebGLUtility.createTextureFromFile(this.gl, source);
  }
  /**
   * WebGL のレンダリングを開始する前のセットアップを行う。
   */
  setup() {
    const gl = this.gl;
    const speed = 0.5;

    const cursor = document.querySelector('#cursor');
    const prev = {x: 0, y: 0};
    const cPos = {x: 0, y: 0};
    const mouse = {x: 0, y: 0};

    // カーソル座標を更新する準備
    const cursorSetX = gsap.quickSetter(cursor, "x", "px");
    const cursorSetY = gsap.quickSetter(cursor, "y", "px");
    const rotateSet = gsap.quickSetter(cursor, "css");

    // カーソルの移動、ボタンを押した、ボタンを離した、の各種イベントを監視
    window.addEventListener('pointermove', (pointerEvent) => {
      const x = pointerEvent.clientX / window.innerWidth * 2.0 - 1.0;
      const y = pointerEvent.clientY / window.innerHeight * 2.0 - 1.0;
      this.uMouse[0] = x;
      this.uMouse[1] = -y;
      
      mouse.x = pointerEvent.clientX;
      mouse.y = pointerEvent.clientY;
    }, false);
    window.addEventListener('pointerdown', () => {
      this.uPress = true;
    }, false);
    window.addEventListener('pointerup', () => {
      this.uPress = false;
    }, false);

    // カーソルの動きを監視して描画
    gsap.ticker.add(() => {
      const dt = 1.0 - Math.pow(1.0 - speed, gsap.ticker.deltaRatio());

      cPos.x += (mouse.x - cPos.x) * dt;
      cPos.y += (mouse.y - cPos.y) * dt;
      cursorSetX(cPos.x);
      cursorSetY(cPos.y);
      
      // 前回と現在のマウス座標からベクトルを作る
      const v = {x: mouse.x - prev.x, y: mouse.y - prev.y};
      // ベクトルの大きさを求める
      const vLength = Math.sqrt(v.x * v.x + v.y * v.y);

      // ベクトルの大きさがある程度ある時はカーソル画像の向きを動く方向に変える
      if( vLength > 5 ) {
        const r = Math.atan2(v.y, v.x);
        const deg = r * 180 / Math.PI + 90;
        rotateSet({ rotate: deg +'deg' });
      }

      prev.x = mouse.x;
      prev.y = mouse.y;
    });

    this.setupGeometry();
    this.resize();
    this.running = true;
    this.previousTime = Date.now();

    // float texture でフレームバッファを２つ生成しておく（ただし解像度は小さくする）
    this.extensions = WebGLUtility.getWebGLExtensions(this.gl);
    this.bufferWidth = this.canvas.width / BUFFER_SCALE;
    this.bufferHeight = this.canvas.height / BUFFER_SCALE;
    this.bufferIndex = 0;
    this.buffers = [
      WebGLUtility.createFramebufferFloat(this.gl, this.extensions, this.bufferWidth, this.bufferHeight),
      WebGLUtility.createFramebufferFloat(this.gl, this.extensions, this.bufferWidth, this.bufferHeight),
    ];

    gl.clearColor(0.9, 0.6, 0.9, 1.0);
  }
  /**
   * ジオメトリ（頂点情報）を構築するセットアップを行う。
   */
  setupGeometry() {
    // 板（プレーン）の頂点情報
    this.mainPosition = [
      -1.0,  1.0,  0.0,
      1.0,  1.0,  0.0,
      -1.0, -1.0,  0.0,
      1.0, -1.0,  0.0,
    ];

    this.mainIndex = [
      0, 2, 1,
      1, 2, 3,
    ];
    this.mainVbo = [
      WebGLUtility.createVbo(this.gl, this.mainPosition),
    ];
    this.mainIbo = WebGLUtility.createIbo(this.gl, this.mainIndex);


    // 板（プレーン）の頂点情報
    this.postPosition = [
      -1.0,  1.0,  0.0,
       1.0,  1.0,  0.0,
      -1.0, -1.0,  0.0,
       1.0, -1.0,  0.0,
    ];
    // // テクスチャ座標 @@@
    this.texCoord = [
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      1.0, 1.0,
    ];
    
    this.postIndex = [
      0, 2, 1,
      1, 2, 3,
    ];
    this.postVbo = [
      WebGLUtility.createVbo(this.gl, this.postPosition),
      WebGLUtility.createVbo(this.gl, this.texCoord),
    ];
    this.postIbo = WebGLUtility.createIbo(this.gl, this.postIndex);
  }
  /**
   * WebGL を利用して描画を行う。
   */
  render() {
    if (this.running === true) {
      requestAnimationFrame(this.render);
    }
    const now = Date.now();
    const time = (now - this.previousTime) / 1000;
    this.uTime += time * this.timeScale;
    this.previousTime = now;

    // メインシーンとポストプロセスを実行
    this.renderMain();
    this.renderPostProcess();
  }
  /**
   * メインシーンの描画
   * ※波紋のシミュレーションを更新
   */
  renderMain() {
    const gl = this.gl;
    const current = this.buffers[this.bufferIndex];
    const other = this.buffers[1 - this.bufferIndex];
    this.bufferIndex = 1 - this.bufferIndex;

    // フレームバッファのバインドを解除し、テクスチャをバインド
    gl.bindFramebuffer(gl.FRAMEBUFFER, current.framebuffer);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, other.texture);
    gl.viewport(0, 0, this.bufferWidth, this.bufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // メインシーン用のプログラムオブジェクトを指定し、VBO、IBO、uniform 変数を設定
    this.mainShaderProgram.use();
    this.mainShaderProgram.setAttribute(this.mainVbo, this.mainIbo);
    this.mainShaderProgram.setUniform([
      0,
      [this.bufferWidth, this.bufferHeight],
      this.uMouse,
      this.uPress,
      this.uVelocitySpeed,
      this.uVelocityAttenuation,
      this.uDistanceScale,
      this.uHeightAttenuation,
    ]);
    gl.drawElements(gl.TRIANGLES, this.mainIndex.length, gl.UNSIGNED_SHORT, 0);
  }
  /**
   * ポストプロセスでの描画
   */
  renderPostProcess() {
    const gl = this.gl;
    // フレームバッファのバインドを解除し、テクスチャをバインド
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.buffers[1 - this.bufferIndex].texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // ポストプロセス用のプログラムオブジェクトを指定し、VBO、IBO、uniform 変数を設定
    this.postShaderProgram.use();
    this.postShaderProgram.setAttribute(this.postVbo, this.postIbo);
    this.postShaderProgram.setUniform([
      0,
      1,
      [this.bufferWidth, this.bufferHeight],
    ]);
    gl.drawElements(gl.TRIANGLES, this.postIndex.length, gl.UNSIGNED_SHORT, 0);
  }
  /**
   * リサイズ処理を行う。
   */
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // フレームバッファのサイズもウィンドウの大きさに同期させる
    if (this.buffers != null) {
      const gl = this.gl;
      this.bufferWidth = this.canvas.width / BUFFER_SCALE;
      this.bufferHeight = this.canvas.height / BUFFER_SCALE;
      this.bufferIndex = 0;
      this.uPress = false;
      for (let i = 0; i < 2; ++i) {
        gl.bindTexture(gl.TEXTURE_2D, this.buffers[i].texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.FLOAT, null);
      }
    }
  }
  /**
   * WebGL を実行するための初期化処理を行う。
   * @param {HTMLCanvasElement|string} canvas - canvas への参照か canvas の id 属性名のいずれか
   * @param {object} [option={}] - WebGL コンテキストの初期化オプション
   */
  init(canvas, option = {}) {
    if (canvas instanceof HTMLCanvasElement === true) {
      this.canvas = canvas;
    } else if (Object.prototype.toString.call(canvas) === '[object String]') {
      const c = document.querySelector(`#${canvas}`);
      if (c instanceof HTMLCanvasElement === true) {
        this.canvas = c;
      }
    }
    if (this.canvas == null) {
      throw new Error('invalid argument');
    }
    this.gl = this.canvas.getContext('webgl', option);
    if (this.gl == null) {
      throw new Error('webgl not supported');
    }
  }
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}
