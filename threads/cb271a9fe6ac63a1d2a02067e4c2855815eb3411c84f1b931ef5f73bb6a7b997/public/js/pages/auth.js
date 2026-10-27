import { t, errorMessage } from '../i18n.js';
import { apiPost, ApiError } from '../api.js';
import { icon, esc, attr, toast, formValues } from '../ui.js';
import { setUser, loadStats } from '../store.js';

function afterLogin(context, user, message) {
  setUser(user);
  loadStats().catch(() => {});
  toast(message);
  const next = context.query.next && context.query.next.startsWith('#/') ? context.query.next : '#/account';
  context.navigate(next.replace(/^#\//, ''));
}

function authAside() {
  return `<aside class="auth__aside">
    <span class="eyebrow">${icon('book', 15)}${esc(t('brand'))}</span>
    <h2>${esc(t('hero.cta'))}</h2>
    <p>${esc(t('hero.subtitle'))}</p>
    <blockquote>${icon('quote', 22)}<p>${esc(t('home.quote'))}</p><cite>${esc(t('home.quote_author'))}</cite></blockquote>
    <ul class="auth__perks">
      <li>${icon('check', 16)}${esc(t('home.step2_text'))}</li>
      <li>${icon('check', 16)}${esc(t('home.step3_text', { days: 14, renew: 7, max: 2 }))}</li>
      <li>${icon('check', 16)}${esc(t('home.step4_text', { fine: '5.000 ₫' }))}</li>
    </ul>
  </aside>`;
}

function demoBox(kind) {
  const accounts = [
    { role: t('auth.demo_admin'), email: 'admin@thuvien.vn', password: 'admin123' },
    { role: t('auth.demo_member'), email: 'minhanh@example.com', password: 'member123' },
  ];
  return `<div class="demo-box ${kind}">
    <h3>${icon('sparkle', 16)}${esc(t('auth.demo'))}</h3>
    ${accounts
      .map(
        (account) => `<div class="demo-box__row">
          <div>
            <strong>${esc(account.role)}</strong>
            <span>${esc(account.email)} · ${esc(account.password)}</span>
          </div>
          <button type="button" class="btn btn--ghost btn--xs" data-demo-fill="${attr(account.email)}" data-demo-pass="${attr(account.password)}">
            ${esc(t('auth.demo_fill'))}
          </button>
        </div>`
      )
      .join('')}
  </div>`;
}

function wireDemoButtons(root, form) {
  root.querySelectorAll('[data-demo-fill]').forEach((button) => {
    button.addEventListener('click', () => {
      form.email.value = button.dataset.demoFill;
      form.password.value = button.dataset.demoPass;
      form.email.focus();
    });
  });
}

export const loginPage = {
  title: () => t('auth.login_title'),
  async view(context) {
    const html = `<div class="container section">
      <div class="auth">
        ${authAside()}
        <div class="auth__card">
          <header>
            <h1>${esc(t('auth.login_title'))}</h1>
            <p>${esc(t('auth.login_sub'))}</p>
          </header>
          <form data-auth-form novalidate>
            <label class="field">
              <span>${esc(t('auth.email'))}</span>
              <input type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
            </label>
            <label class="field">
              <span>${esc(t('auth.password'))}</span>
              <input type="password" name="password" required autocomplete="current-password" placeholder="••••••" />
            </label>
            <button class="btn btn--primary btn--block btn--lg" type="submit">${esc(t('auth.login_button'))}</button>
          </form>
          ${demoBox('demo-box--inline')}
          <p class="auth__switch"><a href="#/register">${esc(t('auth.to_register'))}</a></p>
        </div>
      </div>
    </div>`;

    const mount = (root) => {
      const form = root.querySelector('[data-auth-form]');
      wireDemoButtons(root, form);
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          const values = formValues(form);
          const data = await apiPost('/api/auth/login', { email: values.email, password: values.password });
          afterLogin(context, data.user, t('auth.login_title'));
        } catch (error) {
          toast(error instanceof ApiError ? errorMessage(error.code, error.meta) : t('err.generic'), 'error');
        } finally {
          button.disabled = false;
        }
      });
    };

    return { html, mount, title: t('auth.login_title') };
  },
};

export const registerPage = {
  title: () => t('auth.register_title'),
  async view(context) {
    const html = `<div class="container section">
      <div class="auth">
        ${authAside()}
        <div class="auth__card">
          <header>
            <h1>${esc(t('auth.register_title'))}</h1>
            <p>${esc(t('auth.register_sub'))}</p>
          </header>
          <form data-auth-form novalidate>
            <label class="field">
              <span>${esc(t('auth.name'))}</span>
              <input type="text" name="name" required autocomplete="name" placeholder="Nguyễn Minh Anh" />
            </label>
            <label class="field">
              <span>${esc(t('auth.email'))}</span>
              <input type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
            </label>
            <label class="field">
              <span>${esc(t('auth.password'))}</span>
              <input type="password" name="password" required minlength="6" autocomplete="new-password" placeholder="••••••" />
              <small class="field__hint">${esc(t('auth.password_hint'))}</small>
            </label>
            <button class="btn btn--primary btn--block btn--lg" type="submit">${esc(t('auth.register_button'))}</button>
          </form>
          <p class="auth__switch"><a href="#/login">${esc(t('auth.to_login'))}</a></p>
        </div>
      </div>
    </div>`;

    const mount = (root) => {
      const form = root.querySelector('[data-auth-form]');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          const values = formValues(form);
          const data = await apiPost('/api/auth/register', {
            name: values.name,
            email: values.email,
            password: values.password,
          });
          afterLogin(context, data.user, t('auth.register_button'));
        } catch (error) {
          toast(error instanceof ApiError ? errorMessage(error.code, error.meta) : t('err.generic'), 'error');
        } finally {
          button.disabled = false;
        }
      });
    };

    return { html, mount, title: t('auth.register_title') };
  },
};
