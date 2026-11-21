const header = document.querySelector(".site-header");
const menu = document.querySelector("#mobile-menu");
const menuButton = document.querySelector(".menu-button");
const menuClose = document.querySelector(".menu-close");

function setHeaderState() {
  header.classList.toggle("is-scrolled", window.scrollY > 8);
}

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

menuButton.addEventListener("click", () => {
  menu.showModal();
  menuButton.setAttribute("aria-expanded", "true");
  menuClose.focus();
});
function closeMenu() {
  if (menu.open) menu.close();
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.focus();
}
menuClose.addEventListener("click", closeMenu);
menu.addEventListener("click", (event) => {
  if (event.target.closest("a")) menu.close();
});
menu.addEventListener("close", () => menuButton.setAttribute("aria-expanded", "false"));

const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
function activateTab(index, focus = false) {
  tabs.forEach((tab, current) => {
    const selected = current === index;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panels[current].hidden = !selected;
    panels[current].classList.toggle("is-active", selected);
  });
  if (focus) tabs[index].focus();
}
tabs.forEach((tab, index) => tab.addEventListener("click", () => activateTab(index)));
document.querySelector(".mode-tabs").addEventListener("keydown", (event) => {
  const current = tabs.indexOf(document.activeElement);
  if (current < 0) return;
  let next = current;
  if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
  else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.length - 1;
  else return;
  event.preventDefault();
  activateTab(next, true);
});

const faqButtons = [...document.querySelectorAll(".faq-trigger")];
faqButtons.forEach((button, index) => {
  const panel = document.getElementById(button.getAttribute("aria-controls"));
  const open = index === 0;
  button.setAttribute("aria-expanded", String(open));
  button.querySelector(".faq-indicator").textContent = open ? "−" : "+";
  panel.hidden = !open;
  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    button.querySelector(".faq-indicator").textContent = expanded ? "+" : "−";
    panel.hidden = expanded;
  });
});

document.querySelectorAll(".copy-button").forEach((button) => {
  button.addEventListener("click", async () => {
    const text = button.dataset.copy;
    const label = button.querySelector(".copy-label");
    try {
      await navigator.clipboard.writeText(text);
      label.textContent = "Copied";
      button.setAttribute("aria-label", "Setup commands copied");
      button.setAttribute("aria-live", "polite");
      window.setTimeout(() => {
        label.textContent = "Copy";
        button.setAttribute("aria-label", "Copy setup commands");
        button.removeAttribute("aria-live");
      }, 1500);
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = text;
      fallback.setAttribute("readonly", "");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.append(fallback);
      fallback.select();
      document.execCommand("copy");
      fallback.remove();
      label.textContent = "Copied";
      window.setTimeout(() => { label.textContent = "Copy"; }, 1500);
    }
  });
});

const heroVisual = document.querySelector(".hero-visual");
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll(".hero-visual [data-seq]").forEach((line, index) => {
    line.style.animationDelay = `${320 + index * 130}ms`;
  });
  requestAnimationFrame(() => heroVisual.classList.add("is-playing"));
}

const reveals = [...document.querySelectorAll("[data-reveal]")];
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, { threshold: .2 });
  reveals.forEach((item) => observer.observe(item));
} else {
  reveals.forEach((item) => item.classList.add("is-visible"));
}
