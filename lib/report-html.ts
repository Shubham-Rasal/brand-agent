/**
 * Generates a self-contained HTML asset pack and brand report.
 */

interface LogoAsset {
  url: string;
  type?: string;
  resolution?: { width?: number; height?: number; aspect_ratio?: number };
}

interface ColorAsset {
  hex: string;
  usage?: string;
}

interface BackdropAsset {
  url: string;
  description?: string;
}

interface BrandData {
  brand_name?: string;
  logos?: LogoAsset[];
  colors?: ColorAsset[];
  backdrop_images?: BackdropAsset[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateBrandReportHtml(
  brandData: BrandData,
  sourceUrl: string,
  runId: string,
  generatedAt: string
): string {
  const name = escapeHtml(brandData.brand_name || 'Unknown Brand');
  const logos = brandData.logos ?? [];
  const colors = brandData.colors ?? [];
  const backdrops = brandData.backdrop_images ?? [];

  const colorSwatches = colors
    .map(
      (c) =>
        `<div class="swatch" style="background:${escapeHtml(c.hex)}" title="${escapeHtml(c.hex)} ${escapeHtml(c.usage || '')}">
          <span class="hex">${escapeHtml(c.hex)}</span>
          ${c.usage ? `<span class="usage">${escapeHtml(c.usage)}</span>` : ''}
        </div>`
    )
    .join('');

  const logoCards = logos
    .map(
      (l) =>
        `<div class="logo-card">
          <img src="${escapeHtml(l.url)}" alt="${escapeHtml(l.type || 'logo')}" loading="lazy" onerror="this.style.display='none'"/>
          <div class="logo-meta">
            <span>${escapeHtml(l.type || 'logo')}</span>
            ${l.resolution ? `<span>${l.resolution.width ?? ''}×${l.resolution.height ?? ''}</span>` : ''}
          </div>
        </div>`
    )
    .join('');

  const backdropCards = backdrops
    .map(
      (b) =>
        `<div class="backdrop-card">
          <img src="${escapeHtml(b.url)}" alt="${escapeHtml(b.description || 'backdrop')}" loading="lazy" onerror="this.style.display='none'"/>
          ${b.description ? `<span class="desc">${escapeHtml(b.description)}</span>` : ''}
        </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Brand Asset Pack — ${name}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 2rem; background: #0f0f0f; color: #e5e5e5; line-height: 1.5; }
    .header { margin-bottom: 2rem; }
    h1 { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem; }
    .meta { font-size: 0.875rem; color: #888; }
    .meta a { color: #7c3aed; }
    section { margin-bottom: 2.5rem; }
    h2 { font-size: 1.125rem; font-weight: 600; margin: 0 0 1rem; color: #a3a3a3; text-transform: uppercase; letter-spacing: 0.05em; }
    .swatches { display: flex; flex-wrap: wrap; gap: 1rem; }
    .swatch { width: 120px; height: 80px; border-radius: 8px; display: flex; flex-direction: column; justify-content: flex-end; padding: 8px; font-size: 0.75rem; }
    .swatch .hex { font-family: monospace; font-weight: 600; }
    .swatch .usage { font-size: 0.65rem; opacity: 0.8; }
    .logos-grid, .backdrops-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; }
    .logo-card, .backdrop-card { background: #1a1a1a; border-radius: 12px; overflow: hidden; }
    .logo-card img, .backdrop-card img { width: 100%; height: auto; display: block; }
    .logo-meta, .backdrop-card .desc { padding: 8px; font-size: 0.75rem; color: #888; }
    .backdrop-card img { max-height: 180px; object-fit: cover; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #333; font-size: 0.75rem; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${name}</h1>
    <div class="meta">
      Source: <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(sourceUrl)}</a><br>
      Run ID: ${escapeHtml(runId)} · Generated: ${escapeHtml(generatedAt)}
    </div>
  </div>

  ${colors.length > 0 ? `
  <section>
    <h2>Brand Colors</h2>
    <div class="swatches">${colorSwatches}</div>
  </section>` : ''}

  ${logos.length > 0 ? `
  <section>
    <h2>Logos</h2>
    <div class="logos-grid">${logoCards}</div>
  </section>` : ''}

  ${backdrops.length > 0 ? `
  <section>
    <h2>Backdrop Images</h2>
    <div class="backdrops-grid">${backdropCards}</div>
  </section>` : ''}

  <div class="footer">
    Brand Asset Pack · OpenBrand Agent · <a href="https://brand-agent-six.vercel.app" target="_blank" rel="noopener">brand-agent-six.vercel.app</a>
  </div>
</body>
</html>`;
}
