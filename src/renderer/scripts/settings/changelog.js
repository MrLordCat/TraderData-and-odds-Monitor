/**
 * Changelog tab — loads CHANGELOG.md from app root and renders as HTML
 */
const { ipcRenderer } = require('electron');

let loaded = false;

/** Minimal Markdown → HTML converter (covers CHANGELOG.md patterns) */
function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw;

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
  // Bold **text**
  r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Inline code `text`
  r = r.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links [text](url)
  r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="clLink">$1</a>');
  return r;
}

export function init() {
  // Lazy-load when tab is clicked
  const tabBar = document.querySelector('.tab-bar');
  if (!tabBar) return;

  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn || btn.dataset.tab !== 'changelog') return;
    loadChangelog();
  });
}

async function loadChangelog() {
  if (loaded) return;
  loaded = true;

  const container = document.getElementById('changelog-content');
  if (!container) return;

  try {
    const md = await ipcRenderer.invoke('get-changelog');
    if (md) {
      container.innerHTML = mdToHtml(md);
    } else {
      container.innerHTML = '<p class="changelogEmpty">Changelog not available.</p>';
    }
  } catch (e) {
    container.innerHTML = '<p class="changelogEmpty">Failed to load changelog.</p>';
  }
}
