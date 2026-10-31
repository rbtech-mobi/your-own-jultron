"use strict";

const SVG = "http://www.w3.org/2000/svg";
const LARGURA_NO = 150;
const ALTURA_NO = 56;

const $ = (id) => document.getElementById(id);

function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function criarSvg(tag, atributos, texto) {
  const elemento = document.createElementNS(SVG, tag);
  Object.entries(atributos).forEach(([nome, valor]) => elemento.setAttribute(nome, valor));
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

const selo = (status) => criar("span", `selo ${status}`, STATUS[status]);

function linhaTabela(celulas, ultimaEhStatus) {
  const linha = criar("tr");
  celulas.forEach((valor, indice) => {
    const celula = criar("td");
    if (ultimaEhStatus && indice === celulas.length - 1) celula.append(selo(valor));
    else celula.textContent = valor;
    linha.append(celula);
  });
  return linha;
}

function preencherTabela(id, linhas, ultimaEhStatus = false) {
  $(id).replaceChildren(...linhas.map((linha) => linhaTabela(linha, ultimaEhStatus)));
}

function montarCore() {
  const linha = ([nome, status]) => {
    const item = criar("div");
    item.append(criar("span", "", nome), selo(status));
    return item;
  };
  $("status-sistema").append(...SISTEMA.map(linha));
  LEGENDA.forEach(([status, descricao]) => {
    const item = criar("div");
    item.append(selo(status), criar("span", "descricao-status", descricao));
    $("legenda-status").append(item);
  });
}

function mostrarTrace(nome) {
  preencherTabela("trace", TRACES[nome]);
  [...$("seletor-trace").children].forEach((botao) => botao.setAttribute("aria-pressed", botao.textContent === nome));
}

function montarRuntime() {
  Object.keys(TRACES).forEach((nome) => {
    const botao = criar("button", "conexao", nome);
    botao.type = "button";
    botao.addEventListener("click", () => mostrarTrace(nome));
    $("seletor-trace").append(botao);
  });
  mostrarTrace(Object.keys(TRACES)[0]);
  $("maquina-estados").textContent = MAQUINA;
}

function campos(destino, titulo, linhas, marcador) {
  const itens = linhas.map(([rotulo, valor]) => {
    const linha = criar("div", "campo");
    linha.append(criar("small", "", rotulo), criar("p", "", valor));
    return linha;
  });
  const cabecalho = criar("header");
  cabecalho.append(criar("h3", "", titulo));
  if (marcador) cabecalho.append(marcador);
  destino.replaceChildren(cabecalho, ...itens);
}

function selecionar(atual) {
  document.querySelectorAll(".no, .ligacao-svg, .conexao[data-id]").forEach((item) => item.classList.toggle("selecionado", item.dataset.id === atual));
}

function mostrarComponente(chave) {
  const item = COMPONENTES[chave];
  selecionar(`no-${chave}`);
  campos($("detalhe-arquitetura"), item.nome, [["Responsibility", item.funcao], ["Stack", item.tecnologia], ["Rationale", item.decisao]], selo(item.ativo ? "validated" : "designed"));
}

function mostrarConexao(indice) {
  const item = CONEXOES[indice];
  selecionar(`ligacao-${indice}`);
  campos($("detalhe-arquitetura"), `${COMPONENTES[item.de].nome} → ${COMPONENTES[item.para].nome}`, [["Protocol", item.protocolo], ["Payload", item.dados], ["Failure handling", item.falha]]);
}

function acionavel(elemento, acao, rotulo) {
  elemento.setAttribute("tabindex", "0");
  elemento.setAttribute("role", "button");
  elemento.setAttribute("aria-label", rotulo);
  elemento.addEventListener("click", acao);
  elemento.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      acao();
    }
  });
}

function montarDiagrama() {
  const svg = criarSvg("svg", { viewBox: "0 0 720 460", role: "group", "aria-label": "Container diagram" });
  CONEXOES.forEach((item, indice) => {
    const a = COMPONENTES[item.de];
    const b = COMPONENTES[item.para];
    const grupo = criarSvg("g", { class: `ligacao-svg${a.ativo && b.ativo ? "" : " planejada"}`, "data-id": `ligacao-${indice}` });
    const pontos = { x1: a.x + LARGURA_NO / 2, y1: a.y + ALTURA_NO / 2, x2: b.x + LARGURA_NO / 2, y2: b.y + ALTURA_NO / 2 };
    grupo.append(criarSvg("line", { ...pontos, class: "alvo" }), criarSvg("line", pontos));
    acionavel(grupo, () => mostrarConexao(indice), item.nome);
    svg.append(grupo);
  });
  Object.entries(COMPONENTES).forEach(([chave, item]) => {
    const grupo = criarSvg("g", { class: `no${item.ativo ? "" : " planejado"}`, "data-id": `no-${chave}` });
    grupo.append(
      criarSvg("rect", { x: item.x, y: item.y, width: LARGURA_NO, height: ALTURA_NO }),
      criarSvg("text", { x: item.x + LARGURA_NO / 2, y: item.y + ALTURA_NO / 2 + 5, "text-anchor": "middle" }, item.nome),
    );
    acionavel(grupo, () => mostrarComponente(chave), item.nome);
    svg.append(grupo);
  });
  $("diagrama").append(svg);

  CONEXOES.forEach((item, indice) => {
    const botao = criar("button", "conexao");
    botao.type = "button";
    botao.dataset.id = `ligacao-${indice}`;
    botao.append(criar("span", "", item.nome), criar("small", "", item.protocolo));
    botao.addEventListener("click", () => mostrarConexao(indice));
    $("lista-conexoes").append(botao);
  });
  mostrarComponente("supervisor");
}

function montarArquitetura() {
  montarDiagrama();
  $("sequencia").textContent = SEQUENCIA;
  CONTRATOS.forEach(([nome, corpo]) => {
    const cartao = criar("article", "bloco contrato");
    cartao.append(criar("h3", "", nome), criar("pre", "", corpo));
    $("contratos").append(cartao);
  });
  preencherTabela("falhas", FALHAS, true);
  ADRS.forEach(([codigo, titulo, estado, contexto, rejeitadas, consequencias]) => {
    const registro = criar("article", "bloco adr");
    const topo = criar("header");
    topo.append(criar("h3", "", `${codigo} ${titulo}`), criar("span", "selo", estado));
    registro.append(topo);
    [["Context", contexto], ["Rejected alternatives", rejeitadas], ["Consequences", consequencias]].forEach(([rotulo, valor]) => {
      const campo = criar("div", "campo");
      campo.append(criar("small", "", rotulo), criar("p", "", valor));
      registro.append(campo);
    });
    $("adrs").append(registro);
  });
}

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
    document.querySelectorAll(".temas button").forEach((botao) => botao.setAttribute("aria-pressed", botao.dataset.tema === tema));
  try { localStorage.setItem("tema", tema); } catch { /* optional preference */ }
}

function temaSalvo() {
  if (new URLSearchParams(location.search).get("tema") === "night") return "night";
  try { return localStorage.getItem("tema") === "night" ? "night" : "day"; } catch { return "day"; }
}

function abrirAba(nome) {
  document.querySelectorAll(".aba").forEach((aba) => aba.classList.toggle("ativa", aba.id === nome));
  document.querySelectorAll(".abas button").forEach((botao) => botao.setAttribute("aria-selected", botao.dataset.aba === nome));
}

document.querySelectorAll(".abas button").forEach((botao) => botao.addEventListener("click", () => abrirAba(botao.dataset.aba)));
document.querySelectorAll(".temas button").forEach((botao) => botao.addEventListener("click", () => aplicarTema(botao.dataset.tema)));

aplicarTema(temaSalvo());
montarCore();
montarRuntime();
montarArquitetura();
preencherTabela("benchmarks-lista", BENCHMARKS);
preencherTabela("ci", CI, true);
preencherTabela("registro", REGISTRO);
preencherTabela("investigacoes", INVESTIGACOES);
