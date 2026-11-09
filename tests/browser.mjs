import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { startTestServer } from "./server.mjs";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const server = await startTestServer();
const { origin } = server;
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "UTC",
  });
  const page = await context.newPage(),
    errors = [];
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://**/*", (route) => route.abort());
  await page.clock.install({ time: new Date("2026-11-06T12:00:00Z") });
  await page.goto(origin);
  await page.locator("#home .service").first().waitFor();
  assert.equal(await page.locator("#storageError").isVisible(), false);
  const nav = async (view) => {
    if (await page.locator("#navigationToggle").isVisible())
      await page.locator("#navigationToggle").click();
    await page.locator(`#sidebar [data-view="${view}"]`).click();
  };
  const close = async () => {
    if (await page.locator("#editor").isVisible())
      await page.locator("#editor [data-close]").click();
  };
  await nav("clients");
  await page.locator('[data-action="new-client"]').click();
  await page.locator("#clientName").fill("Pessoa <img src=x onerror=alert(1)>");
  await page.locator("#clientPhone").fill("(11) 98765-4321");
  await page.locator("#clientEmail").fill("teste@example.com");
  await page.locator("#clientConsent").check();
  await page.locator("#saveButton").click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#clientList img").count(), 0);
  await page.locator('#clientList [data-action="edit-client"]').click();
  await page.locator("#clientName").fill("Cliente Atualizado");
  await page.locator("#saveButton").click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  await page.reload();
  await nav("clients");
  await page.locator("#clientSearch").fill("98765");
  assert.equal(await page.locator(".clientCard").count(), 1);
  await page.locator('#clientList [data-action="client-booking"]').click();
  assert.equal(
    await page.locator("#bookingSlots .slot[aria-pressed=true]").count(),
    0,
  );
  assert.equal(await page.locator("#saveButton").isDisabled(), true);
  await page.locator("#bookingDate").fill("2026-11-09");
  await page.locator("#bookingDate").dispatchEvent("change");
  await page.locator('#bookingSlots [data-time="09:00"]').click();
  assert.match(
    await page.locator("#bookingSummary").innerText(),
    /Cliente Atualizado/,
  );
  await page.locator("#saveButton").click();
  await page
    .locator("#editorTitle")
    .filter({ hasText: "Detalhes da reserva" })
    .waitFor();
  let persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("brava-v2")),
  );
  assert.equal(persisted.bookings.length, 1);
  assert.equal(persisted.bookings[0].clientId, persisted.clients[0].id);
  await close();
  await nav("clients");
  await page.locator('#clientList [data-action="edit-client"]').click();
  await page.locator("#clientName").fill("Nome Vinculado");
  await page.locator("#saveButton").click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  await nav("bookings");
  assert.match(
    await page.locator("#bookingList").innerText(),
    /Nome Vinculado/,
  );
  await page.locator('#bookingList [data-action="edit-booking"]').click();
  await page.locator("#bookingDate").fill("2026-11-10");
  await page.locator("#bookingDate").dispatchEvent("change");
  await page.locator("#barberId").selectOption("barber-lucas");
  await page.locator('#bookingSlots [data-time="14:00"]').click();
  await page.locator("#bookingNotes").fill("Preferência registrada");
  await page.locator("#saveButton").click();
  await page
    .locator("#editorTitle")
    .filter({ hasText: "Detalhes da reserva" })
    .waitFor();
  assert.match(
    await page.locator("#editor").innerText(),
    /10\/11\/2026 às 14:00/,
  );
  await close();
  await page.locator('#bookingList [data-action="cancel-booking"]').click();
  await page.locator("#confirmReason").fill("Solicitado pelo cliente");
  await page.locator("#confirmForm button[type=submit]").click();
  await page.locator("#confirmDialog").waitFor({ state: "hidden" });
  assert.match(await page.locator("#bookingList").innerText(), /Cancelado/);
  await page.locator('#bookingList [data-action="booking-details"]').click();
  await page.locator('#editor [data-action="booking-status"]').click();
  await page.locator("#editor .status-confirmed").waitFor();
  assert.match(await page.locator("#editor").innerText(), /Confirmado/);
  await close();
  await nav("agenda");
  await page.locator("#agendaDate").fill("2026-11-10");
  await page.locator("#agendaDate").dispatchEvent("change");
  await page.locator("#agendaMode").selectOption("week");
  assert.equal(await page.locator(".agenda-day").count(), 7);
  await page.locator("#agendaMode").selectOption("month");
  assert.equal(await page.locator(".agenda-day").count(), 30);
  await nav("catalog");
  await page.locator('[data-action="new-service"]').click();
  await page.locator("#serviceName").fill("Corte teste");
  await page.locator("#servicePrice").fill("60,50");
  await page.locator("#saveButton").click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  assert.match(await page.locator("#catalog").innerText(), /60,50/);
  await nav("team");
  await page.locator('[data-action="edit-barber"]').first().click();
  await page.locator("#vacations").fill("2026-12-01 / 2026-12-07");
  await page.locator("#saveButton").click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  await page.locator('#team [data-action="block-time"]').first().click();
  await page.locator("#blockDate").fill("2026-11-11");
  await page.locator("#blockStart").fill("09:00");
  await page.locator("#blockEnd").fill("10:00");
  await page.locator("#saveButton").click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  assert.match(await page.locator("#team").innerText(), /Bloqueios manuais/);
  await nav("clients");
  await page.locator('#clientList [data-action="delete-client"]').click();
  assert.match(await page.locator("#confirmTitle").innerText(), /Arquivar/);
  await page.locator("#confirmForm button[type=submit]").click();
  await page.locator("#confirmDialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator(".clientCard").count(), 0);
  await page.locator("#showArchived").check();
  assert.equal(await page.locator(".clientCard").count(), 1);
  for (const view of [
    "home",
    "bookings",
    "clients",
    "agenda",
    "dashboard",
    "catalog",
    "team",
    "settings",
  ]) {
    await nav(view);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Overflow in " + view,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await nav("home");
  await page.locator('#home [data-action="new-booking"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => {
      const r = document.querySelector("#editor").getBoundingClientRect();
      return r.width <= innerWidth && r.height <= innerHeight;
    }),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#editor").isVisible(), false);
  // Denied writes must show failure and leave the dialog/data intact.
  await nav("clients");
  await page.locator('[data-action="new-client"]').click();
  await page.locator("#clientName").fill("Falha Teste");
  await page.locator("#clientPhone").fill("21987654321");
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota", "QuotaExceededError");
    };
  });
  await page.locator("#saveButton").click();
  await page.locator("#formError:not(.hidden)").waitFor();
  assert.equal(await page.locator("#editor").isVisible(), true);
  await page.evaluate(() => {
    Storage.prototype.setItem = window.originalSetItem;
  });
  await close();
  // Local data tools must preserve the previous state and allow explicit erasure.
  await nav("settings");
  await page.locator('[data-action="demo-data"]').click();
  await page.locator("#confirmForm button[type=submit]").click();
  await page.locator("#confirmDialog").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("brava-v2")).clients[0].name,
    ),
    "Cliente Exemplo (fictício)",
  );
  await page.locator('[data-action="restore-backup"]').click();
  await page.locator("#confirmForm button[type=submit]").click();
  await page.locator("#confirmDialog").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("brava-v2")).clients[0].name,
    ),
    "Nome Vinculado",
  );
  if (process.env.QA_SCREENSHOTS_DIR) {
    await mkdir(process.env.QA_SCREENSHOTS_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await nav("dashboard");
    await page.screenshot({
      path: path.join(process.env.QA_SCREENSHOTS_DIR, "desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await nav("home");
    await page.screenshot({
      path: path.join(process.env.QA_SCREENSHOTS_DIR, "mobile.png"),
      fullPage: true,
    });
  }
  await nav("settings");
  await page.locator('[data-action="clear-data"]').click();
  await page.locator("#confirmForm button[type=submit]").click();
  await page.locator("#confirmDialog").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("brava-v2")).clients.length,
    ),
    0,
  );
  await page.locator('[data-action="erase-all"]').click();
  await page.locator("#confirmForm button[type=submit]").click();
  await page.locator("#confirmDialog").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(() => localStorage.getItem("brava-v2-backup")),
    null,
  );
  assert.deepEqual(errors, []);
  // Migration and corruption on separate origins/contexts.
  const legacyContext = await browser.newContext();
  const legacyPage = await legacyContext.newPage();
  legacyPage.setDefaultTimeout(10000);
  await legacyPage.route("https://**/*", (r) => r.abort());
  await legacyPage.goto(origin);
  await legacyPage.evaluate(() => {
    localStorage.removeItem("brava-v2");
    localStorage.setItem(
      "brava-clients",
      JSON.stringify([
        { id: "old", name: "Cliente Legado", phone: "11987654321" },
      ]),
    );
    localStorage.setItem(
      "brava-bookings",
      JSON.stringify([
        {
          id: 123,
          name: "Cliente Legado",
          service: 0,
          barber: "Rafael",
          date: "2026-11-09",
          time: "09:00",
        },
      ]),
    );
  });
  await legacyPage.reload();
  await legacyPage.locator("#home .service").first().waitFor();
  const migrated = await legacyPage.evaluate(() =>
    JSON.parse(localStorage.getItem("brava-v2")),
  );
  assert.equal(migrated.bookings[0].clientId, migrated.clients[0].id);
  await legacyPage.evaluate(() => localStorage.setItem("brava-v2", "{invalid"));
  await legacyPage.reload();
  await legacyPage.locator("#storageError:not(.hidden)").waitFor();
  assert.equal(
    await legacyPage.evaluate(() => localStorage.getItem("brava-v2")),
    "{invalid",
  );
  const deniedContext = await browser.newContext();
  const deniedPage = await deniedContext.newPage();
  await deniedPage.route("https://**/*", (r) => r.abort());
  await deniedPage.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Denied");
      },
    }),
  );
  await deniedPage.goto(origin);
  await deniedPage.locator("#storageError:not(.hidden)").waitFor();
  console.log(
    "PASS: navigation, CRUD clients, XSS escaping, linked booking, edit/reschedule, cancel/undo, agenda views, services, work schedule, blocks, archive/history, persistence, mobile, Escape, failed writes, migration and corruption.",
  );
} finally {
  if (browser) await browser.close();
  server.close();
}
