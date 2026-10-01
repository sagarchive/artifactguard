const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c],
  );
const JSON_POST = (body) => ({
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify(body),
});
async function api(path, opt) {
  const r = await fetch(path, opt);
  let d = {};
  try {
    d = await r.json();
  } catch {}
  if (!r.ok) throw new Error(d.error || d.reason || `Request failed (HTTP ${r.status})`);
  return d;
}

const MEANING = {
  SUPPORTED: 'The scoped evidence shows no conflict for this scenario.',
  CONDITIONAL: 'Usable only under the conditions the evidence states.',
  CONFLICTED: 'Sources disagree, so no single answer is justified.',
  INSUFFICIENT: 'Not enough scoped evidence to decide.',
  RETEST: 'The evidence is out of date. Retest before relying on it.',
  AVOID: 'The evidence shows a problem for this scenario.',
};
const PRESETS = {
  terostat: {
    revision: 'revision-terostat-historic',
    artifact: 'artifact-lead',
    environment: 'sealed',
    contact: 'indirect',
  },
  pvc: {
    revision: 'revision-flex-pvc-generic',
    artifact: 'artifact-paper',
    environment: 'open',
    contact: 'direct',
  },
  klucel: {
    revision: 'revision-cellulose-05',
    artifact: 'artifact-lead',
    environment: 'open',
    contact: 'indirect',
  },
  labs: {
    revision: 'revision-ethafoam',
    artifact: 'artifact-lead',
    environment: 'sealed',
    contact: 'indirect',
  },
  mdf: {
    revision: 'revision-medium-density-fiberboard',
    artifact: 'artifact-lead',
    environment: 'sealed',
    contact: 'indirect',
  },
};
const GROUP_ORDER = [
  'Guidance and case studies',
  'Display-case materials (2024 and 2025 studies)',
  'Cellulose ethers (2022 study)',
  'Synthetic test fixtures',
];
let catalog = null;
const FIELD_LABEL = {
  sealed: 'Sealed',
  enclosed: 'Enclosed',
  open: 'Open display',
  direct: 'Direct contact',
  indirect: 'No direct contact',
};
const radio = (n) => document.querySelector(`input[name=${n}]:checked`)?.value ?? null;
const setRadio = (n, v) =>
  document.querySelectorAll(`input[name=${n}]`).forEach((el) => {
    el.checked = el.value === v;
  });
const showError = (m) => {
  const e = $('#formError');
  e.textContent = m || '';
  e.hidden = !m;
};

$('#legendList').innerHTML = Object.entries(MEANING)
  .map(([k, v]) => `<div><dt data-v="${k}">${k}</dt><dd>${esc(v)}</dd></div>`)
  .join('');

async function init() {
  try {
    const c = await api('/api/catalog');
    catalog = c;
    const byGroup = new Map();
    for (const p of c.products)
      for (const r of p.revisions) {
        if (!byGroup.has(p.group)) byGroup.set(p.group, []);
        byGroup
          .get(p.group)
          .push(`<option value="${esc(r.id)}">${esc(p.name)} — ${esc(r.label)}</option>`);
      }
    $('#revision').innerHTML =
      '<option value="" disabled>Choose a material…</option>' +
      GROUP_ORDER.filter((g) => byGroup.has(g))
        .map((g) => `<optgroup label="${esc(g)}">${byGroup.get(g).join('')}</optgroup>`)
        .join('');
    $('#artifact').innerHTML =
      '<option value="" disabled>Choose an artifact material…</option>' +
      c.artifactMaterials
        .map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`)
        .join('');
    $('#revision').disabled =
      $('#artifact').disabled =
      $('#go').disabled =
      $('#askGo').disabled =
        false;
    $('#revision').value = PRESETS.terostat.revision;
    $('#artifact').value = PRESETS.terostat.artifact;
  } catch (x) {
    showError(`Could not load the catalog: ${x.message}`);
    $('#revision').innerHTML = $('#artifact').innerHTML = '<option>Unavailable</option>';
  }
  try {
    const s = await api('/api/context-status'),
      live = s.mode === 'live';
    const b = $('#modeBadge');
    b.textContent = live ? 'Live Sanity Context' : 'Local QA mode';
    b.classList.toggle('live', live);
  } catch {
    $('#modeBadge').textContent = 'Context unavailable';
  }
}

function guidanceFor(d, code, shown) {
  const topic = d.guidance?.[code],
    e = (d.knowledge?.entries || []).find((x) => x.topic === topic);
  if (!e) return '';
  if (shown.has(topic))
    return `<p class="kb-same">Same Knowledge Base entry as above: ${esc(e.title || e.path)}.</p>`;
  shown.add(topic);
  const source =
    d.knowledge.mode === 'live' ? 'Sanity Knowledge Base' : 'Bundled KB copy (local mode)';
  return `<div class="kb"><span class="kb-label">${esc(source)} · ${esc(e.title || e.path)}</span><p>${esc(e.excerpt)}</p><details><summary>Read the full entry</summary><pre class="kb-text">${esc(e.text)}</pre></details></div>`;
}

function renderRatings(a) {
  const tests = a.evidence.filter((e) => e._type === 'oddyTest');
  const metal = catalog?.artifactMaterials.find(
    (x) => x.id === a.scenario.artifactMaterialIds?.[0],
  )?.couponMetal;
  $('#ratingsCard').hidden = tests.length < 2;
  if (tests.length < 2) return;
  const chip = (v) =>
    v ? `<span class="rt r-${esc(v)}">${esc(v)}</span>` : '<span class="rt">–</span>';
  const cell = (t, key, name) => `<td class="${metal === name ? 'hl' : ''}">${chip(t[key])}</td>`;
  const rows = tests
    .map(
      (t) =>
        `<tr><td>${esc(t.institution)}</td>${cell(t, 'silverResult', 'silver')}${cell(t, 'copperResult', 'copper')}${cell(t, 'leadResult', 'lead')}<td>${chip(t.overallResult)}</td></tr>`,
    )
    .join('');
  $('#ratings').innerHTML =
    `<table class="ratings"><thead><tr><th>Institution</th><th class="${metal === 'silver' ? 'hl' : ''}">Silver</th><th class="${metal === 'copper' ? 'hl' : ''}">Copper</th><th class="${metal === 'lead' ? 'hl' : ''}">Lead</th><th>Overall</th></tr></thead><tbody>${rows}</tbody></table>` +
    (metal
      ? `<p class="ratings-note">The ${esc(metal)} column is the one that speaks to the selected artifact material. P is permanent use, T temporary, U unsuitable.</p>`
      : '<p class="ratings-note">P is permanent use, T temporary, U unsuitable. The selected artifact material is not one of the Oddy coupon metals.</p>');
}

function renderTrace(trace) {
  const rows = (trace || [])
    .map(
      (s, i) =>
        `<tr><td>${i + 1}</td><td>${esc(s.tool)}</td><td>${esc(s.path ? `${s.target} · ${s.path}` : s.query ? `${s.target} · “${s.query}”` : s.target)}</td><td class="num ${s.failed ? 'fail' : ''}">${s.failed ? 'failed' : s.cached ? '<span class="tag">cached</span>' : `${esc(s.ms)} ms`}</td></tr>`,
    )
    .join('');
  $('#trace').innerHTML = rows
    ? `<table class="trace"><thead><tr><th>#</th><th>Tool</th><th>Target</th><th class="num">Time</th></tr></thead><tbody>${rows}</tbody></table>`
    : '<p>No trace recorded.</p>';
}

function render(d) {
  const a = d.analysis,
    r = $('#result');
  r.hidden = false;
  const v = $('#verdict');
  v.textContent = a.verdict;
  v.dataset.v = a.verdict;
  $('#verdictMeaning').textContent = MEANING[a.verdict] || '';
  $('#summary').textContent = a.summary;
  $('#resultMeta').textContent =
    `${a.evidence.length} evidence records · ${a.sources.length} linked sources`;
  const shown = new Set();
  $('#deductions').innerHTML =
    a.deductions
      .map(
        (x) =>
          `<div class="deduction"><div class="code">${esc(x.code)} · ${esc(x.level)}</div><p>${esc(x.message)}</p>${guidanceFor(d, x.code, shown)}</div>`,
      )
      .join('') || '<p>No deductions.</p>';
  $('#baseline').innerHTML =
    `<div class="baseline-box"><div class="eyebrow">First-match keyword baseline</div><strong>${esc(d.baseline.verdict)}</strong><p>${esc(d.baseline.reason)}</p>${d.baseline.unsupportedCertainty ? '<p><b>Flag:</b> confident conclusion from one flattened record.</p>' : ''}</div>`;
  $('#sources').innerHTML = a.sources.length
    ? a.sources
        .map(
          (s) =>
            `<div class="source"><div><b>${esc(s.title)}</b><small>${esc(s.publisher)} · ${esc(s.authority)}</small></div><a href="${esc(s.url)}" target="_blank" rel="noreferrer">Source ↗</a></div>`,
        )
        .join('')
    : '<p>No external source is linked to this synthetic-only deduction.</p>';
  const k = d.knowledge,
    n = (k?.entries || []).length;
  $('#knowledge').innerHTML = !k
    ? '<p>Knowledge retrieval disabled for this request.</p>'
    : k.error
      ? `<p>${esc(k.message)} The verdict above does not depend on it.</p>`
      : `<p><b>${k.mode === 'live' ? 'Live Sanity Knowledge Base' : 'Local mode: bundled copy of the Knowledge Base files'}</b></p><p>${n ? `${(k.paths || []).length} ${(k.paths || []).length === 1 ? 'entry was' : 'entries were'} found by searching the Knowledge Base for the topic of each deduction, then read. The matching passage appears under each deduction. The verdict itself comes from the structured evidence.` : esc(k.note || 'No Knowledge Base entry applies to this result.')}</p><div class="code-list">${(k.paths || []).map((p) => `<code>${esc(p)}</code>`).join('')}</div>`;
  renderRatings(a);
  renderTrace(d.trace);
  r.scrollIntoView({behavior: 'smooth', block: 'start'});
  r.focus({preventScroll: true});
}

async function analyze() {
  showError('');
  const environment = radio('environment'),
    contact = radio('contact'),
    revision = $('#revision').value,
    artifact = $('#artifact').value;
  if (!revision || !artifact || !environment || !contact) {
    showError(
      'Choose a material, an artifact material, an environment and a contact option first.',
    );
    return;
  }
  const b = $('#go');
  b.disabled = true;
  b.textContent = 'Analyzing…';
  try {
    render(
      await api(
        '/api/analyze',
        JSON_POST({
          scenario: {
            revisionIds: [revision],
            artifactMaterialIds: [artifact],
            environment,
            contact,
          },
          includeKnowledge: true,
        }),
      ),
    );
  } catch (x) {
    showError(x.message);
  } finally {
    b.disabled = false;
    b.textContent = 'Analyze evidence';
  }
}
$('#scenarioForm').addEventListener('submit', (e) => {
  e.preventDefault();
  analyze();
});

document.querySelectorAll('[data-preset]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p || $('#go').disabled) return;
    $('#revision').value = p.revision;
    $('#artifact').value = p.artifact;
    setRadio('environment', p.environment);
    setRadio('contact', p.contact);
    $('#askOut').innerHTML = '';
    analyze();
  }),
);

function showInterpretation(r) {
  const u = r.understood,
    got = [
      u.product && `${u.product}${u.revision ? ` (${u.revision})` : ''}`,
      u.artifact,
      u.environment && FIELD_LABEL[u.environment],
      u.contact && FIELD_LABEL[u.contact],
    ].filter(Boolean);
  const out = $('#askOut');
  const read = got.length ? `<p><b>I read this as:</b> ${esc(got.join(' · '))}</p>` : '';
  if (r.complete) {
    out.innerHTML = `${read}<p>Running it now. Check the form if this is not what you meant.</p>`;
    return;
  }
  const qs = r.missing
    .map(
      (m) =>
        `<p><b>${esc(m.question)}</b></p>${
          m.options
            ? `<div class="opts">${m.options
                .slice(0, 8)
                .map(
                  (o) =>
                    `<button type="button" class="chip" data-pick="${esc(m.field)}" data-id="${esc(o.id)}">${esc(o.label)}</button>`,
                )
                .join('')}</div>`
            : ''
        }`,
    )
    .join('');
  out.innerHTML = `${read}<p>I need a bit more before answering. I won't guess.</p>${qs}`;
}
$('#askOut').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]');
  if (!b) return;
  if (b.dataset.pick === 'artifact') $('#artifact').value = b.dataset.id;
  else $('#revision').value = b.dataset.id;
  b.closest('.opts')
    .querySelectorAll('.chip')
    .forEach((c) => c.classList.toggle('featured', c === b));
});

$('#askForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('#question').value.trim();
  if (!q) return;
  const b = $('#askGo');
  b.disabled = true;
  b.textContent = 'Reading…';
  $('#askOut').textContent = '';
  $('#result').hidden = true;
  try {
    const r = await api('/api/interpret', JSON_POST({question: q}));
    $('#revision').value = r.scenario.revisionIds[0] ?? '';
    $('#artifact').value = r.scenario.artifactMaterialIds[0] ?? '';
    setRadio('environment', r.scenario.environment ?? null);
    setRadio('contact', r.scenario.contact ?? null);
    showInterpretation(r);
    if (r.complete) await analyze();
  } catch (x) {
    $('#askOut').textContent = x.message;
  } finally {
    b.disabled = false;
    b.textContent = 'Ask';
  }
});

$('#calcForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('#calcResult');
  out.classList.remove('err');
  try {
    const r = await api(
      '/api/enclosure',
      JSON_POST({
        emissionRateUgM2H: Number($('#E').value),
        areaM2: Number($('#A').value),
        volumeM3: Number($('#V').value),
        leakagePerHour: Number($('#N').value),
      }),
    );
    out.textContent = `${r.equation} = ${r.concentrationUgM3.toLocaleString(undefined, {maximumFractionDigits: 4})} µg/m³. ${r.interpretation}`;
  } catch (x) {
    out.classList.add('err');
    out.textContent = x.message;
  }
});

init().then(() => {
  const c = new URLSearchParams(location.search).get('case');
  if (c && PRESETS[c]) document.querySelector(`[data-preset=${c}]`).click();
});
