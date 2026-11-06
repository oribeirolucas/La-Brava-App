import {
  DEFAULT_SERVICES,
  DEFAULT_BARBERS,
  STORAGE_KEY,
  BACKUP_KEY,
  STATUSES,
} from "./config.js";
import { clone, uid, normalizePhone, validDate, validTime } from "./utils.js";
export class StorageError extends Error {
  constructor(message) {
    super(message);
    this.name = "StorageError";
  }
}
export const emptyState = () => {
  const stamp = new Date().toISOString();
  const dated = (values) =>
    clone(values).map((v) => ({ ...v, createdAt: stamp, updatedAt: stamp }));
  return {
    schemaVersion: 2,
    revision: 0,
    services: dated(DEFAULT_SERVICES),
    barbers: dated(DEFAULT_BARBERS),
    clients: [],
    bookings: [],
    migrationNotes: [],
  };
};
function legacyArray(raw, name) {
  if (raw == null) return [];
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new StorageError(
      `Os dados antigos de ${name} estão corrompidos. Exporte uma cópia antes de restaurar.`,
    );
  }
  if (!Array.isArray(value))
    throw new StorageError(
      `Formato antigo de ${name} inválido. Seus dados foram preservados.`,
    );
  return value;
}
export function migrateLegacy(rawClients, rawBookings) {
  const state = emptyState(),
    now = new Date().toISOString();
  for (const c of legacyArray(rawClients, "clientes")) {
    if (!c || typeof c.name !== "string" || c.name.trim().length < 1)
      throw new StorageError(
        "Cliente antigo inválido; migração interrompida sem apagar os dados.",
      );
    let phone = "";
    try {
      phone = normalizePhone(c.phone);
    } catch {}
    state.clients.push({
      id: uid(),
      legacyId: c.id,
      name: c.name,
      phone,
      legacyPhone: phone ? "" : String(c.phone || ""),
      email: String(c.email || ""),
      birthday: validDate(c.birthday) ? c.birthday : "",
      notes: "",
      tags: [],
      consent: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
  }
  for (const b of legacyArray(rawBookings, "agendamentos")) {
    if (
      !b ||
      typeof b.name !== "string" ||
      !validDate(b.date) ||
      !validTime(b.time) ||
      !state.services[Number(b.service)]
    )
      throw new StorageError(
        "Reserva antiga inválida; migração interrompida sem apagar os dados.",
      );
    const matches = state.clients.filter(
      (c) =>
        c.name.trim().toLocaleLowerCase("pt-BR") ===
        b.name.trim().toLocaleLowerCase("pt-BR"),
    );
    let client = matches.length === 1 ? matches[0] : null;
    if (!client) {
      client = {
        id: uid(),
        name: b.name,
        phone: "",
        email: "",
        birthday: "",
        notes:
          "Cliente recuperado de reserva antiga. Confirme os dados de contato.",
        tags: ["Migrado"],
        consent: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
      };
      state.clients.push(client);
    }
    const service = state.services[Number(b.service)];
    let barber = state.barbers.find((x) => x.name === b.barber);
    if (!barber) {
      barber = {
        ...clone(DEFAULT_BARBERS[0]),
        id: uid(),
        name: String(b.barber || "Profissional antigo"),
        active: false,
      };
      state.barbers.push(barber);
    }
    const id = uid();
    state.bookings.push({
      id,
      code: "BR-" + id.slice(0, 8).toUpperCase(),
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      date: b.date,
      time: b.time,
      status: "confirmed",
      priceCents: service.priceCents,
      duration: service.duration,
      buffer: service.buffer,
      notes: "",
      cancellationReason: "",
      createdAt: now,
      updatedAt: now,
    });
  }
  if (rawClients || rawBookings)
    state.migrationNotes.push(
      "Dados antigos migrados. Vínculos recuperados por nome único; homônimos ou nomes alterados geraram contatos separados para revisão. Consentimento não foi presumido. Chaves antigas preservadas para recuperação.",
    );
  return state;
}
export function validateState(state) {
  if (!state || state.schemaVersion !== 2 || !Number.isInteger(state.revision))
    throw new StorageError(
      "Versão de dados desconhecida. Nenhum dado foi sobrescrito.",
    );
  for (const key of ["clients", "bookings", "services", "barbers"]) {
    if (
      !Array.isArray(state[key]) ||
      state[key].some(
        (x) =>
          !x ||
          typeof x.id !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(x.id) ||
          (typeof x.name !== "string" && key !== "bookings"),
      ) ||
      new Set(state[key].map((x) => x.id)).size !== state[key].length
    )
      throw new StorageError(
        `Dados de ${key} inválidos. Exporte uma cópia para recuperação.`,
      );
  }
  for (const c of state.clients)
    if (
      !Array.isArray(c.tags) ||
      c.tags.some((t) => typeof t !== "string") ||
      typeof c.phone !== "string" ||
      typeof c.email !== "string" ||
      typeof c.consent !== "boolean" ||
      typeof c.archived !== "boolean" ||
      !c.createdAt ||
      !Number.isFinite(Date.parse(c.createdAt)) ||
      !Number.isFinite(Date.parse(c.updatedAt))
    )
      throw new StorageError("Cadastro de cliente inválido.");
  for (const s of state.services)
    if (
      typeof s.active !== "boolean" ||
      !Number.isSafeInteger(s.priceCents) ||
      s.priceCents < 0 ||
      !Number.isInteger(s.duration) ||
      s.duration < 5 ||
      !Number.isInteger(s.buffer) ||
      s.buffer < 0 ||
      (s.promoCents !== null &&
        (!Number.isSafeInteger(s.promoCents) || s.promoCents < 0)) ||
      !Array.isArray(s.comboIds)
    )
      throw new StorageError("Cadastro de serviço inválido.");
  for (const b of state.barbers)
    if (
      typeof b.active !== "boolean" ||
      !b.schedule ||
      !Array.isArray(b.schedule.days) ||
      !validTime(b.schedule.start) ||
      !validTime(b.schedule.end) ||
      !Array.isArray(b.vacations) ||
      b.vacations.some(
        (v) => !validDate(v.start) || !validDate(v.end) || v.end < v.start,
      ) ||
      !Array.isArray(b.blocks) ||
      b.blocks.some(
        (x) =>
          !/^[A-Za-z0-9_-]+$/.test(x.id) ||
          !validDate(x.date) ||
          !validTime(x.start) ||
          !validTime(x.end),
      )
    )
      throw new StorageError("Cadastro de profissional inválido.");
  for (const b of state.bookings)
    if (
      !state.clients.some((c) => c.id === b.clientId) ||
      !state.services.some((s) => s.id === b.serviceId) ||
      !state.barbers.some((x) => x.id === b.barberId) ||
      !validDate(b.date) ||
      !validTime(b.time) ||
      !Object.hasOwn(STATUSES, b.status) ||
      !Number.isSafeInteger(b.priceCents) ||
      b.priceCents < 0 ||
      !Number.isInteger(b.duration) ||
      b.duration < 5 ||
      !Number.isInteger(b.buffer) ||
      b.buffer < 0 ||
      !Number.isFinite(Date.parse(b.createdAt)) ||
      !Number.isFinite(Date.parse(b.updatedAt))
    )
      throw new StorageError(
        "Reserva inválida ou com referência ausente. Nenhum dado foi sobrescrito.",
      );
  return state;
}
export class LocalStorageAdapter {
  constructor(storage) {
    this.backend = storage;
  }
  get storage() {
    return this.backend ?? globalThis.localStorage;
  }
  read() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw !== null) return validateState(JSON.parse(raw));
      const state = migrateLegacy(
        this.storage.getItem("brava-clients"),
        this.storage.getItem("brava-bookings"),
      );
      validateState(state);
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    } catch (error) {
      throw new StorageError(
        error instanceof StorageError
          ? error.message
          : "Não foi possível ler ou inicializar o armazenamento. Verifique as permissões do navegador. Os dados existentes foram preservados.",
      );
    }
  }
  write(next, expectedRevision) {
    try {
      const current = this.read();
      if (current.revision !== expectedRevision)
        throw new StorageError(
          "Os dados mudaram em outra aba. Reabra o formulário e tente novamente.",
        );
      validateState(next);
      // Back up before replacing. On quota or access failure, do not replace current data.
      this.storage.setItem(BACKUP_KEY, JSON.stringify(current));
      this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      throw new StorageError(
        error instanceof StorageError
          ? error.message
          : "Não foi possível salvar. Verifique espaço e permissões. A alteração não foi confirmada.",
      );
    }
  }
  exportRaw() {
    try {
      return Object.fromEntries(
        [STORAGE_KEY, BACKUP_KEY, "brava-clients", "brava-bookings"].map(
          (k) => [k, this.storage.getItem(k)],
        ),
      );
    } catch {
      throw new StorageError(
        "Não foi possível exportar os dados deste navegador.",
      );
    }
  }
  eraseAll() {
    try {
      for (const key of [
        STORAGE_KEY,
        BACKUP_KEY,
        "brava-clients",
        "brava-bookings",
      ])
        this.storage.removeItem(key);
    } catch {
      throw new StorageError(
        "Não foi possível remover todos os dados. Confira permissões e tente novamente.",
      );
    }
  }
  reset(next = emptyState()) {
    try {
      // First save succeeds or existing data is untouched. Only this app's keys are removed.
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) this.storage.setItem(BACKUP_KEY, raw);
      validateState(next);
      this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
      this.storage.removeItem("brava-clients");
      this.storage.removeItem("brava-bookings");
    } catch {
      throw new StorageError(
        "Não foi possível limpar os dados. Verifique as permissões do navegador.",
      );
    }
  }
  restoreBackup() {
    try {
      const raw = this.storage.getItem(BACKUP_KEY);
      if (!raw) throw new StorageError("Nenhum backup local disponível.");
      const backup = validateState(JSON.parse(raw));
      this.storage.setItem(STORAGE_KEY, JSON.stringify(backup));
    } catch (e) {
      throw new StorageError(
        e instanceof StorageError
          ? e.message
          : "Não foi possível restaurar o backup.",
      );
    }
  }
}
