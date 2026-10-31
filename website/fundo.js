"use strict";
// Fundo animado: varredura de radar, aneis de instrumento e trilhas de energia.
(() => {
  const canvas = document.getElementById("fundo");
  const ctx = canvas.getContext("2d");
  const INTERVALO = 1000 / 30;
  const CORES = { jarvis: "70, 200, 255", ultron: "255, 150, 40" };
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let largura = 0;
  let altura = 0;
  let trilhas = [];
  let anterior = 0;
  let alvoX = 0;
  let alvoY = 0;
  let desvioX = 0;
  let desvioY = 0;

  function criarTrilha() {
    const horizontal = Math.random() < 0.5;
    const pontos = [[Math.random() * largura, Math.random() * altura]];
    for (let i = 0; i < 5; i++) {
      const [x, y] = pontos[pontos.length - 1];
      const passo = 60 + Math.random() * 220;
      const eixoX = (i % 2 === 0) === horizontal;
      pontos.push(eixoX ? [x + (Math.random() < 0.5 ? passo : -passo), y] : [x, y + (Math.random() < 0.5 ? passo : -passo)]);
    }
    return { pontos, fase: Math.random(), velocidade: 0.0012 + Math.random() * 0.002 };
  }

  function ajustar() {
    const escala = Math.min(devicePixelRatio || 1, 2);
    largura = innerWidth;
    altura = innerHeight;
    canvas.width = largura * escala;
    canvas.height = altura * escala;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    trilhas = Array.from({ length: Math.round(largura / 110) }, criarTrilha);
  }

  function ponteiroNaTrilha(trilha, progresso) {
    const trechos = trilha.pontos.length - 1;
    const posicao = progresso * trechos;
    const indice = Math.min(Math.floor(posicao), trechos - 1);
    const t = posicao - indice;
    const [ax, ay] = trilha.pontos[indice];
    const [bx, by] = trilha.pontos[indice + 1];
    return [ax + (bx - ax) * t, ay + (by - ay) * t];
  }

  function desenhar(agora) {
    if (!quieto) requestAnimationFrame(desenhar);
    if (agora - anterior < INTERVALO || document.hidden) return;
    anterior = agora;
    const rgb = CORES[document.documentElement.dataset.tema] || CORES.jarvis;
    const t = agora / 1000;

    desvioX += (alvoX - desvioX) * 0.04;
    desvioY += (alvoY - desvioY) * 0.04;
    ctx.clearRect(0, 0, largura, altura);

    // trilhas de energia
    ctx.lineWidth = 1;
    for (const trilha of trilhas) {
      trilha.fase = (trilha.fase + trilha.velocidade) % 1;
      ctx.strokeStyle = `rgba(${rgb}, .05)`;
      ctx.beginPath();
      trilha.pontos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      const [x, y] = ponteiroNaTrilha(trilha, trilha.fase);
      ctx.fillStyle = `rgba(${rgb}, .75)`;
      ctx.fillRect(x - 1, y - 1, 2.5, 2.5);
      ctx.fillStyle = `rgba(${rgb}, .1)`;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // instrumentos em volta do nucleo
    const cx = largura / 2 + desvioX * 22;
    const cy = altura * 0.54 + desvioY * 22;
    const base = Math.max(largura, altura);
    ctx.save();
    ctx.translate(cx, cy);
    const aneis = [[0.34, 0.03, 8], [0.43, -0.02, 14], [0.54, 0.012, 3], [0.68, -0.008, 22]];
    for (const [raio, velocidade, divisoes] of aneis) {
      ctx.strokeStyle = `rgba(${rgb}, .11)`;
      for (let i = 0; i < divisoes; i++) {
        const inicio = t * velocidade + (i / divisoes) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, base * raio, inicio, inicio + (Math.PI * 2 / divisoes) * 0.62);
        ctx.stroke();
      }
    }

    // marcas de escala
    ctx.strokeStyle = `rgba(${rgb}, .15)`;
    ctx.rotate(t * 0.015);
    for (let i = 0; i < 120; i++) {
      const angulo = (i / 120) * Math.PI * 2;
      const dentro = base * (i % 10 === 0 ? 0.39 : 0.4);
      const fora = base * 0.41;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angulo) * dentro, Math.sin(angulo) * dentro);
      ctx.lineTo(Math.cos(angulo) * fora, Math.sin(angulo) * fora);
      ctx.stroke();
    }
    ctx.restore();

    // varredura
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.35);
    const varredura = ctx.createConicGradient(0, 0, 0);
    varredura.addColorStop(0, `rgba(${rgb}, 0)`);
    varredura.addColorStop(0.05, `rgba(${rgb}, .045)`);
    varredura.addColorStop(0.18, `rgba(${rgb}, 0)`);
    varredura.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = varredura;
    ctx.beginPath();
    ctx.arc(0, 0, base * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // vinheta
    const vinheta = ctx.createRadialGradient(cx, cy, base * 0.1, cx, cy, base * 0.72);
    vinheta.addColorStop(0, `rgba(${rgb}, .07)`);
    vinheta.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = vinheta;
    ctx.fillRect(0, 0, largura, altura);
  }

  addEventListener("resize", ajustar);
  addEventListener("pointermove", (evento) => {
    alvoX = evento.clientX / innerWidth - 0.5;
    alvoY = evento.clientY / innerHeight - 0.5;
  });
  ajustar();
  requestAnimationFrame(desenhar);
})();
