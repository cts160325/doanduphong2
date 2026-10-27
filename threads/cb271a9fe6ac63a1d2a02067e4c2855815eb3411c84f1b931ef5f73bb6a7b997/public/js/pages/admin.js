import { t, formatMoney, formatNumber, formatDate, formatDateTime, formatMonth, errorMessage, categoryName } from '../i18n.js';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError, buildQuery } from '../api.js';
import {
  coverHtml, icon, esc, attr, chip, statusChip, toast, emptyState, confirmDialog, openModal, formValues, table, debounce,
} from '../ui.js';

const NAV = [
  ['overview', 'admin.nav_overview', 'chart'],
  ['books', 'admin.nav_books', 'book'],
  ['categories', 'admin.nav_categories', 'filter'],
  ['members', 'admin.nav_members', 'users'],
  ['loans', 'admin.nav_loans', 'clock'],
  ['reservations', 'admin.nav_reservations', 'bookmark'],
  ['fines', 'admin.nav_fines', 'coins'],
];

const FAIL = (error) => toast(error instanceof ApiError ? errorMessage(error.code, error.meta) : t('err.generic'), 'error');

function statCard(label, value, hint, variant = '') {
  return `<div class="stat ${variant ? `stat--${variant}` : ''}">
    <span class="stat__label">${esc(label)}</span>
    <strong class="stat__value">${value}</strong>
    ${hint ? `<span class="stat__hint">${esc(hint)}</span>` : ''}
  </div>`;
}

function sectionHead(titleKey, subKey, subVars, actions = '') {
  return `<header class="page-head">
    <div>
      <h1>${esc(t(titleKey))}</h1>
      <p>${subKey ? esc(t(subKey, subVars)) : ''}</p>
    </div>
    ${actions ? `<div class="page-head__actions">${actions}</div>` : ''}
  </header>`;
}

function toolbar({ search, searchPlaceholder, filters = [], actions = '' }) {
  return `<div class="toolbar">
    ${
      search === undefined
        ? ''
        : `<form class="toolbar__search" data-search-form>
            ${icon('search', 16)}
            <input type="search" name="q" value="${attr(search || '')}" placeholder="${attr(searchPlaceholder || t('common.search'))}" />
          </form>`
    }
    ${filters.map((f) => `<div class="toolbar__filters">${f}</div>`).join('')}
    ${actions ? `<div class="toolbar__actions">${actions}</div>` : ''}
  </div>`;
}

function filterChips(options, active, hrefFor) {
  return `<div class="chips">${options
    .map(
      ([value, label]) =>
        `<a class="chip chip--link ${active === value ? 'is-active' : ''}" href="${attr(hrefFor(value))}">${esc(label)}</a>`
    )
    .join('')}</div>`;
}

/* ------------------------------ overview ------------------------------ */

async function overviewSection(ctx) {
  const data = await apiGet('/api/admin/overview');
  const { stats, monthly, popular, recent } = data;
  const max = Math.max(...monthly.map((m) => Math.max(m.loans, m.returns)), 1);

  const html = `
    ${sectionHead('admin.overview_title', 'admin.overview_sub')}
    <div class="stats-grid">
      ${statCard(t('admin.stat_books'), formatNumber(stats.books), t('admin.stat_copies', { available: formatNumber(stats.available) }))}
      ${statCard(t('admin.stat_members'), formatNumber(stats.members), t('admin.stat_new_members', { count: stats.new_members }))}
      ${statCard(t('admin.stat_active'), formatNumber(stats.active_loans), t('admin.stat_active'))}
      ${statCard(t('admin.stat_overdue'), formatNumber(stats.overdue), t('admin.stat_overdue'), stats.overdue ? 'danger' : '')}
      ${statCard(t('admin.stat_waiting'), formatNumber(stats.waiting), t('admin.stat_ready') + ': ' + formatNumber(stats.ready), stats.waiting ? 'warn' : '')}
      ${statCard(t('admin.stat_unpaid'), formatMoney(stats.unpaid_fines), t('admin.fine_live'))}
      ${statCard(t('admin.stat_collected'), formatMoney(stats.collected_fines), t('admin.stat_collected'))}
      ${statCard(t('home.categories'), formatNumber(ctx.categories.length), t('admin.category_books'))}
    </div>

    <div class="split split--admin">
      <section class="panel">
        <header class="panel__head"><h2>${esc(t('admin.chart_title'))}</h2>
          <div class="legend">
            <span><i class="legend__swatch legend__swatch--loans"></i>${esc(t('admin.chart_loans'))}</span>
            <span><i class="legend__swatch legend__swatch--returns"></i>${esc(t('admin.chart_returns'))}</span>
          </div>
        </header>
        <div class="chart">
          ${monthly
            .map(
              (m) => `<div class="chart__col">
                <div class="chart__bars">
                  <span class="chart__bar chart__bar--loans" style="height:${Math.round((m.loans / max) * 100)}%" title="${esc(t('admin.chart_loans'))}: ${m.loans}"></span>
                  <span class="chart__bar chart__bar--returns" style="height:${Math.round((m.returns / max) * 100)}%" title="${esc(t('admin.chart_returns'))}: ${m.returns}"></span>
                </div>
                <span class="chart__label">${esc(formatMonth(m.year, m.month))}</span>
                <span class="chart__value">${m.loans}/${m.returns}</span>
              </div>`
            )
            .join('')}
        </div>
      </section>

      <section class="panel">
        <header class="panel__head"><h2>${esc(t('admin.popular_title'))}</h2></header>
        <ol class="rank rank--compact">
          ${popular
            .map(
              (book, index) => `<li class="rank__item">
                <span class="rank__num">${index + 1}</span>
                <a class="rank__link" href="#/book/${attr(book.slug)}">
                  <span class="rank__body"><strong>${esc(book.title)}</strong><span>${esc(book.author)}</span></span>
                </a>
                <span class="rank__meta">${chip(t('admin.loans_label', { count: book.loan_count }), 'muted')}</span>
              </li>`
            )
            .join('')}
        </ol>
      </section>
    </div>

    <section class="panel">
      <header class="panel__head">
        <h2>${esc(t('admin.recent_title'))}</h2>
        <a class="link-arrow" href="#/admin/loans">${esc(t('admin.nav_loans'))}${icon('arrow', 15)}</a>
      </header>
      ${table(
        [
          { label: t('admin.nav_members') },
          { label: t('admin.nav_books') },
          { label: t('account.borrowed_date') },
          { label: t('account.due_date') },
          { label: t('common.status') },
        ],
        recent.map((loan) => ({
          cells: [
            `<strong>${esc(loan.user_name)}</strong><br /><span class="muted small">${esc(loan.user_email)}</span>`,
            `<a href="#/book/${attr(loan.book_slug)}">${esc(loan.book_title)}</a>`,
            esc(formatDate(loan.borrowed_at)),
            esc(formatDate(loan.due_at)),
            loan.returned_at ? statusChip('returned') : statusChip(loan.due_at < new Date().toISOString() ? 'overdue' : 'active'),
          ],
        }))
      )}
    </section>`;

  return { html };
}

/* ------------------------------- books ------------------------------- */

function toneOptions(current) {
  return `<div class="tone-picker">
    ${[0, 1, 2, 3, 4, 5, 6, 7]
      .map(
        (tone) => `<label class="tone-picker__item">
          <input type="radio" name="cover_tone" value="${tone}" ${Number(current) === tone ? 'checked' : ''} />
          <span class="tone-picker__swatch cover--t${tone}"></span>
        </label>`
      )
      .join('')}
  </div>`;
}

function bookForm(book = {}) {
  const categories = ctxCategories();
  return `<form class="form-grid form-grid--modal" data-book-form>
    <label class="field field--wide">
      <span>${esc(t('admin.form_title'))}</span>
      <input type="text" name="title" value="${attr(book.title || '')}" required />
    </label>
    <label class="field">
      <span>${esc(t('admin.form_author'))}</span>
      <input type="text" name="author" value="${attr(book.author || '')}" required />
    </label>
    <label class="field">
      <span>${esc(t('admin.form_category'))}</span>
      <select name="category_id">
        <option value="">—</option>
        ${categories
          .map(
            (c) => `<option value="${c.id}" ${Number(book.category_id) === c.id ? 'selected' : ''}>${esc(categoryName(c))}</option>`
          )
          .join('')}
      </select>
    </label>
    <label class="field">
      <span>${esc(t('admin.form_language'))}</span>
      <select name="language">
        <option value="vi" ${book.language !== 'en' ? 'selected' : ''}>${esc(t('common.vi'))}</option>
        <option value="en" ${book.language === 'en' ? 'selected' : ''}>${esc(t('common.en'))}</option>
      </select>
    </label>
    <label class="field">
      <span>${esc(t('admin.form_publisher'))}</span>
      <input type="text" name="publisher" value="${attr(book.publisher || '')}" />
    </label>
    <label class="field">
      <span>${esc(t('admin.form_year'))}</span>
      <input type="number" name="year" min="0" max="2100" value="${attr(book.year || '')}" />
    </label>
    <label class="field">
      <span>${esc(t('admin.form_pages'))}</span>
      <input type="number" name="pages" min="1" value="${attr(book.pages || '')}" />
    </label>
    <label class="field">
      <span>${esc(t('admin.form_isbn'))}</span>
      <input type="text" name="isbn" value="${attr(book.isbn || '')}" />
    </label>
    <label class="field">
      <span>${esc(t('admin.form_shelf'))}</span>
      <input type="text" name="shelf" value="${attr(book.shelf || '')}" />
    </label>
    <label class="field">
      <span>${esc(t('admin.form_copies'))}</span>
      <input type="number" name="total_copies" min="1" max="999" value="${attr(book.total_copies || 1)}" required />
    </label>
    <div class="field field--wide">
      <span>${esc(t('admin.form_cover_tone'))}</span>
      ${toneOptions(book.cover_tone || 0)}
    </div>
    <label class="field field--wide">
      <span>${esc(t('admin.form_cover_url'))} <em class="muted">${esc(t('common.optional'))}</em></span>
      <input type="url" name="cover_url" value="${attr(book.cover_url || '')}" placeholder="https://…" />
    </label>
    <label class="field field--wide">
      <span>${esc(t('admin.form_desc_vi'))}</span>
      <textarea name="description_vi" rows="3">${esc(book.description_vi || '')}</textarea>
    </label>
    <label class="field field--wide">
      <span>${esc(t('admin.form_desc_en'))}</span>
      <textarea name="description_en" rows="3">${esc(book.description_en || '')}</textarea>
    </label>
    <label class="checkbox field--wide">
      <input type="checkbox" name="featured" ${book.featured ? 'checked' : ''} />
      <span>${esc(t('admin.form_featured'))}</span>
    </label>
  </form>`;
}

let categoriesCache = [];
function ctxCategories() {
  return categoriesCache;
}

async function booksSection(ctx) {
  const q = ctx.query.q || '';
  const category = ctx.query.category || '';
  categoriesCache = ctx.categories.length ? ctx.categories : await apiGet('/api/categories').then((d) => d.items);
  const data = await apiGet('/api/admin/books', { q, category });
  const items = data.items;

  const html = `
    ${sectionHead('admin.books_title', 'admin.books_sub', { count: formatNumber(items.length) },
      `<button class="btn btn--primary" data-add-book>${icon('plus', 16)}${esc(t('admin.add_book'))}</button>`)}
    ${toolbar({
      search: q,
      searchPlaceholder: t('admin.search_books'),
      filters: [
        `<select data-filter-category>
          <option value="">${esc(t('common.all'))}</option>
          ${ctx.categories
            .map((c) => `<option value="${c.slug}" ${category === c.slug ? 'selected' : ''}>${esc(categoryName(c))}</option>`)
            .join('')}
        </select>`,
      ],
    })}
    ${table(
      [
        { label: '' },
        { label: t('admin.form_title') },
        { label: t('admin.form_category') },
        { label: t('admin.form_copies') },
        { label: t('admin.member_total_loans') },
        { label: t('book.rating') },
        { label: t('common.actions'), align: 'right' },
      ],
      items.map((book) => ({
        cells: [
          `<div class="table__cover">${coverHtml(book, { size: 'xxs', href: `#/book/${book.slug}` })}</div>`,
          `<a href="#/book/${attr(book.slug)}"><strong>${esc(book.title)}</strong></a><br /><span class="muted small">${esc(book.author)}${book.year ? ` · ${book.year}` : ''}</span>`,
          book.category_slug ? esc(categoryName(book)) : '—',
          `${chip(t('admin.copies_label', { available: book.available_copies, total: book.total_copies }), book.available_copies ? 'success' : 'warn')}
            ${book.queue_length ? chip(t('book.queue', { count: book.queue_length }), 'info') : ''}`,
          formatNumber(book.loan_count),
          book.rating_avg ? `${Number(book.rating_avg).toFixed(1)} (${book.rating_count})` : '—',
          `<div class="row-actions">
            <button class="icon-btn" data-edit-book="${book.id}" title="${attr(t('common.edit'))}">${icon('edit', 16)}</button>
            <button class="icon-btn icon-btn--danger" data-delete-book="${book.id}" data-title="${attr(book.title)}" title="${attr(t('common.delete'))}">${icon('trash', 16)}</button>
          </div>`,
        ],
      })),
      { emptyMessage: t('admin.no_results') }
    )}`;

  const mount = (root, context) => {
    const openBookModal = (book) => {
      openModal({
        title: book ? t('admin.edit_book', { title: book.title }) : t('admin.add_book'),
        size: 'lg',
        content: bookForm(book || {}),
        footer: `<button class="btn btn--ghost" data-modal-close>${esc(t('common.cancel'))}</button>
          <button class="btn btn--primary" data-save-book>${esc(t('common.save'))}</button>`,
        onMount(modalRoot, close) {
          const form = modalRoot.querySelector('[data-book-form]');
          modalRoot.querySelector('[data-save-book]').addEventListener('click', async () => {
            if (!form.reportValidity()) return;
            const values = formValues(form);
            const payload = {
              title: values.title,
              author: values.author,
              category_id: values.category_id || null,
              language: values.language,
              publisher: values.publisher || null,
              year: values.year || null,
              pages: values.pages || null,
              isbn: values.isbn || null,
              shelf: values.shelf || null,
              total_copies: values.total_copies,
              cover_tone: values.cover_tone,
              cover_url: values.cover_url || null,
              description_vi: values.description_vi || null,
              description_en: values.description_en || null,
              featured: Boolean(values.featured),
            };
            try {
              if (book) {
                await apiPatch(`/api/admin/books/${book.id}`, payload);
                toast(t('admin.book_updated'));
              } else {
                await apiPost('/api/admin/books', payload);
                toast(t('admin.book_created'));
              }
              close();
              context.render();
            } catch (error) {
              FAIL(error);
            }
          });
        },
      });
    };

    root.querySelector('[data-add-book]')?.addEventListener('click', () => openBookModal(null));
    root.querySelectorAll('[data-edit-book]').forEach((button) =>
      button.addEventListener('click', () => openBookModal(items.find((b) => b.id === Number(button.dataset.editBook))))
    );
    root.querySelectorAll('[data-delete-book]').forEach((button) =>
      button.addEventListener('click', async () => {
        const sure = await confirmDialog({
          title: t('common.delete'),
          message: t('admin.delete_book_confirm', { title: button.dataset.title }),
          confirmLabel: t('common.delete'),
        });
        if (!sure) return;
        try {
          await apiDelete(`/api/admin/books/${button.dataset.deleteBook}`);
          toast(t('admin.book_deleted'));
          context.render();
        } catch (error) {
          FAIL(error);
        }
      })
    );

    root.querySelector('[data-search-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      context.navigate(`admin/books${buildQuery({ q: event.target.querySelector('input').value.trim() })}`);
    });
    const searchInput = root.querySelector('[data-search-form] input');
    searchInput?.addEventListener('input', debounce(() => {
      context.navigate(`admin/books${buildQuery({ q: searchInput.value.trim(), category })}`);
    }, 500));
    root.querySelector('[data-filter-category]')?.addEventListener('change', (event) => {
      context.navigate(`admin/books${buildQuery({ q, category: event.target.value })}`);
    });
  };

  return { html, mount };
}

/* ---------------------------- categories ---------------------------- */

async function categoriesSection(ctx) {
  const data = await apiGet('/api/admin/categories');
  const items = data.items;
  categoriesCache = items;

  const html = `
    ${sectionHead('admin.categories_title', 'admin.categories_sub', { count: formatNumber(items.length) },
      `<button class="btn btn--primary" data-add-category>${icon('plus', 16)}${esc(t('admin.add_category'))}</button>`)}
    ${table(
      [
        { label: t('admin.category_name_vi') },
        { label: t('admin.category_name_en') },
        { label: t('admin.form_slug') },
        { label: t('admin.category_books') },
        { label: t('common.actions'), align: 'right' },
      ],
      items.map((category) => ({
        cells: [
          `<strong>${esc(category.name_vi)}</strong>`,
          esc(category.name_en),
          `<code>${esc(category.slug)}</code>`,
          formatNumber(category.book_count),
          `<div class="row-actions">
            <button class="icon-btn" data-edit-category="${category.id}" title="${attr(t('common.edit'))}">${icon('edit', 16)}</button>
            <button class="icon-btn icon-btn--danger" data-delete-category="${category.id}" data-name="${attr(category.name_vi)}" title="${attr(t('common.delete'))}">${icon('trash', 16)}</button>
          </div>`,
        ],
      })),
      { emptyMessage: t('admin.no_results') }
    )}`;

  const mount = (root, context) => {
    const modal = (category) => {
      openModal({
        title: category ? `${t('common.edit')}: ${category.name_vi}` : t('admin.add_category'),
        size: 'sm',
        content: `<form class="form-grid form-grid--modal" data-category-form>
          <label class="field field--wide">
            <span>${esc(t('admin.category_name_vi'))}</span>
            <input type="text" name="name_vi" value="${attr(category?.name_vi || '')}" required />
          </label>
          <label class="field field--wide">
            <span>${esc(t('admin.category_name_en'))}</span>
            <input type="text" name="name_en" value="${attr(category?.name_en || '')}" />
          </label>
        </form>`,
        footer: `<button class="btn btn--ghost" data-modal-close>${esc(t('common.cancel'))}</button>
          <button class="btn btn--primary" data-save-category>${esc(t('common.save'))}</button>`,
        onMount(modalRoot, close) {
          const form = modalRoot.querySelector('[data-category-form]');
          modalRoot.querySelector('[data-save-category]').addEventListener('click', async () => {
            if (!form.reportValidity()) return;
            const values = formValues(form);
            try {
              if (category) {
                await apiPatch(`/api/admin/categories/${category.id}`, values);
                toast(t('admin.category_updated'));
              } else {
                await apiPost('/api/admin/categories', values);
                toast(t('admin.category_created'));
              }
              close();
              context.render();
            } catch (error) {
              FAIL(error);
            }
          });
        },
      });
    };

    root.querySelector('[data-add-category]')?.addEventListener('click', () => modal(null));
    root.querySelectorAll('[data-edit-category]').forEach((button) =>
      button.addEventListener('click', () => modal(items.find((c) => c.id === Number(button.dataset.editCategory))))
    );
    root.querySelectorAll('[data-delete-category]').forEach((button) =>
      button.addEventListener('click', async () => {
        const sure = await confirmDialog({
          title: t('common.delete'),
          message: t('admin.delete_category_confirm', { name: button.dataset.name }),
          confirmLabel: t('common.delete'),
        });
        if (!sure) return;
        try {
          await apiDelete(`/api/admin/categories/${button.dataset.deleteCategory}`);
          toast(t('admin.category_deleted'));
          context.render();
        } catch (error) {
          FAIL(error);
        }
      })
    );
  };

  return { html, mount };
}

/* ------------------------------ members ------------------------------ */

async function membersSection(ctx) {
  const q = ctx.query.q || '';
  const data = await apiGet('/api/admin/members', { q });
  const items = data.items;

  const html = `
    ${sectionHead('admin.members_title', 'admin.members_sub', { count: formatNumber(items.length) })}
    ${toolbar({ search: q, searchPlaceholder: t('admin.search_members') })}
    ${table(
      [
        { label: t('auth.name') },
        { label: t('admin.role') },
        { label: t('common.status') },
        { label: t('admin.member_loans'), align: 'center' },
        { label: t('admin.member_overdue'), align: 'center' },
        { label: t('admin.member_fines'), align: 'right' },
        { label: t('common.actions'), align: 'right' },
      ],
      items.map((member) => ({
        cells: [
          `<strong>${esc(member.name)}</strong><br /><span class="muted small">${esc(member.email)}</span>
            ${member.phone ? `<br /><span class="muted small">${esc(member.phone)}</span>` : ''}`,
          member.role === 'admin' ? chip(t('admin.role_admin'), 'accent') : chip(t('admin.role_member'), 'neutral'),
          member.status === 'active' ? chip(t('admin.status_active'), 'success') : chip(t('admin.status_suspended'), 'danger'),
          formatNumber(member.active_loans),
          member.overdue ? chip(formatNumber(member.overdue), 'danger') : '—',
          member.unpaid_fines ? `<strong>${esc(formatMoney(member.unpaid_fines))}</strong>` : '—',
          `<div class="row-actions">
            <button class="icon-btn" data-edit-member="${member.id}" title="${attr(t('admin.edit_member'))}">${icon('edit', 16)}</button>
            <button class="icon-btn" data-toggle-status="${member.id}" data-status="${member.status}" title="${attr(member.status === 'active' ? t('admin.suspend') : t('admin.activate'))}">
              ${icon(member.status === 'active' ? 'x' : 'check', 16)}
            </button>
            <button class="icon-btn" data-toggle-role="${member.id}" data-role="${member.role}" title="${attr(member.role === 'admin' ? t('admin.make_member') : t('admin.make_admin'))}">
              ${icon('user', 16)}
            </button>
          </div>`,
        ],
      })),
      { emptyMessage: t('admin.no_results') }
    )}`;

  const mount = (root, context) => {
    const patch = async (body) => {
      try {
        await apiPatch(`/api/admin/members/${body.id}`, body.payload);
        toast(t('admin.member_updated'));
        context.render();
      } catch (error) {
        FAIL(error);
      }
    };

    root.querySelectorAll('[data-edit-member]').forEach((button) => {
      const member = items.find((m) => m.id === Number(button.dataset.editMember));
      button.addEventListener('click', () =>
        openModal({
          title: `${t('admin.edit_member')}: ${member.name}`,
          size: 'sm',
          content: `<form class="form-grid form-grid--modal" data-member-form>
            <label class="field field--wide"><span>${esc(t('auth.name'))}</span>
              <input type="text" name="name" value="${attr(member.name)}" required /></label>
            <label class="field field--wide"><span>${esc(t('auth.phone'))}</span>
              <input type="text" name="phone" value="${attr(member.phone || '')}" /></label>
            <label class="field field--wide"><span>${esc(t('auth.address'))}</span>
              <input type="text" name="address" value="${attr(member.address || '')}" /></label>
          </form>`,
          footer: `<button class="btn btn--ghost" data-modal-close>${esc(t('common.cancel'))}</button>
            <button class="btn btn--primary" data-save-member>${esc(t('common.save'))}</button>`,
          onMount(modalRoot, close) {
            const form = modalRoot.querySelector('[data-member-form]');
            modalRoot.querySelector('[data-save-member]').addEventListener('click', async () => {
              if (!form.reportValidity()) return;
              try {
                await apiPatch(`/api/admin/members/${member.id}`, formValues(form));
                toast(t('admin.member_updated'));
                close();
                context.render();
              } catch (error) {
                FAIL(error);
              }
            });
          },
        })
      );
    });

    root.querySelectorAll('[data-toggle-status]').forEach((button) =>
      button.addEventListener('click', () =>
        patch({
          id: Number(button.dataset.toggleStatus),
          payload: { status: button.dataset.status === 'active' ? 'suspended' : 'active' },
        })
      )
    );

    root.querySelectorAll('[data-toggle-role]').forEach((button) =>
      button.addEventListener('click', () =>
        patch({
          id: Number(button.dataset.toggleRole),
          payload: { role: button.dataset.role === 'admin' ? 'member' : 'admin' },
        })
      )
    );

    root.querySelector('[data-search-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      context.navigate(`admin/members${buildQuery({ q: event.target.querySelector('input').value.trim() })}`);
    });
    const searchInput = root.querySelector('[data-search-form] input');
    searchInput?.addEventListener('input', debounce(() => {
      context.navigate(`admin/members${buildQuery({ q: searchInput.value.trim() })}`);
    }, 500));
  };

  return { html, mount };
}

/* ------------------------------- loans ------------------------------- */

async function loansSection(ctx) {
  const status = ctx.query.status || 'all';
  const q = ctx.query.q || '';
  const data = await apiGet('/api/admin/loans', { status, q, limit: 100 });
  const items = data.items;
  const hrefFor = (value) => `#/admin/loans${buildQuery({ status: value === 'all' ? '' : value, q })}`;

  const html = `
    ${sectionHead('admin.loans_title', 'admin.loans_sub', { count: formatNumber(data.total) },
      `<button class="btn btn--primary" data-new-loan>${icon('plus', 16)}${esc(t('admin.add_loan'))}</button>`)}
    ${toolbar({
      search: q,
      searchPlaceholder: t('admin.search_loans'),
      filters: [
        filterChips(
          [
            ['all', t('admin.filter_all')],
            ['active', t('admin.filter_active')],
            ['overdue', t('admin.filter_overdue')],
            ['returned', t('admin.filter_returned')],
            ['unpaid_fines', t('admin.filter_unpaid')],
          ],
          status,
          hrefFor
        ),
      ],
    })}
    ${table(
      [
        { label: t('admin.nav_members') },
        { label: t('admin.nav_books') },
        { label: t('account.borrowed_date') },
        { label: t('account.due_date') },
        { label: t('common.status') },
        { label: t('account.fine_amount'), align: 'right' },
        { label: t('common.actions'), align: 'right' },
      ],
      items.map((loan) => ({
        cells: [
          `<strong>${esc(loan.user_name)}</strong><br /><span class="muted small">${esc(loan.user_email)}</span>`,
          `<a href="#/book/${attr(loan.book_slug)}">${esc(loan.book_title)}</a>`,
          esc(formatDate(loan.borrowed_at)),
          `${esc(formatDate(loan.due_at))}${loan.returned_at ? `<br /><span class="muted small">${esc(t('account.returned_date'))}: ${esc(formatDate(loan.returned_at))}</span>` : ''}`,
          loan.status === 'returned'
            ? statusChip('returned')
            : loan.is_overdue
              ? `${statusChip('overdue')} ${chip(t('account.overdue_days', { days: loan.overdue_days }), 'danger')}`
              : statusChip('active'),
          loan.status === 'active'
            ? loan.live_fine
              ? `<strong>${esc(formatMoney(loan.live_fine))}</strong>`
              : '—'
            : loan.fine_amount
              ? `<strong>${esc(formatMoney(loan.fine_amount))}</strong><br /><span class="muted small">${esc(t(`account.fine_status_${loan.fine_status}`))}</span>`
              : '—',
          `<div class="row-actions">
            ${
              loan.status === 'active'
                ? `<button class="icon-btn" data-renew-loan="${loan.id}" title="${attr(t('book.renew'))}" ${loan.is_overdue ? 'disabled' : ''}>${icon('refresh', 16)}</button>
                   <button class="icon-btn icon-btn--primary" data-return-loan="${loan.id}" title="${attr(t('book.return'))}">${icon('check', 16)}</button>`
                : ''
            }
          </div>`,
        ],
      })),
      { emptyMessage: t('admin.no_results') }
    )}`;

  const mount = (root, context) => {
    root.querySelectorAll('[data-return-loan]').forEach((button) =>
      button.addEventListener('click', async () => {
        try {
          const result = await apiPost(`/api/admin/loans/${button.dataset.returnLoan}/return`, {});
          toast(result.fine
            ? `${t('admin.loan_returned')} ${t('admin.loan_fine_notice', { amount: formatMoney(result.fine) })}`
            : t('admin.loan_returned'));
          context.render();
        } catch (error) {
          FAIL(error);
        }
      })
    );

    root.querySelectorAll('[data-renew-loan]').forEach((button) =>
      button.addEventListener('click', async () => {
        try {
          await apiPost(`/api/admin/loans/${button.dataset.renewLoan}/renew`, {});
          toast(t('admin.loan_renewed'));
          context.render();
        } catch (error) {
          FAIL(error);
        }
      })
    );

    root.querySelector('[data-new-loan]')?.addEventListener('click', async () => {
      const [members, books] = await Promise.all([
        apiGet('/api/admin/members', { q: '' }),
        apiGet('/api/admin/books', { q: '' }),
      ]);
      openModal({
        title: t('admin.add_loan'),
        content: `<form class="form-grid form-grid--modal" data-loan-form>
          <label class="field field--wide"><span>${esc(t('admin.select_member'))}</span>
            <select name="userId" required>
              ${members.items
                .filter((m) => m.status === 'active')
                .map((m) => `<option value="${m.id}">${esc(m.name)} · ${esc(m.email)}</option>`)
                .join('')}
            </select></label>
          <label class="field field--wide"><span>${esc(t('admin.select_book'))}</span>
            <select name="bookId" required>
              ${books.items
                .map(
                  (b) => `<option value="${b.id}" ${b.available_copies ? '' : 'disabled'}>
                    ${esc(b.title)} — ${esc(b.author)} (${b.available_copies}/${b.total_copies})
                  </option>`
                )
                .join('')}
            </select></label>
          <label class="field field--wide"><span>${esc(t('admin.loan_days'))}</span>
            <input type="number" name="days" min="1" max="90" value="${ctx.settings.LOAN_DAYS}" /></label>
        </form>`,
        footer: `<button class="btn btn--ghost" data-modal-close>${esc(t('common.cancel'))}</button>
          <button class="btn btn--primary" data-save-loan>${esc(t('common.create'))}</button>`,
        onMount(modalRoot, close) {
          const form = modalRoot.querySelector('[data-loan-form]');
          modalRoot.querySelector('[data-save-loan]').addEventListener('click', async () => {
            if (!form.reportValidity()) return;
            const values = formValues(form);
            try {
              await apiPost('/api/admin/loans', {
                userId: Number(values.userId),
                bookId: Number(values.bookId),
                days: Number(values.days),
              });
              toast(t('admin.loan_created'));
              close();
              context.render();
            } catch (error) {
              FAIL(error);
            }
          });
        },
      });
    });

    root.querySelector('[data-search-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      context.navigate(`admin/loans${buildQuery({ status: status === 'all' ? '' : status, q: event.target.querySelector('input').value.trim() })}`);
    });
    const searchInput = root.querySelector('[data-search-form] input');
    searchInput?.addEventListener('input', debounce(() => {
      context.navigate(`admin/loans${buildQuery({ status: status === 'all' ? '' : status, q: searchInput.value.trim() })}`);
    }, 500));
  };

  return { html, mount };
}

/* --------------------------- reservations --------------------------- */

async function reservationsSection(ctx) {
  const status = ctx.query.status || 'active';
  const q = ctx.query.q || '';
  const data = await apiGet('/api/admin/reservations', { status, q });
  const items = data.items;
  const hrefFor = (value) => `#/admin/reservations${buildQuery({ status: value === 'active' ? '' : value, q })}`;

  const html = `
    ${sectionHead('admin.reservations_title', 'admin.reservations_sub', { count: formatNumber(data.total) })}
    ${toolbar({
      search: q,
      searchPlaceholder: t('admin.search_loans'),
      filters: [
        filterChips(
          [
            ['active', t('admin.filter_active')],
            ['waiting', t('status.waiting')],
            ['ready', t('status.ready')],
            ['fulfilled', t('status.fulfilled')],
            ['cancelled', t('status.cancelled')],
            ['expired', t('status.expired')],
            ['all', t('admin.filter_all')],
          ],
          status,
          hrefFor
        ),
      ],
    })}
    ${table(
      [
        { label: t('admin.nav_members') },
        { label: t('admin.nav_books') },
        { label: t('account.position'), align: 'center' },
        { label: t('admin.reserved_at') },
        { label: t('common.status') },
        { label: t('common.actions'), align: 'right' },
      ],
      items.map((reservation) => ({
        cells: [
          `<strong>${esc(reservation.user_name)}</strong><br /><span class="muted small">${esc(reservation.user_email)}</span>`,
          `<a href="#/book/${attr(reservation.book_slug)}">${esc(reservation.book_title)}</a><br /><span class="muted small">${esc(t('admin.copies_label', { available: reservation.available_copies, total: reservation.total_copies }))}</span>`,
          reservation.status === 'waiting' ? `#${reservation.queue_position}` : '—',
          esc(formatDateTime(reservation.created_at)),
          `${statusChip(reservation.status)}${reservation.status === 'ready' ? `<br /><span class="muted small">${esc(t('account.ready_until', { time: formatDateTime(reservation.expires_at) }))}</span>` : ''}`,
          `<div class="row-actions">
            ${
              reservation.status === 'ready'
                ? `<button class="icon-btn icon-btn--primary" data-fulfill="${reservation.id}" title="${attr(t('book.borrow'))}">${icon('book', 16)}</button>`
                : ''
            }
            ${
              ['waiting', 'ready'].includes(reservation.status)
                ? `<button class="icon-btn icon-btn--danger" data-cancel-res="${reservation.id}" data-member="${attr(reservation.user_name)}" data-title="${attr(reservation.book_title)}" title="${attr(t('common.cancel'))}">${icon('x', 16)}</button>`
                : ''
            }
          </div>`,
        ],
      })),
      { emptyMessage: t('admin.no_results') }
    )}`;

  const mount = (root, context) => {
    root.querySelectorAll('[data-fulfill]').forEach((button) =>
      button.addEventListener('click', async () => {
        try {
          await apiPost(`/api/admin/reservations/${button.dataset.fulfill}/fulfill`, {});
          toast(t('admin.reservation_fulfilled'));
          context.render();
        } catch (error) {
          FAIL(error);
        }
      })
    );
    root.querySelectorAll('[data-cancel-res]').forEach((button) =>
      button.addEventListener('click', async () => {
        const sure = await confirmDialog({
          title: t('common.cancel'),
          message: t('admin.cancel_reservation_confirm', { member: button.dataset.member, title: button.dataset.title }),
          confirmLabel: t('common.cancel'),
        });
        if (!sure) return;
        try {
          await apiPost(`/api/admin/reservations/${button.dataset.cancelRes}/cancel`, {});
          toast(t('admin.reservation_cancelled'), 'info');
          context.render();
        } catch (error) {
          FAIL(error);
        }
      })
    );
    root.querySelector('[data-search-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      context.navigate(`admin/reservations${buildQuery({ status: status === 'active' ? '' : status, q: event.target.querySelector('input').value.trim() })}`);
    });
    const searchInput = root.querySelector('[data-search-form] input');
    searchInput?.addEventListener('input', debounce(() => {
      context.navigate(`admin/reservations${buildQuery({ status: status === 'active' ? '' : status, q: searchInput.value.trim() })}`);
    }, 500));
  };

  return { html, mount };
}

/* -------------------------------- fines -------------------------------- */

async function finesSection(ctx) {
  const status = ctx.query.status || 'unpaid';
  const data = await apiGet('/api/admin/fines', { status });
  const items = data.items;
  const hrefFor = (value) => `#/admin/fines${buildQuery({ status: value })}`;

  const html = `
    ${sectionHead('admin.fines_title', 'admin.fines_sub', {
      unpaid: formatMoney(data.unpaid_total),
      live: formatMoney(data.live_total),
    })}
    ${toolbar({
      filters: [
        filterChips(
          [
            ['unpaid', t('account.fine_status_unpaid')],
            ['live', t('admin.fine_live')],
            ['paid', t('account.fine_status_paid')],
            ['waived', t('account.fine_status_waived')],
            ['all', t('admin.filter_all')],
          ],
          status,
          hrefFor
        ),
      ],
    })}
    ${table(
      [
        { label: t('admin.nav_members') },
        { label: t('admin.nav_books') },
        { label: t('account.due_date') },
        { label: t('account.overdue_label'), align: 'center' },
        { label: t('account.fine_amount'), align: 'right' },
        { label: t('common.status') },
        { label: t('common.actions'), align: 'right' },
      ],
      items.map((fine) => ({
        cells: [
          `<strong>${esc(fine.user_name)}</strong><br /><span class="muted small">${esc(fine.user_email)}</span>`,
          `<a href="#/book/${attr(fine.book_slug)}">${esc(fine.book_title)}</a>`,
          esc(formatDate(fine.due_at)),
          fine.overdue_days ? formatNumber(fine.overdue_days) : '—',
          `<strong>${esc(formatMoney(fine.amount))}</strong>`,
          fine.is_live ? chip(t('admin.fine_live'), 'warn') : chip(t(`account.fine_status_${fine.fine_status}`), fine.fine_status === 'unpaid' ? 'danger' : 'muted'),
          `<div class="row-actions">
            ${
              fine.fine_status === 'unpaid'
                ? `<button class="btn btn--ghost btn--xs" data-pay-fine="${fine.id}">${esc(t('admin.settle'))}</button>
                   <button class="btn btn--ghost btn--xs" data-waive-fine="${fine.id}">${esc(t('admin.waive'))}</button>`
                : ''
            }
          </div>`,
        ],
      })),
      { emptyMessage: t('admin.no_results') }
    )}`;

  const mount = (root, context) => {
    root.querySelectorAll('[data-pay-fine]').forEach((button) =>
      button.addEventListener('click', async () => {
        try {
          await apiPost(`/api/admin/fines/${button.dataset.payFine}/pay`, {});
          toast(t('admin.fine_paid'));
          context.render();
        } catch (error) {
          FAIL(error);
        }
      })
    );
    root.querySelectorAll('[data-waive-fine]').forEach((button) =>
      button.addEventListener('click', async () => {
        const sure = await confirmDialog({
          title: t('admin.waive'),
          message: t('admin.fine_waived'),
          confirmLabel: t('admin.waive'),
          danger: false,
        });
        if (!sure) return;
        try {
          await apiPost(`/api/admin/fines/${button.dataset.waiveFine}/waive`, {});
          toast(t('admin.fine_waived'));
          context.render();
        } catch (error) {
          FAIL(error);
        }
      })
    );
  };

  return { html, mount };
}

/* -------------------------------- page -------------------------------- */

const SECTIONS = {
  overview: overviewSection,
  books: booksSection,
  categories: categoriesSection,
  members: membersSection,
  loans: loansSection,
  reservations: reservationsSection,
  fines: finesSection,
};

export const adminPage = {
  requiresAdmin: true,
  title: () => t('admin.title'),

  async view(ctx) {
    const section = SECTIONS[ctx.params[0]] ? ctx.params[0] : 'overview';
    const rendered = await SECTIONS[section](ctx);

    const html = `<div class="admin">
      <aside class="admin__side">
        <div class="admin__brand">
          <span class="brand__mark">${icon('book', 18)}</span>
          <div><strong>${esc(t('admin.title'))}</strong><span>${esc(t('brand'))}</span></div>
        </div>
        <nav class="admin__nav">
          ${NAV.map(
            ([key, labelKey, iconName]) => `<a class="admin__nav-item ${section === key ? 'is-active' : ''}" href="#/admin${key === 'overview' ? '' : `/${key}`}">
              ${icon(iconName, 17)}<span>${esc(t(labelKey))}</span>
            </a>`
          ).join('')}
        </nav>
        <div class="admin__side-foot">
          <a class="btn btn--ghost btn--block btn--sm" href="#/">${icon('arrow', 15, 'icon--flip')}${esc(t('admin.back_to_site'))}</a>
        </div>
      </aside>
      <div class="admin__main">${rendered.html}</div>
    </div>`;

    return { html, mount: rendered.mount, title: `${t('admin.title')} · ${t(`admin.nav_${section}`)}` };
  },
};
