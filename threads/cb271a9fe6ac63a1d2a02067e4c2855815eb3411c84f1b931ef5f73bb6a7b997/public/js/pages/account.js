import { t, formatMoney, formatNumber, formatDate, formatDateTime, errorMessage } from '../i18n.js';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '../api.js';
import {
  coverHtml, icon, esc, attr, chip, statusChip, toast, emptyState, confirmDialog, formValues, table,
} from '../ui.js';
import { store, setUser } from '../store.js';

const TABS = [
  ['overview', 'account.tab_overview', 'home'],
  ['loans', 'account.tab_loans', 'book'],
  ['history', 'account.tab_history', 'clock'],
  ['reservations', 'account.tab_reservations', 'bookmark'],
  ['fines', 'account.tab_fines', 'coins'],
  ['favorites', 'account.tab_favorites', 'heart'],
  ['profile', 'account.tab_profile', 'user'],
];

function statCard(label, value, hint, variant = '') {
  return `<div class="stat ${variant ? `stat--${variant}` : ''}">
    <span class="stat__label">${esc(label)}</span>
    <strong class="stat__value">${value}</strong>
    ${hint ? `<span class="stat__hint">${esc(hint)}</span>` : ''}
  </div>`;
}

function fineStatusChip(status) {
  const map = { none: 'muted', unpaid: 'danger', paid: 'success', waived: 'info' };
  return chip(t(`account.fine_status_${status}`), map[status] || 'neutral');
}

function loanCard(loan, { showActions = true, settings } = {}) {
  const maxRenewals = (settings && settings.MAX_RENEWALS) || 2;
  return `<article class="loan-card ${loan.is_overdue ? 'loan-card--overdue' : ''}">
    ${coverHtml({ ...loan, title: loan.book_title, author: loan.book_author, cover_tone: loan.book_cover_tone, cover_url: loan.book_cover_url, slug: loan.book_slug }, { size: 'sm', href: `#/book/${loan.book_slug}` })}
    <div class="loan-card__body">
      <h3><a href="#/book/${attr(loan.book_slug)}">${esc(loan.book_title)}</a></h3>
      <p class="muted small">${esc(loan.book_author)}</p>
      <ul class="loan-card__meta">
        <li>${icon('calendar', 14)}${esc(t('account.borrowed_date'))}: <strong>${esc(formatDate(loan.borrowed_at))}</strong></li>
        <li>${icon('clock', 14)}${esc(t('account.due_date'))}: <strong>${esc(formatDate(loan.due_at))}</strong></li>
        ${
          loan.returned_at
            ? `<li>${icon('check', 14)}${esc(t('account.returned_date'))}: <strong>${esc(formatDate(loan.returned_at))}</strong></li>`
            : ''
        }
      </ul>
      <div class="loan-card__chips">
        ${
          loan.returned_at
            ? statusChip('returned')
            : loan.is_overdue
              ? chip(t('account.overdue_days', { days: loan.overdue_days }), 'danger')
              : chip(t('account.days_left', { days: loan.days_left }), 'info')
        }
        ${loan.renewed_count ? chip(t('account.renewed_times', { count: loan.renewed_count }), 'muted') : ''}
        ${
          !loan.returned_at && loan.renewed_count < maxRenewals
            ? chip(t('account.renew_left', { count: maxRenewals - loan.renewed_count }), 'muted')
            : ''
        }
        ${loan.live_fine ? chip(formatMoney(loan.live_fine), 'danger') : ''}
      </div>
    </div>
    ${
      showActions && loan.status === 'active'
        ? `<div class="loan-card__actions">
            <button class="btn btn--ghost btn--sm" data-renew="${loan.id}" ${loan.is_overdue ? 'disabled' : ''}>${icon('refresh', 15)}${esc(t('book.renew'))}</button>
            <button class="btn btn--primary btn--sm" data-return="${loan.id}">${icon('check', 15)}${esc(t('book.return'))}</button>
          </div>`
        : ''
    }
  </article>`;
}

function reservationCard(reservation) {
  const ready = reservation.status === 'ready';
  return `<article class="reservation-card ${ready ? 'reservation-card--ready' : ''}">
    ${coverHtml({ title: reservation.book_title, author: reservation.book_author, cover_tone: reservation.book_cover_tone, cover_url: reservation.book_cover_url }, { size: 'sm', href: `#/book/${reservation.book_slug}` })}
    <div class="reservation-card__body">
      <h3><a href="#/book/${attr(reservation.book_slug)}">${esc(reservation.book_title)}</a></h3>
      <p class="muted small">${esc(reservation.book_author)}</p>
      <div class="loan-card__chips">
        ${statusChip(reservation.status)}
        ${reservation.status === 'waiting' ? chip(t('account.position', { n: reservation.queue_position }), 'warn') : ''}
        ${ready ? chip(t('account.ready_until', { time: formatDateTime(reservation.expires_at) }), 'success') : ''}
      </div>
      <p class="muted small">${esc(t('account.reserved_on', { date: formatDate(reservation.created_at) }))}</p>
    </div>
    <div class="loan-card__actions">
      ${
        ready
          ? `<button class="btn btn--primary btn--sm" data-borrow-reservation="${reservation.book_id}">${icon('book', 15)}${esc(t('book.borrow'))}</button>`
          : ''
      }
      <button class="btn btn--ghost btn--sm" data-cancel-reservation="${reservation.id}">${icon('x', 15)}${esc(t('book.cancel_reserve'))}</button>
    </div>
  </article>`;
}

export const accountPage = {
  requiresAuth: true,
  title: () => t('account.title'),

  async view(ctx) {
    const tab = TABS.some(([key]) => key === ctx.params[0]) ? ctx.params[0] : 'overview';
    const overviewData = await apiGet('/api/account/overview');
    const overview = overviewData.overview;
    const settings = overviewData.settings;

    let body = '';
    if (tab === 'overview') {
      const [loans, reservations] = await Promise.all([
        apiGet('/api/account/loans', { status: 'active', limit: 4 }),
        apiGet('/api/account/reservations', { status: 'active' }),
      ]);
      const readyHolds = reservations.items.filter((r) => r.status === 'ready');
      body = `
        ${overview.overdue ? `<div class="alert alert--danger">${icon('alert', 18)}<div><strong>${esc(t('account.overdue_alert', { count: overview.overdue }))}</strong></div><a class="btn btn--ghost btn--sm" href="#/account/loans">${esc(t('account.tab_loans'))}</a></div>` : ''}
        ${readyHolds.length ? `<div class="alert alert--success">${icon('bookmark', 18)}<div><strong>${esc(t('account.ready_alert', { count: readyHolds.length }))}</strong><span>${esc(t('account.ready_alert_hint'))}</span></div><a class="btn btn--primary btn--sm" href="#/account/reservations">${esc(t('account.tab_reservations'))}</a></div>` : ''}
        <div class="stats-grid">
          ${statCard(t('account.active_loans'), formatNumber(overview.active_loans), t('account.active_hint', { max: overview.limit }))}
          ${statCard(t('account.due_soon'), formatNumber(overview.due_soon), t('account.due_soon_hint'), overview.due_soon ? 'warn' : '')}
          ${statCard(t('account.waiting'), formatNumber(overview.waiting + overview.ready), t('account.ready') + ': ' + formatNumber(overview.ready))}
          ${statCard(t('account.unpaid'), formatMoney(overview.unpaid_fines), t('account.live_fine') + ': ' + formatMoney(overview.live_fine), overview.unpaid_fines || overview.live_fine ? 'danger' : '')}
          ${statCard(t('account.borrowed_total'), formatNumber(overview.borrowed_total), t('account.tab_history') + ': ' + formatNumber(overview.returned_total))}
          ${statCard(t('account.favorites'), formatNumber(overview.favorites), '')}
        </div>
        <section class="panel">
          <header class="panel__head">
            <h2>${esc(t('account.recent_loans'))}</h2>
            <a class="link-arrow" href="#/account/loans">${esc(t('account.tab_loans'))}${icon('arrow', 15)}</a>
          </header>
          ${loans.items.length ? `<div class="cards">${loans.items.map((l) => loanCard(l, { settings })).join('')}</div>` : emptyState(t('account.loans_empty'), null, `<a class="btn btn--primary" href="#/catalog">${esc(t('nav.catalog'))}</a>`)}
        </section>`;
    }

    if (tab === 'loans' || tab === 'history') {
      const data = await apiGet('/api/account/loans', { status: tab === 'history' ? 'returned' : 'active', limit: 100 });
      const items = data.items;
      body = `<section class="panel">
        <header class="panel__head">
          <h2>${esc(t(tab === 'history' ? 'account.tab_history' : 'account.tab_loans'))}</h2>
          <span class="chip chip--neutral">${formatNumber(items.length)}</span>
        </header>
        ${
          items.length
            ? `<div class="cards">${items.map((loan) => loanCard(loan, { showActions: tab !== 'history', settings })).join('')}</div>`
            : emptyState(t(tab === 'history' ? 'account.history_empty' : 'account.loans_empty'), null,
                `<a class="btn btn--primary" href="#/catalog">${esc(t('nav.catalog'))}</a>`)
        }
      </section>`;
    }

    if (tab === 'reservations') {
      const data = await apiGet('/api/account/reservations', { status: 'active' });
      body = `<section class="panel">
        <header class="panel__head">
          <h2>${esc(t('account.tab_reservations'))}</h2>
          <span class="chip chip--neutral">${formatNumber(data.items.length)}</span>
        </header>
        ${
          data.items.length
            ? `<div class="cards">${data.items.map(reservationCard).join('')}</div>`
            : emptyState(t('account.reservations_empty'), null, `<a class="btn btn--primary" href="#/catalog">${esc(t('nav.catalog'))}</a>`)
        }
      </section>`;
    }

    if (tab === 'fines') {
      const data = await apiGet('/api/account/fines');
      const unpaid = data.items.filter((i) => i.fine_status === 'unpaid');
      body = `<section class="panel">
        <header class="panel__head">
          <h2>${esc(t('account.tab_fines'))}</h2>
          ${unpaid.length ? `<button class="btn btn--primary btn--sm" data-pay-all>${esc(t('account.pay_all', { total: formatMoney(data.unpaid_total) }))}</button>` : ''}
        </header>
        <div class="stats-grid stats-grid--tight">
          ${statCard(t('account.unpaid'), formatMoney(data.unpaid_total), t('account.pay_hint'), data.unpaid_total ? 'danger' : '')}
          ${statCard(t('account.live_fine'), formatMoney(data.live_total), t('book.rules_fine', { fine: formatMoney(settings.FINE_PER_DAY) }), data.live_total ? 'warn' : '')}
        </div>
        ${
          data.items.length
            ? table(
                [
                  { label: t('admin.nav_books') },
                  { label: t('account.due_date') },
                  { label: t('account.overdue_label') },
                  { label: t('account.fine_amount'), align: 'right' },
                  { label: t('common.status') },
                  { label: t('common.actions'), align: 'right' },
                ],
                data.items.map((item) => ({
                  cells: [
                    `<a href="#/book/${attr(item.book_slug)}">${esc(item.book_title)}</a>`,
                    esc(formatDate(item.due_at)),
                    item.is_live ? `${esc(formatNumber(item.overdue_days))} · ${esc(t('admin.fine_live'))}` : '—',
                    `<strong>${esc(formatMoney(item.amount))}</strong>`,
                    fineStatusChip(item.fine_status),
                    item.fine_status === 'unpaid'
                      ? `<button class="btn btn--ghost btn--xs" data-pay-fine="${item.id}">${esc(t('account.pay_fine'))}</button>`
                      : '—',
                  ],
                }))
              )
            : emptyState(t('account.fines_empty'), null)
        }
      </section>`;
    }

    if (tab === 'favorites') {
      const data = await apiGet('/api/favorites');
      body = `<section class="panel">
        <header class="panel__head"><h2>${esc(t('account.tab_favorites'))}</h2><span class="chip chip--neutral">${formatNumber(data.items.length)}</span></header>
        ${
          data.items.length
            ? `<div class="grid grid--books">${data.items
                .map(
                  (book) => `<div class="fav-card">
                    <a class="book-card__link" href="#/book/${attr(book.slug)}">
                      ${coverHtml(book, { size: 'md' })}
                      <h3>${esc(book.title)}</h3>
                      <p class="muted small">${esc(book.author)}</p>
                    </a>
                    <div class="fav-card__actions">
                      ${chip(t('book.available_copies', { available: book.available_copies, total: book.total_copies }), book.available_copies ? 'success' : 'muted')}
                      <button class="btn btn--ghost btn--xs" data-remove-favorite="${book.id}">${icon('x', 14)}${esc(t('common.remove'))}</button>
                    </div>
                  </div>`
                )
                .join('')}</div>`
            : emptyState(t('account.favorites_empty'), null, `<a class="btn btn--primary" href="#/catalog">${esc(t('nav.catalog'))}</a>`)
        }
      </section>`;
    }

    if (tab === 'profile') {
      const user = store.user;
      body = `<section class="panel">
        <header class="panel__head"><h2>${esc(t('account.profile_title'))}</h2></header>
        <form class="form-grid" data-profile-form>
          <label class="field">
            <span>${esc(t('auth.name'))}</span>
            <input type="text" name="name" value="${attr(user.name)}" required />
          </label>
          <label class="field">
            <span>${esc(t('auth.email'))}</span>
            <input type="email" value="${attr(user.email)}" disabled />
          </label>
          <label class="field">
            <span>${esc(t('auth.phone'))}</span>
            <input type="text" name="phone" value="${attr(user.phone || '')}" />
          </label>
          <label class="field field--wide">
            <span>${esc(t('auth.address'))}</span>
            <input type="text" name="address" value="${attr(user.address || '')}" />
          </label>
          <div class="form-grid__actions">
            <button class="btn btn--primary" type="submit">${esc(t('common.save'))}</button>
          </div>
        </form>
      </section>
      <section class="panel">
        <header class="panel__head"><h2>${esc(t('account.password_title'))}</h2></header>
        <form class="form-grid" data-password-form>
          <label class="field">
            <span>${esc(t('account.password_current'))}</span>
            <input type="password" name="current" required autocomplete="current-password" />
          </label>
          <label class="field">
            <span>${esc(t('account.password_new'))}</span>
            <input type="password" name="next" required minlength="6" autocomplete="new-password" />
          </label>
          <div class="form-grid__actions">
            <button class="btn btn--primary" type="submit">${esc(t('account.password_button'))}</button>
          </div>
        </form>
      </section>`;
    }

    const initials = store.user.name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();
    const html = `<div class="container section">
      <div class="account">
        <aside class="account__side">
          <div class="account__user">
            <span class="avatar avatar--lg">${esc(initials)}</span>
            <div>
              <strong>${esc(store.user.name)}</strong>
              <span>${esc(t('account.member_since', { date: formatDate(store.user.created_at) }))}</span>
            </div>
          </div>
          <nav class="account__nav">
            ${TABS.map(
              ([key, labelKey, iconName]) => `<a class="account__nav-item ${tab === key ? 'is-active' : ''}" href="#/account${key === 'overview' ? '' : `/${key}`}">
                ${icon(iconName, 17)}<span>${esc(t(labelKey))}</span>
                ${key === 'fines' && overview.unpaid_fines ? `<span class="badge-dot">${formatNumber(overview.unpaid_fines)}</span>` : ''}
                ${key === 'reservations' && overview.ready ? `<span class="badge-dot badge-dot--success">${overview.ready}</span>` : ''}
              </a>`
            ).join('')}
          </nav>
          <div class="account__side-foot">
            <a class="btn btn--ghost btn--block btn--sm" href="#/catalog">${icon('search', 15)}${esc(t('nav.catalog'))}</a>
          </div>
        </aside>
        <div class="account__main">
          <header class="page-head page-head--tight">
            <div>
              <h1>${esc(t(`account.tab_${tab}`))}</h1>
              <p>${esc(t('account.greeting', { name: store.user.name }))}</p>
            </div>
          </header>
          ${body}
        </div>
      </div>
    </div>`;

    const mount = (root, context) => {
      const reload = () => context.render();
      const guard = async (fn) => {
        try {
          await fn();
        } catch (error) {
          toast(error instanceof ApiError ? errorMessage(error.code, error.meta) : t('err.generic'), 'error');
        }
      };

      root.querySelectorAll('[data-renew]').forEach((button) =>
        button.addEventListener('click', () => guard(async () => {
          await apiPost(`/api/account/loans/${button.dataset.renew}/renew`, {});
          toast(t('admin.loan_renewed'));
          reload();
        }))
      );

      root.querySelectorAll('[data-return]').forEach((button) =>
        button.addEventListener('click', () => guard(async () => {
          const result = await apiPost(`/api/account/loans/${button.dataset.return}/return`, {});
          toast(result.fine
            ? t('admin.loan_fine_notice', { amount: formatMoney(result.fine) })
            : t('admin.loan_returned'));
          reload();
        }))
      );

      root.querySelectorAll('[data-borrow-reservation]').forEach((button) =>
        button.addEventListener('click', () => guard(async () => {
          await apiPost('/api/account/loans', { bookId: Number(button.dataset.borrowReservation) });
          toast(t('book.borrowed_toast'));
          reload();
        }))
      );

      root.querySelectorAll('[data-cancel-reservation]').forEach((button) =>
        button.addEventListener('click', () => guard(async () => {
          if (!(await confirmDialog({ title: t('book.cancel_reserve'), message: t('book.reserved') }))) return;
          await apiDelete(`/api/account/reservations/${button.dataset.cancelReservation}`);
          toast(t('admin.reservation_cancelled'), 'info');
          reload();
        }))
      );

      root.querySelectorAll('[data-pay-fine]').forEach((button) =>
        button.addEventListener('click', () => guard(async () => {
          await apiPost(`/api/account/fines/${button.dataset.payFine}/pay`, {});
          toast(t('admin.fine_paid'));
          reload();
        }))
      );

      root.querySelector('[data-pay-all]')?.addEventListener('click', () => guard(async () => {
        const data = await apiGet('/api/account/fines');
        for (const item of data.items.filter((i) => i.fine_status === 'unpaid')) {
          await apiPost(`/api/account/fines/${item.id}/pay`, {});
        }
        toast(t('admin.fine_paid'));
        reload();
      }));

      root.querySelectorAll('[data-remove-favorite]').forEach((button) =>
        button.addEventListener('click', () => guard(async () => {
          await apiDelete(`/api/favorites/${button.dataset.removeFavorite}`);
          toast(t('book.favorite_removed'), 'info');
          reload();
        }))
      );

      root.querySelector('[data-profile-form]')?.addEventListener('submit', (event) => guard(async () => {
        event.preventDefault();
        const values = formValues(event.currentTarget);
        const data = await apiPatch('/api/auth/profile', values);
        setUser(data.user);
        toast(t('account.profile_saved'));
        reload();
      }));

      root.querySelector('[data-password-form]')?.addEventListener('submit', (event) => guard(async () => {
        event.preventDefault();
        const values = formValues(event.currentTarget);
        await apiPost('/api/auth/password', values);
        event.currentTarget.reset();
        toast(t('account.password_saved'));
      }));
    };

    return { html, mount, title: t('account.title') };
  },
};
