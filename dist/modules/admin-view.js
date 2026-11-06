import { STATUSES, ACTIVE_STATUSES } from "./config.js";
import { availableSlots, occupiedMinutes } from "./bookings.js";
import { clientStats } from "./clients.js";
import { today, addDays, weekday, formatDate, timestamp } from "./utils.js";
import { $, esc, money, input, select, option, empty, metric } from "./ui.js";
export function setupAdmin(ctx) {
  const agenda = {
    date: today(),
    mode: "day",
    barberId: "",
    status: "",
    serviceId: "",
  };
  $("#agenda").innerHTML =
    `<div class="intro"><div><h1>A agenda no seu ritmo.</h1><p>Reservas da equipe, disponibilidade e bloqueios.</p></div><div class="actions"><button class="secondary" data-action="block-time">Bloquear horário</button><button class="primary" data-action="new-booking">Agendar +</button></div></div><div class="filters">${input("agendaDate", "Data de referência", agenda.date, 'type="date" required')}${select("agendaMode", "Visualização", option("day", "Dia") + option("week", "Semana") + option("month", "Mês"))}${select("agendaBarber", "Profissional", "")}${select(
      "agendaStatus",
      "Status",
      option("", "Todos") +
        Object.entries(STATUSES)
          .map(([k, v]) => option(k, v))
          .join(""),
    )}${select("agendaService", "Serviço", "")}</div><div id="agendaContent"></div>`;
  for (const [id, key] of [
    ["agendaDate", "date"],
    ["agendaMode", "mode"],
    ["agendaBarber", "barberId"],
    ["agendaStatus", "status"],
    ["agendaService", "serviceId"],
  ])
    $("#" + id).onchange = () => {
      agenda[key] = $("#" + id).value;
      ctx.renderAgenda();
    };
  ctx.selectBarberAgenda = (id) => {
    agenda.barberId = id;
    $("#agendaBarber").value = id;
    ctx.showView("agenda");
  };
  ctx.renderAgendaOptions = () => {
    $("#agendaBarber").innerHTML =
      option("", "Todos") +
      ctx.state.barbers
        .map((b) => option(b.id, b.name, agenda.barberId === b.id))
        .join("");
    $("#agendaService").innerHTML =
      option("", "Todos") +
      ctx.state.services
        .map((s) => option(s.id, s.name, agenda.serviceId === s.id))
        .join("");
  };
  ctx.renderAgenda = () => {
    if (!agenda.date) {
      $("#agendaContent").innerHTML = empty("Escolha uma data.");
      return;
    }
    let start = agenda.date,
      end = start;
    if (agenda.mode === "week") {
      start = addDays(start, -(weekday(start) + 6) % 7);
      end = addDays(start, 6);
    }
    if (agenda.mode === "month") {
      start = agenda.date.slice(0, 7) + "-01";
      const d = new Date(`${start}T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + 1);
      end = addDays(d.toISOString().slice(0, 10), -1);
    }
    const days = [];
    for (let date = start; date <= end; date = addDays(date, 1))
      days.push(date);
    const bookings = ctx.filteredBookings(ctx.state.bookings, {
      ...agenda,
      from: start,
      to: end,
    });
    let occupied = 0,
      capacity = 0;
    for (const date of days)
      for (const barber of ctx.state.barbers.filter(
        (b) => b.active && (!agenda.barberId || b.id === agenda.barberId),
      )) {
        const stats = occupiedMinutes(ctx.state, barber, date);
        occupied += stats.occupied;
        capacity += stats.capacity;
      }
    const summary = `<div class="metrics">${metric("Reservas no filtro", bookings.length)}${metric("Ocupação do expediente", capacity ? Math.round((100 * occupied) / capacity) + "%" : "—", "Inclui bloqueios e todas as reservas que ocupam horário")}${metric("Período", formatDate(start) + (end === start ? "" : " — " + formatDate(end)))}</div>`;
    const groups = days
      .map((date) => {
        const items = bookings.filter((b) => b.date === date);
        return `<section class="agenda-day"><h3>${formatDate(date)}${date === today() ? " · Hoje" : ""}</h3>${items.length ? items.map(ctx.bookingCard).join("") : '<p class="note">Sem reservas neste filtro.</p>'}${
          agenda.mode === "day"
            ? ctx.state.barbers
                .filter((b) => !agenda.barberId || b.id === agenda.barberId)
                .flatMap((b) =>
                  b.blocks
                    .filter((x) => x.date === date)
                    .map(
                      (x) =>
                        `<div class="notice">Bloqueado · ${esc(b.name)} · ${x.start}–${x.end} · ${esc(x.reason || "Sem motivo informado")}</div>`,
                    ),
                )
                .join("")
            : ""
        }</section>`;
      })
      .join("");
    const serviceId =
      agenda.serviceId || ctx.state.services.find((s) => s.active)?.id;
    const free =
      agenda.mode === "day" && serviceId
        ? `<div class="appointment"><h3>Horários livres · ${esc(ctx.service(serviceId).name)}</h3><p class="note">Disponibilidade com duração e intervalo do serviço escolhido. Clique para agendar.</p>${ctx.state.barbers
            .filter(
              (b) => b.active && (!agenda.barberId || b.id === agenda.barberId),
            )
            .map((b) => {
              const slots = availableSlots(ctx.state, {
                barberId: b.id,
                serviceId,
                date: agenda.date,
              });
              return `<h4>${esc(b.name)}</h4><div class="slots">${slots.length ? slots.map((t) => `<button class="slot" data-action="quick-booking" data-barber="${b.id}" data-service="${serviceId}" data-date="${agenda.date}" data-time="${t}">${t}</button>`).join("") : "<p>Sem disponibilidade. Escolha outra data ou profissional.</p>"}</div>`;
            })
            .join("")}</div>`
        : "";
    $("#agendaContent").innerHTML =
      summary + `<div class="agenda-${agenda.mode}">${groups}</div>` + free;
  };
  ctx.renderDashboard = () => {
    const state = ctx.state,
      date = today(),
      bookings = state.bookings.filter((b) => b.date === date),
      completed = bookings.filter((b) => b.status === "completed");
    const total = completed.reduce((sum, b) => sum + b.priceCents, 0),
      predicted = bookings
        .filter((b) => ["waiting", "confirmed", "completed"].includes(b.status))
        .reduce((sum, b) => sum + b.priceCents, 0);
    const occupancies = state.barbers
        .filter((b) => b.active)
        .map((b) => occupiedMinutes(state, b, date)),
      capacity = occupancies.reduce((n, s) => n + s.capacity, 0),
      occupied = occupancies.reduce((n, s) => n + s.occupied, 0);
    const allCompleted = state.bookings.filter((b) => b.status === "completed");
    const ranking = (key) => {
      const counts = new Map();
      allCompleted.forEach((b) =>
        counts.set(b[key], (counts.get(b[key]) || 0) + 1),
      );
      return [...counts].sort((a, b) => b[1] - a[1]);
    };
    const inactive = [30, 60, 90].map((days) => ({
      days,
      clients: state.clients.filter((c) => {
        const last = clientStats(state, c.id).last;
        if (!last || c.archived) return false;
        const ago = Math.floor(
          (Date.parse(date + "T12:00Z") - Date.parse(last.date + "T12:00Z")) /
            86400000,
        );
        return ago >= days && (days === 90 || ago < days + 30);
      }),
    }));
    const upcoming = ctx
      .filteredBookings(state.bookings, {})
      .filter(
        (b) =>
          ACTIVE_STATUSES.includes(b.status) &&
          timestamp(b.date, b.time) >= Date.now(),
      )
      .slice(0, 5);
    $("#dashboard").innerHTML =
      `<div class="intro"><div><h1>A barbearia em perspectiva.</h1><p>Hoje, ${formatDate(date)} · Dados locais de demonstração.</p></div></div><div class="metrics">${metric("Agendamentos hoje", bookings.length)}${metric("Faturamento previsto", money(predicted), "Aguardando + confirmados + concluídos")}${metric("Receita concluída hoje", money(total))}${metric("Concluídos", completed.length)}${metric("Cancelamentos", bookings.filter((b) => b.status === "cancelled").length)}${metric("Faltas", bookings.filter((b) => b.status === "no_show").length)}${metric("Novos clientes hoje", state.clients.filter((c) => c.createdAt && today(new Date(c.createdAt)) === date).length)}${metric("Ocupação", capacity ? Math.round((100 * occupied) / capacity) + "%" : "—", "Expediente ocupado ou bloqueado")}${metric("Ticket médio concluído", money(completed.length ? Math.round(total / completed.length) : 0))}</div><div class="lower"><article class="appointment"><h2>Serviços mais utilizados</h2><p class="note">Todo o histórico concluído</p>${
        ranking("serviceId")
          .slice(0, 5)
          .map(
            ([id, n]) =>
              `<p>${esc(ctx.service(id).name)} <strong>${n} atendimento(s)</strong></p>`,
          )
          .join("") || "<p>Ainda sem atendimentos concluídos.</p>"
      }<h3>Profissional com mais atendimentos</h3><p>${ranking("barberId").length ? esc(ctx.barber(ranking("barberId")[0][0]).name) + " · " + ranking("barberId")[0][1] + " concluídos" : "Ainda sem dados."}</p></article><article class="appointment"><h2>Comissões estimadas</h2><p class="note">Somente concluídos de hoje; percentual registrado em cada reserva. Não registra pagamento.</p>${state.barbers.map((barber) => `<p>${esc(barber.name)} · <strong>${money(completed.filter((b) => b.barberId === barber.id).reduce((n, b) => n + Math.round((b.priceCents * (b.commissionPercent ?? 0)) / 100), 0))}</strong></p>`).join("")}</article></div><div class="sectionhead"><h2>Próximos atendimentos</h2></div>${upcoming.length ? upcoming.map(ctx.bookingCard).join("") : empty("Sem próximos atendimentos.")}<div class="sectionhead"><h2>Clientes que não retornaram</h2></div><p class="note">Faixas exclusivas: 30–59, 60–89 e 90+ dias desde a última visita concluída.</p><div class="cards">${inactive
        .map(
          (group) =>
            `<article class="appointment"><h3>${group.days === 90 ? "90+" : group.days + "–" + (group.days + 29)} dias · ${group.clients.length}</h3>${
              group.clients
                .slice(0, 10)
                .map(
                  (c) =>
                    `<p><button class="textbtn" data-action="client-history" data-id="${c.id}">${esc(c.name)}</button></p>`,
                )
                .join("") || "<p>Nenhum cliente nesta faixa.</p>"
            }</article>`,
        )
        .join("")}</div>`;
  };
}
