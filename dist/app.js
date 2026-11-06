import { repository, withWriteLock } from "./modules/repository.js";
import { emptyState } from "./modules/storage.js";
import { STORAGE_KEY } from "./modules/config.js";
import {
  today,
  uid,
  addDays,
  effectivePrice,
  dateLabel,
  timestamp,
} from "./modules/utils.js";
import {
  $,
  $$,
  esc,
  money,
  empty,
  notify,
  showError,
  confirmAction,
} from "./modules/ui.js";
import { setupBookings } from "./modules/booking-view.js";
import { setupClients } from "./modules/client-view.js";
import { setupCatalog } from "./modules/catalog-view.js";
import { setupAdmin } from "./modules/admin-view.js";
const VIEWS = {
  home: "Visão geral",
  bookings: "Agendamentos",
  clients: "Clientes",
  agenda: "Agenda da equipe",
  dashboard: "Indicadores",
  catalog: "Serviços",
  team: "Profissionais",
  settings: "Dados e privacidade",
};
$("#adminViews").innerHTML = Object.keys(VIEWS)
  .filter((k) => !["home", "bookings"].includes(k))
  .map(
    (k) =>
      `<section id="${k}" class="hidden" aria-label="${VIEWS[k]}"></section>`,
  )
  .join("");
$("#feedback").tabIndex = -1;
const ctx = {
  repo: repository,
  state: null,
  view: "home",
  client(id) {
    return (
      this.state.clients.find((c) => c.id === id) || {
        name: "Cliente indisponível",
        phone: "",
        tags: [],
      }
    );
  },
  service(id) {
    return (
      this.state.services.find((s) => s.id === id) || {
        name: id ? "Serviço indisponível" : "—",
      }
    );
  },
  barber(id) {
    return (
      this.state.barbers.find((b) => b.id === id) || {
        name: id ? "Profissional indisponível" : "—",
      }
    );
  },
  refreshState() {
    this.state = this.repo.getState();
  },
  async write(action) {
    const result = await withWriteLock(action);
    this.refreshState();
    render();
    return result;
  },
  showView(view) {
    if (!VIEWS[view]) return;
    this.view = view;
    for (const key of Object.keys(VIEWS))
      $("#" + key).classList.toggle("hidden", key !== view);
    $$("nav button").forEach((b) => {
      const active = b.dataset.view === view;
      b.classList.toggle("active", active);
      if (active) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    $("#breadcrumb").textContent = VIEWS[view];
    window.scrollTo(0, 0);
    if (view === "agenda") this.renderAgenda();
    if (view === "dashboard") this.renderDashboard();
  },
};
setupBookings(ctx);
setupClients(ctx);
setupCatalog(ctx);
setupAdmin(ctx);
function renderHome() {
  $("#today").textContent = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  $("#services").innerHTML =
    ctx.state.services
      .filter((s) => s.active)
      .sort((a, b) => a.order - b.order)
      .map(
        (s, i) =>
          `<article class="service"><div class="icon" aria-hidden="true">${s.comboIds.length ? "✧" : "✂"}</div><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><div class="servicefooter"><span class="price">${money(effectivePrice(s))} <small>◷ ${s.duration} min</small></span><button class="plus" data-action="service-booking" data-id="${s.id}" aria-label="Agendar ${esc(s.name)}">↗</button></div></article>`,
      )
      .join("") ||
    empty("Nenhum serviço ativo.", "Cadastre ou ative um serviço na gestão.");
  $("#homeBarbers").innerHTML =
    ctx.state.barbers
      .filter((b) => b.active)
      .map(
        (b) =>
          `<button class="barber" data-action="barber-booking" data-id="${b.id}"><span class="avatar" aria-hidden="true">${esc(b.name.slice(0, 2).toUpperCase())}</span><span><strong>${esc(b.name)}</strong><small>${esc(b.specialties)}</small><small>Ver horários disponíveis ↗</small></span></button>`,
      )
      .join("") || empty("Nenhum profissional ativo.");
  const next = ctx.state.bookings
    .filter(
      (b) =>
        ["confirmed", "waiting"].includes(b.status) &&
        timestamp(b.date, b.time) > Date.now(),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  $("#nextVisit").innerHTML = next
    ? `<div class="visit"><div><strong>${esc(ctx.service(next.serviceId).name)}</strong>${dateLabel(next)} · ${esc(ctx.barber(next.barberId).name)}<br>${esc(ctx.client(next.clientId).name)} · ${esc(next.code)}</div><button class="textbtn" data-action="booking-details" data-id="${next.id}">Detalhes</button></div>`
    : `<div class="visit"><div><strong>Sua cadeira está te esperando.</strong>Agende um momento só seu.</div><button class="textbtn" data-action="new-booking">Agendar ↗</button></div>`;
}
function renderSettings() {
  $("#settings").innerHTML =
    `<div class="intro"><div><h1>Seus dados, com clareza.</h1><p>Privacidade e ferramentas para o modo local.</p></div></div><article class="appointment"><h2>Modo demonstração</h2><p>Os dados ficam no armazenamento deste navegador e origem. Não existe login próprio, sincronização, cobrança, envio automático ou reserva em um servidor. Não use este modo como única fonte de dados de uma operação real.</p><p>Fuso dos agendamentos: America/Sao_Paulo (Brasília). Valores armazenados em centavos inteiros.</p><div class="actions"><button class="secondary" data-action="export-data">Exportar backup JSON</button><button class="secondary" data-action="restore-backup">Restaurar backup anterior</button><button class="secondary" data-action="demo-data">Restaurar demonstração</button><button class="cancel" data-action="clear-data">Limpar dados locais</button></div><p class="note">Limpar e restaurar demonstração substituem os dados atuais. Uma cópia anterior fica guardada para recuperação. Use “Apagar tudo definitivamente” para remover inclusive backups.</p><button class="cancel" data-action="erase-all">Apagar tudo definitivamente</button></article><article class="appointment"><h2>Privacidade e consentimento</h2><p>Nome, telefone, e-mail e nascimento são usados para identificar clientes e organizar atendimentos. Observações e preferências são opcionais: evite registrar dados sensíveis. A marcação de consentimento é manual e não substitui a comprovação exigida para uma operação real.</p><p>WhatsApp: os botões abrem uma conversa com dados da reserva apenas após consentimento. Você revisa o texto e decide enviar. Ao abrir, dados de telefone e texto são compartilhados com o WhatsApp conforme a política desse serviço.</p><p>Não há rastreamento de marketing. A fonte Google Fonts e a imagem Unsplash fazem requisições externas; funcionam com fontes locais e fundo de cor quando indisponíveis.</p><p>Cliente sem reservas pode ser excluído. Quando há reservas, o cadastro é arquivado para preservar histórico e referências; ele não aparece em novas reservas. Arquivamento não equivale à exclusão de dados pessoais. Para apagar todos os registros locais, use a exclusão definitiva acima.</p><p>Antes de uso em produção, a barbearia deve informar responsável, contato de privacidade, finalidade, bases legais e prazos de retenção, além de implementar controle de acesso no backend.</p></article>${ctx.state.migrationNotes?.length ? `<article class="appointment"><h2>Revisão da migração</h2>${ctx.state.migrationNotes.map((n) => `<p>${esc(n)}</p>`).join("")}</article>` : ""}`;
}
function render() {
  renderHome();
  ctx.renderBookingFilters();
  ctx.renderBookings();
  ctx.renderClients();
  ctx.renderCatalog();
  ctx.renderTeam();
  ctx.renderAgendaOptions();
  ctx.renderAgenda();
  ctx.renderDashboard();
  renderSettings();
  $("#storageError").classList.add("hidden");
}
function storageFailure(error) {
  const el = $("#storageError");
  el.classList.remove("hidden");
  el.innerHTML = `<strong>${esc(error.message)}</strong><p>Não continue editando antes de resolver o armazenamento. Exporte os dados para recuperação.</p><div class="actions"><button class="secondary" data-action="export-data">Exportar dados brutos</button><button class="secondary" data-action="restore-backup">Restaurar backup anterior</button><button class="cancel" data-action="clear-data">Limpar e reiniciar</button></div>`;
}
function downloadData() {
  const raw = ctx.repo.adapter.exportRaw();
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), data: raw },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `brava-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  notify(
    "Backup exportado. Ele contém dados pessoais; guarde em local protegido.",
  );
}
async function resetData(demo = false, erase = false) {
  confirmAction({
    title: erase
      ? "Apagar todos os dados?"
      : demo
        ? "Restaurar demonstração?"
        : "Limpar dados locais?",
    message: erase
      ? "Remove clientes, reservas, serviços, profissionais e todos os backups deste app neste navegador. Esta ação não pode ser desfeita."
      : "Os dados atuais serão substituídos. Exporte um backup antes de continuar. O backup anterior local será substituído pela cópia atual.",
    label: erase ? "Apagar definitivamente" : "Substituir dados",
    onConfirm: async () => {
      await withWriteLock(() => {
        if (erase) ctx.repo.adapter.eraseAll();
        else ctx.repo.adapter.reset(demo ? seedDemo() : emptyState());
      });
      ctx.refreshState();
      render();
      $("#editor").close();
      notify(
        demo
          ? "Demonstração restaurada com contatos fictícios."
          : "Dados locais removidos.",
      );
    },
  });
}
function seedDemo() {
  // Entire seed is one write; no real contact, email or phone is used.
  const s = emptyState();
  {
    const now = new Date().toISOString(),
      id = uid();
    s.clients.push({
      id,
      name: "Cliente Exemplo (fictício)",
      phone: "",
      email: "",
      birthday: "",
      notes:
        "Contato fictício de demonstração. Cadastre um telefone para testar mensagens.",
      preferences: "Corte clássico",
      consent: false,
      tags: ["Demo"],
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
    const service = s.services[0],
      barber = s.barbers[0];
    const bookingId = uid();
    s.bookings.push({
      id: bookingId,
      code: "BR-" + bookingId.slice(0, 8).toUpperCase(),
      clientId: id,
      serviceId: service.id,
      barberId: barber.id,
      date: addDays(today(), -1),
      time: "09:00",
      status: "completed",
      priceCents: service.priceCents,
      duration: service.duration,
      buffer: service.buffer,
      commissionPercent: barber.commissionPercent,
      notes: "Atendimento fictício para explorar o histórico e os indicadores.",
      cancellationReason: "",
      createdAt: now,
      updatedAt: now,
    });
  }
  return s;
}
const actions = {
  "new-booking": () => ctx.openBooking(),
  "service-booking": (d) => ctx.openBooking({ serviceId: d.id }),
  "barber-booking": (d) => ctx.openBooking({ barberId: d.id }),
  "client-booking": (d) => ctx.openBooking({ clientId: d.id }),
  "edit-booking": (d) => ctx.openBooking({ id: d.id }),
  "booking-details": (d) => ctx.bookingDetails(d.id),
  "cancel-booking": (d) => ctx.cancelBooking(d.id),
  "booking-status": (d) => ctx.bookingStatus(d.id, d.status),
  message: (d) => ctx.openMessage(d.id, d.type),
  "new-client": () => ctx.openClient(),
  "edit-client": (d) => ctx.openClient(d.id),
  "delete-client": (d) => ctx.deleteClient(d.id),
  "client-history": (d) => ctx.clientHistory(d.id),
  "copy-phone": (d) => ctx.copyPhone(d.id),
  "client-whatsapp": (d) => ctx.clientWhatsApp(d.id),
  "client-return": (d) => ctx.clientWhatsApp(d.id, true),
  "new-service": () => ctx.openService(),
  "edit-service": (d) => ctx.openService(d.id),
  "new-barber": () => ctx.openBarber(),
  "edit-barber": (d) => ctx.openBarber(d.id),
  "barber-agenda": (d) => ctx.selectBarberAgenda(d.id),
  "block-time": (d) => ctx.openBlock(d.id),
  "remove-block": (d) =>
    confirmAction({
      title: "Remover bloqueio?",
      message: "O intervalo voltará a ficar disponível se não houver reservas.",
      label: "Remover",
      onConfirm: async () => {
        await ctx.write(() => ctx.repo.removeBlock(d.id, d.block));
        notify("Bloqueio removido.");
      },
    }),
  "quick-booking": (d) =>
    ctx.openBooking({
      serviceId: d.service,
      barberId: d.barber,
      date: d.date,
      time: d.time,
    }),
  "export-data": downloadData,
  "clear-data": () => resetData(),
  "demo-data": () => resetData(true),
  "erase-all": () => resetData(false, true),
  "restore-backup": () =>
    confirmAction({
      title: "Restaurar backup anterior?",
      message:
        "A cópia local anterior substituirá os dados atuais. Exporte os dados atuais antes de continuar.",
      label: "Restaurar",
      onConfirm: async () => {
        await withWriteLock(() => ctx.repo.adapter.restoreBackup());
        ctx.refreshState();
        render();
        notify("Backup anterior restaurado.");
      },
    }),
};
document.addEventListener("click", async (event) => {
  const nav = event.target.closest("[data-view]");
  if (nav && ctx.state) ctx.showView(nav.dataset.view);
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  try {
    await actions[button.dataset.action]?.(button.dataset);
  } catch (error) {
    showError(error);
    if (error.name === "StorageError") storageFailure(error);
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    try {
      ctx.refreshState();
      render();
      notify(
        "Dados atualizados por outra aba. Reabra formulários antes de salvar.",
      );
    } catch (e) {
      storageFailure(e);
    }
  }
});
for (const img of $$("img")) {
  if (img.complete && !img.naturalWidth) img.hidden = true;
  img.addEventListener("error", () => {
    img.hidden = true;
  });
}
try {
  ctx.refreshState();
  render();
  ctx.showView("home");
  if (ctx.state.migrationNotes?.length)
    notify(
      "Dados antigos migrados. Consulte Dados e privacidade para revisar os vínculos recuperados.",
    );
} catch (error) {
  storageFailure(error);
}
