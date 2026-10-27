import { t, formatNumber, categoryName } from '../i18n.js';
import { apiGet, buildQuery } from '../api.js';
import { bookCard, icon, esc, attr, emptyState, pagination, debounce } from '../ui.js';

const SORTS = ['featured', 'popular', 'newest', 'rating', 'title', 'author'];

export const catalogPage = {
  title: () => t('catalog.title'),

  async view(ctx) {
    const query = {
      q: ctx.query.q || '',
      category: ctx.query.category || '',
      language: ctx.query.language || '',
      availability: ctx.query.availability || '',
      sort: SORTS.includes(ctx.query.sort) ? ctx.query.sort : 'featured',
      featured: ctx.query.featured || '',
      page: Math.max(1, Number(ctx.query.page) || 1),
      limit: 12,
    };

    const data = await apiGet('/api/books', query);
    const categories = ctx.categories;
    const href = (patch) => `#/catalog${buildQuery({ ...query, page: 1, ...patch })}`;
    const activeCategory = categories.find((c) => c.slug === query.category);

    const html = `
      <div class="container section">
        <nav class="breadcrumb">
          <a href="#/">${esc(t('nav.home'))}</a>${icon('arrow', 14)}
          <span>${esc(activeCategory ? categoryName(activeCategory) : t('catalog.title'))}</span>
        </nav>

        <header class="page-head">
          <div>
            <h1>${esc(activeCategory ? categoryName(activeCategory) : t('catalog.title'))}</h1>
            <p>${esc(t('catalog.subtitle', { count: formatNumber(data.total) }))}${
              query.q ? ` · “${esc(query.q)}”` : ''
            }</p>
          </div>
          <div class="page-head__meta">
            <span class="chip chip--neutral">${esc(t('catalog.showing', { shown: data.items.length, total: formatNumber(data.total) }))}</span>
          </div>
        </header>

        <div class="catalog">
          <aside class="filters" id="filters">
            <div class="filters__head">
              <h2>${icon('filter', 17)}${esc(t('catalog.filters'))}</h2>
              <button class="icon-btn filters__toggle" data-filters-toggle aria-label="${attr(t('catalog.filters'))}">${icon('menu', 18)}</button>
            </div>
            <form class="filters__search" data-catalog-search>
              <div class="field field--icon">
                ${icon('search', 16)}
                <input type="search" name="q" value="${attr(query.q)}" placeholder="${attr(t('nav.search_placeholder'))}" />
              </div>
              <button class="btn btn--primary btn--block btn--sm" type="submit">${esc(t('common.search'))}</button>
            </form>

            <div class="filters__group">
              <h3>${esc(t('home.categories'))}</h3>
              <div class="filters__list">
                <a class="filters__item ${!query.category ? 'is-active' : ''}" href="${attr(href({ category: '' }))}">
                  ${esc(t('common.all'))}
                </a>
                ${categories
                  .map(
                    (c) => `<a class="filters__item ${query.category === c.slug ? 'is-active' : ''}" href="${attr(href({ category: c.slug }))}">
                      ${esc(categoryName(c))}<span>${formatNumber(c.book_count)}</span>
                    </a>`
                  )
                  .join('')}
              </div>
            </div>

            <div class="filters__group">
              <h3>${esc(t('catalog.availability'))}</h3>
              <div class="filters__list">
                <a class="filters__item ${!query.availability ? 'is-active' : ''}" href="${attr(href({ availability: '' }))}">${esc(t('common.all'))}</a>
                <a class="filters__item ${query.availability === 'available' ? 'is-active' : ''}" href="${attr(href({ availability: 'available' }))}">${esc(t('catalog.only_available'))}</a>
                <a class="filters__item ${query.availability === 'unavailable' ? 'is-active' : ''}" href="${attr(href({ availability: 'unavailable' }))}">${esc(t('catalog.only_unavailable'))}</a>
              </div>
            </div>

            <div class="filters__group">
              <h3>${esc(t('common.language'))}</h3>
              <div class="filters__list">
                <a class="filters__item ${!query.language || query.language === 'all' ? 'is-active' : ''}" href="${attr(href({ language: '' }))}">${esc(t('common.all'))}</a>
                <a class="filters__item ${query.language === 'vi' ? 'is-active' : ''}" href="${attr(href({ language: 'vi' }))}">${esc(t('common.vi'))}</a>
                <a class="filters__item ${query.language === 'en' ? 'is-active' : ''}" href="${attr(href({ language: 'en' }))}">${esc(t('common.en'))}</a>
              </div>
            </div>

            <a class="btn btn--ghost btn--block btn--sm" href="#/catalog">${icon('refresh', 15)}${esc(t('catalog.reset'))}</a>
          </aside>

          <section class="catalog__main">
            <div class="catalog__toolbar">
              <label class="select">
                <span>${esc(t('catalog.sort'))}</span>
                <select data-sort>
                  <option value="featured" ${query.sort === 'featured' ? 'selected' : ''}>${esc(t('catalog.sort_featured'))}</option>
                  <option value="popular" ${query.sort === 'popular' ? 'selected' : ''}>${esc(t('catalog.sort_popular'))}</option>
                  <option value="newest" ${query.sort === 'newest' ? 'selected' : ''}>${esc(t('catalog.sort_newest'))}</option>
                  <option value="rating" ${query.sort === 'rating' ? 'selected' : ''}>${esc(t('catalog.sort_rating'))}</option>
                  <option value="title" ${query.sort === 'title' ? 'selected' : ''}>${esc(t('catalog.sort_title'))}</option>
                  <option value="author" ${query.sort === 'author' ? 'selected' : ''}>${esc(t('catalog.sort_author'))}</option>
                </select>
              </label>
            </div>

            ${
              data.items.length
                ? `<div class="grid grid--books">${data.items.map(bookCard).join('')}</div>
                   ${pagination(data.page, data.pages, (page) => `#/catalog${buildQuery({ ...query, page })}`)}`
                : emptyState(t('catalog.empty'), t('common.empty_hint'),
                    `<a class="btn btn--primary" href="#/catalog">${esc(t('catalog.reset'))}</a>`)
            }
          </section>
        </div>
      </div>
    `;

    const mount = (root, context) => {
      root.querySelector('[data-catalog-search]').addEventListener('submit', (event) => {
        event.preventDefault();
        const value = event.target.querySelector('input').value.trim();
        context.navigate(`catalog${buildQuery({ ...query, q: value, page: 1 })}`);
      });
      root.querySelector('[data-sort]').addEventListener('change', (event) => {
        context.navigate(`catalog${buildQuery({ ...query, sort: event.target.value, page: 1 })}`);
      });
      root.querySelector('[data-filters-toggle]').addEventListener('click', () => {
        root.querySelector('#filters').classList.toggle('is-open');
      });
      const searchInput = root.querySelector('[data-catalog-search] input');
      searchInput.addEventListener('input', debounce(() => {
        if (searchInput.value.trim().length >= 3 || searchInput.value.trim().length === 0) {
          context.navigate(`catalog${buildQuery({ ...query, q: searchInput.value.trim(), page: 1 })}`);
        }
      }, 700));
    };

    return { html, mount, title: t('catalog.title') };
  },
};
