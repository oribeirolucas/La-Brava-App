import { text, parseMoney, validTime, minutes, validDate } from "./utils.js";
export function validateService(input, state, id) {
  const name = text(input.name, 100);
  if (name.length < 2) throw new Error("Informe o nome do serviço.");
  const priceCents = parseMoney(input.price),
    promoCents =
      input.promo === "" || input.promo == null
        ? null
        : parseMoney(input.promo);
  const duration = Number(input.duration),
    buffer = Number(input.buffer),
    order = Number(input.order);
  if (
    !Number.isInteger(duration) ||
    duration < 5 ||
    duration > 600 ||
    !Number.isInteger(buffer) ||
    buffer < 0 ||
    buffer > 120
  )
    throw new Error(
      "Duração: 5 a 600 minutos. Intervalo adicional: 0 a 120 minutos.",
    );
  if (!Number.isInteger(order) || order < 0 || order > 999)
    throw new Error("Ordem deve estar entre 0 e 999.");
  if (promoCents !== null && promoCents > priceCents)
    throw new Error(
      "O preço promocional não pode ser maior que o preço normal.",
    );
  const comboIds = input.comboIds || [];
  if (
    comboIds.some(
      (x) =>
        x === id ||
        !state.services.some((s) => s.id === x && !s.comboIds.length),
    )
  )
    throw new Error("Escolha serviços individuais válidos para o combo.");
  return {
    name,
    description: text(input.description, 500),
    category: text(input.category, 60),
    priceCents,
    promoCents,
    duration,
    buffer,
    order,
    comboIds,
    active: input.active === true,
  };
}
export function validateBarber(input) {
  const name = text(input.name, 100);
  if (name.length < 2) throw new Error("Informe o nome do profissional.");
  const s = input.schedule;
  if (
    !s ||
    !s.days.length ||
    s.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    !validTime(s.start) ||
    !validTime(s.end) ||
    minutes(s.end) <= minutes(s.start)
  )
    throw new Error("Defina os dias e um expediente válido.");
  if (
    (s.lunchStart || s.lunchEnd) &&
    (!validTime(s.lunchStart) ||
      !validTime(s.lunchEnd) ||
      minutes(s.lunchStart) < minutes(s.start) ||
      minutes(s.lunchEnd) > minutes(s.end) ||
      minutes(s.lunchEnd) <= minutes(s.lunchStart))
  )
    throw new Error(
      "O almoço deve estar dentro do expediente e ter início e fim válidos.",
    );
  const commissionPercent = Number(input.commissionPercent);
  if (
    !Number.isFinite(commissionPercent) ||
    commissionPercent < 0 ||
    commissionPercent > 100
  )
    throw new Error("Comissão deve estar entre 0 e 100%.");
  const vacations = input.vacations || [];
  if (
    vacations.some(
      (v) => !validDate(v.start) || !validDate(v.end) || v.end < v.start,
    )
  )
    throw new Error("Confira as datas de início e fim das férias.");
  return {
    name,
    specialties: text(input.specialties, 300),
    active: input.active === true,
    schedule: s,
    vacations,
    commissionPercent,
  };
}
