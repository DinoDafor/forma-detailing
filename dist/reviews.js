const carousel = document.querySelector('.review-carousel');
const track = carousel.querySelector('.review-track');
const slides = [...track.querySelectorAll('.review-slide')];
const dots = [...carousel.querySelectorAll('[data-review-index]')];
const toggle = carousel.querySelector('#review-toggle');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let current = 0;
let timer;
let onScreen = false;
let hovering = false;
let paused = motion.matches;
let touchStart;

function schedule() {
  clearTimeout(timer);
  if (paused || hovering || !onScreen || document.hidden || carousel.contains(document.activeElement)) return;
  timer = setTimeout(() => show(current + 1), 9000);
}

function show(index) {
  const next = (index + slides.length) % slides.length;
  track.classList.toggle('review-jump', Math.abs(next - current) > 1);
  current = next;
  track.style.setProperty('--review-offset', `-${current * 100}%`);
  slides.forEach((slide, index) => {
    slide.inert = index !== current;
    slide.setAttribute('aria-hidden', String(index !== current));
  });
  dots.forEach((dot, index) => dot.setAttribute('aria-current', index === current ? 'true' : 'false'));
  schedule();
}

function updateToggle() {
  const label = paused ? 'Запустить прокрутку' : 'Приостановить';
  toggle.textContent = window.FormaI18n?.t(label) ?? label;
  track.setAttribute('aria-live', paused ? 'polite' : 'off');
}

dots.forEach((dot, index) => dot.addEventListener('click', () => show(index)));
toggle.addEventListener('click', () => {
  paused = !paused;
  updateToggle();
  schedule();
});
carousel.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  show(current + (event.key === 'ArrowLeft' ? -1 : 1));
  if (dots.includes(event.target)) dots[current].focus();
});
carousel.addEventListener('pointerenter', event => {
  if (event.pointerType === 'mouse') { hovering = true; schedule(); }
});
carousel.addEventListener('pointerleave', () => { hovering = false; schedule(); });
carousel.addEventListener('focusin', schedule);
carousel.addEventListener('focusout', () => setTimeout(schedule, 0));
carousel.addEventListener('touchstart', event => {
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
  clearTimeout(timer);
}, { passive: true });
carousel.addEventListener('touchend', event => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const x = touch.clientX - touchStart.x;
  const y = touch.clientY - touchStart.y;
  touchStart = undefined;
  if (Math.abs(x) > 50 && Math.abs(x) > Math.abs(y)) show(current + (x < 0 ? 1 : -1));
  else schedule();
}, { passive: true });
carousel.addEventListener('touchcancel', () => { touchStart = undefined; schedule(); });
document.addEventListener('visibilitychange', schedule);
window.addEventListener('forma:languagechange', updateToggle);
motion.addEventListener('change', () => { paused = motion.matches; updateToggle(); schedule(); });
new IntersectionObserver(([entry]) => {
  onScreen = entry.isIntersecting;
  schedule();
}, { threshold: 0.35 }).observe(carousel);
show(0);
updateToggle();
