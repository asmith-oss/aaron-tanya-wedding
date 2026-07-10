const entryScreen = document.getElementById('entryScreen');
const holdButton = document.getElementById('holdButton');
const holdLabel = holdButton?.querySelector('.hold-label');
const holdInstruction = document.getElementById('holdInstruction');
const entrySkip = document.getElementById('entrySkip');
const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;


// Hold time: 2.8 seconds
const HOLD_DURATION = 2800;

let holdStart = 0;
let animationFrame = null;
let holding = false;
let readyToOpen = false;
let unlocked = false;
let activePointerId = null;

function setProgress(value) {
  const safeValue = Math.max(0, Math.min(1, value));
  holdButton.style.setProperty('--hold-progress', safeValue);
}

function setReadyState() {
  readyToOpen = true;
  holding = false;

  cancelAnimationFrame(animationFrame);
  setProgress(1);

  holdButton.classList.remove('is-holding');
  holdButton.classList.add('is-ready');

  if (holdLabel) {
    holdLabel.textContent = 'Release to enter';
  }

  if (holdInstruction) {
    holdInstruction.textContent = 'Release to open the invitation';
  }
}

function finishEntry() {
  if (unlocked) return;

  unlocked = true;
  holding = false;
  readyToOpen = false;

  cancelAnimationFrame(animationFrame);

  holdButton.classList.remove('is-holding', 'is-ready');
  entryScreen.classList.add('is-unlocking');

  // The invitation begins opening only after the finger or mouse is released.
  window.setTimeout(() => {
    entryScreen.classList.add('is-opening');
    document.body.classList.remove('page-locked');
    sessionStorage.setItem('weddingInvitationOpened', 'yes');
  }, 700);

  window.setTimeout(() => {
    entryScreen.hidden = true;
  }, 3100);
}

function resetHold() {
  if (unlocked) return;

  holding = false;
  readyToOpen = false;

  cancelAnimationFrame(animationFrame);

  holdButton.classList.remove('is-holding', 'is-ready');
  setProgress(0);

  if (holdLabel) {
    holdLabel.textContent = 'Press and hold';
  }

  if (holdInstruction) {
    holdInstruction.textContent =
      'Hold until the ring is complete, then release';
  }
}

function updateHold(now) {
  if (!holding || unlocked || readyToOpen) return;

  const progress = (now - holdStart) / HOLD_DURATION;
  setProgress(progress);

  if (progress >= 1) {
    setReadyState();
    return;
  }

  animationFrame = requestAnimationFrame(updateHold);
}

function beginHold(event) {
  if (unlocked || readyToOpen) return;

  if (
    event.type === 'keydown' &&
    !['Enter', ' '].includes(event.key)
  ) {
    return;
  }

  if (holding) return;

  event.preventDefault();

  holding = true;
  holdStart = performance.now();

  holdButton.classList.add('is-holding');

  if (event.pointerId !== undefined) {
    activePointerId = event.pointerId;

    try {
      holdButton.setPointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture is helpful but not required.
    }
  }

  animationFrame = requestAnimationFrame(updateHold);
}

function endHold(event) {
  if (event?.preventDefault) {
    event.preventDefault();
  }

  if (
    activePointerId !== null &&
    event?.pointerId === activePointerId
  ) {
    try {
      holdButton.releasePointerCapture(activePointerId);
    } catch (_) {
      // The browser may already have released it.
    }

    activePointerId = null;
  }

  if (readyToOpen) {
    finishEntry();
  } else {
    resetHold();
  }
}

holdButton.addEventListener('pointerdown', beginHold);
holdButton.addEventListener('pointerup', endHold);
holdButton.addEventListener('pointercancel', resetHold);

holdButton.addEventListener('lostpointercapture', () => {
  if (!readyToOpen && !unlocked) {
    resetHold();
  }
});

holdButton.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

holdButton.addEventListener('keydown', beginHold);
holdButton.addEventListener('keyup', endHold);

entrySkip.addEventListener('click', finishEntry);

// Skip the entrance if it was already opened during this browser session.
if (
  sessionStorage.getItem('weddingInvitationOpened') === 'yes'
) {
  entryScreen.hidden = true;
  document.body.classList.remove('page-locked');
}

// Existing scroll-reveal animations
const revealItems = document.querySelectorAll('.reveal');

if (
  reduceMotion ||
  !('IntersectionObserver' in window)
) {
  revealItems.forEach((item) => {
    item.classList.add('visible');
  });
} else {
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12
    }
  );

  revealItems.forEach((item) => {
    observer.observe(item);
  });
}
