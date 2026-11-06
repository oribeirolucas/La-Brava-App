import test from "node:test";
import assert from "node:assert/strict";
import { Repository } from "../dist/modules/repository.js";
import {
  LocalStorageAdapter,
  migrateLegacy,
  StorageError,
  validateState,
} from "../dist/modules/storage.js";
import { STORAGE_KEY, BACKUP_KEY } from "../dist/modules/config.js";
import {
  normalizePhone,
  timestamp,
  today,
  validDate,
  parseMoney,
  uid,
} from "../dist/modules/utils.js";
import { availableSlots, availabilityError } from "../dist/modules/bookings.js";
import { clientStats } from "../dist/modules/clients.js";
class MemoryStorage {
  values = new Map();
  getItem(k) {
    return this.values.get(k) ?? null;
  }
  setItem(k, v) {
    this.values.set(k, v);
  }
  removeItem(k) {
    this.values.delete(k);
  }
}
function fixture() {
  const storage = new MemoryStorage(),
    adapter = new LocalStorageAdapter(storage);
  let now = new Date("2026-11-06T12:00:00Z");
  const repo = new Repository(adapter, () => now);
  const client = repo.saveClient({
    name: "Cliente Teste",
    phone: "11987654321",
    email: "teste@example.com",
  });
  const payload = {
    clientId: client.id,
    serviceId: "svc-corte",
    barberId: "barber-rafael",
    date: "2026-11-09",
    time: "09:00",
    status: "confirmed",
  };
  return {
    storage,
    adapter,
    repo,
    client,
    payload,
    setNow(value) {
      now = new Date(value);
    },
  };
}
test("phone normalization, email and duplicate validation", () => {
  assert.equal(normalizePhone("(11) 98765-4321"), "5511987654321");
  assert.equal(normalizePhone("+55 11 98765-4321"), "5511987654321");
  assert.throws(() => normalizePhone("123"));
  const f = fixture();
  assert.throws(
    () => f.repo.saveClient({ name: "Duplicado", phone: "+55 11 98765-4321" }),
    /já está cadastrado/,
  );
  assert.throws(
    () =>
      f.repo.saveClient({ name: "Outro", phone: "21987654321", email: "bad" }),
    /e-mail/,
  );
});
test("dates, timezone, integer money and uuid", () => {
  assert.equal(today(new Date("2026-11-07T01:00:00Z")), "2026-11-06");
  assert.equal(today(new Date("2026-11-07T03:00:00Z")), "2026-11-07");
  assert.equal(
    timestamp("2026-11-09", "09:00"),
    Date.parse("2026-11-09T12:00:00Z"),
  );
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(parseMoney("19,90"), 1990);
  assert.throws(() => parseMoney("1.001"));
  assert.notEqual(uid(), uid());
});
test("bookings retain links after client edits and snapshots after price changes", () => {
  const f = fixture(),
    booking = f.repo.createBooking(f.payload);
  f.repo.updateClient(f.client.id, {
    ...f.client,
    name: "Novo Nome",
    phone: "11988887777",
  });
  assert.equal(f.repo.getBookings()[0].clientId, f.client.id);
  const service = f.repo.getServices()[0];
  f.repo.saveService(
    { ...service, price: "99", promo: "", duration: 60 },
    service.id,
  );
  assert.equal(f.repo.getBookings()[0].priceCents, 5000);
  assert.equal(f.repo.getBookings()[0].duration, 40);
  assert.ok(booking.code.startsWith("BR-"));
});
test("interval overlap, cancelled reservations release capacity, undo rechecks", () => {
  const f = fixture(),
    booking = f.repo.createBooking(f.payload);
  assert.throws(
    () => f.repo.createBooking({ ...f.payload, time: "09:30" }),
    /ocupado/,
  );
  f.repo.cancelBooking(booking.id, "Solicitado pelo cliente");
  assert.equal(f.repo.getBookings()[0].status, "cancelled");
  f.repo.createBooking(f.payload);
  assert.throws(
    () => f.repo.updateBooking(booking.id, { status: "confirmed" }),
    /ocupado/,
  );
});
test("edit excludes itself, rescheduling verifies conflicts, cancellation keeps history", () => {
  const f = fixture(),
    b = f.repo.createBooking(f.payload);
  f.repo.updateBooking(b.id, { notes: "Observação", time: "09:00" });
  f.repo.createBooking({ ...f.payload, time: "10:00" });
  assert.throws(() => f.repo.updateBooking(b.id, { time: "10:00" }), /ocupado/);
  f.repo.updateBooking(b.id, { time: "14:00" });
  assert.equal(f.repo.getBookings()[0].time, "14:00");
  assert.throws(() => f.repo.cancelBooking(b.id, ""), /motivo/);
});
test("Sunday, past, lunch, end of work, vacation and manual block", () => {
  const f = fixture();
  assert.throws(
    () => f.repo.createBooking({ ...f.payload, date: "2026-11-08" }),
    /expediente/,
  );
  assert.throws(
    () => f.repo.createBooking({ ...f.payload, date: "2026-11-05" }),
    /futuro/,
  );
  assert.throws(
    () => f.repo.createBooking({ ...f.payload, time: "11:30" }),
    /intervalo/,
  );
  assert.throws(
    () => f.repo.createBooking({ ...f.payload, time: "18:30" }),
    /expediente/,
  );
  f.repo.addBlock("barber-rafael", {
    date: f.payload.date,
    start: "09:00",
    end: "10:00",
  });
  assert.throws(() => f.repo.createBooking(f.payload), /bloqueado/);
  const barber = f.repo.getBarbers()[0];
  f.repo.saveBarber(
    { ...barber, vacations: [{ start: "2026-11-09", end: "2026-11-12" }] },
    barber.id,
  );
  assert.deepEqual(
    availableSlots(
      f.repo.getState(),
      f.payload,
      Date.parse("2026-11-06T12:00Z"),
    ),
    [],
  );
});
test("buffer, duration and cross-service conflicts", () => {
  const f = fixture(),
    s = f.repo.getServices()[0];
  f.repo.saveService({ ...s, price: "50", promo: "", buffer: 20 }, s.id);
  f.repo.createBooking(f.payload);
  assert.throws(
    () =>
      f.repo.createBooking({
        ...f.payload,
        serviceId: "svc-barba",
        time: "09:45",
      }),
    /ocupado/,
  );
  f.repo.createBooking({ ...f.payload, serviceId: "svc-barba", time: "10:00" });
});
test("atomic inline registration rolls back if booking conflicts", () => {
  const f = fixture();
  f.repo.createBooking(f.payload);
  assert.throws(
    () =>
      f.repo.createBooking({
        ...f.payload,
        newClient: { name: "Outra pessoa", phone: "21987654321" },
      }),
    /ocupado/,
  );
  assert.equal(f.repo.getClients().length, 1);
});
test("archive protects history; completed revenue, preferred service and points", () => {
  const f = fixture(),
    b = f.repo.createBooking(f.payload);
  assert.throws(
    () => f.repo.updateBooking(b.id, { status: "completed" }),
    /após/,
  );
  f.setNow("2026-11-09T14:00:00Z");
  f.repo.updateBooking(b.id, { status: "completed" });
  assert.equal(clientStats(f.repo.getState(), f.client.id).totalCents, 5000);
  assert.equal(clientStats(f.repo.getState(), f.client.id).points, 10);
  assert.deepEqual(f.repo.deleteClient(f.client.id), { archived: true });
  assert.equal(f.repo.getBookings().length, 1);
  assert.equal(f.repo.getClients()[0].archived, true);
});
test("new repository can read persisted state and detect stale entity or revision", () => {
  const f = fixture();
  const stale = f.repo.getState();
  f.repo.createBooking(f.payload);
  assert.equal(new Repository(f.adapter).getBookings().length, 1);
  assert.throws(() => f.adapter.write(stale, stale.revision), /outra aba/);
  f.setNow("2026-11-06T13:00Z");
  f.repo.updateClient(f.client.id, { ...f.client, name: "Alterado" });
  assert.throws(
    () => f.repo.updateClient(f.client.id, f.client, f.client.updatedAt),
    /mudou/,
  );
});
test("migration maps unique names, recovers ambiguous names and preserves old keys", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    "brava-clients",
    JSON.stringify([{ id: "old", name: "Nome Antigo", phone: "11987654321" }]),
  );
  storage.setItem(
    "brava-bookings",
    JSON.stringify([
      {
        id: 123,
        name: "Nome Antigo",
        service: 0,
        barber: "Rafael",
        date: "2026-11-09",
        time: "09:00",
      },
    ]),
  );
  const state = new LocalStorageAdapter(storage).read();
  assert.equal(state.bookings[0].clientId, state.clients[0].id);
  assert.equal(state.bookings[0].serviceId, "svc-corte");
  assert.ok(storage.getItem("brava-clients"));
  const ambiguous = migrateLegacy(
    JSON.stringify([{ name: "Igual" }, { name: "Igual" }]),
    JSON.stringify([
      {
        name: "Igual",
        service: 0,
        barber: "Rafael",
        date: "2026-11-09",
        time: "09:00",
      },
    ]),
  );
  assert.equal(ambiguous.clients.length, 3);
});
test("corruption, quota and denied storage preserve data without false success", () => {
  const f = fixture();
  const raw = f.storage.getItem(STORAGE_KEY);
  f.storage.setItem(STORAGE_KEY, "{bad");
  assert.throws(() => f.repo.getState(), StorageError);
  assert.equal(f.storage.getItem(STORAGE_KEY), "{bad");
  f.storage.setItem(STORAGE_KEY, raw);
  f.storage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.throws(
    () => f.repo.saveClient({ name: "Outro", phone: "21987654321" }),
    /Não foi possível salvar/,
  );
  assert.equal(f.storage.getItem(STORAGE_KEY), raw);
});
test("reset and backup recovery, no unrelated keys removed", () => {
  const f = fixture();
  f.storage.setItem("other-app", "keep");
  f.adapter.reset();
  assert.equal(f.repo.getClients().length, 0);
  assert.equal(f.storage.getItem("other-app"), "keep");
  f.adapter.restoreBackup();
  assert.equal(f.repo.getClients().length, 1);
});
test("invalid references fail closed", () => {
  const f = fixture();
  f.repo.createBooking(f.payload);
  const state = f.repo.getState();
  state.bookings[0].clientId = "missing";
  assert.throws(() => validateState(state), /referência/);
});

test("denied storage getter fails gracefully through the adapter", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Denied");
    },
  });
  try {
    const adapter = new LocalStorageAdapter();
    assert.throws(() => adapter.read(), StorageError);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});
test("service promotion/combo validation and inactive catalogs", () => {
  const f = fixture(),
    s = f.repo.getServices()[0];
  assert.throws(
    () => f.repo.saveService({ ...s, price: "10", promo: "20" }, s.id),
    /promocional/,
  );
  assert.throws(
    () =>
      f.repo.saveService(
        { ...s, price: "10", promo: "", comboIds: [s.id] },
        s.id,
      ),
    /combo/,
  );
  f.repo.saveService({ ...s, price: "50", promo: "40", active: true }, s.id);
  assert.equal(f.repo.createBooking(f.payload).priceCents, 4000);
  f.repo.saveService({ ...s, price: "50", promo: "", active: false }, s.id);
  assert.throws(
    () => f.repo.createBooking({ ...f.payload, time: "14:00" }),
    /ativo/,
  );
});
test("block conflicts with reservation, removal releases slot, schedules validate", () => {
  const f = fixture();
  f.repo.createBooking(f.payload);
  assert.throws(
    () =>
      f.repo.addBlock("barber-rafael", {
        date: f.payload.date,
        start: "09:00",
        end: "10:00",
      }),
    /Há reserva/,
  );
  const barber = f.repo.addBlock("barber-rafael", {
    date: f.payload.date,
    start: "14:00",
    end: "15:00",
  });
  f.repo.removeBlock(barber.id, barber.blocks[0].id);
  f.repo.createBooking({ ...f.payload, time: "14:00" });
  assert.throws(
    () =>
      f.repo.saveBarber(
        { ...barber, schedule: { ...barber.schedule, end: "08:00" } },
        barber.id,
      ),
    /expediente/,
  );
});
test("WhatsApp generators require consent and never send requests", async () => {
  const {
    whatsappLink,
    generateBookingConfirmationMessage,
    generateReminderMessage,
    generateCancellationMessage,
    generateReviewMessage,
  } = await import("../dist/modules/messages.js");
  const f = fixture(),
    booking = f.repo.createBooking(f.payload);
  assert.throws(() => whatsappLink(f.client, "Texto"), /autorizou/);
  const client = { ...f.client, consent: true };
  const message = generateBookingConfirmationMessage(
    booking,
    client,
    f.repo.getServices()[0],
    f.repo.getBarbers()[0],
  );
  const url = new URL(whatsappLink(client, message));
  assert.equal(url.hostname, "wa.me");
  assert.equal(url.searchParams.get("text"), message);
  assert.ok(
    generateReminderMessage(booking, client, f.repo.getServices()[0]).includes(
      booking.code,
    ),
  );
  assert.ok(
    generateCancellationMessage(
      { ...booking, cancellationReason: "Pedido" },
      client,
    ).includes("Pedido"),
  );
  assert.ok(generateReviewMessage(booking, client).includes("experiência"));
});
