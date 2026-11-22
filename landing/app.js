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
const heroDemo = document.querySelector("#hero-demo");
if (heroVisual && heroDemo && window.Motion && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  heroVisual.classList.add("is-animating");
  try {
    const M = Motion.film({ fps: 30, duration: 7.2, width: 1920, height: 1080, clock: "smooth" });
    const prompt = document.querySelector("#hero-composer-text").textContent;
    const typing = M.cadence(prompt, { style: "prompt", seed: 17, start: 3 });
    const sendFrame = typing[typing.length - 1][0] + 7;
    const userFrame = sendFrame + 6;
    const responseFrame = userFrame + 36;
    const reviewFrame = userFrame + 80;
    const sendButton = document.querySelector("#hero-send");
    const panelRect = heroDemo.getBoundingClientRect();
    const sendRect = sendButton.getBoundingClientRect();
    const sendX = sendRect.left - panelRect.left + sendRect.width / 2;
    const sendY = sendRect.top - panelRect.top + sendRect.height / 2;

    M.show("#hero-composer-placeholder", 0, 3);
    M.show("#hero-composer-placeholder", userFrame);
    M.show("#hero-composer-text", 3, userFrame);
    M.type("#hero-composer-text", {
      at: 3,
      style: "prompt",
      seed: 17,
      caret: "#hero-composer-caret",
      caretGap: 4,
      caretOff: userFrame,
      recenter: false,
    });

    M.hide("#hero-user-message", 0);
    M.enter("#hero-user-message", { at: userFrame, frames: 10, ease: "softLand", from: { x: 26, y: 6, scale: 0.98, opacity: 0.2 } });
    M.hide("#hero-agent-message", 0);
    M.enter("#hero-agent-message", { at: responseFrame, frames: 12, ease: "softLand", from: { x: -20, y: 8, opacity: 0.18 } });

    M.hide("#hero-status-working", 0);
    M.enter("#hero-status-working", { at: userFrame + 2, frames: 7, ease: "softLand", from: { y: 5, opacity: 0.1 } });
    M.exit("#hero-status-working", { at: reviewFrame - 8, frames: 7, ease: "accelExit", to: { y: -5, opacity: 0 } });
    M.hide("#hero-status-review", 0);
    M.enter("#hero-status-review", { at: reviewFrame, frames: 8, ease: "softLand", from: { y: 6, opacity: 0.1 } });

    M.hide("#hero-review-card", 0);
    M.enter("#hero-review-card", { at: reviewFrame, frames: 12, ease: "softLand", from: { x: 26, y: 8, scale: 0.98, opacity: 0.14 } });

    M.cursor("#hero-pointer", {
      keys: [
        [sendFrame - 13, sendX - 76, sendY + 68, 1.45, -10],
        [sendFrame - 5, sendX, sendY, 1, 0],
      ],
      hideAt: sendFrame + 14,
      ease: "glide",
    });
    M.press("#hero-pointer", "#hero-send", { at: sendFrame, cursorDepth: 0.82, targetDepth: 0.82, lag: 1, frames: 3, release: true });

    M.seek(0);
    heroVisual.classList.remove("is-animating");

    let motionReady = false;
    let heroInView = !window.IntersectionObserver;
    let played = false;
    const playHero = () => {
      if (!motionReady || !heroInView || played) return;
      played = true;
      M.tl.repeat(-1);
      M.tl.play(0);
    };
    Motion.loaded().then(() => { motionReady = true; playHero(); });
    if (window.IntersectionObserver) {
      const heroObserver = new IntersectionObserver((entries) => {
        heroInView = entries.some((entry) => entry.isIntersecting);
        playHero();
        if (played) heroObserver.disconnect();
      }, { threshold: 0.2 });
      heroObserver.observe(heroVisual);
    }
  } catch {
    heroVisual.classList.remove("is-animating");
  }
}

const heroNetwork = document.querySelector(".hero-network");
if (heroNetwork) {
  const context = heroNetwork.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let points = [];
  let animationFrame = 0;
  let previousTime = 0;
  let inView = true;
  let seed = 913974;

  function random() {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  }

  function resizeNetwork() {
    const bounds = heroNetwork.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = bounds.width;
    height = bounds.height;
    heroNetwork.width = Math.round(width * pixelRatio);
    heroNetwork.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const pointCount = Math.max(26, Math.min(180, Math.round(width * height / 9500)));
    points = Array.from({ length: pointCount }, () => ({
      x: random() * width,
      y: random() * height,
      vx: (random() - .5) * 7,
      vy: (random() - .5) * 5,
      radius: .7 + random() * .8,
    }));
    drawNetwork(0, false);
  }

  function drawNetwork(time, animate = true) {
    if (!context || !width || !height) return;
    const delta = Math.min((time - previousTime) / 1000 || 0, .05);
    previousTime = time;
    context.clearRect(0, 0, width, height);

    if (animate) {
      for (const point of points) {
        point.x += point.vx * delta;
        point.y += point.vy * delta;
        if (point.x < 0 || point.x > width) point.vx *= -1;
        if (point.y < 0 || point.y > height) point.vy *= -1;
        point.x = Math.max(0, Math.min(width, point.x));
        point.y = Math.max(0, Math.min(height, point.y));
      }
    }

    const reach = Math.min(170, Math.max(115, width * .28));
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      for (let j = i + 1; j < points.length; j++) {
        const other = points[j];
        const dx = other.x - point.x;
        const dy = other.y - point.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= reach) continue;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(other.x, other.y);
        context.strokeStyle = `rgba(220, 58, 94, ${(1 - distance / reach) * .27})`;
        context.lineWidth = .8;
        context.stroke();
      }
    }

    for (const point of points) {
      context.beginPath();
      context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      context.fillStyle = "rgba(239, 111, 145, .58)";
      context.fill();
    }

    if (animate && inView && !reducedMotion.matches) animationFrame = requestAnimationFrame(drawNetwork);
  }

  function startNetwork() {
    if (!animationFrame && inView && !reducedMotion.matches) animationFrame = requestAnimationFrame(drawNetwork);
    else if (reducedMotion.matches) drawNetwork(performance.now(), false);
  }

  function stopNetwork() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  resizeNetwork();
  const networkObserver = new ResizeObserver(resizeNetwork);
  networkObserver.observe(heroNetwork.parentElement);
  if ("IntersectionObserver" in window) {
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) startNetwork();
      else stopNetwork();
    });
    visibilityObserver.observe(heroNetwork);
  }
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      stopNetwork();
      drawNetwork(performance.now(), false);
    } else startNetwork();
  });
  startNetwork();
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
