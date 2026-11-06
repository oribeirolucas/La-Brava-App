import { clientStats } from "./clients.js";
import { today, formatDate, formatPhone, dateLabel } from "./utils.js";
import {
  $,
  esc,
  money,
  input,
  textarea,
  check,
  empty,
  openEditor,
  formShell,
  bindSubmit,
  value,
  checked,
  notify,
  confirmAction,
  metric,
} from "./ui.js";
import { whatsappLink, generateFollowUpMessage } from "./messages.js";
export function setupClients(ctx) {
  $("#clients").innerHTML =
    `<div class="intro"><div><h1>Seus clientes, por perto.</h1><p>Contatos, preferências e histórico em um só lugar.</p></div><button class="primary" data-action="new-client">Cadastrar pessoa +</button></div><div class="filters">${input("clientSearch", "Buscar nome, telefone ou e-mail", "", 'type="search"')}${check("showArchived", "Mostrar arquivados")}</div><p class="note" id="clientCount"></p><div id="clientList"></div>`;
  $("#clientSearch").oninput = () => ctx.renderClients();
  $("#showArchived").onchange = () => ctx.renderClients();
  ctx.renderClients = () => {
    const q = value("clientSearch").toLowerCase(),
      digits = q.replace(/\D/g, "");
    const clients = ctx.state.clients
      .filter(
        (c) =>
          (checked("showArchived") || !c.archived) &&
          (!q ||
            [c.name, c.email].some((v) => v.toLowerCase().includes(q)) ||
            (digits.length > 2 && c.phone.includes(digits))),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    $("#clientCount").textContent = `${clients.length} pessoa(s) encontrada(s)`;
    $("#clientList").innerHTML = clients.length
      ? clients
          .map((c) => {
            const stats = clientStats(ctx.state, c.id);
            return `<article class="appointment clientCard"><div><h3>${esc(c.name)} ${c.archived ? '<span class="status">Arquivado</span>' : ""}</h3><p>${esc(formatPhone(c.phone))}${c.email ? " · " + esc(c.email) : ""}</p><p>${stats.visits} visitas · ${money(stats.totalCents)} em atendimentos concluídos</p><div class="actions">${c.tags.map((t) => `<span class="status">${esc(t)}</span>`).join("")}</div></div><div class="actions"><button class="primary" data-action="client-booking" data-id="${c.id}" ${c.archived ? "disabled" : ""}>Agendar</button><button class="secondary" data-action="client-history" data-id="${c.id}">Histórico</button><button class="textbtn" data-action="edit-client" data-id="${c.id}">Editar</button><button class="cancel" data-action="delete-client" data-id="${c.id}">Excluir / arquivar</button></div></article>`;
          })
          .join("")
      : empty(
          "Nenhuma pessoa encontrada.",
          "Cadastre seu primeiro cliente ou ajuste a busca.",
        );
  };
  ctx.openClient = (id) => {
    const c = ctx.state.clients.find((c) => c.id === id);
    const dialog = openEditor(
      c ? "Editar cliente" : "Novo cliente",
      formShell(
        `${input("clientName", "Nome completo *", c?.name || "", 'required minlength="2" maxlength="100" autocomplete="name"')}${input("clientPhone", "Telefone / WhatsApp com DDD *", c?.phone ? formatPhone(c.phone) : c?.legacyPhone || "", 'required type="tel" maxlength="22" autocomplete="tel"')}${input("clientEmail", "E-mail", c?.email || "", 'type="email" maxlength="150" autocomplete="email"')}${input("clientBirthday", "Data de nascimento", c?.birthday || "", `type="date" min="1900-01-01" max="${today()}"`)}${input("clientTags", "Tags (separadas por vírgulas)", c?.tags.join(", ") || "", 'maxlength="240" placeholder="VIP, recorrente, novo"')}${textarea("clientNotes", "Observações internas", c?.notes || "")}${textarea("clientPreferences", "Preferências de corte e atendimento", c?.preferences || "", 500)}${check("clientConsent", "Cliente autoriza receber mensagens por WhatsApp", c?.consent)}${check("clientArchived", "Cadastro arquivado", c?.archived)}<p class="note">Consentimento deve refletir a escolha da pessoa. Arquivar preserva o histórico e impede novas reservas para este cadastro.</p>`,
      ),
    );
    $("#clientPhone").addEventListener("blur", () => {
      const digits = value("clientPhone").replace(/\D/g, "");
      if ([10, 11, 12, 13].includes(digits.length))
        $("#clientPhone").value = formatPhone(digits);
    });
    const form = $("#editorForm");
    const validate = () => {
      form.dataset.ready = String(
        value("clientName").length >= 2 &&
          value("clientPhone").replace(/\D/g, "").length >= 10,
      );
      $("#saveButton").disabled =
        form.dataset.ready === "false" || !form.checkValidity();
    };
    form.addEventListener("input", validate);
    bindSubmit(async () => {
      const payload = {
        name: value("clientName"),
        phone: value("clientPhone"),
        email: value("clientEmail"),
        birthday: value("clientBirthday"),
        notes: value("clientNotes"),
        preferences: value("clientPreferences"),
        tags: value("clientTags"),
        consent: checked("clientConsent"),
        archived: checked("clientArchived"),
      };
      await ctx.write(() =>
        c
          ? ctx.repo.updateClient(id, payload, c.updatedAt)
          : ctx.repo.saveClient(payload),
      );
      dialog.close();
      notify(
        "Cadastro salvo com sucesso. Reservas continuam vinculadas pelo ID do cliente.",
      );
    });
    validate();
  };
  ctx.deleteClient = (id) => {
    const c = ctx.client(id),
      hasBookings = ctx.state.bookings.some((b) => b.clientId === id);
    confirmAction({
      title: hasBookings ? "Arquivar cliente?" : "Excluir cliente?",
      message: hasBookings
        ? `${c.name} tem reservas. O cadastro será arquivado e o histórico preservado. Para reativar, marque “Mostrar arquivados” e edite o cadastro.`
        : `Excluir ${c.name}? Este cadastro não tem reservas e será removido.`,
      label: hasBookings ? "Arquivar" : "Excluir",
      onConfirm: async () => {
        await ctx.write(() => ctx.repo.deleteClient(id, c.updatedAt));
        $("#editor").close();
        notify(
          hasBookings
            ? "Cliente arquivado. Histórico preservado."
            : "Cadastro excluído.",
        );
      },
    });
  };
  ctx.clientHistory = (id) => {
    const c = ctx.client(id),
      stats = clientStats(ctx.state, id);
    openEditor(
      "Histórico do cliente",
      `<h3>${esc(c.name)}</h3><p>${esc(formatPhone(c.phone))} · ${esc(c.email || "Sem e-mail")}</p><p>Nascimento: ${formatDate(c.birthday)} · Mensagens: ${c.consent ? "autorizadas" : "não autorizadas"}</p><div class="metrics compact">${metric("Visitas concluídas", stats.visits)}${metric("Total gasto", money(stats.totalCents))}${metric("Último atendimento", stats.last ? dateLabel(stats.last) : "—")}${metric("Próximo atendimento", stats.next ? dateLabel(stats.next) : "—")}${metric("Serviço mais utilizado", ctx.service(stats.serviceId)?.name || "—")}${metric("Barbeiro preferido", ctx.barber(stats.barberId)?.name || "—")}</div><div class="summary"><strong>Cartão fidelidade demonstrativo</strong><p>${stats.points} pontos · ${stats.stamps} de 10 carimbos no ciclo atual.</p><p class="note">10 pontos por visita concluída. Contagem informativa, sem resgate ou benefício financeiro automático.</p></div><p>Preferências: ${esc(c.preferences || "Nenhuma")}</p><p>Observações internas: ${esc(c.notes || "Nenhuma")}</p><div class="actions"><button class="secondary" data-action="copy-phone" data-id="${id}">Copiar telefone</button><button class="secondary" data-action="client-whatsapp" data-id="${id}">Abrir WhatsApp</button><button class="secondary" data-action="client-return" data-id="${id}">Convidar para retornar</button><button class="textbtn" data-action="edit-client" data-id="${id}">Editar cadastro</button></div><h3>Todos os agendamentos</h3>${stats.history.length ? stats.history.map(ctx.bookingCard).join("") : empty("Ainda sem atendimentos.")}`,
    );
  };
  ctx.copyPhone = async (id) => {
    const c = ctx.client(id);
    if (!c.phone) throw new Error("Cadastre um telefone primeiro.");
    if (!navigator.clipboard)
      throw new Error(
        "Cópia indisponível neste navegador. Selecione o telefone no histórico.",
      );
    await navigator.clipboard.writeText(c.phone);
    notify("Telefone copiado.");
  };
  ctx.clientWhatsApp = (id, campaign = false) => {
    const c = ctx.client(id);
    window.open(
      whatsappLink(c, campaign ? generateFollowUpMessage(c) : ""),
      "_blank",
      "noopener,noreferrer",
    );
  };
}
