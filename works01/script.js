
/** ===========================================================================
 * インタラクティブな実装例として、マウスカーソルの位置を uniform 変数でシェーダ
 * に送り、カーソルの位置に応じて各頂点の振る舞いが変化するようにしてみましょう。
 * シェーダ側（GPU の世界）は、縦も横も -1.0 ~ 1.0 の広さの空間になっています。
 * そこをぴったりと埋め尽くすように格子状に頂点が配置されるよう JavaScript 側で
 * 頂点の座標を設定しています。
 * また、そのような -1.0 ~ 1.0 の広さの空間で扱いやすいように、マウスカーソルの
 * 座標もあらかじめ同じスケール（-1.0 ~ 1.0）に正規化してから、uniform 変数とし
 * てシェーダに送っていることに注意しましょう。
 * 座標系の話は不慣れなうちは非常に紛らわしいのですが、大事なポイントとしては、
 * 「座標を扱う場合は必ず座標系を揃えてから処理する」ということを意識します。た
 * とえば「メートル法の座標」と「緯度経度」は直接比較したり加減算することはでき
 * ないため、必ずどちらかをもう一方の座標に変換してから計算します。これと同じで
 * 座標系が異なる状態では計算を行うことはできない、ということです。
 * ========================================================================= */

import { WebGLUtility, ShaderProgram } from '../lib/webgl.js';
import { Pane } from '../lib/tweakpane-4.0.0.min.js';

window.addEventListener('DOMContentLoaded', async () => {
  // WebGLApp クラスの初期化とリサイズ処理の設定
  const app = new WebGLApp();
  window.addEventListener('resize', app.resize, false);
  // アプリケーションのロードと初期化
  app.init('webgl-canvas');
  await app.load();
  // セットアップして描画を開始
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
    this.startTime = Date.now();

    // this を固定するためメソッドをバインドする
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);

    // uniform 変数用
    this.uPointSize = 1.0;
    this.uMouse = [0.0, 0.0]; // マウス座標用 @@@
    this.uRposition = [0.0, 0.0]; // 

    // tweakpane を初期化
    const pane = new Pane();
    pane.addBlade({
      view: 'slider',
      label: 'point-size',
      min: 0.0,
      max: 10.0,
      value: this.uPointSize,
    })
    .on('change', (v) => {
      this.uPointSize = v.value;
    });

    // マウス座標用のイベントを設定 @@@
    window.addEventListener('pointermove', (mouseEvent) => {
      const x = mouseEvent.pageX / window.innerWidth;
      const y = mouseEvent.pageY / window.innerHeight;
      const signedX = x * 2.0 - 1.0;
      const signedY = y * 2.0 - 1.0;

      this.uMouse[0] = signedX;
      this.uMouse[1] = -signedY; // スクリーン空間とは正負が逆
    }, false);
  }
  /**
   * シェーダやテクスチャ用の画像など非同期で読み込みする処理を行う。
   * @return {Promise}
   */
  async load() {
    const vs = await WebGLUtility.loadFile('./main.vert');
    const fs = await WebGLUtility.loadFile('./main.frag');
    this.shaderProgram = new ShaderProgram(this.gl, {
      vertexShaderSource: vs,
      fragmentShaderSource: fs,
      attribute: [
        'position',
        'color',
        'size',
      ],
      stride: [
        3,
        4,
        1,
      ],
      uniform: [
        'pointScale',
        'time', // 
      ],
      type: [
        'uniform1f',
        'uniform1f', // GLSL 側で vec2 なので 2fv を使う @@@
      ],
    });
  }
  /**
   * WebGL のレンダリングを開始する前のセットアップを行う。
   */
  setup() {
    this.setupGeometry();
    this.resize();
    this.gl.clearColor(0.1, 0.1, 0.1, 1.0);
    this.running = true;
  }
  /**
   * ジオメトリ（頂点情報）を構築するセットアップを行う。
   */
  setupGeometry() {
    this.position = [];
    this.color = [];
    this.pointSize = [];

    // 頂点を格子状に並べ、座標に応じた色を付け、大きさは揃える @@@
    const COUNT = 50;
    for (let i = 0; i < COUNT; ++i) {
      const x = i / (COUNT - 1);
      const signedX = x * 2.0 - 1.0;
      for (let j = 0; j < COUNT; ++j) {
        const y = j / (COUNT - 1);
        const signedY = y * 2.0 - 1.0;

        this.position.push(signedX, signedY, 0.0);
        this.color.push(x, y, 0.5, 1.0);
        this.pointSize.push(8.0);
      }
    }

    this.vbo = [
      WebGLUtility.createVbo(this.gl, this.position),
      WebGLUtility.createVbo(this.gl, this.color),
      WebGLUtility.createVbo(this.gl, this.pointSize),
    ];
  }
  /**
   * WebGL を利用して描画を行う。
   */
  render() {
    const gl = this.gl;

    // running が true の場合は requestAnimationFrame を呼び出す
    if (this.running === true) {
      requestAnimationFrame(this.render);
    }

    // ビューポートの設定と背景のクリア
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.uTime = (Date.now() - this.startTime) / 1000;
    console.log(this.uTime);


    // プログラムオブジェクトを指定し、VBO と uniform 変数を設定
    this.shaderProgram.use();
    this.shaderProgram.setAttribute(this.vbo);
    this.shaderProgram.setUniform([
      this.uPointSize,
      this.uTime,
    ]);

    // 設定済みの情報を使って、頂点を画面にレンダリングする
    gl.drawArrays(gl.POINTS, 0, this.position.length / 3);
  }
  /**
   * リサイズ処理を行う。
   */
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
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

