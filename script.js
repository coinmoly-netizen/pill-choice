/* ============================================
   PILL CHOICE — Interaction Controller
   ============================================ */

(() => {
  'use strict';

  /* ==============================================
     CONFIG — Edit titles and detail images here.
     REPLACE: detailImage paths with your own assets.
     ============================================== */
  const CONFIG = {
    left: {
      detailImage: 'assets/detail-left.png',   // REPLACE with your left pill detail image
      title: 'You chose wisely',
      subtitle: '',                             // Add subtitle text later
    },
    right: {
      detailImage: 'assets/detail-right.png',  // REPLACE with your right pill detail image
      title: 'You chose wisely',
      subtitle: '',                             // Add subtitle text later
    },
  };

  /* --- DOM refs --- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const sceneChoice = $('#scene-choice');
  const sceneDetail = $('#scene-detail');
  const detailImg   = $('#detail-img');
  const detailCrop  = $('#detail-crop');
  const detailTitle  = $('#detail-title');
  const detailSub    = $('#detail-subtitle');
  const btnBack     = $('#btn-back');
  const pawLeft     = $('#paw-left');
  const pawRight    = $('#paw-right');
  const glowLeft    = $('.paw-glow--left');
  const glowRight   = $('.paw-glow--right');
  const bgStatic    = $('.bg-static');
  const bgImg       = $('.bg-static__img');
  const tagline     = $('.tagline');
  const divider     = $('.divider');
  const cursorLight = $('#cursor-light');
  const hitZones    = $$('.hit-zone');

  let state = 'choice'; // 'choice' | 'transitioning' | 'detail'

  /* ============================================
     CURSOR LIGHT
     ============================================ */
  document.addEventListener('mousemove', (e) => {
    cursorLight.style.left = e.clientX + 'px';
    cursorLight.style.top = e.clientY + 'px';
  });

  /* ============================================
     HOVER
     ============================================ */
  hitZones.forEach(zone => {
    const side = zone.dataset.choice;
    const paw = side === 'left' ? pawLeft : pawRight;
    const glow = side === 'left' ? glowLeft : glowRight;

    zone.addEventListener('mouseenter', () => {
      if (state !== 'choice') return;
      paw.classList.add('is-hovered');
      glow.classList.add('is-active');
    });

    zone.addEventListener('mouseleave', () => {
      paw.classList.remove('is-hovered');
      glow.classList.remove('is-active');
    });
  });

  /* ============================================
     CHOICE
     ============================================ */
  function handleChoice(side) {
    if (state !== 'choice') return;
    state = 'transitioning';

    const cfg = CONFIG[side];
    const chosen = side === 'left' ? pawLeft : pawRight;
    const other  = side === 'left' ? pawRight : pawLeft;

    // Clean up hover
    chosen.classList.remove('is-hovered');
    glowLeft.classList.remove('is-active');
    glowRight.classList.remove('is-active');

    // Transition out choice scene
    chosen.classList.add('paw--chosen');
    other.classList.add('paw--not-chosen');
    bgStatic.classList.add('bg-static--dimming');
    tagline.style.opacity = '0';
    divider.style.opacity = '0';

    // Prepare detail
    sceneDetail.setAttribute('data-choice', side);
    detailImg.src = cfg.detailImage;
    detailImg.style.display = '';
    detailCrop.style.display = 'none';
    detailImg.onerror = () => {
      detailImg.style.display = 'none';
      detailCrop.style.display = 'block';
    };
    detailTitle.textContent = cfg.title;
    detailSub.textContent = cfg.subtitle;

    // Scene swap with delay for cinematic feel
    setTimeout(() => {
      sceneChoice.classList.remove('scene--active');
      sceneChoice.classList.add('scene--exiting');

      setTimeout(() => {
        sceneDetail.classList.add('scene--active');
        state = 'detail';
      }, 450);
    }, 400);
  }

  /* ============================================
     BACK
     ============================================ */
  function handleBack() {
    if (state !== 'detail') return;
    state = 'transitioning';

    sceneDetail.classList.remove('scene--active');
    sceneDetail.classList.add('scene--exiting');

    setTimeout(() => {
      // Reset everything
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

})();
