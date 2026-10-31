"use strict";
// Nucleo holografico em WebGL. O ponteiro afasta e gira as particulas como um campo de forca.
(() => {
  const canvas = document.getElementById("esfera");
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
  if (!gl) return;
  const ESCALA = 0.8;

  const VERTICE = `
    attribute vec3 aPosicao;
    attribute vec3 aDados; // brilho, semente, tamanho
    attribute float aFaixa; // casca a que o traco pertence, igual nas duas pontas
    uniform float uTempo, uForca, uOnda, uAspecto, uEscala;
    uniform vec2 uPonteiro, uInclinacao;
    varying float vBrilho;

    mat3 giroY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
    mat3 giroX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }

    void main() {
      float semente = aDados.y;
      // cada casca gira em ritmo proprio
      float sentido = mod(aFaixa, 2.0) < 1.0 ? 1.0 : -1.0;
      float giro = uTempo * (0.05 + 0.012 * (5.0 - aFaixa)) * sentido;
      vec3 p = giroX(uInclinacao.y) * giroY(giro + uInclinacao.x) * aPosicao;

      // respiracao organica
      p *= 1.0 + 0.012 * sin(uTempo * 0.9 + aFaixa * 1.7);

      // perspectiva
      float z = 1.0 / (2.6 - p.z);
      vec2 tela = p.xy * z * 2.6;

      // campo de forca do ponteiro
      vec2 d = tela - uPonteiro;
      float dist = length(d) + 0.0001;
      float campo = exp(-dist * dist / 0.1) * uForca;
      vec2 radial = d / dist;
      vec2 tangente = vec2(-radial.y, radial.x);
      float forca = 0.34 * (0.5 + semente);
      tela += radial * campo * forca;
      tela += tangente * campo * forca * 0.8 * sin(uTempo * 1.6 + semente * 12.0);

      // onda de choque do clique
      float frente = abs(length(tela) - uOnda * 1.3);
      float choque = exp(-frente * frente / 0.012) * (1.0 - uOnda) * step(0.001, uOnda);
      tela *= 1.0 + choque * 0.16;

      gl_Position = vec4(tela * uEscala / vec2(uAspecto, 1.0), -p.z * 0.2, 1.0);
      float cintila = 0.72 + 0.28 * sin(uTempo * (1.0 + semente * 3.0) + semente * 40.0);
      vBrilho = aDados.x * cintila * (0.35 + 0.65 * smoothstep(-1.1, 0.7, p.z)) + campo * 0.8 + choque * 1.2;
      gl_PointSize = aDados.z * (0.75 + z * 1.2) * (1.0 + campo * 1.4);
    }`;

  const FRAGMENTO = `
    precision mediump float;
    uniform vec3 uCor, uQuente;
    uniform float uPonto;
    varying float vBrilho;

    void main() {
      float a = 1.0;
      if (uPonto > 0.5) {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        a = smoothstep(1.0, 0.0, d);
        a *= a;
      }
      vec3 cor = mix(uCor, uQuente, clamp(vBrilho - 0.45, 0.0, 1.0));
      float luz = a * min(vBrilho * 1.5, 1.6);
      gl_FragColor = vec4(cor * luz, luz);
    }`;

  function compilar(tipo, fonte) {
    const shader = gl.createShader(tipo);
    gl.shaderSource(shader, fonte);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  const programa = gl.createProgram();
  gl.attachShader(programa, compilar(gl.VERTEX_SHADER, VERTICE));
  gl.attachShader(programa, compilar(gl.FRAGMENT_SHADER, FRAGMENTO));
  gl.linkProgram(programa);
  gl.useProgram(programa);

  const sorteio = (minimo, maximo) => minimo + Math.random() * (maximo - minimo);

  function naEsfera(teta, fi, raio) {
    const r = Math.cos(fi) * raio;
    return [r * Math.cos(teta), Math.sin(fi) * raio, r * Math.sin(teta)];
  }

  // mancha de densidade: gera as regioes densas e os vazios da casca
  function densidade(teta, fi) {
    return Math.sin(teta * 3 + 1.3) * Math.cos(fi * 4 - 0.6) + Math.sin(teta * 7 + fi * 5) * 0.5 + Math.cos(fi * 11 + teta * 2) * 0.28;
  }

  const linhas = [];
  const pontos = [];
  const faixaDe = (p) => Math.floor(Math.hypot(...p) * 5);
  const linha = (a, b, brilho, semente) => {
    const faixa = faixaDe(a);
    linhas.push(...a, brilho, semente, 1, faixa, ...b, brilho, semente, 1, faixa);
  };
  const ponto = (p, brilho, tamanho) => pontos.push(...p, brilho, Math.random(), tamanho, faixaDe(p));

  // casca externa: tracos radiais e fragmentos de circuito
  for (let i = 0; i < 9000; i++) {
    const teta = sorteio(0, Math.PI * 2);
    const fi = Math.asin(sorteio(-1, 1));
    if (densidade(teta, fi) < -0.3) continue;
    const raio = sorteio(0.84, 1.03);
    const semente = Math.random();
    const brilho = sorteio(0.45, 1.1);
    if (i % 3 === 0) {
      linha(naEsfera(teta, fi, raio), naEsfera(teta, fi, raio + sorteio(0.03, 0.13)), brilho, semente);
    } else if (i % 3 === 1) {
      const passo = sorteio(0.015, 0.07);
      const a = naEsfera(teta, fi, raio);
      const b = naEsfera(teta + passo, fi, raio);
      linha(a, b, brilho, semente);
      linha(b, naEsfera(teta + passo, fi + passo * 0.7, raio), brilho, semente);
    } else {
      const lado = sorteio(0.01, 0.03);
      const canto = [[0, 0], [lado, 0], [lado, lado], [0, lado], [0, 0]];
      for (let c = 0; c < 4; c++) {
        linha(naEsfera(teta + canto[c][0], fi + canto[c][1], raio), naEsfera(teta + canto[c + 1][0], fi + canto[c + 1][1], raio), brilho * 0.8, semente);
      }
    }
  }

  // aneis e arcos internos, em planos diferentes
  function arco(raio, inclinacaoX, inclinacaoZ, inicio, abertura, brilho, segmentos) {
    const cx = Math.cos(inclinacaoX), sx = Math.sin(inclinacaoX), cz = Math.cos(inclinacaoZ), sz = Math.sin(inclinacaoZ);
    const em = (t) => {
      const x = Math.cos(t) * raio, y0 = Math.sin(t) * raio;
      const y = y0 * cx, z = y0 * sx;
      return [x * cz - y * sz, x * sz + y * cz, z];
    };
    const semente = Math.random();
    for (let i = 0; i < segmentos; i++) {
      linha(em(inicio + abertura * i / segmentos), em(inicio + abertura * (i + 1) / segmentos), brilho, semente);
    }
  }
  for (let i = 0; i < 90; i++) {
    arco(sorteio(0.4, 0.82), sorteio(-1.5, 1.5), sorteio(0, 3.14), sorteio(0, 6.28), sorteio(0.4, 3.6), sorteio(0.5, 1.1), 44);
  }

  // espiral brilhante que desce ate o centro
  const volta = (eixo, fase) => {
    for (let i = 0; i < 200; i++) {
      const t = i / 200;
      const giro = t * 9.5 + fase;
      const raio = 0.74 * (1 - t) + 0.07;
      const a = [Math.cos(giro) * raio, Math.sin(giro) * raio * eixo, (t - 0.5) * 0.3];
      const b = [Math.cos(giro + 0.05) * raio, Math.sin(giro + 0.05) * raio * eixo, (t - 0.5) * 0.3];
      linha(a, b, 0.8 + t * 0.6, t);
    }
  };
  volta(0.86, 0);
  volta(0.86, 3.14);

  // miolo
  for (let i = 0; i < 6; i++) arco(0.075 + i * 0.022, 0.25, 0, 0, 6.3, 1.4, 48);

  // faiscas
  for (let i = 0; i < 6000; i++) {
    const teta = sorteio(0, Math.PI * 2);
    const fi = Math.asin(sorteio(-1, 1));
    const raio = i % 5 === 0 ? sorteio(0.1, 0.8) : sorteio(0.82, 1.12);
    if (raio > 0.8 && densidade(teta, fi) < 0) continue;
    ponto(naEsfera(teta, fi, raio), sorteio(0.4, 1.3), sorteio(1.5, 4.5));
  }
  for (let i = 0; i < 90; i++) ponto(naEsfera(sorteio(0, 6.28), sorteio(-1.5, 1.5), sorteio(0, 0.13)), 1.5, sorteio(3, 8));

  function criarBuffer(dados) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dados), gl.STATIC_DRAW);
    return { buffer, total: dados.length / 7 };
  }
  const bufferLinhas = criarBuffer(linhas);
  const bufferPontos = criarBuffer(pontos);

  const aPosicao = gl.getAttribLocation(programa, "aPosicao");
  const aDados = gl.getAttribLocation(programa, "aDados");
  const aFaixa = gl.getAttribLocation(programa, "aFaixa");
  gl.enableVertexAttribArray(aPosicao);
  gl.enableVertexAttribArray(aDados);
  gl.enableVertexAttribArray(aFaixa);
  const uniforme = (nome) => gl.getUniformLocation(programa, nome);
  const u = Object.fromEntries(["uTempo", "uForca", "uOnda", "uAspecto", "uEscala", "uPonteiro", "uInclinacao", "uCor", "uQuente", "uPonto"].map((nome) => [nome, uniforme(nome)]));

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.clearColor(0, 0, 0, 0);

  const TEMAS = {
    jarvis: { cor: [0.2, 0.68, 1.0], quente: [0.86, 0.98, 1.0] },
    ultron: { cor: [1.0, 0.5, 0.08], quente: [1.0, 0.92, 0.62] },
  };
  const cor = [...TEMAS.jarvis.cor];
  const quente = [...TEMAS.jarvis.quente];
  const aproximar = (atual, alvo, passo) => atual.forEach((valor, i) => { atual[i] = valor + (alvo[i] - valor) * passo; });

  const ponteiro = { x: 0, y: 0, alvoX: 0, alvoY: 0, forca: 0, alvoForca: 0 };
  let onda = 0;
  let largura = 0;
  let altura = 0;

  function ajustar() {
    const caixa = canvas.getBoundingClientRect();
    const escala = Math.min(devicePixelRatio || 1, 2);
    largura = Math.max(1, Math.round(caixa.width * escala));
    altura = Math.max(1, Math.round(caixa.height * escala));
    canvas.width = largura;
    canvas.height = altura;
    gl.viewport(0, 0, largura, altura);
  }
  new ResizeObserver(ajustar).observe(canvas);
  ajustar();

  function mover(evento) {
    const caixa = canvas.getBoundingClientRect();
    if (!caixa.width) return;
    ponteiro.alvoX = ((evento.clientX - caixa.left) / caixa.width * 2 - 1) * (caixa.width / caixa.height) / ESCALA;
    ponteiro.alvoY = (1 - (evento.clientY - caixa.top) / caixa.height * 2) / ESCALA;
    ponteiro.alvoForca = 1;
  }
  canvas.addEventListener("pointermove", mover);
  canvas.addEventListener("pointerleave", () => { ponteiro.alvoForca = 0; });
  canvas.addEventListener("pointerdown", (evento) => { mover(evento); onda = 0.001; });

  function desenhar(alvo, modo, ponto) {
    gl.bindBuffer(gl.ARRAY_BUFFER, alvo.buffer);
    gl.vertexAttribPointer(aPosicao, 3, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(aDados, 3, gl.FLOAT, false, 28, 12);
    gl.vertexAttribPointer(aFaixa, 1, gl.FLOAT, false, 28, 24);
    gl.uniform1f(u.uPonto, ponto);
    gl.drawArrays(modo, 0, alvo.total);
  }

  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let anterior = 0;
  let primeiroQuadro = true;

  function quadro(agora) {
    const tempo = agora / 1000;
    const passo = Math.min((agora - anterior) / 1000, 0.25);
    anterior = agora;
    const inicial = primeiroQuadro;
    primeiroQuadro = false;
    if (canvas.offsetParent === null) {
      if (!quieto) requestAnimationFrame(quadro);
      return;
    }
    const suave = (taxa) => 1 - Math.exp(-passo * taxa);
    const tema = TEMAS[document.documentElement.dataset.tema] || TEMAS.jarvis;
    aproximar(cor, tema.cor, inicial ? 1 : suave(4));
    aproximar(quente, tema.quente, inicial ? 1 : suave(4));
    ponteiro.x += (ponteiro.alvoX - ponteiro.x) * suave(7);
    ponteiro.y += (ponteiro.alvoY - ponteiro.y) * suave(7);
    ponteiro.forca += (ponteiro.alvoForca - ponteiro.forca) * suave(4);
    if (onda > 0) { onda += passo * 0.9; if (onda >= 1) onda = 0; }

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.uTempo, tempo);
    gl.uniform1f(u.uForca, ponteiro.forca);
    gl.uniform1f(u.uOnda, onda);
    gl.uniform1f(u.uAspecto, largura / altura);
    gl.uniform1f(u.uEscala, ESCALA);
    gl.uniform2f(u.uPonteiro, ponteiro.x, ponteiro.y);
    gl.uniform2f(u.uInclinacao, ponteiro.x * ponteiro.forca * 0.1, ponteiro.y * ponteiro.forca * 0.08 + 0.1);
    gl.uniform3fv(u.uCor, cor);
    gl.uniform3fv(u.uQuente, quente);
    desenhar(bufferLinhas, gl.LINES, 0);
    desenhar(bufferPontos, gl.POINTS, 1);
    if (!quieto) requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
})();
