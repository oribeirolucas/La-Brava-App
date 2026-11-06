import { DAYS, DEFAULT_SCHEDULE } from "./config.js";
import { clone, effectivePrice, formatDate, today } from "./utils.js";
import {
  $,
  $$,
  esc,
  money,
  option,
  input,
  textarea,
  select,
  check,
  openEditor,
  formShell,
  bindSubmit,
  value,
  checked,
  empty,
  notify,
} from "./ui.js";
export function setupCatalog(ctx) {
  ctx.renderCatalog = () => {
    $("#catalog").innerHTML =
      `<div class="intro"><div><h1>Serviços e rituais.</h1><p>Preços em reais, duração e intervalos para uma agenda precisa.</p></div><button class="primary" data-action="new-service">Cadastrar serviço +</button></div><p class="note">Alterar preços e duração não muda os valores de reservas já criadas. Desativar preserva o histórico.</p><div class="services">${ctx.state.services
        .sort((a, b) => a.order - b.order)
        .map(
          (s) =>
            `<article class="service"><span class="status">${s.active ? "Ativo" : "Inativo"}</span><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><p>${esc(s.category)} · ${s.duration} min + ${s.buffer} min de intervalo</p><strong>${money(effectivePrice(s))}</strong>${s.promoCents !== null ? `<small> · de ${money(s.priceCents)}</small>` : ""}${s.comboIds.length ? `<p>Combo: ${s.comboIds.map((id) => esc(ctx.service(id).name)).join(" + ")}</p>` : ""}<div class="servicefooter"><span>Ordem ${s.order}</span><button class="secondary" data-action="edit-service" data-id="${s.id}">Editar / arquivar</button></div></article>`,
        )
        .join("")}</div>`;
  };
  ctx.openService = (id) => {
    const s = ctx.state.services.find((s) => s.id === id);
    const dialog = openEditor(
      s ? "Editar serviço" : "Novo serviço",
      formShell(
        `${input("serviceName", "Nome *", s?.name || "", 'required minlength="2" maxlength="100"')}${textarea("serviceDescription", "Descrição", s?.description || "", 500)}<div class="row">${input("servicePrice", "Preço (R$) *", s ? (s.priceCents / 100).toFixed(2) : "", 'required inputmode="decimal" placeholder="50,00"')}${input("servicePromo", "Preço promocional (opcional)", s?.promoCents == null ? "" : (s.promoCents / 100).toFixed(2), 'inputmode="decimal"')}</div><div class="row">${input("serviceDuration", "Duração em minutos *", s?.duration || 30, 'type="number" required min="5" max="600"')}${input("serviceBuffer", "Intervalo após serviço (min)", s?.buffer || 0, 'type="number" min="0" max="120" required')}</div><div class="row">${input("serviceCategory", "Categoria", s?.category || "", 'maxlength="60"')}${input("serviceOrder", "Ordem de exibição", s?.order ?? ctx.state.services.length + 1, 'type="number" min="0" max="999" required')}</div><fieldset><legend>Combo · componentes opcionais</legend><p class="note">Defina acima o preço e a duração total do combo.</p>${ctx.state.services
          .filter((x) => x.id !== id && !x.comboIds.length)
          .map((x) =>
            check("combo-" + x.id, esc(x.name), s?.comboIds.includes(x.id)),
          )
          .join(
            "",
          )}</fieldset>${check("serviceActive", "Serviço ativo para novos agendamentos", s?.active ?? true)}`,
      ),
    );
    bindSubmit(async () => {
      const payload = {
        name: value("serviceName"),
        description: value("serviceDescription"),
        price: value("servicePrice"),
        promo: value("servicePromo"),
        duration: value("serviceDuration"),
        buffer: value("serviceBuffer"),
        category: value("serviceCategory"),
        order: value("serviceOrder"),
        active: checked("serviceActive"),
        comboIds: $$('input[id^="combo-"]:checked').map((x) => x.id.slice(6)),
      };
      await ctx.write(() => ctx.repo.saveService(payload, id, s?.updatedAt));
      dialog.close();
      notify(
        "Serviço salvo. Reservas anteriores mantêm preço e duração originais.",
      );
    });
  };
  ctx.renderTeam = () => {
    $("#team").innerHTML =
      `<div class="intro"><div><h1>Quem faz a La Brava App.</h1><p>Equipe, expediente, folgas e bloqueios.</p></div><button class="primary" data-action="new-barber">Cadastrar profissional +</button></div><div class="cards">${ctx.state.barbers.map((b) => `<article class="appointment"><div class="avatar" aria-hidden="true">${esc(b.name.slice(0, 2).toUpperCase())}</div><h3>${esc(b.name)} <span class="status">${b.active ? "Ativo" : "Inativo"}</span></h3><p>${esc(b.specialties)}</p><p>${b.schedule.days.map((d) => DAYS[d]).join(", ")} · ${b.schedule.start}–${b.schedule.end}</p><p>Almoço: ${b.schedule.lunchStart ? b.schedule.lunchStart + "–" + b.schedule.lunchEnd : "sem intervalo definido"} · Comissão: ${b.commissionPercent}%</p>${b.vacations.map((v) => `<p>Férias: ${formatDate(v.start)} a ${formatDate(v.end)}</p>`).join("")}<div class="actions"><button class="secondary" data-action="edit-barber" data-id="${b.id}">Editar / desativar</button><button class="secondary" data-action="barber-agenda" data-id="${b.id}">Ver agenda</button><button class="textbtn" data-action="block-time" data-id="${b.id}">Bloquear horário</button></div>${b.blocks.length ? "<h4>Bloqueios manuais</h4>" + b.blocks.map((x) => `<div class="block-item"><span>${formatDate(x.date)} · ${x.start}–${x.end} · ${esc(x.reason)}</span><button class="textbtn" data-action="remove-block" data-id="${b.id}" data-block="${x.id}">Remover</button></div>`).join("") : ""}</article>`).join("")}</div><p class="note">Mudanças no expediente não cancelam reservas existentes. Revise a agenda após alterar horários, férias ou status.</p>`;
  };
  ctx.openBarber = (id) => {
    const b = ctx.state.barbers.find((b) => b.id === id),
      s = b?.schedule || clone(DEFAULT_SCHEDULE);
    const dialog = openEditor(
      b ? "Editar profissional" : "Novo profissional",
      formShell(
        `${input("barberName", "Nome *", b?.name || "", 'required minlength="2" maxlength="100"')}${textarea("barberSpecialties", "Especialidades", b?.specialties || "", 300)}<p class="note">O avatar é criado com as iniciais; nenhuma foto externa é necessária.</p><fieldset><legend>Dias de trabalho (desmarque as folgas)</legend><div class="weekdays">${DAYS.map((d, i) => check("day-" + i, d, s.days.includes(i))).join("")}</div></fieldset><div class="row">${input("workStart", "Início *", s.start, 'required type="time"')}${input("workEnd", "Fim *", s.end, 'required type="time"')}</div><div class="row">${input("lunchStart", "Início do almoço (opcional)", s.lunchStart, 'type="time"')}${input("lunchEnd", "Fim do almoço (opcional)", s.lunchEnd, 'type="time"')}</div><fieldset><legend>Férias · um período por linha</legend><p class="note">Formato: AAAA-MM-DD / AAAA-MM-DD. Apague uma linha para remover.</p>${textarea("vacations", "Períodos de férias", b?.vacations.map((v) => v.start + " / " + v.end).join("\n") || "")}</fieldset>${input("commission", "Comissão percentual (%)", b?.commissionPercent ?? 40, 'type="number" min="0" max="100" step="0.01" required')}${check("barberActive", "Profissional ativo", b?.active ?? true)}<p class="note">Revise reservas existentes após mudar disponibilidade. As comissões são registradas na reserva e calculadas sobre atendimentos concluídos.</p>`,
      ),
    );
    bindSubmit(async () => {
      const vacations = value("vacations")
        .split("\n")
        .filter((x) => x.trim())
        .map((line) => {
          const [start, end] = line.split("/").map((x) => x.trim());
          return { start, end };
        });
      const payload = {
        name: value("barberName"),
        specialties: value("barberSpecialties"),
        schedule: {
          days: DAYS.map((_, i) => i).filter((i) => checked("day-" + i)),
          start: value("workStart"),
          end: value("workEnd"),
          lunchStart: value("lunchStart"),
          lunchEnd: value("lunchEnd"),
        },
        vacations,
        commissionPercent: value("commission"),
        active: checked("barberActive"),
      };
      await ctx.write(() => ctx.repo.saveBarber(payload, id, b?.updatedAt));
      dialog.close();
      notify(
        "Profissional salvo. Confira eventuais reservas fora do novo expediente.",
      );
    });
  };
  ctx.openBlock = (barberId) => {
    const dialog = openEditor(
      "Bloquear horário",
      formShell(
        `${select("blockBarber", "Profissional", ctx.state.barbers.map((b) => option(b.id, b.name, b.id === barberId)).join(""))}${input("blockDate", "Data *", today(), 'type="date" required')}<div class="row">${input("blockStart", "Início *", "09:00", 'type="time" required')}${input("blockEnd", "Fim *", "10:00", 'type="time" required')}</div>${input("blockReason", "Motivo interno", "", 'maxlength="200"')}<p class="note">Se houver reserva, primeiro remarque ou cancele o atendimento.</p>`,
        "Salvar bloqueio",
      ),
    );
    bindSubmit(async () => {
      await ctx.write(() =>
        ctx.repo.addBlock(value("blockBarber"), {
          date: value("blockDate"),
          start: value("blockStart"),
          end: value("blockEnd"),
          reason: value("blockReason"),
        }),
      );
      dialog.close();
      notify("Bloqueio salvo na agenda.");
    });
  };
}
