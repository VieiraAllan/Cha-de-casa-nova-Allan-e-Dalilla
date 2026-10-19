// ===== CONFIGURAÇÃO =====
// Preencha com os dados do seu projeto Supabase antes do deploy.
const SUPABASE_URL = "https://ybjlprzthbeboajrhyet.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inliamxwcnp0aGJlYm9hanJoeWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMzc2MjMsImV4cCI6MjEwNDkxMzYyM30.DNOdGStdo2Wr-Ofk1JljVKsqDVGAm0FO8EJIuv31xTI";
const RESERVATION_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/reservar`;

const hasSupabaseConfig = !SUPABASE_URL.includes("SEU-PROJETO") && !SUPABASE_ANON_KEY.includes("SUA_ANON_KEY");
const client = hasSupabaseConfig ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const state = {
  gifts: [],
  selectedGift: null,
  sort: localStorage.getItem("gift-sort") || "default",
  availableOnly: localStorage.getItem("gift-available-only") === "true"
};

const grid = document.getElementById("gift-grid");
const sortSelect = document.getElementById("sort-select");
const availableOnly = document.getElementById("available-only");
const giftCount = document.getElementById("gift-count");
const modal = document.getElementById("reserve-modal");
const selectedGift = document.getElementById("selected-gift");
const reserveForm = document.getElementById("reserve-form");
const guestName = document.getElementById("guest-name");
const formMessage = document.getElementById("form-message");

sortSelect.value = state.sort;
availableOnly.checked = state.availableOnly;

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  localStorage.setItem("gift-sort", state.sort);
  render();
});
availableOnly.addEventListener("change", () => {
  state.availableOnly = availableOnly.checked;
  localStorage.setItem("gift-available-only", String(state.availableOnly));
  render();
});

function money(value) {
  return new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"}).format(value);
}

function sortGifts(gifts) {
  const list = [...gifts];
  if (state.sort === "name-asc") return list.sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (state.sort === "name-desc") return list.sort((a,b) => b.nome.localeCompare(a.nome, "pt-BR"));
  if (state.sort === "price-asc") return list.sort((a,b) => Number(a.preco) - Number(b.preco));
  if (state.sort === "price-desc") return list.sort((a,b) => Number(b.preco) - Number(a.preco));
  return list;
}

function render() {
  const visible = sortGifts(state.gifts.filter(g => !state.availableOnly || g.status === "disponivel"));
  const available = state.gifts.filter(g => g.status === "disponivel").length;
  giftCount.textContent = `${available} disponível${available === 1 ? "" : " e"}${state.gifts.length ? ` de ${state.gifts.length}` : ""}`;

  if (!visible.length) {
    grid.innerHTML = `<div class="empty">Não encontramos presentes disponíveis no momento. 💕</div>`;
    return;
  }

  grid.innerHTML = visible.map(g => {
    const reserved = g.status !== "disponivel";
    return `<article class="gift-card ${reserved ? "is-reserved" : ""}" data-id="${g.id}">
      <div class="gift-image">${g.imagem_url ? `<img src="${escapeAttr(g.imagem_url)}" alt="${escapeAttr(g.nome)}">` : "♡"}</div>
      <div class="gift-body">
        <div class="gift-category">${escapeHtml(g.categoria || "Para nossa casa")}</div>
        <div class="gift-name">${escapeHtml(g.nome)}</div>
        <p class="gift-description">${escapeHtml(g.descricao || "")}</p>
        <div class="gift-price">${money(g.preco)}</div>
        <div class="status ${reserved ? "reserved" : "available"}">${reserved ? "● Já reservado" : "● Disponível"}</div>
        <div class="gift-actions">
          <a href="${escapeAttr(g.link_compra)}" target="_blank" rel="noopener noreferrer">Ver produto</a>
          <button ${reserved ? "disabled" : ""} onclick="openReserve('${g.id}')">${reserved ? "Reservado" : "Reservar"}</button>
        </div>
      </div>
    </article>`;
  }).join("");
}

function openReserve(id) {
  const gift = state.gifts.find(g => String(g.id) === String(id));
  if (!gift || gift.status !== "disponivel") return;
  state.selectedGift = gift;
  selectedGift.textContent = `${gift.nome} · ${money(gift.preco)}`;
  formMessage.textContent = "";
  reserveForm.reset();
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => guestName.focus(), 50);
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  state.selectedGift = null;
}
document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeModal));
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

reserveForm.addEventListener("submit", async e => {
  e.preventDefault();
  const name = guestName.value.trim();
  if (name.length < 3) {
    formMessage.textContent = "Informe seu nome e sobrenome.";
    return;
  }
  if (!state.selectedGift) return;
  const button = reserveForm.querySelector("button");
  button.disabled = true;
  button.textContent = "Reservando…";
  formMessage.textContent = "";

  try {
    if (!client) throw new Error("CONFIG_MISSING");
    const response = await fetch(RESERVATION_FUNCTION_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json", "apikey":SUPABASE_ANON_KEY, "Authorization":`Bearer ${SUPABASE_ANON_KEY}`},
      body: JSON.stringify({ present_id: state.selectedGift.id, guest_name: name })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível reservar.");
    formMessage.textContent = "Presente reservado com sucesso! 💕";
    formMessage.style.color = "#6A7D65";
    await loadGifts();
    setTimeout(closeModal, 1100);
  } catch (err) {
    formMessage.style.color = "#8A625E";
    formMessage.textContent = err.message === "CONFIG_MISSING"
      ? "Configure o Supabase no arquivo app.js antes de publicar."
      : (err.message || "Não foi possível reservar. Tente novamente.");
  } finally {
    button.disabled = false;
    button.textContent = "Confirmar reserva";
  }
});

async function loadGifts() {
  if (!client) {
    state.gifts = [
      {id:"demo-1",nome:"Jogo de panelas",descricao:"Para começar nossa cozinha juntos.",preco:399.90,categoria:"Cozinha",imagem_url:"",link_compra:"#",status:"disponivel"},
      {id:"demo-2",nome:"Jogo de toalhas",descricao:"Um detalhe para deixar nosso cantinho mais aconchegante.",preco:89.90,categoria:"Banho",imagem_url:"",link_compra:"#",status:"disponivel"},
      {id:"demo-3",nome:"Liquidificador",descricao:"Para nossas receitas e cafés da manhã.",preco:249.90,categoria:"Cozinha",imagem_url:"",link_compra:"#",status:"reservado"}
    ];
    render();
    return;
  }
  const {data, error} = await client.from("presentes").select("id,nome,descricao,preco,categoria,imagem_url,link_compra,status").order("ordem",{ascending:true});
  if (error) {
    grid.innerHTML = `<div class="empty">Não foi possível carregar a lista agora. Tente novamente em instantes.</div>`;
    return;
  }
  state.gifts = data || [];
  render();
}

async function setupRealtime() {
  if (!client) return;
  client.channel("presentes-realtime")
    .on("postgres_changes", {event:"*", schema:"public", table:"presentes"}, payload => {
      const i = state.gifts.findIndex(g => g.id === payload.new?.id || g.id === payload.old?.id);
      if (payload.eventType === "DELETE") {
        if (i >= 0) state.gifts.splice(i,1);
      } else if (i >= 0) {
        state.gifts[i] = {...state.gifts[i], ...payload.new};
      } else if (payload.new) {
        state.gifts.push(payload.new);
      }
      render();
    })
    .subscribe();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function escapeAttr(value) { return escapeHtml(value); }

loadGifts();
setupRealtime();
