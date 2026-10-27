import { t, formatMoney, formatDate, formatDateTime, getLang, localizedField, hasLocalized, errorMessage, categoryName } from '../i18n.js';
import { apiGet, apiPost, apiDelete, ApiError } from '../api.js';
import { bookCard, coverHtml, icon, esc, attr, chip, starsHtml, toast, emptyState, confirmDialog, availabilityChip, formatNumber } from '../ui.js';

export const bookPage = {
  title: () => t('book.tab_about'),

  async view(ctx) {
    const slug = ctx.params[0];
    if (!slug) {
      return { html: `<div class="container section">${emptyState(t('err.BOOK_NOT_FOUND'), null)}</div>` };
    }

    const data = await apiGet(`/api/books/${encodeURIComponent(slug)}`);
    const { book, reviews, related, viewer, settings } = data;

    const myReview = ctx.user ? reviews.find((r) => r.user_id === ctx.user.id) : null;
    const description = localizedField(book, 'description');
    const otherLang = !hasLocalized(book, 'description') && description;

    const actionArea = () => {
      if (viewer.loan) {
        return `<div class="book__state book__state--info">
            ${icon('check', 18)}
            <div>
              <strong>${esc(t('book.borrowed'))}</strong>
              <span>${esc(t('account.due_date'))}: ${esc(formatDate(viewer.loan.due_at))}</span>
            </div>
            <a class="btn btn--ghost btn--sm" href="#/account/loans">${esc(t('account.tab_loans'))}</a>
          </div>`;
      }
      if (viewer.reservation && viewer.reservation.status === 'ready') {
        return `<div class="book__state book__state--success">
            ${icon('bookmark', 18)}
            <div>
              <strong>${esc(t('book.hold_ready'))}</strong>
              <span>${esc(t('book.hold_expires', { time: formatDateTime(viewer.reservation.expires_at) }))}</span>
            </div>
            <button class="btn btn--primary btn--sm" data-borrow>${esc(t('book.borrow'))}</button>
          </div>`;
      }
      if (viewer.reservation) {
        return `<div class="book__state book__state--warn">
            ${icon('clock', 18)}
            <div>
              <strong>${esc(t('book.reserved'))}</strong>
              <span>${esc(t('status.waiting'))}</span>
            </div>
            <button class="btn btn--ghost btn--sm" data-cancel-reservation>${esc(t('book.cancel_reserve'))}</button>
          </div>`;
      }
      if (book.available_copies > 0) {
        return `<button class="btn btn--primary btn--lg" data-borrow>${icon('book', 18)}${esc(t('book.borrow'))}</button>`;
      }
      return `<button class="btn btn--primary btn--lg" data-reserve>${icon('bookmark', 18)}${esc(t('book.reserve'))}</button>`;
    };

    const html = `
      <div class="container section">
        <nav class="breadcrumb">
          <a href="#/">${esc(t('nav.home'))}</a>${icon('arrow', 14)}
          <a href="#/catalog">${esc(t('nav.catalog'))}</a>${icon('arrow', 14)}
          ${
            book.category_slug
              ? `<a href="#/catalog?category=${attr(book.category_slug)}">${esc(categoryName(book))}</a>${icon('arrow', 14)}`
              : ''
          }
          <span>${esc(book.title)}</span>
        </nav>

        <article class="book">
          <div class="book__cover">
            ${coverHtml(book, { size: 'xl' })}
            <div class="book__cover-actions">
              <button class="btn btn--ghost btn--block ${viewer.is_favorite ? 'is-active' : ''}" data-favorite>
                ${icon('heart', 16)}<span>${esc(t(viewer.is_favorite ? 'book.favorite_remove' : 'book.favorite_add'))}</span>
              </button>
            </div>
          </div>

          <div class="book__main">
            <div class="book__head">
              ${book.category_slug ? `<a class="chip chip--link" href="#/catalog?category=${attr(book.category_slug)}">${esc(categoryName(book))}</a>` : ''}
              ${book.featured ? chip(t('home.featured'), 'accent') : ''}
              <h1>${esc(book.title)}</h1>
              <p class="book__author">${esc(t('book.by'))} <strong>${esc(book.author)}</strong></p>
              <div class="book__rating">${starsHtml(book.rating_avg, book.rating_count)}</div>
            </div>

            <div class="book__status">
              <div class="book__status-row">
                <span class="label">${esc(t('book.availability'))}</span>
                ${availabilityChip(book)}
                ${book.available_copies > 0 && book.queue_length ? chip(t('book.queue', { count: book.queue_length }), 'warn') : ''}
              </div>
              <div class="book__status-actions">${actionArea()}</div>
              <ul class="rules">
                <li>${icon('clock', 15)}${esc(t('book.rules_period', { days: settings.LOAN_DAYS }))}</li>
                <li>${icon('book', 15)}${esc(t('book.rules_limit', { max: settings.MAX_ACTIVE_LOANS }))}</li>
                <li>${icon('coins', 15)}${esc(t('book.rules_fine', { fine: formatMoney(settings.FINE_PER_DAY) }))}</li>
                <li>${icon('bookmark', 15)}${esc(t('book.rules_hold', { hours: settings.HOLD_HOURS }))}</li>
              </ul>
            </div>

            <div class="tabs" data-tabs>
              <div class="tabs__nav" role="tablist">
                <button class="tabs__btn is-active" data-tab="about" role="tab">${esc(t('book.tab_about'))}</button>
                <button class="tabs__btn" data-tab="reviews" role="tab">${esc(t('book.tab_reviews', { count: reviews.length }))}</button>
                <button class="tabs__btn" data-tab="details" role="tab">${esc(t('book.tab_details'))}</button>
              </div>

              <div class="tabs__panel is-active" data-panel="about">
                ${description
                  ? `<p class="book__desc">${esc(description)}</p>
                     ${
                       otherLang
                         ? `<p class="muted small">${esc(
                             t('book.description_other_lang', {
                               lang: getLang() === 'vi' ? t('common.en') : t('common.vi'),
                             })
                           )}</p>`
                         : ''
                     }`
                  : `<p class="muted">${esc(t('book.description_missing'))}</p>`}
              </div>

              <div class="tabs__panel" data-panel="reviews">
                <div class="reviews">
                  <div class="reviews__summary">
                    <div class="reviews__score">
                      <strong>${book.rating_avg ? Number(book.rating_avg).toFixed(1) : '—'}</strong>
                      ${starsHtml(book.rating_avg, undefined, { hideLabel: true })}
                      <span>${esc(t('book.rating_count', { count: book.rating_count }))}</span>
                    </div>
                    ${
                      ctx.user
                        ? `<form class="review-form" data-review-form>
                            <h3>${esc(t(myReview ? 'book.review_edit' : 'book.review_write'))}</h3>
                            <div class="rating-input" data-rating-input data-value="${myReview ? myReview.rating : 5}">
                              ${[1, 2, 3, 4, 5]
                                .map(
                                  (value) => `<button type="button" class="star-btn ${value <= (myReview ? myReview.rating : 5) ? 'is-on' : ''}" data-value="${value}" aria-label="${value}">${icon('star', 22)}</button>`
                                )
                                .join('')}
                            </div>
                            <textarea name="comment" rows="3" placeholder="${attr(t('book.review_placeholder'))}">${esc(myReview?.comment || '')}</textarea>
                            <div class="review-form__actions">
                              <button class="btn btn--primary btn--sm" type="submit">${esc(t('book.review_submit'))}</button>
                              ${
                                myReview
                                  ? `<button class="btn btn--ghost btn--sm" type="button" data-delete-review="${myReview.id}">${esc(t('book.review_delete'))}</button>`
                                  : ''
                              }
                            </div>
                          </form>`
                        : `<div class="review-login">
                            <p>${esc(t('book.login_to_review'))}</p>
                            <a class="btn btn--primary btn--sm" href="#/login?next=${encodeURIComponent(`#/book/${book.slug}`)}">${esc(t('nav.login'))}</a>
                          </div>`
                    }
                  </div>
                  <ul class="reviews__list">
                    ${
                      reviews.length
                        ? reviews
                            .map(
                              (review) => `<li class="review">
                                <div class="review__head">
                                  <span class="avatar avatar--sm">${esc(review.user_name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase())}</span>
                                  <div>
                                    <strong>${esc(review.user_name)}</strong>
                                    <span>${esc(formatDate(review.created_at))}</span>
                                  </div>
                                  ${starsHtml(review.rating, undefined, { hideLabel: true, size: 14 })}
                                </div>
                                ${review.comment ? `<p>${esc(review.comment)}</p>` : ''}
                              </li>`
                            )
                            .join('')
                        : `<li>${emptyState(t('book.reviews_empty'), null)}</li>`
                    }
                  </ul>
                </div>
              </div>

              <div class="tabs__panel" data-panel="details">
                <dl class="meta-list">
                  <div><dt>${esc(t('book.publisher'))}</dt><dd>${esc(book.publisher || '—')}</dd></div>
                  <div><dt>${esc(t('book.year'))}</dt><dd>${book.year ? formatNumber(book.year) : '—'}</dd></div>
                  <div><dt>${esc(t('book.pages'))}</dt><dd>${book.pages ? formatNumber(book.pages) : '—'}</dd></div>
                  <div><dt>${esc(t('book.isbn'))}</dt><dd>${esc(book.isbn || '—')}</dd></div>
                  <div><dt>${esc(t('book.language'))}</dt><dd>${esc(book.language === 'vi' ? t('common.vi') : t('common.en'))}</dd></div>
                  <div><dt>${esc(t('book.shelf'))}</dt><dd>${esc(book.shelf || '—')}</dd></div>
                  <div><dt>${esc(t('book.total_copies'))}</dt><dd>${formatNumber(book.total_copies)}</dd></div>
                  <div><dt>${esc(t('book.loans_total'))}</dt><dd>${formatNumber(book.loan_count)}</dd></div>
                </dl>
              </div>
            </div>
          </div>
        </article>

        ${
          related.length
            ? `<section class="section">
                <header class="section__head"><div><h2>${esc(t('book.related'))}</h2></div></header>
                <div class="grid grid--books">${related.map(bookCard).join('')}</div>
              </section>`
            : ''
        }
      </div>
    `;

    const mount = (root, context) => {
      const reload = () => context.render();

      root.querySelectorAll('[data-tab]').forEach((button) => {
        button.addEventListener('click', () => {
          root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-active', b === button));
          root.querySelectorAll('[data-panel]').forEach((panel) => {
            panel.classList.toggle('is-active', panel.dataset.panel === button.dataset.tab);
          });
        });
      });

      const borrow = async () => {
        try {
          await apiPost('/api/account/loans', { bookId: book.id });
          toast(t('book.borrowed_toast'));
          reload();
        } catch (error) {
          toast(error instanceof ApiError ? errorMessage(error.code, error.meta) : t('err.generic'), 'error');
        }
      };
      root.querySelector('[data-borrow]')?.addEventListener('click', (event) => {
        if (!context.user) {
          context.navigate(`login?next=${encodeURIComponent(`#/book/${book.slug}`)}`);
          return;
        }
        event.currentTarget.disabled = true;
        borrow();
      });

      root.querySelector('[data-reserve]')?.addEventListener('click', async () => {
        if (!context.user) {
          context.navigate(`login?next=${encodeURIComponent(`#/book/${book.slug}`)}`);
          return;
        }
        try {
          await apiPost('/api/account/reservations', { bookId: book.id });
          toast(t('book.reserved_toast'));
          reload();
        } catch (error) {
          toast(error instanceof ApiError ? errorMessage(error.code, error.meta) : t('err.generic'), 'error');
        }
      });

      root.querySelector('[data-cancel-reservation]')?.addEventListener('click', async () => {
        try {
          const sure = await confirmDialog({
            title: t('book.cancel_reserve'),
            message: t('book.reserved'),
            confirmLabel: t('common.confirm'),
          });
          if (!sure) return;
          await apiDelete(`/api/account/reservations/${viewer.reservation.id}`);
          toast(t('admin.reservation_cancelled'), 'info');
          reload();
        } catch (error) {
          toast(error instanceof ApiError ? errorMessage(error.code, error.meta) : t('err.generic'), 'error');
        }
      });

      root.querySelector('[data-favorite]')?.addEventListener('click', async (event) => {
        if (!context.user) {
          context.navigate(`login?next=${encodeURIComponent(`#/book/${book.slug}`)}`);
          return;
        }
        const button = event.currentTarget;
        try {
          if (viewer.is_favorite) {
            await apiDelete(`/api/favorites/${book.id}`);
            toast(t('book.favorite_removed'), 'info');
          } else {
            await apiPost(`/api/favorites/${book.id}`, {});
            toast(t('book.favorite_added'));
          }
          reload();
        } catch (error) {
          toast(error instanceof ApiError ? errorMessage(error.code, error.meta) : t('err.generic'), 'error');
        } finally {
          button.disabled = false;
        }
      });

      const ratingInput = root.querySelector('[data-rating-input]');
      if (ratingInput) {
        ratingInput.querySelectorAll('.star-btn').forEach((button) => {
          button.addEventListener('click', () => {
            const value = Number(button.dataset.value);
            ratingInput.dataset.value = String(value);
            ratingInput.querySelectorAll('.star-btn').forEach((b) => {
              b.classList.toggle('is-on', Number(b.dataset.value) <= value);
            });
          });
        });
      }

      root.querySelector('[data-review-form]')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
          await apiPost(`/api/books/${book.id}/reviews`, {
            rating: Number(ratingInput.dataset.value),
            comment: form.querySelector('textarea').value,
          });
          toast(t('book.review_saved'));
          reload();
        } catch (error) {
          toast(error instanceof ApiError ? errorMessage(error.code, error.meta) : t('err.generic'), 'error');
        }
      });

      root.querySelector('[data-delete-review]')?.addEventListener('click', async (event) => {
        try {
          const sure = await confirmDialog({
            title: t('book.review_delete'),
            message: t('book.review_delete'),
            confirmLabel: t('common.delete'),
          });
          if (!sure) return;
          await apiDelete(`/api/reviews/${event.currentTarget.dataset.deleteReview}`);
          toast(t('book.review_deleted'), 'info');
          reload();
        } catch (error) {
          toast(error instanceof ApiError ? errorMessage(error.code, error.meta) : t('err.generic'), 'error');
        }
      });
    };

    return { html, mount, title: book.title };
  },
};
