import { t, formatMoney, formatNumber, formatDate, formatDateTime, categoryName, localizedField } from './i18n.js';

export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function attr(value) {
  return esc(value);
}

/* ------------------------------- icons ------------------------------- */

const ICONS = {
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.4 3-5 6.5-5s6.5 1.6 6.5 5"/><path d="M17 5.5a3.5 3.5 0 0 1 0 7"/><path d="M18.5 20c0-2.6-.8-4.2-2-5.2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  heart: '<path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20z"/>',
  star: '<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.8l5.9-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="m14.5 5.5 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  check: '<path d="m5 13 4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  shelf: '<path d="M3 5h7v14H3zM14 5h7v14h-7zM10 5h4M14 12h4"/>',
  chart: '<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>',
  coins: '<circle cx="9" cy="8" r="5"/><path d="M14.5 4.3a5 5 0 0 1 0 15.4"/><path d="M4 15.5V19a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4"/>',
  bookmark: '<path d="M6 3h12v18l-6-4.5L6 21z"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v4.5h-4.5"/>',
  send: '<path d="M4 12 20 4l-6 16-2.5-6z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  home: '<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  quote: '<path d="M9 7c-3 1-4 3.5-4 6.5V18h5v-6H7c0-2 .7-3.2 2-3.8zM19 7c-3 1-4 3.5-4 6.5V18h5v-6h-3c0-2 .7-3.2 2-3.8z"/>',
  level: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/>',
};

export function icon(name, size = 18, className = '') {
  const body = ICONS[name] || ICONS.book;
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">${body}</svg>`;
}

/* ------------------------------ covers ------------------------------ */

export function coverHtml(book, options = {}) {
  const { size = 'md', href = null, showTone = null } = options;
  const tone = showTone != null ? showTone : (Number(book.cover_tone) || 0) % 8;
  const classes = ['cover', `cover--t${tone}`, `cover--${size}`];
  const tag = href ? 'a' : 'div';
  const linkAttrs = href ? ` href="${attr(href)}"` : '';
  const inner = book.cover_url
    ? `<img class="cover__img" src="${attr(book.cover_url)}" alt="${attr(book.title)}" loading="lazy" />`
    : `<span class="cover__frame">
         <span class="cover__kicker">MỘC LIBRARY</span>
         <span class="cover__title">${esc(book.title)}</span>
         <span class="cover__rule"></span>
         <span class="cover__author">${esc(book.author)}</span>
       </span>`;
  return `<${tag} class="${classes.join(' ')}"${linkAttrs}>
    <span class="cover__spine"></span>
    ${inner}
    <span class="cover__mark">M</span>
  </${tag}>`;
}

/* ------------------------------ badges ------------------------------ */

export function chip(text, variant = 'neutral') {
  return `<span class="chip chip--${variant}">${esc(text)}</span>`;
}

export function availabilityChip(book) {
  if (book.available_copies > 0) {
    return chip(t('book.available_copies', { available: book.available_copies, total: book.total_copies }), 'success');
  }
  if (book.queue_length > 0) return chip(t('book.queue', { count: book.queue_length }), 'warn');
  return chip(t('book.out_of_stock'), 'muted');
}

export function statusChip(status) {
  const map = { active: 'info', overdue: 'danger', returned: 'muted', ready: 'success', waiting: 'warn', fulfilled: 'info', cancelled: 'muted', expired: 'muted' };
  return chip(t(`status.${status}`), map[status] || 'neutral');
}

export function starsHtml(rating, count, options = {}) {
  const value = Number(rating) || 0;
  const stars = [1, 2, 3, 4, 5]
    .map((i) => `<span class="star ${i <= Math.round(value) ? 'star--on' : ''}">${icon('star', options.size || 15)}</span>`)
    .join('');
  const label = count === undefined
    ? (value ? value.toFixed(1) : '')
    : value
      ? `${value.toFixed(1)} · ${t('book.rating_count', { count })}`
      : t('book.no_rating');
  return `<span class="stars" title="${attr(label)}"><span class="stars__row">${stars}</span>
    ${options.hideLabel ? '' : `<span class="stars__label">${esc(label)}</span>`}</span>`;
}

export function ratingBadge(rating, count) {
  if (!rating) return '';
  return `<span class="rating-badge">${icon('star', 13)}<strong>${Number(rating).toFixed(1)}</strong>${
    count ? `<span>(${count})</span>` : ''
  }</span>`;
}

/* --------------------------- book listings --------------------------- */

export function bookCard(book) {
  return `<article class="book-card">
    ${coverHtml(book, { size: 'md' })}
    <div class="book-card__body">
      ${book.category_slug ? `<a class="book-card__cat" href="#/catalog?category=${attr(book.category_slug)}">${esc(categoryName(book))}</a>` : ''}
      <h3 class="book-card__title"><a href="#/book/${attr(book.slug)}">${esc(book.title)}</a></h3>
      <p class="book-card__author">${esc(book.author)}</p>
      <div class="book-card__footer">
        ${availabilityChip(book)}
        ${ratingBadge(book.rating_avg, book.rating_count)}
      </div>
    </div>
  </article>`;
}

export function bookRow(book) {
  return `<a class="book-row" href="#/book/${attr(book.slug)}">
    ${coverHtml(book, { size: 'xs' })}
    <span class="book-row__body">
      <span class="book-row__title">${esc(book.title)}</span>
      <span class="book-row__author">${esc(book.author)}</span>
      <span class="book-row__meta">${esc(categoryName(book))}${book.year ? ` · ${book.year}` : ''}</span>
    </span>
    <span class="book-row__side">${availabilityChip(book)}</span>
  </a>`;
}

/* ------------------------------ states ------------------------------ */

export function spinner(label) {
  return `<div class="state state--loading"><span class="spinner"></span><p>${esc(label || t('common.loading'))}</p></div>`;
}

export function emptyState(message, hint, actionHtml = '') {
  return `<div class="state state--empty">
    ${icon('shelf', 30)}
    <p class="state__title">${esc(message || t('common.empty'))}</p>
    ${hint === null ? '' : `<p class="state__hint">${esc(hint || t('common.empty_hint'))}</p>`}
    ${actionHtml}
  </div>`;
}

export function skeletonCards(count = 4) {
  return `<div class="grid grid--books">${Array.from({ length: count })
    .map(() => '<div class="skeleton skeleton--card"></div>')
    .join('')}</div>`;
}

/* ------------------------------ toasts ------------------------------ */

export function toast(message, variant = 'success') {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const node = document.createElement('div');
  node.className = `toast toast--${variant}`;
  node.innerHTML = `${icon(variant === 'error' ? 'alert' : variant === 'info' ? 'sparkle' : 'check', 18)}
    <span>${esc(message)}</span>`;
  host.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 300);
  }, variant === 'error' ? 5200 : 3600);
}

/* ------------------------------ modals ------------------------------ */

export function openModal({ title, content, footer = '', size = 'md', onMount }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal modal--${size}" role="dialog" aria-modal="true">
      <header class="modal__head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn" data-modal-close aria-label="${attr(t('common.close'))}">${icon('x', 18)}</button>
      </header>
      <div class="modal__body">${content}</div>
      ${footer ? `<footer class="modal__foot">${footer}</footer>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('is-modal-open');
  requestAnimationFrame(() => overlay.classList.add('is-visible'));

  const close = () => {
    overlay.classList.remove('is-visible');
    document.body.classList.remove('is-modal-open');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.closest('[data-modal-close]')) close();
  });
  const onKey = (event) => {
    if (event.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);

  if (onMount) onMount(overlay.querySelector('.modal'), close);
  const focusable = overlay.querySelector('input, select, textarea, button');
  if (focusable) focusable.focus();
  return { overlay, close };
}

export function confirmDialog({ title, message, confirmLabel, danger = true }) {
  return new Promise((resolve) => {
    let settled = false;
    openModal({
      title: title || t('common.confirm'),
      size: 'sm',
      content: `<p class="modal__text">${esc(message)}</p>`,
      footer: `<button class="btn btn--ghost" data-no>${esc(t('common.cancel'))}</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-yes>${esc(confirmLabel || t('common.confirm'))}</button>`,
      onMount(root, close) {
        const backdrop = root.parentElement;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          close();
          resolve(value);
        };
        root.querySelector('[data-no]').addEventListener('click', () => finish(false));
        root.querySelector('[data-yes]').addEventListener('click', () => finish(true));
        root.querySelector('[data-modal-close]').addEventListener('click', () => finish(false));
        backdrop.addEventListener('click', (event) => {
          if (event.target === backdrop) finish(false);
        });
      },
    });
  });
}

/* ------------------------------ tables ------------------------------ */

export function table(headers, rows, options = {}) {
  if (!rows.length) return emptyState(options.emptyMessage || t('admin.no_results'), null);
  return `<div class="table-wrap">
    <table class="table">
      <thead><tr>${headers.map((h) => `<th${h.align ? ` class="ta-${h.align}"` : ''}>${esc(h.label || h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr${row.attrs || ''}>${row.cells.map((cell, i) => `<td${headers[i] && headers[i].align ? ` class="ta-${headers[i].align}"` : ''}>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;
}

export function pagination(page, pages, buildHref) {
  if (!pages || pages <= 1) return '';
  const items = [];
  const push = (label, target, disabled = false, active = false) =>
    items.push(
      disabled
        ? `<span class="page-btn is-disabled">${label}</span>`
        : `<a class="page-btn ${active ? 'is-active' : ''}" href="${attr(buildHref(target))}">${label}</a>`
    );
  push(icon('arrow', 15, 'icon--flip'), page - 1, page <= 1);
  for (let i = 1; i <= pages; i += 1) {
    if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - page) > 1) {
      if (items[items.length - 1] !== '<span class="page-gap">…</span>') items.push('<span class="page-gap">…</span>');
      continue;
    }
    push(String(i), i, false, i === page);
  }
  push(icon('arrow', 15), page + 1, page >= pages);
  return `<nav class="pagination">${items.join('')}</nav>`;
}

/* ------------------------------ misc ------------------------------ */

export function debounce(fn, wait = 320) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function formValues(form) {
  const data = {};
  for (const [key, value] of new FormData(form).entries()) {
    data[key] = typeof value === 'string' ? value.trim() : value;
  }
  for (const input of form.querySelectorAll('input[type="checkbox"]')) {
    data[input.name] = input.checked;
  }
  return data;
}

export function describeLoanDates(loan) {
  return `${formatDate(loan.borrowed_at)} → ${formatDate(loan.due_at)}`;
}

export function holdCountdown(iso) {
  if (!iso) return '';
  return formatDateTime(iso);
}

export { formatMoney, formatNumber, formatDate, formatDateTime, localizedField, categoryName };
