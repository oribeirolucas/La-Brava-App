import {
  normalizePhone,
  emailValid,
  validDate,
  today,
  text,
  timestamp,
} from "./utils.js";
export function validateClient(input, state, id) {
  const name = text(input.name, 100);
  if (name.length < 2)
    throw new Error("Informe um nome com pelo menos dois caracteres.");
  const phone = normalizePhone(input.phone);
  if (state.clients.some((c) => c.id !== id && c.phone === phone))
    throw new Error(
      "Este telefone já está cadastrado, inclusive entre arquivados. Edite ou restaure o cadastro existente.",
    );
  const email = text(input.email, 150).toLowerCase();
  if (!emailValid(email)) throw new Error("Informe um e-mail válido.");
  const birthday = input.birthday || "";
  if (
    birthday &&
    (!validDate(birthday) || birthday > today() || birthday < "1900-01-01")
  )
    throw new Error(
      "Informe uma data de nascimento válida, sem datas futuras.",
    );
  return {
    name,
    phone,
    email,
    birthday,
    notes: text(input.notes, 2000),
    preferences: text(input.preferences, 500),
    tags: (Array.isArray(input.tags)
      ? input.tags
      : String(input.tags || "").split(",")
    )
      .map((x) => text(x, 30))
      .filter(Boolean)
      .slice(0, 8),
    consent: input.consent === true,
    archived: input.archived === true,
  };
}
export function clientStats(state, clientId, date = today()) {
  const history = state.bookings
    .filter((b) => b.clientId === clientId)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const completed = history.filter((b) => b.status === "completed");
  const favorite = (key) => {
    const counts = new Map();
    completed.forEach((b) => counts.set(b[key], (counts.get(b[key]) || 0) + 1));
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  return {
    history,
    visits: completed.length,
    totalCents: completed.reduce((sum, b) => sum + b.priceCents, 0),
    last: completed[0],
    next: history
      .filter(
        (b) =>
          ["waiting", "confirmed"].includes(b.status) &&
          b.date >= date &&
          timestamp(b.date, b.time) >= Date.now(),
      )
      .at(-1),
    serviceId: favorite("serviceId"),
    barberId: favorite("barberId"),
    points: completed.length * 10,
    stamps: completed.length % 10,
  };
}
