import { LocalStorageAdapter } from "./storage.js";
import {
  uid,
  clone,
  effectivePrice,
  validDate,
  validTime,
  minutes,
  timestamp,
  text,
} from "./utils.js";
import { STATUSES, OCCUPIED_STATUSES } from "./config.js";
import { availabilityError, overlaps } from "./bookings.js";
import { validateClient } from "./clients.js";
import { validateService, validateBarber } from "./services.js";
export class Repository {
  constructor(adapter = new LocalStorageAdapter(), clock = () => new Date()) {
    this.adapter = adapter;
    this.clock = clock;
  }
  getState() {
    return clone(this.adapter.read());
  }
  getClients() {
    return this.getState().clients;
  }
  getBookings() {
    return this.getState().bookings;
  }
  getServices() {
    return this.getState().services;
  }
  getBarbers() {
    return this.getState().barbers;
  }
  mutate(fn) {
    const state = this.getState(),
      revision = state.revision;
    const result = fn(state);
    state.revision++;
    this.adapter.write(state, revision);
    return clone(result);
  }
  updatedAt(previous) {
    return new Date(
      Math.max(this.clock().getTime(), (Date.parse(previous) || 0) + 1),
    ).toISOString();
  }
  entity(state, key, id, expectedUpdatedAt) {
    const entity = state[key].find((x) => x.id === id);
    if (!entity) throw new Error("Registro não encontrado. Atualize a página.");
    if (expectedUpdatedAt && entity.updatedAt !== expectedUpdatedAt)
      throw new Error(
        "Este registro mudou. Feche e reabra o formulário para não sobrescrever alterações.",
      );
    return entity;
  }
  saveClient(input) {
    return this.mutate((s) => {
      const now = this.clock().toISOString(),
        c = {
          ...validateClient(input, s),
          id: uid(),
          createdAt: now,
          updatedAt: now,
        };
      s.clients.push(c);
      return c;
    });
  }
  updateClient(id, input, expected) {
    return this.mutate((s) => {
      const c = this.entity(s, "clients", id, expected);
      Object.assign(c, validateClient(input, s, id), {
        updatedAt: this.updatedAt(c.updatedAt),
      });
      return c;
    });
  }
  deleteClient(id, expected) {
    return this.mutate((s) => {
      const c = this.entity(s, "clients", id, expected);
      if (s.bookings.some((b) => b.clientId === id)) {
        c.archived = true;
        c.updatedAt = this.updatedAt(c.updatedAt);
        return { archived: true };
      }
      s.clients = s.clients.filter((x) => x.id !== id);
      return { archived: false };
    });
  }
  withNewClient(s, input) {
    if (!input.newClient) return input;
    const now = this.clock().toISOString();
    const client = {
      ...validateClient(input.newClient, s),
      id: uid(),
      createdAt: now,
      updatedAt: now,
    };
    s.clients.push(client);
    return { ...input, clientId: client.id };
  }
  bookingInput(s, input, existing) {
    if (!Object.hasOwn(STATUSES, input.status))
      throw new Error("Status inválido.");
    const client = s.clients.find((c) => c.id === input.clientId);
    if (!client || (client.archived && client.id !== existing?.clientId))
      throw new Error("Escolha um cliente ativo.");
    const service = s.services.find((x) => x.id === input.serviceId),
      barber = s.barbers.find((x) => x.id === input.barberId);
    if (!service || !barber)
      throw new Error("Serviço ou profissional não encontrado.");
    if (!validDate(input.date) || !validTime(input.time))
      throw new Error("Informe data e horário válidos.");
    const changedSlot =
      !existing ||
      ["serviceId", "barberId", "date", "time"].some(
        (k) => input[k] !== existing[k],
      );
    const snapshot =
      !existing || input.serviceId !== existing.serviceId
        ? {
            priceCents: effectivePrice(service),
            duration: service.duration,
            buffer: service.buffer,
            commissionPercent: barber.commissionPercent,
          }
        : {
            priceCents: existing.priceCents,
            duration: existing.duration,
            buffer: existing.buffer,
            commissionPercent:
              input.barberId === existing.barberId
                ? existing.commissionPercent
                : barber.commissionPercent,
          };
    const booking = {
      clientId: client.id,
      serviceId: service.id,
      barberId: barber.id,
      date: input.date,
      time: input.time,
      status: input.status,
      notes: text(input.notes, 2000),
      cancellationReason: text(input.cancellationReason, 500),
      ...snapshot,
    };
    const reactivating =
      existing?.status === "cancelled" && input.status !== "cancelled";
    if (changedSlot || reactivating) {
      const error = availabilityError(s, booking, {
        now: this.clock().getTime(),
        excludeId: existing?.id,
      });
      if (error) throw new Error(error);
    }
    if (input.status === "cancelled" && !booking.cancellationReason)
      throw new Error("Informe o motivo do cancelamento.");
    if (
      ["completed", "no_show"].includes(input.status) &&
      timestamp(booking.date, booking.time) > this.clock().getTime()
    )
      throw new Error(
        "Conclua ou marque falta somente após o horário de início.",
      );
    if (input.status !== "cancelled") booking.cancellationReason = "";
    return booking;
  }
  createBooking(input) {
    return this.mutate((s) => {
      const now = this.clock().toISOString(),
        id = uid();
      const booking = {
        ...this.bookingInput(s, this.withNewClient(s, input)),
        id,
        code: "BR-" + id.slice(0, 8).toUpperCase(),
        createdAt: now,
        updatedAt: now,
      };
      s.bookings.push(booking);
      return booking;
    });
  }
  updateBooking(id, input, expected) {
    return this.mutate((s) => {
      const b = this.entity(s, "bookings", id, expected);
      Object.assign(
        b,
        this.bookingInput(s, { ...b, ...this.withNewClient(s, input) }, b),
        { updatedAt: this.updatedAt(b.updatedAt) },
      );
      return b;
    });
  }
  cancelBooking(id, reason, expected) {
    return this.updateBooking(
      id,
      { status: "cancelled", cancellationReason: reason },
      expected,
    );
  }
  saveService(input, id, expected) {
    return this.mutate((s) => {
      const now = this.clock().toISOString(),
        value = validateService(input, s, id);
      if (id) {
        const old = this.entity(s, "services", id, expected);
        Object.assign(old, value, { updatedAt: this.updatedAt(old.updatedAt) });
        return old;
      }
      const service = { ...value, id: uid(), createdAt: now, updatedAt: now };
      s.services.push(service);
      return service;
    });
  }
  saveBarber(input, id, expected) {
    return this.mutate((s) => {
      const now = this.clock().toISOString(),
        value = validateBarber(input);
      if (id) {
        const old = this.entity(s, "barbers", id, expected);
        Object.assign(old, value, { updatedAt: this.updatedAt(old.updatedAt) });
        return old;
      }
      const barber = {
        ...value,
        blocks: [],
        id: uid(),
        createdAt: now,
        updatedAt: now,
      };
      s.barbers.push(barber);
      return barber;
    });
  }
  addBlock(barberId, input) {
    return this.mutate((s) => {
      const barber = this.entity(s, "barbers", barberId),
        { date, start, end } = input;
      if (
        !validDate(date) ||
        !validTime(start) ||
        !validTime(end) ||
        minutes(end) <= minutes(start)
      )
        throw new Error("Informe data e intervalo válidos.");
      if (
        s.bookings.some(
          (b) =>
            b.barberId === barberId &&
            b.date === date &&
            OCCUPIED_STATUSES.includes(b.status) &&
            overlaps(
              minutes(start),
              minutes(end),
              minutes(b.time),
              minutes(b.time) + b.duration + b.buffer,
            ),
        )
      )
        throw new Error(
          "Há reserva neste intervalo. Remarque ou cancele antes de bloquear.",
        );
      if (
        barber.blocks.some(
          (b) =>
            b.date === date &&
            overlaps(
              minutes(start),
              minutes(end),
              minutes(b.start),
              minutes(b.end),
            ),
        )
      )
        throw new Error("Já existe um bloqueio neste intervalo.");
      barber.blocks.push({
        id: uid(),
        date,
        start,
        end,
        reason: text(input.reason, 200),
      });
      barber.updatedAt = this.updatedAt(barber.updatedAt);
      return barber;
    });
  }
  removeBlock(barberId, blockId) {
    return this.mutate((s) => {
      const b = this.entity(s, "barbers", barberId);
      b.blocks = b.blocks.filter((x) => x.id !== blockId);
      b.updatedAt = this.updatedAt(b.updatedAt);
      return b;
    });
  }
}
export const repository = new Repository();
// Cooperative writes across tabs, where Web Locks is supported. Multi-device integrity requires a server.
export async function withWriteLock(action) {
  return globalThis.navigator?.locks
    ? navigator.locks.request("brava-data-write", action)
    : action();
}
