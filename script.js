'use strict';

/* -------------------------------------------------
   ELEMENTS
------------------------------------------------- */

const entryScreen =
  document.getElementById('entryScreen');

const holdButton =
  document.getElementById('holdButton');

const holdLabel =
  holdButton?.querySelector('.hold-label');

const holdInstruction =
  document.getElementById('holdInstruction');

const entrySkip =
  document.getElementById('entrySkip');

const spotifyEmbed =
  document.getElementById('spotifyEmbed');

/* -------------------------------------------------
   ACCESSIBILITY + TIMING
------------------------------------------------- */

const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

/*
  This remains exactly 2.8 seconds for everyone.
*/
const HOLD_DURATION = 2800;

const ENTRY_OPEN_DELAY =
  reduceMotion ? 0 : 700;

const ENTRY_HIDE_DELAY =
  reduceMotion ? 80 : 3100;

/* -------------------------------------------------
   SPOTIFY
------------------------------------------------- */

const SPOTIFY_TRACK_URI =
  'spotify:track:7E3YInQ8ZQuZgQhu2Sfito';

let spotifyController = null;
let spotifyReady = false;
let pendingSpotifyPlayback = false;

/*
  Spotify calls this function after its iframe API loads.

  The controller creates the visible Spotify player inside
  the music section. It does not create a floating button
  or a player at the top of the page.
*/
window.onSpotifyIframeApiReady = (IFrameAPI) => {
  if (!spotifyEmbed) return;

  const options = {
    width: '100%',
    height: '152',
    uri: SPOTIFY_TRACK_URI
  };

  IFrameAPI.createController(
    spotifyEmbed,
    options,
    (controller) => {
      spotifyController = controller;

      controller.addListener('ready', () => {
        spotifyReady = true;

        /*
          This is a backup attempt in case Spotify finished
          loading immediately after the invitation opened.
        */
        if (pendingSpotifyPlayback) {
          pendingSpotifyPlayback = false;
          controller.play();
        }
      });
    }
  );
};

function startSpotifyFromEntry() {
  if (
    spotifyController &&
    spotifyReady
  ) {
    /*
      This is called directly from the guest's release
      or click action, giving autoplay its best chance.
    */
    spotifyController.play();
    pendingSpotifyPlayback = false;
    return;
  }

  /*
    Spotify may still be initializing. Do not delay or
    change the invitation unlock timing.
  */
  pendingSpotifyPlayback = true;
}

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
      sessionStorage.getItem(
        'weddingInvitationOpened'
      ) === 'yes'
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
    // Continue if storage is unavailable.
  }
}

/* -------------------------------------------------
   HOLD BUTTON HELPERS
------------------------------------------------- */

function setHoldProgress(value) {
  if (!holdButton) return;

  const safeValue =
    Math.max(0, Math.min(1, value));

  holdButton.style.setProperty(
    '--hold-progress',
    String(safeValue)
  );
}

function setEntryMessage(
  labelText,
  instructionText
) {
  if (holdLabel) {
    holdLabel.textContent = labelText;
  }

  if (holdInstruction) {
    holdInstruction.textContent =
      instructionText;
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
    // The browser may have already released it.
  }

  activePointerId = null;
}

/* -------------------------------------------------
   HOLD-TO-ENTER
------------------------------------------------- */

function setReadyState() {
  if (!holdButton || isUnlocked) return;

  isHolding = false;
  isReadyToOpen = true;

  cancelAnimationFrame(
    holdAnimationFrame
  );

  holdAnimationFrame = null;

  setHoldProgress(1);

  holdButton.classList.remove(
    'is-holding'
  );

  holdButton.classList.add(
    'is-ready'
  );

  setEntryMessage(
    'Release to enter',
    'Release to open the invitation'
  );
}

function resetHold() {
  if (isUnlocked) return;

  isHolding = false;
  isReadyToOpen = false;

  cancelAnimationFrame(
    holdAnimationFrame
  );

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

  holdButton.classList.add(
    'is-holding'
  );

  if (
    event.pointerId !== undefined
  ) {
    activePointerId =
      event.pointerId;

    try {
      holdButton.setPointerCapture(
        event.pointerId
      );
    } catch (_) {
      // Pointer capture is helpful but optional.
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
  if (
    !entryScreen ||
    isUnlocked
  ) {
    return;
  }

  isUnlocked = true;
  isHolding = false;
  isReadyToOpen = false;

  cancelAnimationFrame(
    holdAnimationFrame
  );

  holdAnimationFrame = null;

  releasePointerCapture();

  holdButton?.classList.remove(
    'is-holding',
    'is-ready'
  );

  /*
    Start Spotify immediately while this function is
    still running from the guest's release or click.
  */
  startSpotifyFromEntry();

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
   SCROLL REVEALS
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
          if (
            !entry.isIntersecting
          ) {
            return;
          }

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
        rootMargin:
          '0px 0px -40px 0px'
      }
    );

  revealItems.forEach((item) => {
    revealObserver.observe(item);
  });
}
