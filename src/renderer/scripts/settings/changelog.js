/**
 * Changelog tab — fetches CHANGELOG.md from GitHub and renders as HTML
 */
const { ipcRenderer } = require('electron');

let loaded = false;
let loading = false;

/** Minimal Markdown → HTML converter (covers CHANGELOG.md patterns) */
function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw;

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('<hr>');
      continue;
    }

    // Headings
    if (/^### /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h4 class="clH3">${esc(line.slice(4))}</h4>`);
      continue;
    }
    if (/^## /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3 class="clH2">${esc(line.slice(3))}</h3>`);
      continue;
    }
    if (/^# /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2 class="clH1">${esc(line.slice(2))}</h2>`);
      continue;
    }

    // List items
    if (/^- /.test(line.trim())) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inlineFormat(line.trim().slice(2))}</li>`);
      continue;
    }

    // Empty line
    if (!line.trim()) {
      if (inList) { out.push('</ul>'); inList = false; }
      continue;
    }

    // Paragraph
    if (inList) { out.push('</ul>'); inList = false; }
    out.push(`<p>${inlineFormat(line)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function inlineFormat(s) {
  let r = esc(s);
  r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  r = r.replace(/`([^`]+)`/g, '<code>$1</code>');
  r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="clLink">$1</a>');
  return r;
}

export function init() {
  const tabBar = document.querySelector('.tab-bar');
  if (!tabBar) return;

  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn || btn.dataset.tab !== 'changelog') return;
    loadChangelog();
  });
}

async function loadChangelog() {
  if (loaded || loading) return;
  loading = true;

  const container = document.getElementById('changelog-content');
  if (!container) { loading = false; return; }

  container.innerHTML = '<p class="changelogLoading">Loading changelog from GitHub…</p>';

  try {
    const md = await ipcRenderer.invoke('get-changelog');
    if (md) {
      container.innerHTML = mdToHtml(md);
      loaded = true;
    } else {
      container.innerHTML = '<p class="changelogEmpty">Changelog not available. <a href="#" class="clRetry">Retry</a></p>';
    }
  } catch (e) {
    container.innerHTML = '<p class="changelogEmpty">Failed to load changelog. <a href="#" class="clRetry">Retry</a></p>';
  }
  loading = false;

  // Retry link handler
  const retry = container.querySelector('.clRetry');
  if (retry) {
    retry.addEventListener('click', (e) => {
      e.preventDefault();
      loaded = false;
      loadChangelog();
    });
  }
}
