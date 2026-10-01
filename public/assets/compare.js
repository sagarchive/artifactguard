const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c],
  );
const KIND = {
  'real-source-derived': 'published data',
  'synthetic-rule': 'synthetic',
  policy: 'policy',
};

try {
  const r = await fetch('/api/benchmark');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  document.querySelector('#stats').innerHTML =
    `<div class="stat"><b>${d.passed}/${d.total}</b>scenarios behave as expected</div><div class="stat"><b>${d.rows.filter((x) => x.kind === 'real-source-derived').length}</b>derived from published data</div><div class="stat"><b>${d.baselineUnsupportedCertaintyCount}</b>keyword baseline certainty flags</div>`;
  document.querySelector('#benchmarkRows').innerHTML = d.rows
    .map(
      (x) =>
        `<tr><td><b>${esc(x.id)}</b> <small>${esc(KIND[x.kind] || x.kind)}</small><br>${esc(x.name)}</td><td><b>${esc(x.actual)}</b><br><small>${esc(x.observedCodes.slice(0, 3).join(', '))}</small></td><td><b>${esc(x.baseline)}</b>${x.baselineUnsupportedCertainty ? '<br><small>unsupported-certainty flag</small>' : ''}</td><td class="${x.pass ? 'pass' : 'fail'}">${x.pass ? 'PASS' : 'FAIL'}</td></tr>`,
    )
    .join('');
} catch (x) {
  document.querySelector('#stats').innerHTML =
    `<p class="page-msg">Could not load the benchmark (${esc(x.message)}). Reload to retry.</p>`;
}
