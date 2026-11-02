// A single native dialog presents the complete collection without a detail/list detour.
export function mountAnnouncements({
  document,
  window,
  container,
  dialog,
  title,
  back,
  close,
  overview,
  access,
  count,
  ribbonTitle,
  ribbonImage,
  ribbonCount,
  ribbonExcerpt,
  records,
  labels,
  beforeOpen = () => {},
  feedback = () => {}
}) {
  let active = false,
    returnFocus = null;
  const state = () => window.history.state || {};
  const safeHref = value => {
    try {
      const url = new URL(value, document.location.origin);
      return ['https:', 'http:'].includes(url.protocol) ? value : null;
    } catch {
      return null;
    }
  };
  const render = () => {
    if (!dialog.open) dialog.showModal();
    title.focus({ preventScroll: true });
  };
  const show = () => {
    if (!records.length) return;
    if (active) {
      render();
      return;
    }
    returnFocus = document.activeElement;
    beforeOpen();
    active = true;
    window.history.pushState(
      {
        ...state(),
        announcement: { collection: true, entry: document.activeElement === overview ? 'overview' : 'access' }
      },
      '',
      window.location.href
    );
    dialog.scrollTop = 0;
    render();
  };
  const dismiss = () => {
    if (active) window.history.back();
  };
  const handlePopstate = () => {
    const next = state().announcement,
      owned = active || !!next;
    if (next) {
      if (!active) {
        returnFocus =
          (next.entry || (window.location.hash ? 'access' : 'overview')) === 'overview' ? overview : access;
        beforeOpen();
      }
      active = true;
      render();
    } else if (active) {
      active = false;
      dialog.close();
      returnFocus?.focus({ preventScroll: true });
    }
    return owned;
  };
  title.textContent = labels.banners;
  back.hidden = true;
  records.forEach((record, index) => {
    const article = document.createElement('article');
    article.className = 'banner banner-complete';
    const heading = document.createElement('h3');
    heading.id = 'banner-heading-' + index;
    heading.textContent = record.title;
    article.setAttribute('aria-labelledby', heading.id);
    if (record.image) {
      const image = document.createElement('img');
      image.src = record.image;
      image.alt = '';
      image.loading = 'lazy';
      article.append(image);
    }
    const body = document.createElement('div');
    body.className = 'banner-body';
    const text = document.createElement('p');
    text.textContent = record.description;
    body.append(heading, text);
    const href = safeHref(record.href);
    if (href) {
      const link = document.createElement('a');
      link.href = href;
      link.className = 'text-button banner-link';
      link.textContent = record.button || labels.open;
      feedback(link);
      body.append(link);
    }
    article.append(body);
    container.append(article);
  });
  access.hidden = overview.hidden = !records.length;
  count.textContent = ribbonCount.textContent = String(records.length);
  access.setAttribute('aria-label', labels.banners + ' · ' + records.length);
  access.setAttribute('aria-haspopup', 'dialog');
  access.setAttribute('aria-controls', dialog.id);
  if (records.length) {
    const first = records[0];
    ribbonTitle.textContent = first.title;
    ribbonExcerpt.textContent = first.description;
    ribbonImage.hidden = !first.image;
    if (first.image) {
      ribbonImage.src = first.image;
      ribbonImage.addEventListener('error', () => (ribbonImage.hidden = true), { once: true });
    }
  }
  const cue = overview.querySelector('.announcement-read');
  if (cue?.firstChild) cue.firstChild.textContent = labels.allAnnouncements + ' ';
  overview.addEventListener('click', show);
  access.addEventListener('click', show);
  close.addEventListener('click', dismiss);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    dismiss();
  });
  return { show, handlePopstate };
}
