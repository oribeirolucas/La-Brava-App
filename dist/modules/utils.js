import { TIME_ZONE } from "./config.js";
export const clone = (value) => structuredClone(value);
export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  return [...bytes]
    .map(
      (n, i) =>
        ([4, 6, 8, 10].includes(i) ? "-" : "") +
        n.toString(16).padStart(2, "0"),
    )
    .join("");
}
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const money = (cents) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function parseMoney(value) {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text))
    throw new Error("Informe um valor válido, com até duas casas decimais.");
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function today(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !isNaN(d) && d.toISOString().slice(0, 10) === value;
}
export const validTime = (value) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "");
export const minutes = (time) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export const toTime = (value) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
// Brasília has UTC-03:00 and no daylight saving time. Date-only arithmetic stays in UTC.
export const timestamp = (date, time) =>
  new Date(`${date}T${time}:00-03:00`).getTime();
export const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
export function addDays(date, count) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export const formatDate = (date) =>
  validDate(date) ? date.split("-").reverse().join("/") : "—";
export const dateLabel = (booking) =>
  `${formatDate(booking.date)} às ${booking.time}`;
export function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  if (!/^55[1-9]\d[2-9]\d{7,8}$/.test(digits))
    throw new Error("Informe um telefone brasileiro válido com DDD.");
  return digits;
}
export function formatPhone(value) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return value || "Sem telefone";
}
export const emailValid = (email) =>
  !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const effectivePrice = (service) =>
  service.promoCents ?? service.priceCents;
export function text(value, max = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}
