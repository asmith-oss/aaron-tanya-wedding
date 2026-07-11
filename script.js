'use strict';

/* -------------------------------------------------
   ELEMENTS
------------------------------------------------- */

const entryScreen = document.getElementById('entryScreen');
const holdButton = document.getElementById('holdButton');
const holdLabel = holdButton?.querySelector('.hold-label');
const holdInstruction = document.getElementById('holdInstruction');
const entrySkip = document.getElementById('entrySkip');

/* -------------------------------------------------
   ACCESSIBILITY + TIMING
------------------------------------------------- */

const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

const HOLD_DURATION = reduceMotion ? 450 : 2800;
const ENTRY_OPEN_DELAY = reduceMotion ? 0 : 700;
const ENTRY_HIDE_DELAY = reduceMotion ? 80 : 3100;

/* -------------------------------------------------
   ENTRY STATE
------------------------------------------------- */

let holdStartTime = 0;
let holdAnimationFrame = null;

let isHolding = false;
let isReadyToOpen = false;
let isUnlocked = false;

let activePointerId = null;

/* -------------------------------------------------
   SESSION STORAGE
------------------------------------------------- */

function getInvitationOpenedState() {
  try {
    return (
      sessionStorage.getItem('weddingInvitationOpened') ===
      'yes'
    );
  } catch (_) {
    return false;
  }
}

function saveInvitationOpenedState() {
  try {
    sessionStorage.setItem(
      'weddingInvitationOpened',
      'yes'
    );
  } catch (_) {
    // Continue normally if storage is unavailable.
  }
}

/* -------------------------------------------------
   HOLD BUTTON HELPERS
------------------------------------------------- */

function setHoldProgress(value) {
  if (!holdButton) return;

  const safeValue = Math.max(0, Math.min(1, value));

  holdButton.style.setProperty(
    '--hold-progress',
    String(safeValue)
  );
}

function setEntryMessage(labelText, instructionText) {
  if (holdLabel) {
    holdLabel.textContent = labelText;
  }

  if (holdInstruction) {
    holdInstruction.textContent = instructionText;
  }
}

function releasePointerCapture() {
  if (
    !holdButton ||
    activePointerId === null
  ) {
    activePointerId = null;
    return;
  }

  try {
    if (
      holdButton.hasPointerCapture?.(
        activePointerId
      )
    ) {
      holdButton.releasePointerCapture(
        activePointerId
      );
    }
  } catch (_) {
    // The browser may already have released it.
  }

  activePointerId = null;
}

/* -------------------------------------------------
   HOLD-TO-ENTER ANIMATION
------------------------------------------------- */

function setReadyState() {
  if (!holdButton || isUnlocked) return;

  isHolding = false;
  isReadyToOpen = true;

  cancelAnimationFrame(holdAnimationFrame);
  holdAnimationFrame = null;

  setHoldProgress(1);

  holdButton.classList.remove('is-holding');
  holdButton.classList.add('is-ready');

  setEntryMessage(
    'Release to enter',
    'Release to open the invitation'
  );
}

function resetHold() {
  if (isUnlocked) return;

  isHolding = false;
  isReadyToOpen = false;

  cancelAnimationFrame(holdAnimationFrame);
  holdAnimationFrame = null;

  releasePointerCapture();

  holdButton?.classList.remove(
    'is-holding',
    'is-ready'
  );

  setHoldProgress(0);

  setEntryMessage(
    'Press and hold to enter',
    'Hold until the ring is complete, then release'
  );
}

function updateHold(currentTime) {
  if (
    !isHolding ||
    isUnlocked ||
    isReadyToOpen
  ) {
    return;
  }

  const elapsedTime =
    currentTime - holdStartTime;

  const progress =
    elapsedTime / HOLD_DURATION;

  setHoldProgress(progress);

  if (progress >= 1) {
    setReadyState();
    return;
  }

  holdAnimationFrame =
    requestAnimationFrame(updateHold);
}

function beginHold(event) {
  if (
    !holdButton ||
    isUnlocked ||
    isReadyToOpen ||
    isHolding
  ) {
    return;
  }

  const isKeyboardEvent =
    event.type === 'keydown';

  if (
    isKeyboardEvent &&
    event.key !== 'Enter' &&
    event.key !== ' '
  ) {
    return;
  }

  if (
    isKeyboardEvent &&
    event.repeat
  ) {
    return;
  }

  event.preventDefault();

  isHolding = true;
  holdStartTime = performance.now();

  holdButton.classList.add('is-holding');

  if (event.pointerId !== undefined) {
    activePointerId = event.pointerId;

    try {
      holdButton.setPointerCapture(
        event.pointerId
      );
    } catch (_) {
      // Pointer capture improves mobile reliability
      // but is not required.
    }
  }

  holdAnimationFrame =
    requestAnimationFrame(updateHold);
}

function endHold(event) {
  event?.preventDefault?.();

  releasePointerCapture();

  if (isReadyToOpen) {
    openInvitation({
      withAnimation: true
    });
  } else {
    resetHold();
  }
}

/* -------------------------------------------------
   OPEN INVITATION
------------------------------------------------- */

function openInvitation({
  withAnimation = true
} = {}) {
  if (!entryScreen || isUnlocked) return;

  isUnlocked = true;
  isHolding = false;
  isReadyToOpen = false;

  cancelAnimationFrame(holdAnimationFrame);
  holdAnimationFrame = null;

  releasePointerCapture();

  holdButton?.classList.remove(
    'is-holding',
    'is-ready'
  );

  const shouldAnimate =
    withAnimation && !reduceMotion;

  if (shouldAnimate) {
    entryScreen.classList.add(
      'is-unlocking'
    );
  }

  window.setTimeout(() => {
    entryScreen.classList.add(
      'is-opening'
    );

    document.body.classList.remove(
      'page-locked'
    );

    saveInvitationOpenedState();
  }, shouldAnimate ? ENTRY_OPEN_DELAY : 0);

  window.setTimeout(() => {
    entryScreen.hidden = true;
  }, shouldAnimate ? ENTRY_HIDE_DELAY : 80);
}

/* -------------------------------------------------
   ENTRY EVENTS
------------------------------------------------- */

holdButton?.addEventListener(
  'pointerdown',
  beginHold
);

holdButton?.addEventListener(
  'pointerup',
  endHold
);

holdButton?.addEventListener(
  'pointercancel',
  resetHold
);

holdButton?.addEventListener(
  'lostpointercapture',
  () => {
    if (
      !isReadyToOpen &&
      !isUnlocked
    ) {
      resetHold();
    }
  }
);

holdButton?.addEventListener(
  'contextmenu',
  (event) => {
    event.preventDefault();
  }
);

holdButton?.addEventListener(
  'keydown',
  beginHold
);

holdButton?.addEventListener(
  'keyup',
  endHold
);

entrySkip?.addEventListener(
  'click',
  () => {
    openInvitation({
      withAnimation: false
    });
  }
);

/* -------------------------------------------------
   RETURN VISITS
------------------------------------------------- */

if (getInvitationOpenedState()) {
  isUnlocked = true;

  if (entryScreen) {
    entryScreen.hidden = true;
  }

  document.body.classList.remove(
    'page-locked'
  );
}

/* -------------------------------------------------
   SCROLL REVEAL ANIMATIONS
------------------------------------------------- */

const revealItems =
  document.querySelectorAll('.reveal');

if (
  reduceMotion ||
  !('IntersectionObserver' in window)
) {
  revealItems.forEach((item) => {
    item.classList.add('visible');
  });
} else {
  const revealObserver =
    new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add(
            'visible'
          );

          observer.unobserve(
            entry.target
          );
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
      }
    );

  revealItems.forEach((item) => {
    revealObserver.observe(item);
  });
}
