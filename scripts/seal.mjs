/** Web3D 2026 award seal as inline SVG (shared by the video cards and the site badges). */
export function seal(line1, line2, line3, size) {
  const R = 150;
  const rr = R - 24; // ring-text radius
  const px = size ?? 2 * R + 12;
  const circ = (2 * Math.PI * rr).toFixed(1);
  const ring = "WEB3D CONSORTIUM  ·  WEB3D 2026  ·  DOHA, QATAR  ·  INTERNATIONAL CONFERENCE  ·  ";
  const id = "ring" + Math.random().toString(36).slice(2, 7);
  const F = "font-family=\"'Segoe UI',system-ui,sans-serif\"";
  return `<svg viewBox="${-R - 6} ${-R - 6} ${2 * R + 12} ${2 * R + 12}" width="${px}" height="${px}" xmlns="http://www.w3.org/2000/svg">
    <defs><path id="${id}" d="M 0 ${-rr} A ${rr} ${rr} 0 1 1 -0.01 ${-rr}"/></defs>
    <circle r="${R}" fill="#121a14" stroke="#d9b24a" stroke-width="4"/>
    <circle r="${R - 10}" fill="none" stroke="#d9b24a" stroke-width="1.5"/>
    <circle r="${R - 40}" fill="none" stroke="#d9b24a" stroke-width="1.5" opacity="0.6"/>
    <text ${F} font-size="14" font-weight="600" fill="#e9d48a"><textPath href="#${id}" startOffset="0" textLength="${circ}" lengthAdjust="spacing">${ring}</textPath></text>
    <text y="-56" text-anchor="middle" font-size="20" fill="#d9b24a">★</text>
    <text y="-30" text-anchor="middle" ${F} font-size="15" font-weight="700" fill="#e9d48a" letter-spacing="4">WINNER</text>
    <text y="2" text-anchor="middle" ${F} font-size="21" font-weight="700" fill="#ffffff">${line1}</text>
    <text y="30" text-anchor="middle" ${F} font-size="21" font-weight="700" fill="#ffffff">${line2}</text>
    <line x1="-40" y1="44" x2="40" y2="44" stroke="#d9b24a" stroke-width="1"/>
    <text y="66" text-anchor="middle" ${F} font-size="15" font-weight="600" fill="#e9d48a">${line3}</text>
  </svg>`;
}

export const SEAL_TOOLS = ["Web3D / Metaverse", "Tool of the Year", "TOOLS COMPETITION"];
export const SEAL_AI = ["AI &amp; Web3D Innovation", "Competition", "1ST PRIZE"];
