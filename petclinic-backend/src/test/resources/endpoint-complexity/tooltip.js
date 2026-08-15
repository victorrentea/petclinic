// One tooltip, delegated on document, driven by data-tip. Never a native title=:
// that one can't be styled and shows up ~500ms late, by which time the reader has
// already given up on the bar segment they were hovering.
(function () {
  const tip = document.getElementById('tip');
  let timer = null;
  let current = null;

  function place(el) {
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    let left = r.left + r.width / 2 - t.width / 2;
    left = Math.max(8, Math.min(left, innerWidth - t.width - 8));
    let top = r.top - t.height - 10;
    if (top < 8) {
      top = r.bottom + 10;
    }
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function show(el) {
    const text = el.getAttribute('data-tip');
    if (!text) {
      return;
    }
    current = el;
    tip.textContent = text;
    tip.style.left = '-9999px';
    tip.style.top = '0';
    requestAnimationFrame(function () {
      if (current === el) {
        place(el);
        tip.classList.add('visible');
      }
    });
  }

  function hide() {
    clearTimeout(timer);
    current = null;
    tip.classList.remove('visible');
  }

  document.addEventListener('mouseover', function (e) {
    const el = e.target.closest('[data-tip]');
    if (!el) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(function () {
      show(el);
    }, 150);
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest('[data-tip]')) {
      hide();
    }
  });
  // focus/blur don't bubble — focusin/focusout are what delegation needs.
  document.addEventListener('focusin', function (e) {
    const el = e.target.closest('[data-tip]');
    if (el) {
      show(el);
    }
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      hide();
    }
  });
  addEventListener('scroll', hide, true);
  document.addEventListener('touchstart', hide, { passive: true });
})();
