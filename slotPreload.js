// Slot placeholder: just shows outline + preset tag (no add button).
window.addEventListener('DOMContentLoaded', () => {
  try {
    const params = new URLSearchParams(location.search);
    const preset = params.get('preset') || '';
    const lbl = document.getElementById('presetId'); if (lbl) lbl.textContent = preset;
  } catch(_){ }
});
