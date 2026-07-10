const entryScreen = document.getElementById('entryScreen');
const holdButton = document.getElementById('holdButton');
const holdLabel = holdButton?.querySelector('.hold-label');
const holdInstruction = document.getElementById('holdInstruction');
const entrySkip = document.getElementById('entrySkip');

const musicToggle = document.getElementById('musicToggle');
const musicLabel = document.getElementById('musicLabel');
const spotifyEmbed = document.getElementById('spotifyEmbed');

const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

const HOLD_DURATION = 2800;
const SPOTIFY_TRACK_URI = 'spotify:track:7E3YInQ8ZQuZgQhu2Sfito';

let holdStart = 0;
let animationFrame = null;
let holding = false;
let readyToOpen = false;
let unlocked = false;
let activePointerId = null;

let spotifyController = null;
let spotifyReady = false;
let musicPlaying = false;
let pendingEntryPlayback = false;
let playbackConfirmationTimer = null;

function setProgress(value) {
  const safeValue = Math.max(0, Math.min(1, value));

  holdButton?.style.setProperty(
    '--hold-progress',
    safeValue
  );
}

function setMusicButtonState(isPlaying, fallbackText = null) {
  musicPlaying = isPlaying;

  musicToggle?.classList.toggle(
    'is-playing',
    isPlaying
  );

  if (musicLabel) {
    musicLabel.textContent =
      fallbackText ||
      (isPlaying ? 'Pause Our Song' : 'Play Our Song');
  }

  musicToggle?.setAttribute(
    'aria-label',
    isPlaying
      ? 'Pause our song, It Is Well, on Spotify'
      : 'Play our song, It Is Well, on Spotify'
  );
}

function revealMusicButton() {
  if (!musicToggle) return;

  musicToggle.hidden = false;

  requestAnimationFrame(() => {
    musicToggle.classList.add('is-visible');
  });
}

function tryStartMusicFromEntry() {
  revealMusicButton();

  if (!spotifyController || !spotifyReady) {
    pendingEntryPlayback = true;
    setMusicButtonState(false, 'Play Our Song');
    return;
  }

  pendingEntryPlayback = false;
  spotifyController.play();

  clearTimeout(playbackConfirmationTimer);

  playbackConfirmationTimer = window.setTimeout(() => {
    if (!musicPlaying) {
      setMusicButtonState(
        false,
        'Tap to Play Our Song'
      );
    }
  }, 1800);
}

/*
  Spotify calls this function automatically after its iframe API loads.
*/
window.onSpotifyIframeApiReady = (IFrameAPI) => {
  if (!spotifyEmbed) return;

  const options = {
    width: 152,
    height: 152,
    uri: SPOTIFY_TRACK_URI
  };

  IFrameAPI.createController(
    spotifyEmbed,
    options,
    (controller) => {
      spotifyController = controller;

      controller.addListener('ready', () => {
        spotifyReady = true;

        if (pendingEntryPlayback) {
          controller.play();
          pendingEntryPlayback = false;
        }
      });

      controller.addListener('playback_started', () => {
        clearTimeout(playbackConfirmationTimer);
        setMusicButtonState(true);
        revealMusicButton();
      });

      controller.addListener(
        'playback_update',
        (event) => {
          if (!event?.data) return;

          const isPaused = Boolean(
            event.data.isPaused
          );

          const hasStarted =
            Number(event.data.position) > 0 ||
            (
              !isPaused &&
              !event.data.isBuffering
            );

          if (hasStarted) {
            setMusicButtonState(!isPaused);
          }
        }
      );
    }
  );
};

musicToggle?.addEventListener('click', () => {
  if (!spotifyController || !spotifyReady) {
    setMusicButtonState(
      false,
      'Spotify Is Loading…'
    );
    return;
  }

  spotifyController.togglePlay();
});

function setReadyState() {
  readyToOpen = true;
  holding = false;

  cancelAnimationFrame(animationFrame);
  setProgress(1);

  holdButton?.classList.remove('is-holding');
  holdButton?.classList.add('is-ready');

  if (holdLabel) {
    holdLabel.textContent = 'Release to enter';
  }

  if (holdInstruction) {
    holdInstruction.textContent =
      'Release to open the invitation';
  }
}

function finishEntry() {
  if (unlocked) return;

  unlocked = true;
  holding = false;
  readyToOpen = false;

  cancelAnimationFrame(animationFrame);

  holdButton?.classList.remove(
    'is-holding',
    'is-ready'
  );

  entryScreen?.classList.add('is-unlocking');

  /*
    This runs directly from the release or click interaction,
    giving Spotify the best chance to begin playback.
  */
  tryStartMusicFromEntry();

  window.setTimeout(() => {
    entryScreen?.classList.add('is-opening');
    document.body.classList.remove('page-locked');

    sessionStorage.setItem(
      'weddingInvitationOpened',
      'yes'
    );
  }, 700);

  window.setTimeout(() => {
    if (entryScreen) {
      entryScreen.hidden = true;
    }
  }, 3100);
}

function resetHold() {
  if (unlocked) return;

  holding = false;
  readyToOpen = false;

  cancelAnimationFrame(animationFrame);

  holdButton?.classList.remove(
    'is-holding',
    'is-ready'
  );

  setProgress(0);

  if (holdLabel) {
    holdLabel.textContent =
      'Press and hold to enter';
  }

  if (holdInstruction) {
    holdInstruction.textContent =
      'Hold until the ring is complete, then release';
  }
}

function updateHold(now) {
  if (!holding || unlocked || readyToOpen) return;

  const progress =
    (now - holdStart) / HOLD_DURATION;

  setProgress(progress);

  if (progress >= 1) {
    setReadyState();
    return;
  }

  animationFrame =
    requestAnimationFrame(updateHold);
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

  holdButton?.classList.add('is-holding');

  if (event.pointerId !== undefined) {
    activePointerId = event.pointerId;

    try {
      holdButton?.setPointerCapture(
        event.pointerId
      );
    } catch (_) {
      // Pointer capture is helpful but not required.
    }
  }

  animationFrame =
    requestAnimationFrame(updateHold);
}

function endHold(event) {
  event?.preventDefault?.();

  if (
    activePointerId !== null &&
    event?.pointerId === activePointerId
  ) {
    try {
      holdButton?.releasePointerCapture(
        activePointerId
      );
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
    if (!readyToOpen && !unlocked) {
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
  finishEntry
);

/*
  Skip the entrance if it was already opened during
  the current browser session.
*/
if (
  sessionStorage.getItem(
    'weddingInvitationOpened'
  ) === 'yes'
) {
  if (entryScreen) {
    entryScreen.hidden = true;
  }

  document.body.classList.remove('page-locked');
  revealMusicButton();
}

/* Existing scroll-reveal animations */

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
