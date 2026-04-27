'use strict';

// ---------------------------------------------------------------------------
// Console Result Page Renderer
// ---------------------------------------------------------------------------
// Generates static HTML for audit (and future tool) result pages.
// All pages use .fb-* classes only. The page IS the proof.
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreColor(pct) {
  if (pct >= 85) return 'var(--fb-matrix)';
  if (pct >= 60) return 'var(--fb-amber)';
  if (pct >= 35) return 'var(--fb-coral)';
  return 'var(--fb-red)';
}

function statusChip(status) {
  const colorMap = { YES: '--fb-matrix', WEAK: '--fb-amber', NO: '--fb-red' };
  const color = colorMap[status] || '--fb-text-mute';
  return `<span class="fb-chip" style="border-color:var(${color});color:var(${color});">${status}</span>`;
}

function boolChip(val, yesLabel, noLabel) {
  if (val) return `<span class="fb-chip fb-chip--matrix">${yesLabel || 'Yes'}</span>`;
  return `<span class="fb-chip" style="border-color:var(--fb-red);color:var(--fb-red);">${noLabel || 'No'}</span>`;
}

function renderAuditPage(audit, slug, opts = {}) {
  const isPrivate = opts.private || false;
  const timestamp = opts.timestamp || new Date().toISOString();
  const inputSnippet = esc((opts.inputSnippet || '').slice(0, 200));

  const mailSubject = encodeURIComponent(`Design System Audit — Score: ${audit.score}/${audit.maxScore}`);
  const mailBody = encodeURIComponent(
    `Our design system scored ${audit.score}/${audit.maxScore} (${audit.pct}%) on the FixBroken OS rubric.\n\n` +
    `Full audit: https://fixbroken.ai/console/audit/${slug}/\n\n` +
    `Top fixes:\n` +
    audit.punchList.map(p => `${p.rank}. ${p.name} (${p.status}) — est. ${p.effort}`).join('\n') +
    `\n\nAudited by FixBroken OS — https://fixbroken.ai/design/`
  );

  const categoryRows = Object.entries(audit.categories).map(([cat, data]) => {
    const itemRows = data.items.map(item => `
              <tr>
                <td style="padding:8px 12px;border-bottom:1px solid var(--fb-hairline);">${statusChip(item.status)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid var(--fb-hairline);color:var(--fb-text);font-family:var(--fb-font-sans);font-size:var(--fb-fs-14);">${esc(item.name)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid var(--fb-hairline);color:var(--fb-text-dim);font-family:var(--fb-font-mono);font-size:var(--fb-fs-12);">${esc(item.evidence)}</td>
              </tr>`).join('');
    return `
            <tr>
              <td colspan="3" style="padding:16px 12px 8px;border-bottom:1px solid var(--fb-hairline-hot);">
                <span class="fb-label fb-label--signal">${esc(cat)}</span>
                <span class="fb-mono" style="color:var(--fb-text-mute);font-size:var(--fb-fs-12);margin-left:8px;">${data.yes} yes · ${data.weak} weak · ${data.no} no</span>
              </td>
            </tr>
            ${itemRows}`;
  }).join('');

  const leakRows = audit.leakPoints.map((lp, i) => `
          <div class="fb-panel fb-panel--tight" style="border-left:3px solid var(--fb-red);">
            <div class="fb-stack fb-stack--tight" style="padding:16px 20px;">
              <span class="fb-label" style="color:var(--fb-red);">Leak ${i + 1}</span>
              <p style="color:var(--fb-text-loud);font-size:var(--fb-fs-16);margin:0;font-family:var(--fb-font-sans);">${esc(lp.execLabel)}</p>
              <p style="color:var(--fb-text-dim);font-size:var(--fb-fs-13);margin:0;font-family:var(--fb-font-mono);">Missing: ${esc(lp.name)} · ${esc(lp.category)}</p>
            </div>
          </div>`).join('');

  const punchRows = audit.punchList.map(p => `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid var(--fb-hairline);color:var(--fb-signal);font-family:var(--fb-font-mono);font-weight:600;">#${p.rank}</td>
                <td style="padding:10px 12px;border-bottom:1px solid var(--fb-hairline);color:var(--fb-text);font-family:var(--fb-font-sans);">${esc(p.name)}</td>
                <td style="padding:10px 12px;border-bottom:1px solid var(--fb-hairline);">${statusChip(p.status)}</td>
                <td style="padding:10px 12px;border-bottom:1px solid var(--fb-hairline);color:var(--fb-text-dim);font-family:var(--fb-font-mono);font-size:var(--fb-fs-12);">${esc(p.effort)}</td>
              </tr>`).join('');

  const t = audit.comparison.theirs;
  const r = audit.comparison.reference;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Design System Audit — ${audit.score}/${audit.maxScore} — fixbroken.ai</title>
<meta name="description" content="Design system audit result: ${audit.score}/${audit.maxScore} (${audit.pct}%). ${audit.verdict}">
${isPrivate ? '<meta name="robots" content="noindex,nofollow">' : ''}
<meta property="og:title" content="Design System Audit — ${audit.score}/${audit.maxScore}">
<meta property="og:description" content="${esc(audit.verdict)}">
<meta property="og:url" content="https://fixbroken.ai/console/audit/${slug}/">
<meta property="og:type" content="article">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/design/fixbroken-os.css">
<style>
  .audit-score-ring {
    width: 120px; height: 120px;
    border-radius: 50%;
    border: 4px solid ${scoreColor(audit.pct)};
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    box-shadow: 0 0 32px ${scoreColor(audit.pct)}33;
    flex-shrink: 0;
  }
  .audit-score-ring__num {
    font-family: var(--fb-font-mono);
    font-size: var(--fb-fs-40);
    font-weight: 600;
    color: var(--fb-text-loud);
    line-height: 1;
  }
  .audit-score-ring__max {
    font-family: var(--fb-font-mono);
    font-size: var(--fb-fs-13);
    color: var(--fb-text-mute);
  }
  .audit-cmp-table { width: 100%; border-collapse: collapse; }
  .audit-cmp-table th {
    text-align: left; padding: 8px 12px;
    font-family: var(--fb-font-mono); font-size: var(--fb-fs-11);
    letter-spacing: var(--fb-tracking-wide); text-transform: uppercase;
    color: var(--fb-text-mute); border-bottom: 1px solid var(--fb-hairline-hot);
  }
  .audit-cmp-table td {
    padding: 8px 12px; border-bottom: 1px solid var(--fb-hairline);
    font-family: var(--fb-font-mono); font-size: var(--fb-fs-13);
    color: var(--fb-text);
  }
  .audit-rubric-table { width: 100%; border-collapse: collapse; }
  .audit-rubric-table td, .audit-rubric-table th { text-align: left; }
  .audit-punch-table { width: 100%; border-collapse: collapse; }
  .audit-migration { white-space: pre-wrap; font-family: var(--fb-font-mono); font-size: var(--fb-fs-13); color: var(--fb-text-dim); line-height: var(--fb-lh-relaxed); }
  ${isPrivate ? '.audit-private-badge { display: inline-block; padding: 4px 10px; border: 1px solid var(--fb-amber); color: var(--fb-amber); font-family: var(--fb-font-mono); font-size: var(--fb-fs-11); letter-spacing: var(--fb-tracking-wide); text-transform: uppercase; border-radius: var(--fb-r-2); }' : ''}
  @media (max-width: 640px) {
    .audit-hero-row { flex-direction: column !important; align-items: flex-start !important; }
    .audit-cmp-grid { grid-template-columns: 1fr !important; }
  }
</style>
</head>
<body class="fb-shell">
<div class="fb-grid-bg"></div>

<nav class="fb-nav">
  <div class="fb-nav__inner">
    <a href="/" class="fb-nav__brand">fixbroken.ai</a>
    <div class="fb-nav__links">
      <a class="fb-nav__link" href="/">Home</a>
      <a class="fb-nav__link" href="/design/">Design</a>
      <a class="fb-nav__link fb-nav__link--active" href="/console/">Console</a>
    </div>
  </div>
</nav>

<main class="fb-container" style="padding-top:calc(var(--fb-nav-h) + var(--fb-s-12));">

  <!-- HERO -->
  <section class="fb-section">
    ${isPrivate ? '<div style="margin-bottom:var(--fb-s-4);"><span class="audit-private-badge">Private result</span></div>' : ''}
    <span class="fb-kicker">Console · Audit</span>
    <div class="fb-row" style="gap:var(--fb-s-8);align-items:center;flex-wrap:wrap;" class="audit-hero-row">
      <div class="audit-score-ring">
        <span class="audit-score-ring__num">${audit.score}</span>
        <span class="audit-score-ring__max">/ ${audit.maxScore}</span>
      </div>
      <div class="fb-stack fb-stack--tight" style="flex:1;min-width:240px;">
        <h1 style="font-size:var(--fb-fs-32);font-weight:600;color:var(--fb-text-loud);margin:0;line-height:var(--fb-lh-tight);">What you give your LLM</h1>
        <p style="color:var(--fb-text-dim);font-size:var(--fb-fs-16);margin:0;line-height:var(--fb-lh-relaxed);max-width:52ch;font-family:var(--fb-font-sans);">${esc(audit.verdict)}</p>
      </div>
    </div>
    ${inputSnippet ? `<div class="fb-panel fb-panel--tight" style="margin-top:var(--fb-s-6);">
      <div style="padding:12px 16px;">
        <span class="fb-label fb-label--signal" style="margin-bottom:4px;display:block;">Input snippet</span>
        <p class="fb-mono" style="color:var(--fb-text-dim);font-size:var(--fb-fs-12);margin:0;word-break:break-all;">${inputSnippet}${opts.inputSnippet && opts.inputSnippet.length > 200 ? '…' : ''}</p>
      </div>
    </div>` : ''}
  </section>

  <!-- COMPARISON -->
  <section class="fb-section">
    <h2 style="font-size:var(--fb-fs-20);font-weight:600;color:var(--fb-text-loud);margin:0 0 var(--fb-s-4);">Side by side</h2>
    <div class="fb-panel">
      <div style="padding:20px;overflow-x:auto;">
        <table class="audit-cmp-table">
          <thead>
            <tr>
              <th style="width:35%;">Metric</th>
              <th style="color:var(--fb-coral);">Your input</th>
              <th style="color:var(--fb-signal);">FixBroken OS</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Files</td><td>${t.fileCount}</td><td>${r.fileCount}</td></tr>
            <tr><td>Size</td><td>${t.kb} KB</td><td>${r.kb} KB</td></tr>
            <tr><td>Formats</td><td>${t.ruleTypes.length > 0 ? t.ruleTypes.join(', ') : 'none'}</td><td>${r.ruleTypes.join(', ')}</td></tr>
            <tr><td>Tokens</td><td>${t.tokenCount}</td><td>${r.tokenCount}</td></tr>
            <tr><td>Components</td><td>${t.componentCount}</td><td>${r.componentCount}</td></tr>
            <tr><td>Colors</td><td>${t.colorCount}</td><td>${r.colorCount}</td></tr>
            <tr><td>CLAUDE.md</td><td>${boolChip(t.hasCLAUDE)}</td><td>${boolChip(r.hasCLAUDE)}</td></tr>
            <tr><td>brand.md</td><td>${boolChip(t.hasBrand)}</td><td>${boolChip(r.hasBrand)}</td></tr>
            <tr><td>CSS source</td><td>${boolChip(t.hasCSSSource)}</td><td>${boolChip(r.hasCSSSource)}</td></tr>
            <tr><td>Session prompt</td><td>${boolChip(t.hasSessionPrompt)}</td><td>${boolChip(r.hasSessionPrompt)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- RUBRIC SCORECARD -->
  <section class="fb-section">
    <h2 style="font-size:var(--fb-fs-20);font-weight:600;color:var(--fb-text-loud);margin:0 0 var(--fb-s-4);">Rubric scorecard</h2>
    <div class="fb-panel">
      <div style="padding:20px;overflow-x:auto;">
        <table class="audit-rubric-table">
          ${categoryRows}
        </table>
      </div>
    </div>
  </section>

  <!-- LEAK POINTS -->
  ${audit.leakPoints.length > 0 ? `
  <section class="fb-section">
    <h2 style="font-size:var(--fb-fs-20);font-weight:600;color:var(--fb-text-loud);margin:0 0 var(--fb-s-4);">Top leak points</h2>
    <p style="color:var(--fb-text-dim);font-size:var(--fb-fs-14);margin:0 0 var(--fb-s-4);font-family:var(--fb-font-sans);">These are the places where your team's output will drift the most.</p>
    <div class="fb-stack" style="gap:var(--fb-s-3);">
      ${leakRows}
    </div>
  </section>` : ''}

  <!-- PUNCH LIST -->
  <section class="fb-section">
    <h2 style="font-size:var(--fb-fs-20);font-weight:600;color:var(--fb-text-loud);margin:0 0 var(--fb-s-4);">Punch list</h2>
    <p style="color:var(--fb-text-dim);font-size:var(--fb-fs-14);margin:0 0 var(--fb-s-4);font-family:var(--fb-font-sans);">Five highest-impact fixes, ranked. Estimated effort assumes one person with design system experience.</p>
    <div class="fb-panel">
      <div style="padding:20px;overflow-x:auto;">
        <table class="audit-punch-table">
          <thead>
            <tr>
              <th style="padding:8px 12px;font-family:var(--fb-font-mono);font-size:var(--fb-fs-11);letter-spacing:var(--fb-tracking-wide);text-transform:uppercase;color:var(--fb-text-mute);border-bottom:1px solid var(--fb-hairline-hot);text-align:left;">#</th>
              <th style="padding:8px 12px;font-family:var(--fb-font-mono);font-size:var(--fb-fs-11);letter-spacing:var(--fb-tracking-wide);text-transform:uppercase;color:var(--fb-text-mute);border-bottom:1px solid var(--fb-hairline-hot);text-align:left;">Fix</th>
              <th style="padding:8px 12px;font-family:var(--fb-font-mono);font-size:var(--fb-fs-11);letter-spacing:var(--fb-tracking-wide);text-transform:uppercase;color:var(--fb-text-mute);border-bottom:1px solid var(--fb-hairline-hot);text-align:left;">Status</th>
              <th style="padding:8px 12px;font-family:var(--fb-font-mono);font-size:var(--fb-fs-11);letter-spacing:var(--fb-tracking-wide);text-transform:uppercase;color:var(--fb-text-mute);border-bottom:1px solid var(--fb-hairline-hot);text-align:left;">Effort</th>
            </tr>
          </thead>
          <tbody>
            ${punchRows}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- MIGRATION PROMPT -->
  <section class="fb-section">
    <h2 style="font-size:var(--fb-fs-20);font-weight:600;color:var(--fb-text-loud);margin:0 0 var(--fb-s-4);">Migration prompt</h2>
    <p style="color:var(--fb-text-dim);font-size:var(--fb-fs-14);margin:0 0 var(--fb-s-4);font-family:var(--fb-font-sans);">Paste this into your LLM to start closing the gaps.</p>
    <div class="fb-terminal">
      <div class="fb-terminal__bar">
        <div class="fb-terminal__dots">
          <span class="fb-terminal__dot fb-terminal__dot--red"></span>
          <span class="fb-terminal__dot fb-terminal__dot--amber"></span>
          <span class="fb-terminal__dot fb-terminal__dot--matrix"></span>
        </div>
      </div>
      <div class="fb-terminal__body">
        <pre class="audit-migration" id="migration-prompt">${esc(opts.migrationPrompt || '')}</pre>
      </div>
    </div>
    <button onclick="navigator.clipboard.writeText(document.getElementById('migration-prompt').textContent).then(()=>{this.textContent='Copied';setTimeout(()=>this.textContent='Copy prompt',2000)})" class="fb-cta fb-cta--ghost" style="margin-top:var(--fb-s-3);">Copy prompt</button>
  </section>

  <!-- FOOTER -->
  <footer class="fb-section" style="padding-bottom:var(--fb-s-16);">
    <div class="fb-divider fb-divider--signal" style="margin-bottom:var(--fb-s-6);"></div>
    <div class="fb-stack" style="gap:var(--fb-s-4);">
      <div class="fb-row fb-row--wrap" style="gap:var(--fb-s-4);">
        <a href="mailto:?subject=${mailSubject}&body=${mailBody}" class="fb-cta">Email this audit to your team</a>
        <a href="/contact" class="fb-cta fb-cta--pink-solid" onclick="if(typeof openContact==='function'){openContact();return false;}">Need this fixed for real? Talk to FixBroken</a>
      </div>
      <div class="fb-row fb-row--wrap" style="gap:var(--fb-s-4);align-items:center;">
        <a href="/design/" class="fb-mono" style="color:var(--fb-text-mute);font-size:var(--fb-fs-12);text-decoration:none;">Audited by FixBroken OS</a>
        <span class="fb-mono" style="color:var(--fb-text-ghost);font-size:var(--fb-fs-11);">${timestamp}</span>
      </div>
    </div>
  </footer>

</main>
</body>
</html>`;
}

module.exports = { renderAuditPage, esc };
