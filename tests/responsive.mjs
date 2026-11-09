import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { startTestServer } from "./server.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const server = await startTestServer();
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
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage(),
    errors = [];
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://**/*", (route) => route.abort());
  await page.goto(server.origin);
  await page.locator("#home .service").first().waitFor();
  await page.evaluate(async () => {
    const { repository: repo } = await import("/modules/repository.js");
    const client = repo.saveClient({
      name: "Cliente de demonstração com um nome longo para testar a leitura no celular",
      phone: "11987654321",
      email: "cliente-ficticio@example.com",
      tags: ["Demonstração", "Preferência de atendimento especial"],
    });
    repo.createBooking({
      clientId: client.id,
      serviceId: "svc-corte",
      barberId: "barber-rafael",
      date: "2030-05-06",
      time: "09:00",
      status: "confirmed",
      notes:
        "Observação de demonstração com mais detalhes para testar quebra de linha.",
    });
  });
  await page.reload();
  const navigate = async (view) => {
    if (await page.locator("#navigationToggle").isVisible())
      await page.locator("#navigationToggle").click();
    await page.locator(`#sidebar [data-view="${view}"]`).click();
    assert.equal(await page.locator(`#${view}`).isVisible(), true);
    assert.equal(
      await page.locator("#navigationToggle").getAttribute("aria-expanded"),
      "false",
    );
  };
  const checkWidth = async (label) => {
    const dimensions = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    assert.ok(
      dimensions.content <= dimensions.viewport + 1,
      `${label}: horizontal overflow ${JSON.stringify(dimensions)}`,
    );
  };
  for (const width of [320, 360, 390, 600, 768, 960, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 600 ? 680 : 900 });
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
      await navigate(view);
      await checkWidth(`${width}/${view}`);
      const boxes = await page.evaluate(() => {
        const loc = document
          .querySelector(".header-location")
          .getBoundingClientRect();
        const profile = document
          .querySelector(".profile")
          .getBoundingClientRect();
        return {
          left: loc.right,
          right: profile.left,
          end: profile.right,
          width: innerWidth,
        };
      });
      assert.ok(
        boxes.left <= boxes.right + 1 && boxes.end <= boxes.width,
        `Header overlap at ${width}/${view}`,
      );
    }
    const trigger = page.locator("#profileTrigger");
    await trigger.click();
    assert.equal(await page.locator("#profileMenu").isVisible(), true);
    const menu = await page.locator("#profileMenu").boundingBox();
    assert.ok(
      menu.x >= 0 && menu.x + menu.width <= width + 1,
      `Profile menu clipped at ${width}`,
    );
    await page.locator('#profileMenu [data-view="bookings"]').click();
    assert.equal(await page.locator("#bookings").isVisible(), true);
    assert.equal(
      await page
        .locator("#content")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(await page.locator("#profileMenu").isVisible(), false);
    await trigger.click();
    await page.keyboard.press("Escape");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    assert.equal(
      await trigger.evaluate((el) => el === document.activeElement),
      true,
    );
    await trigger.press("ArrowDown");
    assert.equal(
      await page
        .locator("#profileMenu button")
        .first()
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Escape");
    await trigger.click();
    await page.locator("#breadcrumb").click();
    assert.equal(await page.locator("#profileMenu").isVisible(), false);
    if (width <= 960) {
      await page.locator("#navigationToggle").click();
      assert.equal(
        await page.locator("#sidebar").evaluate((el) => el.inert),
        false,
      );
      await page.locator("#sidebar nav button").last().focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .locator("#closeNavigation")
          .evaluate((el) => el === document.activeElement),
        true,
      );
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page
          .locator("#sidebar nav button")
          .last()
          .evaluate((el) => el === document.activeElement),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator("#navigationToggle").getAttribute("aria-expanded"),
        "false",
      );
      assert.equal(
        await page.locator("#sidebar").evaluate((el) => el.inert),
        true,
      );
      await page.locator("#navigationToggle").click();
      await page
        .locator("#navigationBackdrop")
        .click({ position: { x: width - 8, y: 20 } });
      assert.equal(
        await page.locator("#navigationToggle").getAttribute("aria-expanded"),
        "false",
      );
    }
    // Booking, client, service and barber forms must fit and remain scrollable.
    for (const [view, action] of [
      ["home", "new-booking"],
      ["clients", "new-client"],
      ["catalog", "new-service"],
      ["team", "new-barber"],
    ]) {
      await navigate(view);
      await page.locator(`#${view} [data-action="${action}"]`).click();
      const box = await page.locator("#editor").boundingBox();
      assert.ok(
        box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= width + 1 &&
          box.height <= (width < 600 ? 680 : 900),
        `Dialog overflow ${width}/${action}`,
      );
      await checkWidth(`${width}/${action}`);
      if (width <= 600)
        assert.ok(
          (await page
            .locator("#editor input")
            .first()
            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) >= 16,
        );
      await page.keyboard.press("Escape");
    }
  }
  // Opening one panel never leaves the other panel open; resizing restores scroll.
  await page.setViewportSize({ width: 390, height: 680 });
  await page.locator("#profileTrigger").click();
  await page.locator("#navigationToggle").click();
  assert.equal(await page.locator("#profileMenu").isVisible(), false);
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.equal(
    await page.locator("#sidebar").evaluate((el) => el.inert),
    false,
  );
  assert.equal(
    await page
      .locator("body")
      .evaluate((el) => el.classList.contains("navigation-open")),
    false,
  );
  if (process.env.QA_SCREENSHOTS_DIR) {
    await mkdir(process.env.QA_SCREENSHOTS_DIR, { recursive: true });
    await navigate("home");
    await page.waitForFunction(
      () => !document.body.classList.contains("navigation-open"),
    );
    await page.locator("#profileTrigger").click();
    await page.locator("#profileMenu").waitFor({ state: "visible" });
    await page.screenshot({
      path: path.join(process.env.QA_SCREENSHOTS_DIR, "desktop-profile.png"),
    });
    await page.locator("#profileTrigger").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await navigate("home");
    await page.screenshot({
      path: path.join(process.env.QA_SCREENSHOTS_DIR, "mobile-home.png"),
      fullPage: true,
    });
    await page.locator("#navigationToggle").click();
    await page.waitForFunction(
      () =>
        Math.abs(document.querySelector("#sidebar").getBoundingClientRect().x) <
        0.5,
    );
    await page.screenshot({
      path: path.join(process.env.QA_SCREENSHOTS_DIR, "mobile-navigation.png"),
    });
  }
  const touchContext = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const touchPage = await touchContext.newPage();
  await touchPage.route("https://**/*", (r) => r.abort());
  await touchPage.goto(server.origin);
  await touchPage.locator("#home .service").first().waitFor();
  await touchPage.locator("#navigationToggle").tap();
  await touchPage.locator('#sidebar [data-view="clients"]').tap();
  assert.equal(await touchPage.locator("#clients").isVisible(), true);
  await touchPage.setViewportSize({ width: 844, height: 390 });
  await touchPage.locator("#profileTrigger").tap();
  const landscapeMenu = await touchPage.locator("#profileMenu").boundingBox();
  assert.ok(
    landscapeMenu.y >= 0 && landscapeMenu.y + landscapeMenu.height <= 390,
    "Profile menu clipped in landscape",
  );
  await touchPage.locator('#profileMenu [data-action="new-booking"]').tap();
  const landscapeDialog = await touchPage.locator("#editor").boundingBox();
  assert.ok(
    landscapeDialog.y >= 0 && landscapeDialog.height <= 390,
    "Dialog clipped in landscape",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 80 screen/viewport combinations (320–1920px), profile menu, navigation drawer, keyboard/focus, resizing and 40 modal/viewport combinations; no JavaScript errors.",
  );
} finally {
  await browser?.close();
  server.close();
}
