// The player address for a project video link (YouTube, Rutube, VK), or null when it cannot be embedded.
export function videoEmbed(url) {
  try {
    const u = new URL(url),
      host = u.hostname.replace(/^(www|m)\./, '');
    // fs=1 keeps the provider's own full screen button; playsinline stops iPhone from forcing its player.
    const tube = id =>
      /^[a-zA-Z0-9_-]{11}$/.test(id || '')
        ? 'https://www.youtube-nocookie.com/embed/' + id + '?fs=1&rel=0&playsinline=1&autoplay=1'
        : null;
    if (host === 'youtu.be') return tube(u.pathname.slice(1));
    if (host === 'youtube.com' && u.pathname === '/watch') return tube(u.searchParams.get('v'));
    if (host === 'rutube.ru') {
      const id = u.pathname.split('/').filter(Boolean)[1];
      if (/^[a-f0-9]{32}$/i.test(id)) return 'https://rutube.ru/play/embed/' + id;
    }
    if (host === 'vk.com' || host === 'vkvideo.ru') {
      const match = /video(-?\d+)_(\d+)/.exec(u.pathname + u.search);
      if (match)
        return 'https://vk.com/video_ext.php?oid=' + match[1] + '&id=' + match[2] + '&hd=2&autoplay=1';
    }
  } catch {}
  return null;
}
