/* ============================================
   PILL CHOICE — Interaction Controller + Voting
   ============================================ */

(() => {
  'use strict';

  /* ==============================================
     API BASE — Uses same origin in production.
     Change this if your backend runs on a different port.
     ============================================== */
  // In production, set to '' (same origin).
  // For development with preview proxy, point to Express directly.
  const API_BASE = location.port === '3456' ? '' : 'http://localhost:3456';

  /* ==============================================
     CONFIG — Edit titles and detail images here.
     REPLACE: detailImage paths with your own assets.
     ============================================== */
  const CONFIG = {
    left: {
      detailImage: 'assets/detail-left.png',
      title: 'You chose wisely',
      subtitle: '',
    },
    right: {
      detailImage: 'assets/detail-right.png',
      title: 'You chose wisely',
      subtitle: '',
    },
  };

  /* --- DOM refs --- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ============================================
     INTRO SCREEN & MUSIC
     ============================================ */
  const introScreen = $('#intro-screen');
  const btnEnter    = $('#btn-enter');
  const bgMusic     = $('#bg-music');
  const sfxEnter    = $('#sfx-enter');

  // Volumes (0 to 1)
  const MUSIC_TARGET_VOL = 0.25;
  bgMusic.volume  = 0;
  sfxEnter.volume = 0.7;

  /* ============================================
     SCENE REFS
     ============================================ */
  const sceneChoice  = $('#scene-choice');
  const sceneDetail  = $('#scene-detail');
  const sceneResults = $('#scene-results');
  const detailImg    = $('#detail-img');
  const detailCrop   = $('#detail-crop');
  const detailTitle  = $('#detail-title');
  const detailSub    = $('#detail-subtitle');
  const btnBack      = $('#btn-back');
  const pawLeft      = $('#paw-left');
  const pawRight     = $('#paw-right');
  const bgStatic     = $('.bg-static');
  const bgImg        = $('.bg-static__img');
  const darkenLeft   = $('#darken-left');
  const darkenRight  = $('#darken-right');
  const tagline      = $('.tagline');
  const divider      = $('.divider');
  const cursorLight  = $('#cursor-light');
  const hitZones     = $$('.hit-zone');

  // Results DOM
  const barLeft      = $('#bar-left');
  const barRight     = $('#bar-right');
  const pctLeft      = $('#pct-left');
  const pctRight     = $('#pct-right');
  const resultsTotal = $('#results-total');
  const resultsYour  = $('#results-your-choice');
  const resultsAlready = $('#results-already');

  // Voice lines
  const sfxVoiceLeft  = $('#sfx-voice-left');
  const sfxVoiceRight = $('#sfx-voice-right');
  sfxVoiceLeft.volume  = 1.0;
  sfxVoiceRight.volume = 1.0;

  // State machine: 'choice' | 'transitioning' | 'detail' | 'results'
  let state = 'choice';

  // Track if user already voted (checked on page load)
  let hasVoted = false;

  /* ============================================
     CURSOR LIGHT
     ============================================ */
  document.addEventListener('mousemove', (e) => {
    cursorLight.style.left = e.clientX + 'px';
    cursorLight.style.top = e.clientY + 'px';
  });

  /* ============================================
     MUSIC FADE IN
     ============================================ */
  function fadeInMusic() {
    bgMusic.play().catch(() => {});
    const fadeDuration = 3000;
    const fadeSteps = 60;
    const fadeInterval = fadeDuration / fadeSteps;
    const volStep = MUSIC_TARGET_VOL / fadeSteps;
    let currentStep = 0;
    const fadeIn = setInterval(() => {
      currentStep++;
      bgMusic.volume = Math.min(volStep * currentStep, MUSIC_TARGET_VOL);
      if (currentStep >= fadeSteps) clearInterval(fadeIn);
    }, fadeInterval);
  }

  /* ============================================
     INTRO — Click "Enter"
     ============================================ */
  btnEnter.addEventListener('click', async () => {
    sfxEnter.play().catch(() => {});
    introScreen.classList.add('is-hidden');
    setTimeout(() => introScreen.classList.add('is-done'), 3100);
    fadeInMusic();

    /* ------------------------------------------------
       CHECK IF ALREADY VOTED
       After intro fades, check server + localStorage.
       If already voted, skip choice and show results.
       ------------------------------------------------ */
    const localVote = localStorage.getItem('pill-choice-vote');

    try {
      const res = await fetch(API_BASE + '/api/results');
      const data = await res.json();

      if (data.voted) {
        // Server confirms this IP already voted
        hasVoted = true;
        localStorage.setItem('pill-choice-vote', data.voted);

        // Wait for intro fade to finish, then show results directly
        setTimeout(() => {
          sceneChoice.classList.remove('scene--active');
          showResults(data.results, data.voted, true);
        }, 3200);
        return;
      }
    } catch (e) {
      // Server unreachable — fallback to localStorage
      if (localVote) {
        hasVoted = true;
      }
    }
  });

  /* ============================================
     HOVER — Darken opposite side
     ============================================ */
  hitZones.forEach(zone => {
    const side = zone.dataset.choice;
    const darken = side === 'left' ? darkenRight : darkenLeft;

    zone.addEventListener('mouseenter', () => {
      if (state !== 'choice') return;
      darken.classList.add('is-active');
    });

    zone.addEventListener('mouseleave', () => {
      darken.classList.remove('is-active');
    });
  });

  /* ============================================
     CHOICE — User clicks a paw
     ============================================ */
  async function handleChoice(side) {
    if (state !== 'choice' || hasVoted) return;
    state = 'transitioning';

    const cfg = CONFIG[side];
    const chosen = side === 'left' ? pawLeft : pawRight;
    const other  = side === 'left' ? pawRight : pawLeft;

    // Clean up hover
    chosen.classList.remove('is-hovered');
    darkenLeft.classList.remove('is-active');
    darkenRight.classList.remove('is-active');

    // Play voice line for the chosen side
    const voice = side === 'left' ? sfxVoiceLeft : sfxVoiceRight;
    voice.currentTime = 0;
    voice.play().catch(() => {});

    // Transition out choice scene
    chosen.classList.add('paw--chosen');
    other.classList.add('paw--not-chosen');
    bgStatic.classList.add('bg-static--dimming');
    tagline.style.opacity = '0';
    divider.style.opacity = '0';

    /* ------------------------------------------------
       SUBMIT VOTE TO SERVER
       ------------------------------------------------ */
    let voteResults = null;
    try {
      const res = await fetch(API_BASE + '/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice: side }),
      });
      const data = await res.json();

      // Save to localStorage regardless
      localStorage.setItem('pill-choice-vote', side);
      hasVoted = true;

      if (data.success) {
        voteResults = data.results;
      } else if (data.alreadyVoted) {
        voteResults = data.results;
      }
    } catch (e) {
      // Server down — still mark locally so UI progresses
      localStorage.setItem('pill-choice-vote', side);
      hasVoted = true;
      console.warn('Vote submission failed:', e);
    }

    /* ------------------------------------------------
       TRANSITION: choice → results
       Skip the detail scene entirely, go straight
       to results with a cinematic transition.
       ------------------------------------------------ */
    setTimeout(() => {
      sceneChoice.classList.remove('scene--active');
      sceneChoice.classList.add('scene--exiting');

      setTimeout(() => {
        showResults(voteResults, side, false);
      }, 500);
    }, 600);
  }

  /* ============================================
     SHOW RESULTS
     ============================================ */
  function showResults(results, userChoice, alreadyVoted) {
    state = 'results';

    // Hide other scenes
    sceneChoice.classList.remove('scene--active', 'scene--exiting');
    sceneDetail.classList.remove('scene--active', 'scene--exiting');

    // Show results scene
    sceneResults.classList.add('scene--active');

    // Start background video
    const bgVideo = sceneResults.querySelector('.results-bg-video');
    if (bgVideo) {
      bgVideo.currentTime = 0;
      bgVideo.play().catch(() => {});
    }

    // Mark the user's chosen row
    const rowLeft = $('#row-left');
    const rowRight = $('#row-right');
    rowLeft.classList.remove('is-chosen');
    rowRight.classList.remove('is-chosen');

    if (userChoice === 'left') {
      rowLeft.classList.add('is-chosen');
      resultsYour.textContent = 'You chose left';
    } else if (userChoice === 'right') {
      rowRight.classList.add('is-chosen');
      resultsYour.textContent = 'You chose right';
    }

    // Show already voted message if applicable
    if (alreadyVoted) {
      resultsAlready.style.display = 'block';
    }

    // If we have results from the server, animate bars
    if (results && results.total > 0) {
      const leftPct = Math.round((results.left / results.total) * 100);
      const rightPct = 100 - leftPct;

      // Set total
      resultsTotal.textContent = results.total + ' vote' + (results.total > 1 ? 's' : '');

      // Animate bars after a short delay (let the scene fade in first)
      requestAnimationFrame(() => {
        setTimeout(() => {
          barLeft.style.width = leftPct + '%';
          barRight.style.width = rightPct + '%';
          pctLeft.textContent = leftPct + '%';
          pctRight.textContent = rightPct + '%';
        }, 400);
      });
    } else {
      // No server data — show placeholder
      resultsTotal.textContent = 'Vote recorded';
      pctLeft.textContent = '—';
      pctRight.textContent = '—';
    }
  }

  /* ============================================
     BACK — disabled after voting (no re-vote)
     ============================================ */
  function handleBack() {
    if (state !== 'detail') return;
    state = 'transitioning';

    sceneDetail.classList.remove('scene--active');
    sceneDetail.classList.add('scene--exiting');

    setTimeout(() => {
      [pawLeft, pawRight].forEach(p => {
        p.classList.remove('paw--chosen', 'paw--not-chosen', 'is-hovered');
      });
      bgStatic.classList.remove('bg-static--dimming');
      tagline.style.opacity = '';
      divider.style.opacity = '';
      sceneDetail.classList.remove('scene--active', 'scene--exiting');
      sceneDetail.removeAttribute('data-choice');
      sceneChoice.classList.remove('scene--exiting');
      sceneChoice.classList.add('scene--active');
      state = 'choice';
    }, 550);
  }

  /* ============================================
     EVENTS
     ============================================ */
  hitZones.forEach(zone => {
    zone.addEventListener('click', () => handleChoice(zone.dataset.choice));
    zone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleChoice(zone.dataset.choice);
      }
    });
  });

  btnBack.addEventListener('click', handleBack);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state === 'detail') handleBack();
  });

  /* ============================================
     SECRET RESET — Type "reset" on the page
     Clears all votes (server + local) and
     reloads back to the choice screen.
     ============================================ */
  let resetBuffer = '';
  document.addEventListener('keydown', (e) => {
    resetBuffer += e.key.toLowerCase();
    // Keep only last 5 chars
    if (resetBuffer.length > 5) resetBuffer = resetBuffer.slice(-5);

    if (resetBuffer === 'reset') {
      resetBuffer = '';
      fetch(API_BASE + '/api/reset')
        .then(r => r.json())
        .then(() => {
          localStorage.removeItem('pill-choice-vote');
          window.location.reload();
        })
        .catch(() => {
          localStorage.removeItem('pill-choice-vote');
          window.location.reload();
        });
    }
  });

})();
