const TEMPLATES = {
  'gradient-blue': { gradient: ['#0a1628', '#1a3a5c', '#0a1628'], accent: '#c8a960', textColor: '#ffffff' },
  'gradient-gold': { gradient: ['#1a1206', '#3d2b10', '#1a1206'], accent: '#d4a843', textColor: '#f5e6c8' },
  'dark-elegant': { gradient: ['#0d0d0d', '#1a1a2e', '#0d0d0d'], accent: '#e6b422', textColor: '#e0e0e0' },
  'parchment': { gradient: ['#f5e6c8', '#e8d5a3', '#f5e6c8'], accent: '#5c3a1e', textColor: '#2a1a0a' }
};

export async function generateBackgroundImage({ template, title, subtitle, width = 1920, height = 1080 }) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const tmpl = TEMPLATES[template] || TEMPLATES['gradient-blue'];

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  tmpl.gradient.forEach((color, i) => grad.addColorStop(i / (tmpl.gradient.length - 1), color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Decorative border
  const margin = 60;
  ctx.strokeStyle = tmpl.accent; ctx.lineWidth = 4;
  ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);
  ctx.strokeStyle = tmpl.accent + '40'; ctx.lineWidth = 1;
  ctx.strokeRect(margin + 15, margin + 15, width - (margin + 15) * 2, height - (margin + 15) * 2);

  // Corner elements
  const cs = 30;
  ctx.strokeStyle = tmpl.accent; ctx.lineWidth = 3;
  [[margin, margin], [width - margin, margin], [margin, height - margin], [width - margin, height - margin]].forEach(([x, y]) => {
    const dx = x === margin ? 1 : -1;
    const dy = y === margin ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x + dx * cs, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * cs);
    ctx.stroke();
  });

  // Title
  if (title) {
    ctx.fillStyle = tmpl.accent;
    ctx.font = 'bold 56px "David", "Frank Ruhl Libre", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(title, width / 2, margin + 40);
  }

  // Subtitle
  if (subtitle) {
    ctx.fillStyle = tmpl.textColor + 'CC';
    ctx.font = '36px "David", "Frank Ruhl Libre", serif';
    ctx.textAlign = 'center';
    ctx.fillText(subtitle, width / 2, margin + 110);
  }

  // Decorative line
  ctx.strokeStyle = tmpl.accent + '80'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 200, margin + 160);
  ctx.lineTo(width / 2 + 200, margin + 160);
  ctx.stroke();

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

export function getTemplateNames() { return Object.keys(TEMPLATES); }
export function getTemplatePreview(templateName) { return TEMPLATES[templateName] || TEMPLATES['gradient-blue']; }
