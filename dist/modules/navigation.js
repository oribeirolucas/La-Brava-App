/** Layout-only controls; no authentication or customer data is changed here. */
export function setupNavigation() {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("navigationToggle");
  const closeButton = document.getElementById("closeNavigation");
  const backdrop = document.getElementById("navigationBackdrop");
  const profile = document.querySelector(".profile");
  const profileTrigger = document.getElementById("profileTrigger");
  const profileMenu = document.getElementById("profileMenu");
  const compact = window.matchMedia("(max-width: 960px)");
  let previousFocus;

  function closeProfile(returnFocus = false) {
    profileMenu.hidden = true;
    profileTrigger.setAttribute("aria-expanded", "false");
    profileTrigger.setAttribute("aria-label", "Abrir menu do seu espaço");
    if (returnFocus) profileTrigger.focus();
  }
  function closeNavigation(returnFocus = false) {
    document.body.classList.remove("navigation-open");
    toggle.setAttribute("aria-expanded", "false");
    backdrop.hidden = true;
    sidebar.inert = compact.matches;
    sidebar.removeAttribute("role");
    sidebar.removeAttribute("aria-modal");
    if (returnFocus && compact.matches) (previousFocus || toggle).focus();
  }
  function openNavigation() {
    if (!compact.matches) return;
    closeProfile();
    previousFocus = document.activeElement;
    sidebar.inert = false;
    sidebar.setAttribute("role", "dialog");
    sidebar.setAttribute("aria-modal", "true");
    document.body.classList.add("navigation-open");
    toggle.setAttribute("aria-expanded", "true");
    backdrop.hidden = false;
    closeButton.focus();
  }
  toggle.addEventListener("click", () => {
    if (toggle.getAttribute("aria-expanded") === "true") closeNavigation(true);
    else openNavigation();
  });
  closeButton.addEventListener("click", () => closeNavigation(true));
  backdrop.addEventListener("click", () => closeNavigation(true));
  profileTrigger.addEventListener("click", () => {
    const opening = profileMenu.hidden;
    closeNavigation();
    profileMenu.hidden = !opening;
    profileTrigger.setAttribute("aria-expanded", String(opening));
    profileTrigger.setAttribute(
      "aria-label",
      opening ? "Fechar menu do seu espaço" : "Abrir menu do seu espaço",
    );
  });
  profileTrigger.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    profileMenu.hidden = false;
    profileTrigger.setAttribute("aria-expanded", "true");
    profileTrigger.setAttribute("aria-label", "Fechar menu do seu espaço");
    profileMenu.querySelector("button").focus();
  });
  document.addEventListener("click", (event) => {
    if (!profile.contains(event.target)) closeProfile();
    if (event.target.closest("[data-view], [data-action]")) {
      const fromNavigation =
        sidebar.contains(event.target) || profileMenu.contains(event.target);
      if (sidebar.contains(event.target)) closeNavigation();
      closeProfile();
      if (fromNavigation)
        document.querySelector("main").focus({ preventScroll: true });
    }
  });
  document.addEventListener("focusin", (event) => {
    if (!profile.contains(event.target)) closeProfile();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!profileMenu.hidden) {
        event.preventDefault();
        closeProfile(true);
      }
      if (toggle.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        closeNavigation(true);
      }
    }
    if (
      event.key !== "Tab" ||
      !compact.matches ||
      toggle.getAttribute("aria-expanded") !== "true"
    )
      return;
    const controls = [
      ...sidebar.querySelectorAll("button:not(:disabled), a[href]"),
    ];
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  compact.addEventListener("change", () => {
    closeProfile();
    closeNavigation();
  });
  closeNavigation();
}
