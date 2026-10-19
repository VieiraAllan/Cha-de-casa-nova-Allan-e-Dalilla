// ===== CONFIGURAÇÃO =====
// Use os MESMOS valores que você colocou no app.js.
const SUPABASE_URL = "https://ybjlprzthbeboajrhyet.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inliamxwcnp0aGJlYm9hanJoeWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMzc2MjMsImV4cCI6MjEwNDkxMzYyM30.DNOdGStdo2Wr-Ofk1JljVKsqDVGAm0FO8EJIuv31xTI";

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const telaLogin = document.getElementById("tela-login");
const telaPainel = document.getElementById("tela-painel");

async function verificarSessao() {
  const { data } = await client.auth.getSession();
  if (data.session) {
    mostrarPainel();
  } else {
    telaLogin.style.display = "block";
    telaPainel.style.display = "none";
  }
}

async function fazerLogin() {
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value;
  const erro = document.getElementById("erro-login");
  erro.textContent = "";

  if (!email || !senha) {
    erro.textContent = "Preencha e-mail e senha.";
    return;
  }

  const { error } = await client.auth.signInWithPassword({ email, password: senha });
  if (error) {
    erro.textContent = "E-mail ou senha incorretos.";
    return;
  }
  mostrarPainel();
}

async function fazerLogout() {
  await client.auth.signOut();
  telaLogin.style.display = "block";
  telaPainel.style.display = "none";
}

async function mostrarPainel() {
  telaLogin.style.display = "none";
  telaPainel.style.display = "block";
  await carregarTudo();
}

function money(v) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

let presentesCache = [];

async function carregarTudo() {
  const erroGeral = document.getElementById("erro-geral");
  erroGeral.textContent = "";

  const { data: presentes, error: e1 } = await client
    .from("presentes")
    .select("*")
    .order("ordem", { ascending: true });

  const { data: reservas, error: e2 } = await client
    .from("reservas")
    .select("presente_id, nome_convidado, status, created_at")
    .order("created_at", { ascending: false });

  if (e1 || e2) {
    erroGeral.textContent = "Não foi possível carregar os dados. Verifique se você está logado com a conta correta.";
    return;
  }

  presentesCache = (presentes || []).map(p => {
    const reserva = (reservas || []).find(r => r.presente_id === p.id && r.status !== "cancelado");
    return { ...p, reservado_por: reserva ? reserva.nome_convidado : null };
  });

  renderStats();
  renderTabela();
}

function renderStats() {
  const total = presentesCache.length;
  const disp = presentesCache.filter(p => p.status === "disponivel").length;
  const res = presentesCache.filter(p => p.status === "reservado").length;
  const rec = presentesCache.filter(p => p.status === "recebido").length;

  document.getElementById("stats").innerHTML = `
    <div class="stat"><div class="num">${total}</div><div class="lbl">Total de presentes</div></div>
    <div class="stat"><div class="num">${disp}</div><div class="lbl">Disponíveis</div></div>
    <div class="stat"><div class="num">${res}</div><div class="lbl">Reservados</div></div>
    <div class="stat"><div class="num">${rec}</div><div class="lbl">Recebidos</div></div>
  `;
}

function renderTabela() {
  const tbody = document.getElementById("tbody-presentes");
  tbody.innerHTML = presentesCache.map(p => `
    <tr>
      <td>${escapeHtml(p.nome)}</td>
      <td>${money(p.preco)}</td>
      <td>${p.reservado_por ? escapeHtml(p.reservado_por) : "—"}</td>
      <td>
        <select class="status-sel" onchange="mudarStatus('${p.id}', this.value)">
          <option value="disponivel" ${p.status === "disponivel" ? "selected" : ""}>Disponível</option>
          <option value="reservado" ${p.status === "reservado" ? "selected" : ""}>Reservado</option>
          <option value="recebido" ${p.status === "recebido" ? "selected" : ""}>Recebido</option>
        </select>
      </td>
      <td style="display:flex;gap:6px;">
        <button class="btn-admin secundario" onclick="editarPresente('${p.id}')">Editar</button>
        <button class="btn-admin secundario" onclick="excluirPresente('${p.id}')">Excluir</button>
      </td>
    </tr>
  `).join("");
}

async function mudarStatus(id, novoStatus) {
  const { error } = await client.from("presentes").update({ status: novoStatus }).eq("id", id);
  if (error) {
    alert("Não foi possível atualizar: " + error.message);
    return;
  }

  if (novoStatus === "disponivel") {
    await client.from("reservas").update({ status: "cancelado" }).eq("presente_id", id).eq("status", "reservado");
  } else if (novoStatus === "recebido") {
    await client.from("reservas").update({ status: "recebido" }).eq("presente_id", id);
  }

  await carregarTudo();
}

async function excluirPresente(id) {
  if (!confirm("Excluir este presente da lista? Essa ação não pode ser desfeita.")) return;
  const { error } = await client.from("presentes").delete().eq("id", id);
  if (error) {
    alert("Não foi possível excluir: " + error.message);
    return;
  }
  await carregarTudo();
}

let presenteEditandoId = null;

function limparForm() {
  document.getElementById("f-nome").value = "";
  document.getElementById("f-descricao").value = "";
  document.getElementById("f-categoria").value = "";
  document.getElementById("f-preco").value = "";
  document.getElementById("f-imagem").value = "";
  document.getElementById("f-link").value = "";
  document.getElementById("erro-form").textContent = "";
}

function abrirFormNovo() {
  presenteEditandoId = null;
  limparForm();
  document.getElementById("titulo-form").textContent = "Novo presente";
  document.getElementById("btn-salvar-form").textContent = "Salvar presente";
  document.getElementById("form-novo").classList.add("aberto");
}

function toggleFormNovo() {
  const form = document.getElementById("form-novo");
  if (form.classList.contains("aberto")) {
    form.classList.remove("aberto");
    presenteEditandoId = null;
  } else {
    abrirFormNovo();
  }
}

function editarPresente(id) {
  const p = presentesCache.find(x => x.id === id);
  if (!p) return;
  presenteEditandoId = id;

  document.getElementById("f-nome").value = p.nome || "";
  document.getElementById("f-descricao").value = p.descricao || "";
  document.getElementById("f-categoria").value = p.categoria || "";
  document.getElementById("f-preco").value = p.preco != null ? p.preco : "";
  document.getElementById("f-imagem").value = p.imagem_url || "";
  document.getElementById("f-link").value = p.link_compra || "";
  document.getElementById("erro-form").textContent = "";

  document.getElementById("titulo-form").textContent = "Editar presente";
  document.getElementById("btn-salvar-form").textContent = "Salvar alterações";
  document.getElementById("form-novo").classList.add("aberto");
  document.getElementById("form-novo").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function salvarPresente() {
  const nome = document.getElementById("f-nome").value.trim();
  const descricao = document.getElementById("f-descricao").value.trim();
  const categoria = document.getElementById("f-categoria").value.trim();
  const preco = parseFloat(document.getElementById("f-preco").value);
  const imagem = document.getElementById("f-imagem").value.trim();
  const link = document.getElementById("f-link").value.trim();
  const erro = document.getElementById("erro-form");
  erro.textContent = "";

  if (!nome || !link || isNaN(preco) || preco < 0) {
    erro.textContent = "Preencha ao menos nome, preço e link do produto.";
    return;
  }

  const payload = {
    nome, descricao, categoria, preco,
    imagem_url: imagem || null,
    link_compra: link
  };

  let error;
  if (presenteEditandoId) {
    ({ error } = await client.from("presentes").update(payload).eq("id", presenteEditandoId));
  } else {
    ({ error } = await client.from("presentes").insert({ ...payload, ordem: presentesCache.length + 1 }));
  }

  if (error) {
    erro.textContent = "Não foi possível salvar: " + error.message;
    return;
  }

  presenteEditandoId = null;
  limparForm();
  document.getElementById("form-novo").classList.remove("aberto");
  await carregarTudo();
}

function configurarRealtime() {
  client.channel("admin-presentes-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "presentes" }, () => carregarTudo())
    .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, () => carregarTudo())
    .subscribe();
}

verificarSessao();
configurarRealtime();
