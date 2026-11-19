const carousel = document.querySelector('.review-carousel');
const slides = [...carousel.querySelectorAll('.review-slide')];
const position = carousel.querySelector('#review-position');
let current = 0;
let touchStart;

function move(step) {
  slides[current].hidden = true;
  current = (current + step + slides.length) % slides.length;
  slides[current].hidden = false;
  position.textContent = `${current + 1} / ${slides.length}`;
}

carousel.querySelector('#review-prev').addEventListener('click', () => move(-1));
carousel.querySelector('#review-next').addEventListener('click', () => move(1));
carousel.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  move(event.key === 'ArrowLeft' ? -1 : 1);
});
carousel.addEventListener('touchstart', event => {
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
carousel.addEventListener('touchend', event => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const x = touch.clientX - touchStart.x;
  const y = touch.clientY - touchStart.y;
  touchStart = undefined;
  if (Math.abs(x) > 50 && Math.abs(x) > Math.abs(y)) move(x < 0 ? 1 : -1);
}, { passive: true });
