/* BLACKBOXY Prompt Packs — 페이지 스크립트
   상품 정보는 prompt-packs-data.js 에서 관리합니다. 이 파일은 화면만 그립니다.
   모든 문자열은 textContent 로만 넣습니다 (HTML 삽입 없음). */
(function () {
  'use strict';

  var PACKS = Array.isArray(window.BLACKBOXY_PROMPT_PACKS) ? window.BLACKBOXY_PROMPT_PACKS : [];
  var FILTERS = Array.isArray(window.BLACKBOXY_PACK_FILTERS) ? window.BLACKBOXY_PACK_FILTERS : [{ id: 'all', name: '전체' }];
  var IMPORTED_KEY = 'blackboxy_imported_prompt_packs_v1';
  var PENDING_KEY = 'blackboxy_pending_pack';
  var ALLOWED_BADGES = { '무료': 'free', '추천': 'pick', '신규': 'new' };

  var state = { filter: 'all', lastFocus: null, openId: null };

  /* ── 작은 DOM 헬퍼 ── */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }
  function safeColor(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : '#8A8E98'; }
  function priceText(p) { return p.type === 'free' || !p.price ? '무료' : Number(p.price).toLocaleString('ko-KR') + '원'; }
  function findPack(id) { for (var i = 0; i < PACKS.length; i++) if (PACKS[i].id === id) return PACKS[i]; return null; }
  function isHttpsUrl(u) {
    if (typeof u !== 'string' || !u.trim()) return false;
    try { var x = new URL(u.trim()); return x.protocol === 'https:'; } catch (e) { return false; }
  }
  function importedInfo(packId) {
    try { var m = JSON.parse(localStorage.getItem(IMPORTED_KEY) || '{}'); return m && m[packId] ? m[packId] : null; }
    catch (e) { return null; }
  }

  /* ── 토스트 ── */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('pk-toast');
    if (!t) return;
    t.textContent = '';
    t.appendChild(h('img', { src: 'boxy-icon.png', alt: '', width: '28', height: '28' }));
    t.appendChild(h('span', { text: msg }));
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ── 필터 칩 ── */
  function countFor(fid) {
    if (fid === 'all') return PACKS.length;
    return PACKS.filter(function (p) { return (p.filters || []).indexOf(fid) !== -1; }).length;
  }
  function renderFilters() {
    var box = document.getElementById('pack-filters');
    if (!box) return;
    box.textContent = '';
    FILTERS.forEach(function (f) {
      var active = state.filter === f.id;
      box.appendChild(h('button', {
        type: 'button', class: 'pack-filter' + (active ? ' active' : ''),
        'aria-pressed': active ? 'true' : 'false',
        onclick: function () { state.filter = f.id; renderFilters(); renderGrid(); }
      }, [f.name + ' ', h('span', { class: 'pack-filter-count', text: String(countFor(f.id)) })]));
    });
  }

  /* ── 카드 ── */
  function badgeEls(p) {
    return (p.badges || []).filter(function (b) { return ALLOWED_BADGES[b]; }).map(function (b) {
      return h('span', { class: 'pack-badge ' + ALLOWED_BADGES[b], text: b });
    });
  }
  function packLabel(name) { return /스타터팩/.test(name || '') ? '스타터팩' : '프롬프트팩'; }
  var DOWNLOAD_GUIDE = '다운로드한 JSON 파일을 BLACKBOXY의 ‘프롬프트팩 가져오기’에서 선택해주세요.';
  var SOON_MSG = '유료 프롬프트팩은 곧 오픈할 예정이에요 📦';
  // 유료팩은 결제 주소(https)가 있어야만 판매 중으로 봅니다.
  function isOnSale(p) { return p.type === 'paid' && isHttpsUrl(p.paymentUrl); }
  function isSoon(p) { return p.type !== 'free' && !isOnSale(p); }
  function ctaLabel(p) { return p.type === 'free' ? '📥 무료로 받기' : (isOnSale(p) ? '🛒 구매하기' : '⏳ 준비중'); }
  function ctaAria(p) { return p.name + (p.type === 'free' ? ' 무료로 받기' : (isOnSale(p) ? ' 구매하기' : ' 판매 준비중')); }

  function packCard(p) {
    var sample = (p.samples || [])[0];
    var done = importedInfo(p.packId);
    return h('article', { class: 'pack-card' + (p.type === 'free' ? ' is-free' : ''), 'aria-labelledby': 'pack-name-' + p.id }, [
      h('div', { class: 'pack-card-top' }, [
        h('span', { class: 'pack-drawer', style: 'background:' + safeColor(p.drawerColor), 'aria-hidden': 'true' }),
        h('div', { class: 'pack-badges' }, badgeEls(p)),
        done ? h('span', { class: 'pack-owned', text: '✓ 서랍에 있음' }) : null
      ]),
      h('h3', { class: 'pack-name', id: 'pack-name-' + p.id, text: p.name }),
      h('p', { class: 'pack-summary', text: p.summary || '' }),
      h('ul', { class: 'pack-meta', 'aria-label': '팩 정보' }, [
        h('li', null, [h('b', { text: '프롬프트' }), ' ' + p.promptCount + '개']),
        h('li', null, [h('b', { text: '추천 대상' }), ' ' + (p.audience || []).join(', ')]),
        h('li', null, [h('b', { text: '카테고리' }), ' ' + (p.categories || []).join(' · ')])
      ]),
      sample ? h('div', { class: 'pack-preview' }, [
        h('div', { class: 'pack-preview-label', text: '미리보기 · ' + sample.title }),
        h('p', { class: 'pack-preview-text', text: sample.preview + '…' })
      ]) : null,
      h('div', { class: 'pack-tags' }, (p.tags || []).map(function (t) { return h('span', { class: 'pack-tag', text: '#' + t }); })),
      h('div', { class: 'pack-foot' }, [
        h('div', { class: 'pack-price' + (p.type === 'free' ? ' free' : ''), text: priceText(p) }),
        h('div', { class: 'pack-actions' }, [
          h('button', { type: 'button', class: 'pack-btn ghost', 'aria-label': p.name + ' 구성 보기', onclick: function (e) { openModal(p.id, e.currentTarget); } }, ['구성 보기']),
          h('button', { type: 'button', class: 'pack-btn ' + (isSoon(p) ? 'soon' : 'primary'), 'aria-label': ctaAria(p), onclick: function (e) { primaryAction(p, e.currentTarget); } }, [ctaLabel(p)])
        ])
      ])
    ]);
  }

  function renderGrid() {
    var grid = document.getElementById('pack-grid');
    if (!grid) return;
    grid.textContent = '';
    var list = PACKS.filter(function (p) { return state.filter === 'all' || (p.filters || []).indexOf(state.filter) !== -1; });
    // 무료팩은 항상 맨 앞
    list.sort(function (a, b) { return (a.type === 'free' ? 0 : 1) - (b.type === 'free' ? 0 : 1); });
    if (!list.length) {
      grid.appendChild(h('div', { class: 'pack-empty' }, [
        h('img', { src: 'boxy-icon.png', alt: '', width: '48', height: '48' }),
        h('p', { text: '이 카테고리의 팩은 준비 중이에요.' }),
        h('button', { type: 'button', class: 'pack-btn ghost', onclick: function () { state.filter = 'all'; renderFilters(); renderGrid(); } }, ['전체 팩 보기'])
      ]));
      return;
    }
    list.forEach(function (p) { grid.appendChild(packCard(p)); });
  }

  /* ── 주요 버튼 동작 ── */
  function primaryAction(p, opener) {
    if (p.type === 'free') openModal(p.id, opener, 'get');
    else goToPayment(p);
  }

  function goToPayment(p) {
    if (!isOnSale(p)) { toast(SOON_MSG); return; }   // 준비중: 결제 페이지를 열지 않음
    var w = window.open(p.paymentUrl.trim(), '_blank', 'noopener,noreferrer');
    if (w) { try { w.opener = null; } catch (e) {} }
  }

  function fetchPack(p) {
    return fetch(p.downloadUrl, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('http');
      return r.text();
    }).then(function (text) {
      var data = JSON.parse(text);
      if (!data || data.type !== 'prompt-pack' || !Array.isArray(data.memories)) throw new Error('format');
      return text;
    });
  }

  function addToDrawer(p, btn) {
    if (!p.downloadUrl) { toast('파일을 준비하고 있어요.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = '담는 중…'; }
    fetchPack(p).then(function (text) {
      try { sessionStorage.setItem(PENDING_KEY, text); }
      catch (e) { throw new Error('session'); }
      location.href = 'index.html#import-pack';
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = '🧺 내 서랍에 바로 담기'; }
      toast('팩을 불러오지 못했어요. JSON 파일로 받아서 가져와 주세요.');
    });
  }

  /* ── 상세 모달 ── */
  function section(title, body) {
    return h('section', { class: 'pk-sec' }, [h('h3', { class: 'pk-sec-title', text: title })].concat(body));
  }

  function buildModal(p, focusGet) {
    var panel = document.getElementById('pk-modal-panel');
    panel.textContent = '';
    var done = importedInfo(p.packId);

    var head = h('div', { class: 'pk-head' }, [
      h('span', { class: 'pack-drawer lg', style: 'background:' + safeColor(p.drawerColor), 'aria-hidden': 'true' }),
      h('div', { class: 'pk-head-text' }, [
        h('div', { class: 'pack-badges' }, badgeEls(p)),
        h('h2', { class: 'pk-title', id: 'pk-modal-title', text: p.name }),
        h('div', { class: 'pk-sub', text: '프롬프트 ' + p.promptCount + '개 · ' + priceText(p) })
      ]),
      h('button', { type: 'button', class: 'pk-close', 'aria-label': '닫기', onclick: closeModal }, ['✕'])
    ]);

    var samples = (p.samples || []).slice(0, 5).map(function (s) {
      return h('li', { class: 'pk-sample' }, [
        h('div', { class: 'pk-sample-title', text: s.title }),
        h('p', { class: 'pk-sample-text', text: s.preview + '…' })
      ]);
    });

    var body = h('div', { class: 'pk-body' }, [
      (p.highlights && p.highlights.length) ? h('ul', { class: 'pk-highlights' }, p.highlights.map(function (x) { return h('li', { text: x }); })) : null,
      h('p', { class: 'pk-desc', text: p.description || p.summary || '' }),
      section('추천 대상', [h('ul', { class: 'pk-list' }, (p.audience || []).map(function (a) { return h('li', { text: a }); }))]),
      section('구성 · 프롬프트 ' + p.promptCount + '개', [h('div', { class: 'pk-chips' }, (p.categories || []).map(function (c) { return h('span', { class: 'pk-chip', text: c }); }))]),
      (p.contents && p.contents.length) ? section('들어 있는 프롬프트 ' + p.contents.length + '개', [
        h('ol', { class: 'pk-contents' }, p.contents.map(function (t) { return h('li', { text: t }); }))
      ]) : null,
      (p.examples && p.examples.length) ? section('이럴 때 써요', [h('ul', { class: 'pk-list' }, p.examples.map(function (x) { return h('li', { text: x }); }))]) : null,
      samples.length ? section('샘플 프롬프트 미리보기', [
        h('ul', { class: 'pk-samples' }, samples),
        h('p', { class: 'pk-note', text: '미리보기는 일부만 보여드려요. 전체 프롬프트는 팩 파일에 들어 있어요.' })
      ]) : null,
      section('사용 방법', [h('ol', { class: 'pk-steps' }, [
        h('li', { text: p.type === 'free' ? '무료로 받기로 JSON 파일을 받거나, 내 서랍에 바로 담아요.' : '결제를 마치면 팩 파일(.json) 다운로드 링크를 받아요.' }),
        h('li', { text: 'BLACKBOXY 홈에서 🗂 데이터 관리 → 🧺 프롬프트팩 가져오기를 눌러요.' }),
        h('li', { text: '받은 파일을 고르면 기존 기억은 그대로 두고 팩의 프롬프트만 추가돼요.' })
      ])])
    ]);

    var foot = h('div', { class: 'pk-foot' });
    if (done) foot.appendChild(h('p', { class: 'pk-warn', role: 'note', text: '이미 추가한 ' + packLabel(p.name) + '이에요. 다시 담으면 같은 프롬프트가 한 번 더 들어가요.' }));
    var price = h('div', { class: 'pk-price' + (p.type === 'free' ? ' free' : '') }, [h('span', { text: '가격' }), h('b', { text: priceText(p) })]);
    var btns = h('div', { class: 'pk-actions' });
    var mainBtn;
    if (p.type === 'free') {
      var done_ = h('p', { class: 'pk-done', role: 'status', hidden: true });
      if (p.downloadUrl) {
        var fname = p.downloadUrl.split('/').pop();
        mainBtn = h('a', { class: 'pack-btn primary lg', href: p.downloadUrl, download: fname, onclick: function () {
          done_.textContent = '📥 ' + DOWNLOAD_GUIDE;
          done_.hidden = false;
          setTimeout(function () { try { done_.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }, 60);
        } }, ['📥 무료로 받기']);
      } else {
        // TODO: 무료팩 JSON 파일을 올린 뒤 prompt-packs-data.js 의 downloadUrl 을 채우세요.
        mainBtn = h('button', { type: 'button', class: 'pack-btn primary lg', onclick: function () { toast('파일을 준비하고 있어요.'); } }, ['📥 무료로 받기']);
      }
      btns.appendChild(mainBtn);
      btns.appendChild(h('button', { type: 'button', class: 'pack-btn ghost lg', onclick: function (e) { addToDrawer(p, e.currentTarget); } }, ['🧺 내 서랍에 바로 담기']));
      foot.appendChild(price);
      foot.appendChild(btns);
      foot.appendChild(done_);
      foot.appendChild(h('p', { class: 'pk-note', text: '결제·로그인 없이 바로 받을 수 있어요. 받은 파일은 BLACKBOXY 홈 → 🗂 데이터 관리 → 🧺 프롬프트팩 가져오기에서 선택하면 돼요. 가져온 프롬프트는 이 브라우저의 내 서랍에만 저장돼요.' }));
    } else {
      var onSale = isOnSale(p);
      mainBtn = h('button', { type: 'button', class: 'pack-btn lg ' + (onSale ? 'primary' : 'soon'), onclick: function () { goToPayment(p); } },
        [onSale ? '🛒 구매하기 · ' + priceText(p) : '⏳ 준비중 · ' + priceText(p)]);
      btns.appendChild(mainBtn);
      foot.appendChild(price);
      foot.appendChild(btns);
      foot.appendChild(h('p', { class: 'pk-note', text: onSale
        ? '결제는 외부 결제 페이지에서 진행돼요. 결제가 끝나면 팩 파일(.json) 다운로드 링크를 받아요. 환불 및 결제 정책은 결제 페이지에서 확인할 수 있습니다.'
        : '이 팩은 아직 판매 전이에요. 오픈하면 이 페이지에서 바로 구매할 수 있어요. 그동안 무료 스타터팩을 먼저 써보세요.' }));
    }

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(foot);
    return focusGet ? mainBtn : panel.querySelector('.pk-close');
  }

  function openModal(id, opener, mode) {
    var p = findPack(id);
    if (!p) return;
    state.lastFocus = opener || document.activeElement;
    state.openId = id;
    var bg = document.getElementById('pk-modal');
    var target = buildModal(p, mode === 'get');
    bg.hidden = false;
    bg.classList.add('open');
    document.documentElement.classList.add('pk-lock');
    document.body.classList.add('pk-lock');
    var panel = document.getElementById('pk-modal-panel');
    panel.scrollTop = 0;
    setTimeout(function () { (target || panel).focus(); }, 30);
  }

  function closeModal() {
    var bg = document.getElementById('pk-modal');
    if (!bg || bg.hidden) return;
    bg.classList.remove('open');
    bg.hidden = true;
    document.documentElement.classList.remove('pk-lock');
    document.body.classList.remove('pk-lock');
    state.openId = null;
    var f = state.lastFocus;
    state.lastFocus = null;
    if (f && typeof f.focus === 'function' && document.contains(f)) f.focus();
    renderGrid(); // '서랍에 있음' 표시 갱신
  }

  function trapFocus(e) {
    var panel = document.getElementById('pk-modal-panel');
    var items = panel.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  document.addEventListener('keydown', function (e) {
    var bg = document.getElementById('pk-modal');
    if (!bg || bg.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    else if (e.key === 'Tab') trapFocus(e);
  });

  function init() {
    var bg = document.getElementById('pk-modal');
    if (bg) bg.addEventListener('click', function (e) { if (e.target === bg) closeModal(); });
    document.querySelectorAll('[data-open-pack]').forEach(function (b) {
      b.addEventListener('click', function () { openModal(b.getAttribute('data-open-pack'), b); });
    });
    renderFilters();
    renderGrid();
    // 모바일 가로 스크롤 메뉴에서 현재 메뉴(Prompt Packs)가 잘려 보이지 않게
    var nav = document.querySelector('.site-nav .nav-links');
    var cur = nav && nav.querySelector('.nav-link.active');
    if (nav && cur && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = Math.max(0, cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2);
    }
    // 외부에서 prompt-packs.html#pack-marketing 처럼 들어오면 해당 팩 열기
    var m = /^#pack-([a-z0-9_-]+)$/i.exec(location.hash || '');
    if (m && findPack(m[1])) openModal(m[1], null);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
