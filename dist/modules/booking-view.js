import { STATUSES, ACTIVE_STATUSES } from "./config.js";
import { availableSlots } from "./bookings.js";
import {
  today,
  uid,
  timestamp,
  formatDate,
  dateLabel,
  effectivePrice,
  formatPhone,
} from "./utils.js";
import {
  $,
  $$,
  esc,
  money,
  option,
  input,
  select,
  textarea,
  check,
  empty,
  notify,
  openEditor,
  formShell,
  bindSubmit,
  value,
  checked,
  confirmAction,
  statusBadge,
} from "./ui.js";
import * as messages from "./messages.js";
export function setupBookings(ctx) {
  const filters = {
    search: "",
    status: "",
    barberId: "",
    serviceId: "",
    from: "",
    to: "",
  };
  ctx.renderBookingFilters = () => {
    $("#bookingFilters").innerHTML =
      `<div class="filters">${input("bookingSearch", "Buscar nome ou telefone", filters.search, 'type="search"')}${select(
        "bookingStatus",
        "Status",
        option("", "Todos") +
          Object.entries(STATUSES)
            .map(([k, v]) => option(k, v, filters.status === k))
            .join(""),
      )}${select("bookingBarber", "Profissional", option("", "Todos") + ctx.state.barbers.map((b) => option(b.id, b.name, filters.barberId === b.id)).join(""))}${input("bookingFrom", "De", filters.from, 'type="date"')}${input("bookingTo", "Até", filters.to, 'type="date"')}</div>`;
    for (const [id, key] of [
      ["bookingSearch", "search"],
      ["bookingStatus", "status"],
      ["bookingBarber", "barberId"],
      ["bookingFrom", "from"],
      ["bookingTo", "to"],
    ])
      $("#" + id).addEventListener("input", () => {
        filters[key] = value(id);
        ctx.renderBookings();
      });
  };
  ctx.filteredBookings = (items = ctx.state.bookings, f = filters) =>
    items
      .filter((b) => {
        const client = ctx.client(b.clientId),
          q = (f.search || "").toLowerCase(),
          digits = q.replace(/\D/g, "");
        return (
          (!q ||
            client.name.toLowerCase().includes(q) ||
            (digits.length > 2 && client.phone.includes(digits))) &&
          (!f.status || b.status === f.status) &&
          (!f.barberId || b.barberId === f.barberId) &&
          (!f.serviceId || b.serviceId === f.serviceId) &&
          (!f.from || b.date >= f.from) &&
          (!f.to || b.date <= f.to)
        );
      })
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  ctx.bookingCard = (b) =>
    `<article class="appointment bookingCard ${b.date === today() ? "is-today" : ""}"><div><div class="actions">${statusBadge(b.status, STATUSES)}<small>${esc(b.code)}${b.date === today() ? " · Hoje" : ""}${ACTIVE_STATUSES.includes(b.status) && timestamp(b.date, b.time) < Date.now() ? " · Atrasado / verificar" : ""}</small></div><h3>${esc(ctx.service(b.serviceId).name)} · ${money(b.priceCents)}</h3><p>${esc(ctx.client(b.clientId).name)} · ${esc(formatPhone(ctx.client(b.clientId).phone))}</p><p>${dateLabel(b)} · ${esc(ctx.barber(b.barberId).name)} · ${b.duration} min</p>${b.status === "cancelled" ? `<p>Motivo: ${esc(b.cancellationReason)}</p>` : ""}</div><div class="actions"><button class="secondary" data-action="booking-details" data-id="${b.id}">Detalhes</button><button class="textbtn" data-action="edit-booking" data-id="${b.id}">Editar / remarcar</button>${ACTIVE_STATUSES.includes(b.status) ? `<button class="cancel" data-action="cancel-booking" data-id="${b.id}">Cancelar</button>` : ""}</div></article>`;
  ctx.renderBookings = () => {
    const bookings = ctx.filteredBookings();
    $("#bookingList").innerHTML = bookings.length
      ? bookings.map(ctx.bookingCard).join("")
      : empty(
          "Nenhuma reserva neste filtro.",
          "Crie um novo agendamento ou ajuste os filtros.",
        );
  };
  ctx.openBooking = ({
    id,
    serviceId,
    barberId,
    clientId,
    date,
    time,
  } = {}) => {
    ctx.refreshState();
    const b = ctx.state.bookings.find((b) => b.id === id);
    let selectedTime = time || b?.time || "";
    const services = ctx.state.services.filter(
        (s) => s.active || s.id === b?.serviceId,
      ),
      barbers = ctx.state.barbers.filter(
        (s) => s.active || s.id === b?.barberId,
      ),
      clients = ctx.state.clients.filter(
        (c) => !c.archived || c.id === b?.clientId,
      );
    if (!services.length || !barbers.length) {
      notify(
        "Cadastre pelo menos um serviço e um profissional ativo para agendar.",
        true,
      );
      return;
    }
    const dialog = openEditor(
      b ? "Editar e remarcar" : "Reserve seu momento",
      formShell(
        `<p>Escolha o serviço, confira o horário e confirme seus dados.</p><div class="row">${select("serviceId", "1. Serviço *", services.map((s) => option(s.id, `${s.name} · ${money(effectivePrice(s))} · ${s.duration} min`, s.id === (serviceId || b?.serviceId))).join(""))}${select("barberId", "2. Profissional *", barbers.map((x) => option(x.id, x.name, x.id === (barberId || b?.barberId))).join(""))}</div>${input("bookingDate", "3. Data * · Brasília", date || b?.date || today(), 'type="date" required')}<fieldset><legend>4. Horários disponíveis</legend><div class="slots" id="bookingSlots"></div><p id="slotNote" class="note" aria-live="polite"></p></fieldset>${select("clientId", "5. Cliente *", option("new", "Cadastrar cliente agora", !clients.length) + clients.map((c) => option(c.id, `${c.name} · ${formatPhone(c.phone)}`, c.id === (clientId || b?.clientId))).join(""))}<div id="inlineClient">${input("newName", "Nome completo *", "", 'maxlength="100" autocomplete="name"')}${input("newPhone", "Telefone com DDD *", "", 'type="tel" maxlength="22" autocomplete="tel"')}${check("newConsent", "Cliente autoriza mensagens de atendimento por WhatsApp")}</div><div class="row">${select(
          "bookingEditStatus",
          "Status",
          Object.entries(STATUSES)
            .map(([k, v]) => option(k, v, k === (b?.status || "confirmed")))
            .join(""),
        )}${input("cancelReason", "Motivo (obrigatório se cancelado)", b?.cancellationReason || "", 'maxlength="500"')}</div>${textarea("bookingNotes", "Observação interna", b?.notes || "")}<div id="bookingSummary" class="summary" aria-live="polite"></div><p class="note">Revise os dados antes de confirmar. Chegue 5 minutos antes. Não há confirmação ou mensagem enviada à barbearia.</p>`,
        b ? "Salvar alterações" : "Confirmar agendamento",
      ),
    );
    if (clientId || b?.clientId) $("#clientId").value = clientId || b.clientId;
    else $("#clientId").value = "new";
    function updateSummary() {
      const service = ctx.service(value("serviceId")),
        isNew = value("clientId") === "new";
      $("#inlineClient").hidden = !isNew;
      $("#newName").required = isNew;
      $("#newPhone").required = isNew;
      const clientName = isNew
        ? value("newName")
        : ctx.client(value("clientId")).name;
      const price =
        b && b.serviceId === service.id
          ? b.priceCents
          : effectivePrice(service);
      $("#bookingSummary").innerHTML =
        `<strong>Resumo da reserva</strong><p>${esc(service.name)} · ${money(price)} · ${b && b.serviceId === service.id ? b.duration : service.duration} min</p><p>${esc(clientName || "Informe o cliente")} · ${esc(ctx.barber(value("barberId")).name)}</p><p>${formatDate(value("bookingDate"))} · ${esc(selectedTime || "Selecione um horário")} · Brasília</p>`;
      $("#cancelReason").required = value("bookingEditStatus") === "cancelled";
      const ready =
        !!selectedTime &&
        !!clientName &&
        (!isNew || value("newPhone").replace(/\D/g, "").length >= 10);
      $("#editorForm").dataset.ready = String(ready);
      $("#saveButton").disabled = !ready || !$("#editorForm").checkValidity();
    }
    function updateSlots() {
      ctx.refreshState();
      const slots = availableSlots(ctx.state, {
        serviceId: value("serviceId"),
        barberId: value("barberId"),
        date: value("bookingDate"),
        excludeId: b?.id,
      });
      const originalUnchanged =
        b &&
        value("serviceId") === b.serviceId &&
        value("barberId") === b.barberId &&
        value("bookingDate") === b.date;
      if (originalUnchanged && !slots.includes(b.time)) slots.push(b.time);
      slots.sort();
      if (!slots.includes(selectedTime)) selectedTime = "";
      $("#bookingSlots").innerHTML = slots
        .map(
          (t) =>
            `<button class="slot ${t === selectedTime ? "selected" : ""}" type="button" aria-pressed="${t === selectedTime}" data-time="${t}">${t}${originalUnchanged && t === b.time ? " · atual" : ""}</button>`,
        )
        .join("");
      $("#slotNote").textContent = slots.length
        ? "Escolha um horário. Duração, almoço, bloqueios e reservas são considerados."
        : "Sem disponibilidade nesta data. Confira folgas, férias ou escolha outro dia/profissional.";
      $$(".slot", dialog).forEach(
        (button) =>
          (button.onclick = () => {
            selectedTime = button.dataset.time;
            $$(".slot", dialog).forEach((x) => {
              x.classList.toggle("selected", x === button);
              x.setAttribute("aria-pressed", x === button);
            });
            updateSummary();
          }),
      );
      updateSummary();
    }
    for (const id of ["serviceId", "barberId", "bookingDate"])
      $("#" + id).onchange = () => {
        selectedTime = "";
        updateSlots();
      };
    $("#editorForm").addEventListener("input", updateSummary);
    bindSubmit(async () => {
      if (!selectedTime) throw new Error("Selecione um horário disponível.");
      const payload = {
        clientId: value("clientId"),
        serviceId: value("serviceId"),
        barberId: value("barberId"),
        date: value("bookingDate"),
        time: selectedTime,
        status: value("bookingEditStatus"),
        notes: value("bookingNotes"),
        cancellationReason: value("cancelReason"),
      };
      if (payload.clientId === "new")
        payload.newClient = {
          name: value("newName"),
          phone: value("newPhone"),
          email: "",
          consent: checked("newConsent"),
        };
      const saved = await ctx.write(() =>
        b
          ? ctx.repo.updateBooking(b.id, payload, b.updatedAt)
          : ctx.repo.createBooking(payload),
      );
      dialog.close();
      ctx.showView("bookings");
      notify(
        `${b ? "Reserva atualizada" : "Reserva criada"}: ${saved.code}. Salva neste navegador.`,
      );
      ctx.bookingDetails(saved.id);
    });
    updateSlots();
  };
  ctx.cancelBooking = (id) => {
    const b = ctx.state.bookings.find((b) => b.id === id);
    confirmAction({
      title: "Cancelar reserva?",
      message: `${b.code} · ${ctx.client(b.clientId).name}. O histórico será preservado.`,
      reason: true,
      label: "Cancelar reserva",
      onConfirm: async (reason) => {
        await ctx.write(() => ctx.repo.cancelBooking(id, reason, b.updatedAt));
        $("#editor").close();
        notify(
          `Reserva ${b.code} cancelada. Use Detalhes para desfazer, se o horário ainda estiver livre e no futuro.`,
        );
      },
    });
  };
  ctx.bookingDetails = (id) => {
    const b = ctx.state.bookings.find((b) => b.id === id);
    if (!b) return;
    const c = ctx.client(b.clientId),
      s = ctx.service(b.serviceId),
      barber = ctx.barber(b.barberId);
    openEditor(
      "Detalhes da reserva",
      `<div class="actions">${statusBadge(b.status, STATUSES)}<strong>${esc(b.code)}</strong></div><h3>${esc(c.name)}</h3><p>${esc(formatPhone(c.phone))}</p><div class="summary"><strong>${esc(s.name)} · ${money(b.priceCents)}</strong><p>${dateLabel(b)} · Brasília</p><p>${esc(barber.name)} · ${b.duration} min + ${b.buffer} min de intervalo</p></div><p>Observação interna: ${esc(b.notes || "Nenhuma")}</p>${b.cancellationReason ? `<p>Cancelamento: ${esc(b.cancellationReason)}</p>` : ""}<p class="note">Criado: ${esc(new Date(b.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))}<br>Atualizado: ${esc(new Date(b.updatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))}</p><div class="actions"><button class="primary" data-action="edit-booking" data-id="${id}">Editar / remarcar</button>${b.status === "waiting" ? `<button class="secondary" data-action="booking-status" data-status="confirmed" data-id="${id}">Confirmar</button>` : ""}${ACTIVE_STATUSES.includes(b.status) ? `<button class="secondary" data-action="booking-status" data-status="completed" data-id="${id}">Concluir</button><button class="secondary" data-action="booking-status" data-status="no_show" data-id="${id}">Marcar falta</button><button class="cancel" data-action="cancel-booking" data-id="${id}">Cancelar</button>` : ""}${b.status === "cancelled" ? `<button class="secondary" data-action="booking-status" data-status="confirmed" data-id="${id}">Desfazer cancelamento</button>` : ""}</div><hr><h3>WhatsApp</h3><p class="note">Abre uma conversa com texto pronto. Você revisa e envia no WhatsApp. Não há lembretes automáticos.</p><div class="actions">${[
        ["confirmation", "Confirmação"],
        ["reminder", "Lembrete"],
        ["reschedule", "Reagendamento"],
        ["cancellation", "Cancelamento"],
        ["review", "Pós-atendimento / avaliação"],
      ]
        .map(
          ([type, label]) =>
            `<button class="secondary" data-action="message" data-id="${id}" data-type="${type}">${label}</button>`,
        )
        .join("")}</div>`,
    );
  };
  ctx.openMessage = (id, type) => {
    const b = ctx.state.bookings.find((b) => b.id === id),
      c = ctx.client(b.clientId),
      s = ctx.service(b.serviceId),
      barber = ctx.barber(b.barberId);
    const generators = {
      confirmation: messages.generateBookingConfirmationMessage,
      reminder: messages.generateReminderMessage,
      cancellation: messages.generateCancellationMessage,
      reschedule: messages.generateRescheduleMessage,
      review: messages.generateReviewMessage,
    };
    if (type === "confirmation" && b.status !== "confirmed")
      throw new Error("Confirme a reserva antes de gerar a confirmação.");
    if (type === "cancellation" && b.status !== "cancelled")
      throw new Error(
        "A reserva precisa estar cancelada para gerar esse aviso.",
      );
    const url = messages.whatsappLink(c, generators[type](b, c, s, barber));
    window.open(url, "_blank", "noopener,noreferrer");
  };
  ctx.bookingStatus = async (id, status) => {
    const b = ctx.state.bookings.find((b) => b.id === id);
    await ctx.write(() => ctx.repo.updateBooking(id, { status }, b.updatedAt));
    ctx.bookingDetails(id);
    notify(`Reserva ${b.code}: ${STATUSES[status]}.`);
  };
}
