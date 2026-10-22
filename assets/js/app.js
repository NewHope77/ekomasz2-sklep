/* EKOMASZ2 — koszyk, zamówienie i interakcje sklepu (wersja demonstracyjna, bez backendu) */
(function () {
  'use strict';

  var root = document.body.getAttribute('data-root') || '';
  var P = window.PRODUCTS || {};
  var CART_KEY = 'ekomasz_cart_v1';
  var ORDER_KEY = 'ekomasz_last_order';

  /* ---------- helpers ---------- */
  function store(kind) {
    try { return kind === 'session' ? window.sessionStorage : window.localStorage; } catch (e) { return null; }
  }
  function read(key, fallback, kind) {
    var s = store(kind);
    if (!s) return fallback;
    try { var v = JSON.parse(s.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function write(key, val, kind) {
    var s = store(kind);
    if (!s) return;
    try { s.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  var fmtInt = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 });
  var fmtDec = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 });
  function money(v) { return Math.round(v * 100) % 100 === 0 ? fmtInt.format(v) : fmtDec.format(v); }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- theme ---------- */
  $$('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      // the design defaults to light unless the visitor picked dark before
      var cur = document.documentElement.getAttribute('data-theme') || 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  });

  /* ---------- header & drawer ---------- */
  var header = $('.header');
  function onScroll() { if (header) header.classList.toggle('is-scrolled', window.scrollY > 10); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var drawer = $('.drawer');
  var burger = $('.burger');
  function setDrawer(open) {
    if (!drawer) return;
    drawer.classList.toggle('open', open);
    if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (burger) burger.addEventListener('click', function () { setDrawer(!drawer.classList.contains('open')); });
  $$('[data-drawer-close]').forEach(function (el) { el.addEventListener('click', function () { setDrawer(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setDrawer(false); });

  /* ---------- reveal & counters ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      if (en.target.hasAttribute('data-count')) countUp(en.target);
      io.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }) : null;
  function observe(el) { if (io) io.observe(el); else el.classList.add('in'); }
  $$('[data-reveal], [data-count]').forEach(observe);
  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    var t0 = null, dur = 1400;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + (el.getAttribute('data-suffix') || '');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- cart ---------- */
  function getCart() {
    return read(CART_KEY, []).filter(function (l) { return P[l.id] && l.qty > 0; });
  }
  function setCart(c) { write(CART_KEY, c); updateBadge(true); }
  function cartCount(c) { return (c || getCart()).reduce(function (s, l) { return s + l.qty; }, 0); }
  function subtotal(c) { return (c || getCart()).reduce(function (s, l) { return s + P[l.id].price * l.qty; }, 0); }
  function hasBike(c) { return (c || getCart()).some(function (l) { return P[l.id].bike; }); }

  function updateBadge(bump) {
    var n = cartCount();
    $$('.cart-count').forEach(function (b) {
      b.textContent = n;
      b.classList.toggle('has-items', n > 0);
      if (bump && n > 0) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
    });
  }
  updateBadge(false);

  function addToCart(id, qty) {
    var c = getCart();
    var line = c.filter(function (l) { return l.id === id; })[0];
    if (line) line.qty = Math.min(99, line.qty + qty); else c.push({ id: id, qty: qty });
    setCart(c);
  }

  var toast, toastTimer;
  function showToast(id, qty) {
    var p = P[id];
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.innerHTML = '<img src="' + root + p.img + '" alt="" width="72" height="54">' +
      '<div><b>Dodano do koszyka</b><small>' + esc(p.name) + (qty > 1 ? ' × ' + qty : '') + '</small><br>' +
      '<a href="' + root + 'koszyk.html">Przejdź do koszyka →</a></div>';
    setTimeout(function () { toast.classList.add('show'); }, 20);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3600);
  }

  function qtyFrom(btn) {
    var sel = btn.getAttribute('data-qty-from');
    var inp = sel ? $(sel) : null;
    var v = inp ? parseInt(inp.value, 10) : 1;
    return v > 0 ? Math.min(v, 99) : 1;
  }

  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault();
      var id = add.getAttribute('data-add');
      var q = qtyFrom(add);
      addToCart(id, q);
      if (add.hasAttribute('data-buy-now')) { location.href = root + 'zamowienie.html'; return; }
      showToast(id, q);
      add.classList.add('is-added');
      var label = add.querySelector('[data-label]');
      var old = label ? label.textContent : null;
      if (label) label.textContent = 'Dodano';
      setTimeout(function () { add.classList.remove('is-added'); if (label) label.textContent = old; }, 1600);
    }
    var qb = e.target.closest('[data-qty-step]');
    if (qb) {
      var input = qb.parentNode.querySelector('input');
      var nv = Math.max(1, Math.min(99, (parseInt(input.value, 10) || 1) + parseInt(qb.getAttribute('data-qty-step'), 10)));
      input.value = nv;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  /* ---------- tabs ---------- */
  $$('[data-tabs]').forEach(function (box) {
    var btns = $$('[role="tab"]', box);
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) {
          var on = x === b;
          x.setAttribute('aria-selected', on ? 'true' : 'false');
          $('#' + x.getAttribute('aria-controls')).hidden = !on;
        });
      });
    });
  });

  /* ---------- catalogue: search & sort ---------- */
  var grid = $('[data-catalog]');
  if (grid) {
    var items = $$('.card', grid);
    var search = $('#q');
    var sort = $('#sort');
    var note = $('[data-count-note]');
    var empty = $('[data-empty]');
    var params = new URLSearchParams(location.search);
    if (search && params.get('q')) search.value = params.get('q');
    function apply() {
      var q = (search && search.value || '').trim().toLowerCase();
      var mode = sort ? sort.value : 'default';
      var list = items.slice().sort(function (a, b) {
        var pa = +a.getAttribute('data-price'), pb = +b.getAttribute('data-price');
        if (mode === 'asc') return pa - pb;
        if (mode === 'desc') return pb - pa;
        return +a.getAttribute('data-order') - +b.getAttribute('data-order');
      });
      var shown = 0;
      list.forEach(function (el) {
        var ok = !q || el.getAttribute('data-name').indexOf(q) > -1;
        el.style.display = ok ? '' : 'none';
        if (ok) shown++;
        grid.appendChild(el);
      });
      if (note) note.textContent = shown + ' ' + (shown === 1 ? 'produkt' : (shown % 10 >= 2 && shown % 10 <= 4 && (shown % 100 < 10 || shown % 100 >= 20) ? 'produkty' : 'produktów'));
      if (empty) empty.hidden = shown > 0;
    }
    if (search) search.addEventListener('input', apply);
    if (sort) sort.addEventListener('change', apply);
    apply();
    if (location.hash === '#szukaj' && search) search.focus();
  }

  /* ---------- shipping & payment rules ---------- */
  function shippingOptions(c) {
    var bike = hasBike(c);
    return [
      { id: 'odbior', name: 'Odbiór osobisty w sklepie', note: 'Bulowice — rower wydajemy złożony i wyregulowany', price: 0 },
      { id: 'kurier', name: bike ? 'Kurier — przesyłka gabarytowa' : 'Kurier DPD', note: bike ? 'Rower złożony w 95%, w kartonie, 2–4 dni robocze' : '1–2 dni robocze', price: bike ? 149 : 19.99 },
      { id: 'paczkomat', name: 'Paczkomat InPost', note: bike ? 'Niedostępne dla rowerów' : '1–2 dni robocze', price: 14.99, disabled: bike }
    ];
  }
  var PAYMENTS = [
    { id: 'blik', name: 'BLIK', note: 'Kod z aplikacji banku' },
    { id: 'p24', name: 'Szybki przelew', note: 'Przelewy24 — wszystkie banki' },
    { id: 'karta', name: 'Karta płatnicza', note: 'Visa, Mastercard, Apple Pay, Google Pay' },
    { id: 'raty', name: 'Raty online', note: 'Decyzja kredytowa w kilka minut' },
    { id: 'przelew', name: 'Przelew tradycyjny', note: 'Wysyłka po zaksięgowaniu wpłaty' },
    { id: 'gotowka', name: 'Płatność przy odbiorze', note: 'Gotówką lub kartą w sklepie', only: 'odbior' }
  ];
  var PAY_ICONS = {
    blik: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>',
    p24: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    karta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    raty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    przelew: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M2 10l10-7 10 7z"/></svg>',
    gotowka: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>'
  };

  function summaryItems(c) {
    return c.map(function (l) {
      var p = P[l.id];
      return '<div class="summary__item"><img src="' + root + p.img + '" alt="" width="56" height="42">' +
        '<span>' + esc(p.name) + (l.qty > 1 ? ' × ' + l.qty : '') + '</span><b>' + money(p.price * l.qty) + '</b></div>';
    }).join('');
  }

  /* ---------- cart page ---------- */
  var cartRoot = $('#cart-root');
  function renderCart() {
    var c = getCart();
    if (!c.length) {
      cartRoot.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h2 style="margin-bottom:10px">Twój koszyk jest pusty</h2>' +
        '<p style="margin-bottom:22px">Wybierz rower lub akcesoria w naszym sklepie.</p>' +
        '<a class="btn btn--accent" href="' + root + 'sklep.html">Przejdź do sklepu</a></div>';
      return;
    }
    var rows = c.map(function (l) {
      var p = P[l.id];
      return '<article class="cart-item" data-id="' + l.id + '">' +
        '<a class="cart-item__img" href="' + root + p.url + '"><img src="' + root + p.img + '" alt="' + esc(p.name) + '" width="120" height="90"></a>' +
        '<div><small>' + esc(p.catName) + '</small><h3><a href="' + root + p.url + '">' + esc(p.name) + '</a></h3><small>' + money(p.price) + ' / szt.</small></div>' +
        '<div class="cart-item__side"><b>' + money(p.price * l.qty) + '</b>' +
        '<div class="qty qty--sm"><button type="button" data-qty-step="-1" aria-label="Mniej">−</button>' +
        '<input type="number" min="1" max="99" value="' + l.qty + '" aria-label="Ilość"><button type="button" data-qty-step="1" aria-label="Więcej">+</button></div>' +
        '<button class="remove" type="button" data-remove>Usuń</button></div></article>';
    }).join('');
    var sub = subtotal(c);
    var ship = shippingOptions(c);
    cartRoot.innerHTML = '<div class="cart-list">' + rows + '</div>' +
      '<aside class="summary"><h2>Podsumowanie</h2>' +
      '<div class="summary__row"><span>Wartość produktów</span><b>' + money(sub) + '</b></div>' +
      '<div class="summary__row"><span>Dostawa</span><b>od ' + money(0) + '</b></div>' +
      '<div class="summary__row summary__total"><span>Razem</span><b>' + money(sub) + '</b></div>' +
      '<a class="btn btn--accent btn--lg btn--block" href="' + root + 'zamowienie.html">Przejdź do kasy</a>' +
      '<p class="summary__note">Odbiór osobisty w Bulowicach — 0 zł. Kurier: ' + money(ship[1].price) + '. Ceny zawierają VAT.</p></aside>';
  }
  if (cartRoot) {
    renderCart();
    cartRoot.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-remove]');
      if (!rm) return;
      var id = rm.closest('.cart-item').getAttribute('data-id');
      setCart(getCart().filter(function (l) { return l.id !== id; }));
      renderCart();
    });
    cartRoot.addEventListener('change', function (e) {
      if (e.target.type !== 'number') return;
      var id = e.target.closest('.cart-item').getAttribute('data-id');
      var v = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1));
      var c = getCart();
      c.forEach(function (l) { if (l.id === id) l.qty = v; });
      setCart(c);
      renderCart();
    });
  }

  /* ---------- checkout ---------- */
  var form = $('#checkout-form');
  if (form) {
    var shipBox = $('#ship-options');
    var payBox = $('#pay-options');
    var sumBox = $('#co-summary');

    function selected(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; }

    function renderOptions() {
      var c = getCart();
      if (!c.length) {
        $('.checkout').innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h2 style="margin-bottom:10px">Koszyk jest pusty</h2>' +
          '<p style="margin-bottom:22px">Dodaj produkty, aby złożyć zamówienie.</p><a class="btn btn--accent" href="' + root + 'sklep.html">Przejdź do sklepu</a></div>';
        return false;
      }
      var curShip = selected('ship') || 'odbior';
      var opts = shippingOptions(c);
      if (opts.some(function (o) { return o.id === curShip && o.disabled; })) curShip = 'odbior';
      shipBox.innerHTML = opts.map(function (o) {
        return '<label class="opt"><input type="radio" name="ship" value="' + o.id + '"' + (o.id === curShip ? ' checked' : '') + (o.disabled ? ' disabled' : '') + '>' +
          '<span class="opt__dot"></span><span class="opt__body"><b>' + o.name + '</b><small>' + o.note + '</small></span>' +
          '<span class="opt__price">' + (o.price ? money(o.price) : 'Gratis') + '</span></label>';
      }).join('');
      var curPay = selected('pay') || 'blik';
      var pays = PAYMENTS.filter(function (p) { return !p.only || p.only === curShip; });
      if (!pays.some(function (p) { return p.id === curPay; })) curPay = 'blik';
      payBox.innerHTML = pays.map(function (p) {
        return '<label class="opt opt--pay"><input type="radio" name="pay" value="' + p.id + '"' + (p.id === curPay ? ' checked' : '') + '>' +
          '<span class="opt__dot"></span><span class="opt__logo">' + PAY_ICONS[p.id] + p.name + '</span><small style="color:var(--muted);font-size:13.5px">' + p.note + '</small></label>';
      }).join('');
      $('#blik-code').classList.toggle('show', curPay === 'blik');
      renderSummary();
      return true;
    }

    function totals() {
      var c = getCart();
      var ship = shippingOptions(c).filter(function (o) { return o.id === (selected('ship') || 'odbior'); })[0];
      var sub = subtotal(c);
      return { c: c, sub: sub, ship: ship, total: sub + ship.price };
    }

    function renderSummary() {
      var t = totals();
      sumBox.innerHTML = '<h2>Twoje zamówienie</h2><div class="summary__items">' + summaryItems(t.c) + '</div>' +
        '<div class="summary__row"><span>Produkty</span><b>' + money(t.sub) + '</b></div>' +
        '<div class="summary__row"><span>' + t.ship.name + '</span><b>' + (t.ship.price ? money(t.ship.price) : 'Gratis') + '</b></div>' +
        '<div class="summary__row summary__total"><span>Do zapłaty</span><b>' + money(t.total) + '</b></div>' +
        '<button class="btn btn--accent btn--lg btn--block" type="submit" form="checkout-form">Zamawiam z obowiązkiem zapłaty</button>' +
        '<p class="summary__note">Klikając, składasz zamówienie z obowiązkiem zapłaty. Ceny zawierają VAT.</p>';
    }

    if (renderOptions()) {
      form.addEventListener('change', function (e) {
        if (e.target.name === 'ship' || e.target.name === 'pay') renderOptions();
        if (e.target.id === 'want-invoice') $('#invoice-fields').hidden = !e.target.checked;
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = true;
        $$('.field', form).forEach(function (f) {
          var inp = f.querySelector('input, textarea, select');
          if (!inp || inp.closest('[hidden]')) { f.classList.remove('invalid'); return; }
          var bad = !inp.checkValidity();
          f.classList.toggle('invalid', bad);
          if (bad) ok = false;
        });
        var terms = $('#terms');
        terms.closest('.check').classList.toggle('invalid', !terms.checked);
        if (!terms.checked) ok = false;
        if (!ok) {
          var first = form.querySelector('.invalid');
          if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        var t = totals();
        var d = new Date();
        var no = 'EK-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + Math.floor(1000 + Math.random() * 9000);
        var pay = PAYMENTS.filter(function (p) { return p.id === selected('pay'); })[0];
        write(ORDER_KEY, {
          no: no, lines: t.c, sub: t.sub, ship: t.ship, total: t.total, pay: pay.name, payId: pay.id,
          name: form.elements.firstname.value + ' ' + form.elements.lastname.value, email: form.elements.email.value
        }, 'session');
        setCart([]);
        location.href = root + 'potwierdzenie.html';
      });
      $$('input, textarea', form).forEach(function (inp) {
        inp.addEventListener('input', function () { var f = inp.closest('.field'); if (f && inp.checkValidity()) f.classList.remove('invalid'); });
      });
    }
  }

  /* ---------- confirmation ---------- */
  var conf = $('#confirm-root');
  if (conf) {
    var o = read(ORDER_KEY, null, 'session');
    if (o) {
      var payInfo = {
        blik: 'Płatność BLIK została przyjęta.',
        p24: 'Płatność online została przyjęta.',
        karta: 'Płatność kartą została przyjęta.',
        raty: 'Wniosek ratalny został przekazany — partner skontaktuje się z Tobą.',
        przelew: 'Dane do przelewu wysłaliśmy na adres e-mail. W tytule wpisz numer zamówienia.',
        gotowka: 'Zapłacisz przy odbiorze w sklepie.'
      }[o.payId] || '';
      $('[data-order-no]', conf).textContent = o.no;
      $('[data-order-email]', conf).textContent = o.email;
      $('[data-order-pay]', conf).textContent = payInfo;
      $('[data-order-summary]', conf).innerHTML = '<h2>Zamówienie ' + esc(o.no) + '</h2><div class="summary__items">' +
        o.lines.filter(function (l) { return P[l.id]; }).map(function (l) {
          var p = P[l.id];
          return '<div class="summary__item"><img src="' + root + p.img + '" alt="" width="56" height="42"><span>' + esc(p.name) + (l.qty > 1 ? ' × ' + l.qty : '') + '</span><b>' + money(p.price * l.qty) + '</b></div>';
        }).join('') + '</div>' +
        '<div class="summary__row"><span>' + esc(o.ship.name) + '</span><b>' + (o.ship.price ? money(o.ship.price) : 'Gratis') + '</b></div>' +
        '<div class="summary__row"><span>Płatność</span><b>' + esc(o.pay) + '</b></div>' +
        '<div class="summary__row summary__total"><span>Razem</span><b>' + money(o.total) + '</b></div>';
    } else {
      $('[data-order-block]', conf).hidden = true;
    }
  }

  /* ---------- demo forms (serwis, kontakt) ---------- */
  $$('.js-demo-form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      $$('.field', f).forEach(function (fl) {
        var inp = fl.querySelector('input, textarea, select');
        var bad = inp && !inp.checkValidity();
        fl.classList.toggle('invalid', !!bad);
        if (bad) ok = false;
      });
      var consent = f.querySelector('.check input[required]');
      if (consent) { consent.closest('.check').classList.toggle('invalid', !consent.checked); if (!consent.checked) ok = false; }
      if (!ok) return;
      f.innerHTML = '<div class="confirm" style="padding:24px 0"><div class="confirm__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></div>' +
        '<h2 style="margin-bottom:10px">Dziękujemy!</h2><p>' + esc(f.getAttribute('data-success') || 'Wiadomość została wysłana.') + '</p></div>';
    });
  });

  /* ---------- cookies ---------- */
  var cookies = $('.cookies');
  if (cookies && !read('ekomasz_cookies', null)) {
    setTimeout(function () { cookies.classList.add('show'); }, 900);
    $$('[data-cookies]', cookies).forEach(function (b) {
      b.addEventListener('click', function () {
        write('ekomasz_cookies', { choice: b.getAttribute('data-cookies'), at: Date.now() });
        cookies.classList.remove('show');
      });
    });
  }
})();
