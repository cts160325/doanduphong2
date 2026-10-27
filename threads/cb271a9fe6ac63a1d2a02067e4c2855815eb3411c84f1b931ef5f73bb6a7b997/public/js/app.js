import { t, setLang, getLang, toggleLang, errorMessage } from './i18n.js';
import { store, loadSession, loadCategories, loadStats, logout, onStoreChange } from './store.js';
import { icon, esc, attr, toast, spinner, emptyState } from './ui.js';
import { apiGet } from './api.js';

import { homePage } from './pages/home.js';
import { catalogPage } from './pages/catalog.js';
import { bookPage } from './pages/book.js';
import { loginPage, registerPage } from './pages/auth.js';
import { accountPage } from './pages/account.js';
import { adminPage } from './pages/admin.js';

const header = document.getElementById('site-header');
const footer = document.getElementById('site-footer');
const outlet = document.getElementById('app');

/* ------------------------------- router ------------------------------- */

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = {};
  for (const [key, value] of new URLSearchParams(queryPart || '')) query[key] = value;
  return { segments, query, raw: raw || '' };
}

export function navigate(path) {
  const next = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
  if (location.hash === next) render();
  else location.hash = next;
}

function resolveRoute(segments) {
  const [first = ''] = segments;
  if (!first) return { page: homePage, params: [] };
  if (first === 'catalog') return { page: catalogPage, params: segments.slice(1) };
  if (first === 'book') return { page: bookPage, params: [segments[1]].filter(Boolean) };
  if (first === 'login') return { page: loginPage, params: [] };
  if (first === 'register') return { page: registerPage, params: [] };
  if (first === 'account') return { page: accountPage, params: segments.slice(1) };
  if (first === 'admin') return { page: adminPage, params: segments.slice(1) };
  return { page: homePage, params: [], notFound: true };
}

let renderToken = 0;

async function render() {
  const token = ++renderToken;
  const { segments, query } = parseHash();
  const { page, params, notFound } = resolveRoute(segments);

  const ctx = {
    segments,
    params,
    query,
    notFound: Boolean(notFound),
    user: store.user,
    isAdmin: store.isAdmin,
    categories: store.categories,
    settings: store.settings,
    stats: store.stats,
    navigate,
    render,
  };

  if (notFound) {
    outlet.innerHTML = `<div class="container section">${emptyState(t('err.NOT_FOUND'), null,
      `<a class="btn btn--primary" href="#/">${esc(t('nav.home'))}</a>`)}</div>`;
    return;
  }

  if (page.requiresAuth && !store.user) {
    toast(t('err.UNAUTHORIZED'), 'info');
    navigate(`login?next=${encodeURIComponent(`#/${segments.join('/')}`)}`);
    return;
  }
  if (page.requiresAdmin && !store.isAdmin) {
    outlet.innerHTML = `<div class="container section">${emptyState(t('err.FORBIDDEN'), null,
      `<a class="btn btn--primary" href="#/">${esc(t('nav.home'))}</a>`)}</div>`;
    return;
  }

  outlet.innerHTML = `<div class="container section">${spinner()}</div>`;
  try {
    const result = await page.view(ctx, outlet);
    if (token !== renderToken) return;
    outlet.innerHTML = result.html;
    if (result.mount) result.mount(outlet, ctx);
    document.title = `${result.title || page.title?.(ctx) || t('brand')} · ${t('brand')}`;
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  } catch (error) {
    if (token !== renderToken) return;
    console.error(error);
    outlet.innerHTML = `<div class="container section">${emptyState(
      error.code ? errorMessage(error.code, error.meta) : t('err.generic'),
      null,
      `<button class="btn btn--primary" data-retry>${esc(t('common.retry'))}</button>`
    )}</div>`;
    outlet.querySelector('[data-retry]')?.addEventListener('click', render);
  }
}

/* ------------------------------- header ------------------------------- */

function accountMenu() {
  if (!store.user) {
    return `<div class="header__auth">
      <a class="btn btn--ghost btn--sm" href="#/login">${esc(t('nav.login'))}</a>
      <a class="btn btn--primary btn--sm" href="#/register">${esc(t('nav.register'))}</a>
    </div>`;
  }
  const initials = store.user.name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();
  return `<div class="usermenu" data-usermenu>
    <button class="usermenu__trigger" data-usermenu-toggle aria-haspopup="true" aria-expanded="false">
      <span class="avatar">${esc(initials)}</span>
      <span class="usermenu__name">${esc(store.user.name)}</span>
      ${icon('arrow', 15, 'usermenu__caret')}
    </button>
    <div class="usermenu__panel">
      <div class="usermenu__head">
        <strong>${esc(store.user.name)}</strong>
        <span>${esc(store.user.email)}</span>
      </div>
      <a href="#/account" data-close-menu>${icon('user', 16)}<span>${esc(t('nav.account'))}</span></a>
      <a href="#/account/favorites" data-close-menu>${icon('heart', 16)}<span>${esc(t('account.tab_favorites'))}</span></a>
      ${store.isAdmin ? `<a href="#/admin" data-close-menu>${icon('chart', 16)}<span>${esc(t('nav.admin'))}</span></a>` : ''}
      <button type="button" data-logout>${icon('logout', 16)}<span>${esc(t('nav.logout'))}</span></button>
    </div>
  </div>`;
}

function navLinks(ctx = {}) {
  const current = location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0];
  const link = (href, label, key) =>
    `<a class="mainnav__link ${current === key ? 'is-active' : ''}" href="${href}">${esc(label)}</a>`;
  return [
    link('#/', t('nav.home'), ''),
    link('#/catalog', t('nav.catalog'), 'catalog'),
    `<a class="mainnav__link ${current === 'catalog' && location.hash.includes('sort=popular') ? 'is-active' : ''}" href="#/catalog?sort=popular">${esc(t('home.popular'))}</a>`,
    store.user ? link('#/account', t('nav.account'), 'account') : '',
    store.isAdmin ? link('#/admin', t('nav.admin'), 'admin') : '',
  ]
    .filter(Boolean)
    .join('');
}

function renderHeader() {
  const { query } = parseHash();
  header.innerHTML = `<div class="topbar">
    <div class="container topbar__inner">
      <a class="brand" href="#/">
        <span class="brand__mark">${icon('book', 20)}</span>
        <span class="brand__text">
          <strong>${esc(t('brand'))}</strong>
          <small>${esc(t('tagline'))}</small>
        </span>
      </a>
      <nav class="mainnav" id="mainnav">${navLinks()}</nav>
      <form class="quick-search" data-quick-search role="search">
        ${icon('search', 17)}
        <input type="search" name="q" value="${attr(query.q || '')}" placeholder="${attr(t('nav.search_placeholder'))}" aria-label="${attr(t('common.search'))}" />
        <button type="submit" class="quick-search__go" aria-label="${attr(t('common.search'))}">${icon('arrow', 16)}</button>
      </form>
      <div class="header__actions">
        <button class="lang-toggle" data-lang-toggle title="${attr(t('common.language'))}">
          ${icon('globe', 16)}<span>${getLang().toUpperCase()}</span>
        </button>
        ${accountMenu()}
        <button class="icon-btn mainnav__toggle" data-nav-toggle aria-label="${attr(t('nav.menu'))}">${icon('menu', 20)}</button>
      </div>
    </div>
    <div class="mobile-panel" data-mobile-panel>
      <form class="mobile-search" data-quick-search>
        <input type="search" name="q" value="${attr(query.q || '')}" placeholder="${attr(t('nav.search_placeholder'))}" aria-label="${attr(t('common.search'))}" />
        <button type="submit" class="btn btn--primary btn--sm">${esc(t('common.search'))}</button>
      </form>
      <nav class="mobile-nav">${navLinks()}</nav>
      ${
        store.user
          ? `<button class="btn btn--ghost btn--block" data-logout>${esc(t('nav.logout'))}</button>`
          : `<div class="mobile-auth">
              <a class="btn btn--ghost btn--block" href="#/login">${esc(t('nav.login'))}</a>
              <a class="btn btn--primary btn--block" href="#/register">${esc(t('nav.register'))}</a>
            </div>`
      }
    </div>
  </div>`;

  for (const form of header.querySelectorAll('[data-quick-search]')) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = form.querySelector('input').value.trim();
      closeMobilePanel();
      navigate(`catalog${value ? `?q=${encodeURIComponent(value)}` : ''}`);
    });
  }

  header.querySelector('[data-lang-toggle]').addEventListener('click', () => {
    toggleLang();
    renderHeader();
    render();
  });

  header.querySelector('[data-nav-toggle]')?.addEventListener('click', () => {
    header.querySelector('[data-mobile-panel]').classList.toggle('is-open');
  });

  const menu = header.querySelector('[data-usermenu]');
  if (menu) {
    const trigger = menu.querySelector('[data-usermenu-toggle]');
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = menu.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function closeOnOutside(event) {
      if (!menu.isConnected) {
        document.removeEventListener('click', closeOnOutside);
        return;
      }
      if (!menu.contains(event.target)) menu.classList.remove('is-open');
    });
    for (const link of menu.querySelectorAll('[data-close-menu]')) {
      link.addEventListener('click', () => menu.classList.remove('is-open'));
    }
  }

  for (const button of header.querySelectorAll('[data-logout]')) {
    button.addEventListener('click', async () => {
      await logout();
      closeMobilePanel();
      toast(t('auth.logout_done'), 'info');
      renderHeader();
      const section = parseHash().segments[0];
      if (section === 'account' || section === 'admin') navigate('');
      else render();
    });
  }
}

function closeMobilePanel() {
  header.querySelector('[data-mobile-panel]')?.classList.remove('is-open');
}

/* ------------------------------- footer ------------------------------- */

function renderFooter() {
  const year = new Date().getFullYear();
  footer.innerHTML = `<div class="container footer__inner">
    <div class="footer__brand">
      <a class="brand brand--light" href="#/">
        <span class="brand__mark">${icon('book', 20)}</span>
        <span class="brand__text"><strong>${esc(t('brand'))}</strong><small>${esc(t('tagline'))}</small></span>
      </a>
      <p>${esc(t('footer.about'))}</p>
    </div>
    <div class="footer__col">
      <h3>${esc(t('footer.links'))}</h3>
      <a href="#/catalog">${esc(t('nav.catalog'))}</a>
      <a href="#/catalog?sort=popular">${esc(t('home.popular'))}</a>
      <a href="#/catalog?featured=true">${esc(t('home.featured'))}</a>
      <a href="#/register">${esc(t('nav.register'))}</a>
    </div>
    <div class="footer__col">
      <h3>${esc(t('footer.hours'))}</h3>
      <p>${esc(t('footer.hours_week'))}</p>
      <p>${esc(t('footer.hours_sat'))}</p>
      <p>${esc(t('footer.hours_sun'))}</p>
    </div>
    <div class="footer__col">
      <h3>${esc(t('footer.contact'))}</h3>
      <p>${icon('home', 15)} ${esc(t('footer.address'))}</p>
      <p>${icon('calendar', 15)} ${esc(t('footer.phone'))}</p>
      <p>${icon('send', 15)} ${esc(t('footer.email'))}</p>
    </div>
  </div>
  <div class="footer__bottom">
    <div class="container footer__bottom-inner">
      <span>© ${year} ${esc(t('brand'))}. ${esc(t('footer.rights'))}</span>
      <span class="footer__note">${esc(t('footer.note'))}</span>
    </div>
  </div>`;
}

/* -------------------------------- boot -------------------------------- */

onStoreChange(() => {
  if (document.querySelector('.site-header')) renderHeader();
});

async function boot() {
  document.documentElement.lang = getLang();
  renderHeader();
  renderFooter();
  try {
    await Promise.all([loadSession(), loadCategories(), loadStats()]);
  } catch (error) {
    console.error('boot failed', error);
  }
  renderHeader();
  render();
}

window.addEventListener('hashchange', () => {
  closeMobilePanel();
  render();
});

boot();

export { render };
