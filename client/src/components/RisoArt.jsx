import { cx } from './ui.jsx';

// Each session gets an original two-ink "riso print" instead of a stock photo.
// The shapes for each recipe live in index.css (.a-python, .a-guitar, ...).
const RECIPES = {
  python: { shapes: ['s1 dot', 's2'], glyph: '{ }' },
  guitar: { shapes: ['s1 dot', 's2'], glyph: '♪', g: 0.9 },
  excel: { shapes: ['s1', 's2 dot'], glyph: 'fx' },
  paint: { shapes: ['s1', 's2 dot'], glyph: '' },
  spanish: { shapes: ['s1 dot', 's2'], glyph: '¿?', g: 1.05 },
  chess: { shapes: ['s1', 's2 dot'], glyph: '♞', g: 1.2 },
  speak: { shapes: ['s1 dot'], glyph: '“', g: 1.4 },
  git: { shapes: ['s1', 's2', 's3 dot'], glyph: '' },
};

// Specific skills first, then the category, then a stable fallback.
const BY_KEYWORD = {
  python: { recipe: 'python' },
  dsa: { recipe: 'excel', glyph: 'O(n)', g: 0.55 },
  linux: { recipe: 'python', glyph: '$_', g: 0.85 },
  git: { recipe: 'git' },
  guitar: { recipe: 'guitar' },
  excel: { recipe: 'excel' },
  painting: { recipe: 'paint' },
  watercolor: { recipe: 'paint' },
  spanish: { recipe: 'spanish' },
  chess: { recipe: 'chess' },
  communication: { recipe: 'speak' },
};
const BY_CATEGORY = {
  Programming: 'python',
  Languages: 'spanish',
  Music: 'guitar',
  Art: 'paint',
  Productivity: 'excel',
  Communication: 'speak',
  Games: 'chess',
};

function hash(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function pickArt({ title = '', skills = [], category } = {}) {
  for (const word of [...skills, ...title.toLowerCase().split(/\W+/)]) {
    const match = BY_KEYWORD[word.toLowerCase()];
    if (match) return { ...RECIPES[match.recipe], ...match, recipe: match.recipe };
  }
  if (BY_CATEGORY[category]) return { ...RECIPES[BY_CATEGORY[category]], recipe: BY_CATEGORY[category] };
  const keys = Object.keys(RECIPES);
  const recipe = keys[hash(title) % keys.length];
  return { ...RECIPES[recipe], recipe, glyph: title.charAt(0).toUpperCase() };
}

export default function RisoArt({ offer, className, glyphScale = 1 }) {
  const art = pickArt(offer);
  return (
    <div className={cx('art', `a-${art.recipe}`, className)} aria-hidden="true">
      {art.shapes.map((shape) => (
        <span key={shape} className={`s ${shape}`} />
      ))}
      {art.glyph && (
        <span className="glyph" style={{ '--g': (art.g ?? 1) * glyphScale }}>
          {art.glyph}
        </span>
      )}
    </div>
  );
}
