import { escapeHTML as esc, money } from "./utils.js";
export { esc, money };
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];
export const option = (value, label, selected = false) =>
  `<option value="${esc(value)}" ${selected ? "selected" : ""}>${esc(label)}</option>`;
export const field = (id, label, input) =>
  `<div class="field"><label for="${id}">${label}</label>${input}</div>`;
export const input = (id, label, value = "", attrs = "") =>
  field(
    id,
    label,
    `<input id="${id}" name="${id}" value="${esc(value)}" ${attrs}>`,
  );
export const textarea = (id, label, value = "", max = 2000) =>
  field(
    id,
    label,
    `<textarea id="${id}" name="${id}" maxlength="${max}" rows="3">${esc(value)}</textarea>`,
  );
export const select = (id, label, options) =>
  field(id, label, `<select id="${id}" name="${id}">${options}</select>`);
export const check = (id, label, checked = false) =>
  `<label class="check"><input type="checkbox" id="${id}" name="${id}" ${checked ? "checked" : ""}> ${label}</label>`;
export const empty = (title, detail = "") =>
  `<div class="empty"><h3>${esc(title)}</h3><p>${esc(detail)}</p></div>`;
export function notify(message, error = false) {
  const el = $("#feedback");
  el.className = error ? "error" : "notice";
  el.textContent = message;
  el.focus({ preventScroll: true });
  const local = $("#dialogFeedback");
  if (local) {
    local.className = error ? "error" : "notice";
    local.textContent = message;
  }
}
export function showError(error) {
  notify(error.message || "Não foi possível concluir esta ação.", true);
}
export function openEditor(title, content) {
  const dialog = $("#editor");
  if (dialog.open) dialog.close();
  dialog.innerHTML = `<button class="close" type="button" data-close aria-label="Fechar janela">×</button><span class="eyebrow">La Brava App · SEU ESPAÇO</span><h2 id="editorTitle">${esc(title)}</h2><div id="dialogFeedback" role="status" aria-live="polite"></div>${content}`;
  dialog.showModal();
  $("[data-close]", dialog).onclick = () => dialog.close();
  return dialog;
}
export function formShell(content, label = "Salvar") {
  return `<form id="editorForm">${content}<p id="formError" class="error hidden" role="alert"></p><button class="primary wide" type="submit" id="saveButton">${label}</button></form>`;
}
export function bindSubmit(handler) {
  const form = $("#editorForm");
  let busy = false;
  const validate = () => {
    if (!busy)
      $("#saveButton").disabled =
        form.dataset.ready === "false" || !form.checkValidity();
  };
  form.addEventListener("input", validate);
  validate();
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (busy || !form.reportValidity()) return;
    busy = true;
    const button = $("#saveButton"),
      label = button.textContent;
    button.disabled = true;
    button.textContent = "Salvando…";
    try {
      await handler(form);
    } catch (error) {
      const el = $("#formError");
      if (el) {
        el.textContent = error.message;
        el.classList.remove("hidden");
        el.tabIndex = -1;
        el.focus();
      } else showError(error);
    } finally {
      busy = false;
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = label;
        form.dispatchEvent(new Event("input"));
      }
    }
  };
}
export const value = (id) => document.getElementById(id).value.trim();
export const checked = (id) => document.getElementById(id).checked;
export function confirmAction({
  title,
  message,
  reason = false,
  label = "Confirmar",
  onConfirm,
}) {
  const dialog = $("#confirmDialog");
  if (dialog.open) dialog.close();
  dialog.innerHTML = `<h2 id="confirmTitle">${esc(title)}</h2><p>${esc(message)}</p><form id="confirmForm">${reason ? textarea("confirmReason", "Motivo do cancelamento *", "", 500) : ""}<p class="error hidden" id="confirmError" role="alert"></p><div class="actions"><button class="secondary" type="button" id="confirmBack">Voltar</button><button class="primary" type="submit">${esc(label)}</button></div></form>`;
  if (reason) $("#confirmReason").required = true;
  $("#confirmBack").onclick = () => dialog.close();
  let busy = false;
  $("#confirmForm").onsubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    const button = $("button[type=submit]", dialog);
    button.disabled = true;
    try {
      await onConfirm(reason ? value("confirmReason") : "");
      dialog.close();
    } catch (error) {
      $("#confirmError").textContent = error.message;
      $("#confirmError").classList.remove("hidden");
    } finally {
      busy = false;
      button.disabled = false;
    }
  };
  dialog.showModal();
}
export const statusBadge = (status, labels) =>
  `<span class="status status-${esc(status)}">${esc(labels[status] || status)}</span>`;
export const metric = (label, value, detail = "") =>
  `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`;
