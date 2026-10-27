import { t, formatMoney, formatNumber } from '../i18n.js';
import { apiGet } from '../api.js';
import { bookCard, bookRow, coverHtml, icon, esc, categoryName, availabilityChip, ratingBadge } from '../ui.js';

const CATEGORY_ICONS = {
  'van-hoc': 'book',
  'kinh-te': 'coins',
  'khoa-hoc': 'sparkle',
  'lich-su': 'level',
  'ky-nang': 'star',
  'thieu-nhi': 'heart',
  'cong-nghe': 'settings',
  'triet-hoc': 'quote',
};

export const homePage = {
  title: () => t('nav.home'),

  async view(ctx) {
    const [featured, newest, popular, categoryData, statData] = await Promise.all([
      apiGet('/api/books', { featured: 'true', limit: 4, sort: 'popular' }),
      apiGet('/api/books', { sort: 'newest', limit: 4 }),
      apiGet('/api/books', { sort: 'popular', limit: 5 }),
      ctx.categories.length ? Promise.resolve({ items: ctx.categories }) : apiGet('/api/categories'),
      ctx.stats ? Promise.resolve({ stats: ctx.stats }) : apiGet('/api/stats'),
    ]);

    const featuredItems = (featured.items.length ? featured.items : popular.items).slice(0, 4);
    const categories = categoryData.items || [];
    const stats = statData.stats || {};
    const settings = ctx.settings;

    const stack = (popular.items.length ? popular.items : featuredItems).slice(0, 3);

    const html = `
      <section class="hero">
        <div class="hero__grain"></div>
        <div class="container hero__inner">
          <div class="hero__copy">
            <span class="eyebrow">${icon('sparkle', 15)}${esc(t('hero.eyebrow'))}</span>
            <h1 class="hero__title">${t('hero.title').split('\n').map((line) => esc(line)).join('<br />')}</h1>
            <p class="hero__subtitle">${esc(t('hero.subtitle'))}</p>
            <form class="hero__search" data-hero-search>
              <label class="hero__search-label" for="hero-q">${esc(t('hero.search_label'))}</label>
              <div class="hero__search-row">
                ${icon('search', 18)}
                <input id="hero-q" name="q" type="search" placeholder="${esc(t('nav.search_placeholder'))}" />
                <button class="btn btn--primary" type="submit">${esc(t('common.search'))}</button>
              </div>
            </form>
            <div class="hero__chips">
              ${categories
                .slice(0, 5)
                .map((c) => `<a class="chip chip--link" href="#/catalog?category=${esc(c.slug)}">${esc(categoryName(c))}</a>`)
                .join('')}
            </div>
            <dl class="hero__stats">
              <div><dt>${esc(t('hero.stat_books'))}</dt><dd>${formatNumber(stats.books)}</dd></div>
              <div><dt>${esc(t('hero.stat_copies'))}</dt><dd>${formatNumber(stats.copies)}</dd></div>
              <div><dt>${esc(t('hero.stat_members'))}</dt><dd>${formatNumber(stats.members)}</dd></div>
              <div><dt>${esc(t('hero.stat_loans'))}</dt><dd>${formatNumber(stats.active_loans)}</dd></div>
            </dl>
          </div>
          <div class="hero__art">
            <div class="bookstack">
              ${stack
                .map(
                  (book, index) => `<div class="bookstack__item bookstack__item--${index}">
                    ${coverHtml(book, { size: 'lg' })}
                  </div>`
                )
                .join('')}
            </div>
            <div class="hero__art-card">
              ${icon('clock', 16)}
              <div>
                <strong>${esc(t('book.rules_period', { days: settings.LOAN_DAYS }))}</strong>
                <span>${esc(t('book.rules_fine', { fine: formatMoney(settings.FINE_PER_DAY) }))}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="container section">
        <header class="section__head">
          <div>
            <h2>${esc(t('home.featured'))}</h2>
            <p>${esc(t('home.featured_sub'))}</p>
          </div>
          <a class="link-arrow" href="#/catalog?sort=popular">${esc(t('nav.catalog'))}${icon('arrow', 16)}</a>
        </header>
        <div class="grid grid--books">${featuredItems.map(bookCard).join('')}</div>
      </section>

      <section class="container section">
        <header class="section__head">
          <div>
            <h2>${esc(t('home.categories'))}</h2>
            <p>${esc(t('home.categories_sub'))}</p>
          </div>
        </header>
        <div class="grid grid--cats">
          ${categories
            .map(
              (c) => `<a class="cat-card" href="#/catalog?category=${esc(c.slug)}">
                <span class="cat-card__icon">${icon(CATEGORY_ICONS[c.slug] || 'book', 22)}</span>
                <span class="cat-card__name">${esc(categoryName(c))}</span>
                <span class="cat-card__count">${esc(t('admin.category_books'))}: ${formatNumber(c.book_count)}</span>
                <span class="cat-card__arrow">${icon('arrow', 16)}</span>
              </a>`
            )
            .join('')}
        </div>
      </section>

      <section class="section section--paper">
        <div class="container">
          <header class="section__head">
            <div>
              <h2>${esc(t('home.how'))}</h2>
              <p>${esc(t('home.how_sub'))}</p>
            </div>
          </header>
          <ol class="steps">
            ${[
              ['step1_title', 'step1_text'],
              ['step2_title', 'step2_text'],
              ['step3_title', 'step3_text'],
              ['step4_title', 'step4_text'],
            ]
              .map(
                ([titleKey, textKey], index) => `<li class="steps__item">
                  <span class="steps__num">${String(index + 1).padStart(2, '0')}</span>
                  <h3>${esc(t(`home.${titleKey}`))}</h3>
                  <p>${esc(
                    t(`home.${textKey}`, {
                      days: settings.LOAN_DAYS,
                      renew: settings.RENEW_DAYS,
                      max: settings.MAX_RENEWALS,
                      fine: formatMoney(settings.FINE_PER_DAY),
                    })
                  )}</p>
                </li>`
              )
              .join('')}
          </ol>
        </div>
      </section>

      <section class="container section">
        <div class="split">
          <div class="split__col">
            <header class="section__head section__head--tight">
              <div>
                <h2>${esc(t('home.new_arrivals'))}</h2>
                <p>${esc(t('home.new_arrivals_sub'))}</p>
              </div>
            </header>
            <div class="rows">${newest.items.map(bookRow).join('')}</div>
          </div>
          <div class="split__col">
            <header class="section__head section__head--tight">
              <div>
                <h2>${esc(t('home.popular'))}</h2>
                <p>${esc(t('admin.chart_loans'))} · ${esc(t('catalog.sort_popular'))}</p>
              </div>
            </header>
            <ol class="rank">
              ${popular.items
                .map(
                  (book, index) => `<li class="rank__item">
                    <span class="rank__num">${index + 1}</span>
                    <a class="rank__link" href="#/book/${esc(book.slug)}">
                      ${coverHtml(book, { size: 'xxs' })}
                      <span class="rank__body">
                        <strong>${esc(book.title)}</strong>
                        <span>${esc(book.author)}</span>
                      </span>
                    </a>
                    <span class="rank__meta">${ratingBadge(book.rating_avg, book.rating_count) ||
                      availabilityChip(book)}</span>
                  </li>`
                )
                .join('')}
            </ol>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <blockquote class="quote">
            ${icon('quote', 30)}
            <p>${esc(t('home.quote'))}</p>
            <cite>${esc(t('home.quote_author'))}</cite>
          </blockquote>
        </div>
      </section>

      <section class="container section">
        <div class="cta">
          <div class="cta__copy">
            <h2>${esc(t('home.cta_title'))}</h2>
            <p>${esc(t('home.cta_text'))}</p>
            <div class="cta__actions">
              <a class="btn btn--primary btn--lg" href="#/register">${esc(t('nav.register'))}</a>
              <a class="btn btn--ghost btn--lg" href="#/catalog">${esc(t('hero.cta'))}</a>
            </div>
          </div>
          <div class="cta__demo">
            <h3>${esc(t('auth.demo'))}</h3>
            <div class="demo-account">
              <span class="demo-account__role">${esc(t('auth.demo_admin'))}</span>
              <code>admin@thuvien.vn</code>
              <code>admin123</code>
            </div>
            <div class="demo-account">
              <span class="demo-account__role">${esc(t('auth.demo_member'))}</span>
              <code>minhanh@example.com</code>
              <code>member123</code>
            </div>
          </div>
        </div>
      </section>
    `;

    const mount = (root, context) => {
      root.querySelector('[data-hero-search]')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = event.target.querySelector('input').value.trim();
        context.navigate(`catalog${value ? `?q=${encodeURIComponent(value)}` : ''}`);
      });
    };

    return { html, mount, title: t('nav.home') };
  },
};
