const GEMINI_KEY = "AQ.Ab8RN6KEw6oFgAfCA5pr1pG11BT02rkV8V_1_8JsSLOdW_rIRw";
const MODELO = "gemini-3.1-flash-lite";

const $ = id => document.getElementById(id);
const hoje = () => new Date().toLocaleDateString("sv");
let S = { xp: 0, animais: {}, dias: {}, conquistas: [] };
try { S = { ...S, ...JSON.parse(localStorage.getItem("cacador") || "{}") }; } catch (e) {}
const salvar = () => { try { localStorage.setItem("cacador", JSON.stringify(S)); } catch (e) {} };

const QUESTS = [
  { id: "q3", t: "Fotografe 3 animais", meta: 3, campo: "fotos", xp: 20 },
  { id: "q5", t: "Fotografe 5 animais", meta: 5, campo: "fotos", xp: 30 },
  { id: "q10", t: "Fotografe 10 animais", meta: 10, campo: "fotos", xp: 60 },
  { id: "qn", t: "Descubra 1 espécie nova", meta: 1, campo: "novos", xp: 25 },
  { id: "qn3", t: "Descubra 3 espécies novas", meta: 3, campo: "novos", xp: 50 },
];
const CONQ = [
  [1, "🥚", "Primeiro passo", "Cadastre seu 1º animal"],
  [5, "🔭", "Explorador", "Cadastre 5 animais"],
  [10, "🧭", "Aventureiro", "Cadastre 10 animais"],
  [25, "🦉", "Naturalista", "Cadastre 25 animais"],
  [50, "👑", "Mestre da Selva", "Cadastre 50 animais"],
];

function dia() { return S.dias[hoje()] ||= { fotos: 0, novos: 0, feitas: [] }; }
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 3000); }
function ganharXP(n) { S.xp += n; }

function verificar() {
  const d = dia(), total = Object.keys(S.animais).length;
  QUESTS.forEach(q => {
    if (d[q.campo] >= q.meta && !d.feitas.includes(q.id)) {
      d.feitas.push(q.id); ganharXP(q.xp); toast(`✅ Missão: ${q.t}! +${q.xp} XP`);
    }
  });
  CONQ.forEach(([n, ic, nome]) => {
    if (total >= n && !S.conquistas.includes(n)) {
      S.conquistas.push(n); ganharXP(40); toast(`🏆 Conquista: ${ic} ${nome}! +40 XP`);
    }
  });
  salvar(); desenhar();
}

function desenhar() {
  const nv = Math.floor(S.xp / 100) + 1;
  $("nivel").textContent = "Nv " + nv;
  $("xpTxt").textContent = S.xp + " XP";
  $("xpBarra").style.width = (S.xp % 100) + "%";

  const lista = Object.values(S.animais);
  $("qtd").textContent = `(${lista.length})`;
  $("grade").innerHTML = lista.length
    ? lista.map(a => `<div class="item"><img src="${a.img || ""}" alt=""><div><b>${a.nome}</b><br><small>${a.vezes}x fotografado</small></div></div>`).join("")
    : '<p class="vazio">Nenhum bicho ainda. Vai caçar! 🐾</p>';

  const d = dia();
  $("quests").innerHTML = QUESTS.map(q => {
    const v = Math.min(d[q.campo], q.meta), ok = d.feitas.includes(q.id);
    return `<div class="q ${ok ? "ok" : ""}"><div class="t"><span>${ok ? "✅" : "🎯"} ${q.t}</span><span>+${q.xp} XP</span></div><div class="b"><i style="width:${v / q.meta * 100}%"></i></div></div>`;
  }).join("");

  $("conquistas").innerHTML = CONQ.map(([n, ic, nome, desc]) => {
    const ok = S.conquistas.includes(n);
    return `<div class="q ${ok ? "ok" : "lock"}"><div class="t"><span>${ic} ${nome}</span><span>${ok ? "🔓" : "🔒"}</span></div><small>${desc}</small></div>`;
  }).join("");
}

document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll(".aba").forEach(a => a.hidden = a.id !== b.dataset.aba);
});

async function processar(arquivo) {
  if (!arquivo) return;
  $("resultado").hidden = true;
  $("preview").src = URL.createObjectURL(arquivo); $("preview").hidden = false;
  $("status").textContent = "🔍 Identificando o animal...";
  try {
    const animal = await identificarAnimal(await paraBase64(arquivo, 1024));
    if (!animal.encontrado) { $("status").textContent = "Não vi nenhum animal nessa foto. Tente outra!"; return; }
    $("status").textContent = "📚 Buscando na Wikipédia...";
    const wiki = await buscarWikipedia(animal.nome_popular, animal.nome_cientifico);

    const chave = (animal.nome_cientifico || animal.nome_popular).toLowerCase();
    const novo = !S.animais[chave];
    const d = dia(); d.fotos++;
    if (novo) { d.novos++; S.animais[chave] = { nome: animal.nome_popular, vezes: 0, img: await miniatura(arquivo) }; }
    S.animais[chave].vezes++;
    ganharXP(novo ? 10 : 2);

    $("nome").textContent = animal.nome_popular;
    $("cient").textContent = animal.nome_cientifico || "";
    $("badge").textContent = novo ? "✨ Espécie nova! +10 XP" : "Já no álbum +2 XP";
    $("resumo").textContent = wiki ? wiki.extract : "Não achei página na Wikipédia para esse animal.";
    $("link").hidden = !wiki; if (wiki) $("link").href = wiki.content_urls.mobile.page;
    $("wikiImg").hidden = !(wiki && wiki.thumbnail); if (wiki && wiki.thumbnail) $("wikiImg").src = wiki.thumbnail.source;
    $("resultado").hidden = false; $("status").textContent = "";
    verificar();
  } catch (e) {
    console.error(e); $("status").textContent = "Deu erro. Confira a chave da API e tente de novo.";
  }
}
["foto", "galeria"].forEach(id => $(id).addEventListener("change", e => { processar(e.target.files[0]); e.target.value = ""; }));

function carregar(arquivo, max) {
  return new Promise((ok, err) => {
    const img = new Image();
    img.onload = () => {
      const e = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = img.width * e; c.height = img.height * e;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); ok(c);
    };
    img.onerror = err; img.src = URL.createObjectURL(arquivo);
  });
}
const paraBase64 = async (f, m) => (await carregar(f, m)).toDataURL("image/jpeg", 0.85).split(",")[1];
const miniatura = async f => (await carregar(f, 240)).toDataURL("image/jpeg", 0.7);

async function identificarAnimal(b64) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${GEMINI_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: "Identifique o animal nesta foto. Responda apenas em JSON com: encontrado (true/false), nome_popular (português do Brasil) e nome_cientifico. Se não houver animal, encontrado false." },
        { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
      generationConfig: { response_mime_type: "application/json" } })
  });
  if (!r.ok) throw new Error("Gemini " + r.status);
  return JSON.parse((await r.json()).candidates[0].content.parts[0].text);
}

async function buscarWikipedia(popular, cientifico) {
  for (const [lang, termo] of [["pt", popular], ["pt", cientifico], ["en", cientifico]]) {
    if (!termo) continue;
    const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(termo)}`);
    if (r.ok) { const d = await r.json(); if (d.type === "standard") return d; }
  }
  return null;
}

verificar();
