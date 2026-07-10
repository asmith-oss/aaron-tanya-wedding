const entryScreen = document.getElementById('entryScreen');
const holdButton = document.getElementById('holdButton');
const entrySkip = document.getElementById('entrySkip');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const HOLD_DURATION = reduceMotion ? 250 : 1650;
let holdStart = 0;
let animationFrame = null;
let holding = false;
let unlocked = false;

function setProgress(value) {
  const safeValue = Math.max(0, Math.min(1, value));
  holdButton.style.setProperty('--hold-progress', safeValue);
}

function finishEntry() {
  if (unlocked) return;
  unlocked = true;
  holding = false;
  cancelAnimationFrame(animationFrame);
  setProgress(1);
  holdButton.classList.remove('is-holding');
  entryScreen.classList.add('is-unlocking');

  window.setTimeout(() => {
    entryScreen.classList.add('is-opening');
    document.body.classList.remove('page-locked');
    sessionStorage.setItem('weddingInvitationOpened', 'yes');
  }, reduceMotion ? 50 : 650);

  window.setTimeout(() => {
    entryScreen.hidden = true;
  }, reduceMotion ? 100 : 1800);
}

function resetHold() {
  if (!holding || unlocked) return;
  holding = false;
  cancelAnimationFrame(animationFrame);
  holdButton.classList.remove('is-holding');
  setProgress(0);
}

function updateHold(now) {
  if (!holding || unlocked) return;
  const progress = (now - holdStart) / HOLD_DURATION;
  setProgress(progress);

  if (progress >= 1) {
    finishEntry();
    return;
  }

  animationFrame = requestAnimationFrame(updateHold);
}

function beginHold(event) {
  if (unlocked) return;
  if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  holding = true;
  holdStart = performance.now();
  holdButton.classList.add('is-holding');
  animationFrame = requestAnimationFrame(updateHold);
}

holdButton.addEventListener('pointerdown', beginHold);
holdButton.addEventListener('pointerup', resetHold);
holdButton.addEventListener('pointercancel', resetHold);
holdButton.addEventListener('pointerleave', resetHold);
holdButton.addEventListener('keydown', beginHold);
holdButton.addEventListener('keyup', resetHold);
entrySkip.addEventListener('click', finishEntry);

if (sessionStorage.getItem('weddingInvitationOpened') === 'yes') {
  entryScreen.hidden = true;
  document.body.classList.remove('page-locked');
}

const revealItems = document.querySelectorAll('.reveal');

if (reduceMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('visible'));
} else {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => observer.observe(item));
}
