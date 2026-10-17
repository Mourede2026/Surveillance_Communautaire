/**
 * Scènes illustrées et animées du lecteur "vidéo" du briefing (assets/briefing-video.js).
 *
 * Pour chaque diapositive, bvSceneSvg(moduleId, slide) renvoie un décor SVG animé (SMIL) :
 * un village béninois (cases, manguier, soleil, nuages), des personnages (le RC en gilet
 * turquoise avec casquette, l'ASCQ en gilet bleu, des villageois) et des accessoires propres
 * à chaque maladie (vache, moustique, chien, rat, chauve-souris, seau d'eau sale, dispositif
 * de lavage des mains, moustiquaire, vaccin, marmite…).
 *
 * Mise en scène selon le type de diapositive (slide.kind / slide.blk) :
 *   intro → le RC salue · symptômes → un villageois malade, signes animés · alerte → le RC
 *   désigne le cas, ciel rouge qui clignote · transmission → vecteur + flèche vers la victime
 *   · prévention → gestes de protection validés · CAT / règle d'or → le RC appelle l'ASCQ
 *   · rôle → le RC sensibilise la communauté.
 *
 * Aucune dépendance. Pas de fichier image : tout est dessiné en SVG, donc léger et hors-ligne.
 */
(function (global) {
  'use strict';

  const SKIN = ['#6b4330', '#8a5a3c', '#4f3123', '#9a6642'];
  const SHIRTS = ['#e67e22', '#8e44ad', '#2980b9', '#c0392b', '#f1c40f', '#16a085'];
  const PANTS = ['#2c3e50', '#5d4037', '#34495e', '#3e2723'];
  let _n = 0;

  /* ------------------------------ petits utilitaires ------------------------------ */
  const T = (x, y, s) => `translate(${x} ${y}) scale(${s == null ? 1 : s})`;
  const beg = (b) => (b ? `begin="${b}s"` : '');
  const rotAnim = (vals, dur, cx, cy, b) =>
    `<animateTransform attributeName="transform" type="rotate" values="${vals.map((v) => `${v} ${cx} ${cy}`).join(';')}" dur="${dur}s" ${beg(b)} repeatCount="indefinite"/>`;
  const moveAnim = (pts, dur, b) =>
    `<animateTransform attributeName="transform" type="translate" values="${pts.map((p) => p.join(' ')).join(';')}" dur="${dur}s" ${beg(b)} repeatCount="indefinite"/>`;
  const scaleAnim = (vals, dur, b) =>
    `<animateTransform attributeName="transform" type="scale" values="${vals.join(';')}" dur="${dur}s" ${beg(b)} repeatCount="indefinite"/>`;
  const anim = (attr, vals, dur, b) =>
    `<animate attributeName="${attr}" values="${vals}" dur="${dur}s" ${beg(b)} repeatCount="indefinite"/>`;

  /* ------------------------------------ décor ------------------------------------ */
  function hut(x, y, s, round) {
    if (round) {
      return `<g transform="${T(x, y, s)}"><rect x="-22" y="-26" width="44" height="26" rx="3" fill="#c98a55"/>
        <path d="M-30 -24 L0 -56 L30 -24Z" fill="#b8893f"/><path d="M-24 -26 L0 -50" stroke="#9a6f2c" stroke-width="1.5"/>
        <path d="M-12 -34 L8 -48" stroke="#9a6f2c" stroke-width="1.5"/><rect x="-6" y="-18" width="12" height="18" rx="5" fill="#3b2a20"/></g>`;
    }
    return `<g transform="${T(x, y, s)}"><rect x="-26" y="-28" width="52" height="28" fill="#e6cfa8"/>
      <path d="M-32 -28 L-6 -44 L32 -44 L32 -28Z" fill="#8d6e63"/><path d="M-32 -28 L32 -28" stroke="#6d4c41" stroke-width="2"/>
      <rect x="-5" y="-20" width="11" height="20" fill="#5d4037"/><rect x="12" y="-22" width="10" height="9" fill="#90caf9"/></g>`;
  }
  function tree(x, y, s) {
    return `<g transform="${T(x, y, s)}"><path d="M-3 0 L-2 -34 L3 -34 L4 0Z" fill="#6d4c41"/>
      <circle cx="0" cy="-46" r="19" fill="#3f8f3f"/><circle cx="-15" cy="-38" r="13" fill="#4aa14a"/>
      <circle cx="15" cy="-38" r="13" fill="#2f7d32"/><circle cx="-4" cy="-56" r="11" fill="#58b05a"/>
      <circle cx="9" cy="-48" r="2.6" fill="#f9a825"/><circle cx="-10" cy="-44" r="2.6" fill="#f9a825"/></g>`;
  }
  function cloud(y, s, dur, b) {
    return `<g transform="translate(-100 ${y}) scale(${s})" opacity=".92">${moveAnim([[-100, y], [520, y]], dur, b)}
      <ellipse cx="0" cy="0" rx="26" ry="9" fill="#fff"/><ellipse cx="-14" cy="-6" rx="14" ry="9" fill="#fff"/>
      <ellipse cx="10" cy="-9" rx="16" ry="10" fill="#fff"/></g>`;
  }
  function bg(mood) {
    const id = 'bsg' + (++_n);
    const sky = mood === 'alert' ? ['#ff8a5a', '#ffe0b0'] : ['#6ec6ff', '#eaf8ff'];
    let sun = `<g transform="translate(335 52)"><g>${rotAnim([0, 360], 40, 0, 0)}
      ${[0, 45, 90, 135].map((a) => `<rect x="-1.5" y="-34" width="3" height="68" rx="1.5" fill="#ffe27a" opacity=".55" transform="rotate(${a})"/>`).join('')}
      </g><circle r="19" fill="#ffd54a"/></g>`;
    if (mood === 'alert') sun = `<g transform="translate(335 78)"><circle r="22" fill="#ff7043"/></g>`;
    return `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="-200" x2="0" y2="200">
        <stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
      <rect x="-2000" y="-2000" width="4400" height="2200" fill="url(#${id})"/>
      ${sun}${cloud(46, 1, 70, -10)}${cloud(86, .7, 95, -55)}${cloud(30, .55, 120, -90)}
      <path d="M-700 200 Q-500 150 -300 185 T100 170 T450 182 T900 160 L900 210 L-700 210Z" fill="#9ccc9a" opacity=".85"/>
      <path d="M-700 205 Q-420 178 -200 198 T220 190 T620 200 L900 215 L-700 215Z" fill="#6fae6a"/>
      ${hut(-40, 205, 1, true)}${tree(30, 207, .9)}${hut(370, 203, .9, false)}${tree(430, 205, 1)}${hut(130, 202, .75, false)}
      <rect x="-2000" y="200" width="4400" height="2000" fill="#c27a45"/>
      <path d="M-2000 200 L2400 200 L2400 208 L-2000 208Z" fill="#8bbf5a"/>
      <path d="M-60 300 Q120 232 230 214 Q330 204 470 206 L470 300Z" fill="#d9a46c" opacity=".75"/>
      ${[[20, 262], [95, 290], [350, 276], [250, 296], [-30, 280]].map((p) => `<path d="M${p[0]} ${p[1]} l-3 -7 m3 7 l0 -9 m0 9 l3 -7" stroke="#6b8f3a" stroke-width="1.6" stroke-linecap="round"/>`).join('')}
      ${mood === 'alert' ? `<rect x="-2000" y="-2000" width="4400" height="4400" fill="#d00000" opacity="0">${anim('opacity', '0;.2;0', 1)}</rect>` : ''}`;
  }

  /* ---------------------------------- personnages ---------------------------------- */
  function fx(list) {
    const drop = (cx, cy, d) => `<path d="M0 -4 Q3.4 0 0 3.2 Q-3.4 0 0 -4Z" fill="#6ec1ff" opacity="0"><animateTransform attributeName="transform" type="translate" values="${cx} ${cy};${cx} ${cy + 13}" dur="1.3s" begin="${d}s" repeatCount="indefinite"/>${anim('opacity', '0;1;0', 1.3, d)}</path>`;
    let o = '';
    list.forEach((k) => {
      if (k === 'fever') {
        o += drop(15, -90, 0) + drop(-16, -86, .5) + drop(13, -80, .9);
        o += `<g transform="translate(-36 -104)"><rect x="-2.5" y="-14" width="5" height="22" rx="2.5" fill="#fff" stroke="#bbb"/><circle cy="10" r="5" fill="#e53935"/>
          <rect x="-1.2" y="-6" width="2.4" height="16" fill="#e53935">${anim('y', '-10;-13;-10', 1)}</rect>${moveAnim([[0, 0], [0, -3], [0, 0]], 1.6)}</g>`;
        o += [-6, 0, 6].map((dx, i) => `<path d="M${dx - 3} -98 q2 -4 0 -8 t0 -8" stroke="#ff7043" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7">${anim('opacity', '.2;.9;.2', 1.1, i * .25)}</path>`).join('');
      } else if (k === 'rash') {
        o += [[-5, -80], [4, -73], [7, -82], [-8, -72], [0, -85]].map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="1.4" fill="#d62828">${anim('r', '1;1.9;1', 1.2, i * .2)}</circle>`).join('');
        o += [[-5, -54], [3, -46], [-2, -38], [6, -56], [-8, -44]].map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="1.7" fill="#d62828">${anim('r', '1.2;2.2;1.2', 1.2, i * .17)}</circle>`).join('');
      } else if (k === 'cough') {
        o += [0, .5, 1].map((d) => `<circle cx="16" cy="-72" r="2" fill="#fff" opacity="0">${anim('cx', '16;50', 1.5, d)}${anim('r', '2;8', 1.5, d)}${anim('opacity', '.9;0', 1.5, d)}</circle>`).join('');
      } else if (k === 'belly') {
        o += `<g transform="translate(0 -44)">${rotAnim([-8, 8, -8], .5, 0, 0)}${[0, 60, 120, 180, 240, 300].map((a) => `<path d="M0 -9 L0 -15" stroke="#ff9800" stroke-width="2.2" stroke-linecap="round" transform="rotate(${a})"/>`).join('')}</g>`;
      } else if (k === 'drop') {
        o += drop(7, -22, 0) + drop(-6, -18, .6);
      } else if (k === 'headache') {
        o += `<path d="M-3 -106 L2 -99 L-2 -99 L4 -90" stroke="#ffb300" stroke-width="2.4" fill="none" stroke-linejoin="round" stroke-linecap="round">${anim('opacity', '.2;1;.2', .7)}</path>
          <path d="M-14 -102 L-10 -96 L-13 -96 L-8 -89" stroke="#ffb300" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round">${anim('opacity', '1;.2;1', .7)}</path>`;
      } else if (k === 'stiff') {
        o += `<ellipse cx="0" cy="-64" rx="7" ry="3" fill="none" stroke="#e53935" stroke-width="2">${anim('opacity', '.3;1;.3', .9)}</ellipse>`;
      } else if (k === 'wound') {
        o += `<g transform="translate(-14 -36)"><circle r="6" fill="#7b1e1e" opacity=".85">${anim('r', '6;7.5;6', 1.3)}</circle><circle r="3.4" fill="#111"/></g>`;
      } else if (k === 'bite') {
        o += `<g transform="translate(6 -14)"><circle r="4.6" fill="#c62828">${anim('r', '4;5.8;4', 1)}</circle><circle r="1.6" cx="1" cy="-1" fill="#7f0000"/><path d="M-1 4 q-1 4 0 8" stroke="#c62828" stroke-width="2" stroke-linecap="round">${anim('opacity', '1;.2;1', 1.2)}</path></g>`;
      } else if (k === 'bleed') {
        o += drop(2, -72, 0).replace('#6ec1ff', '#c62828') + drop(3, -71, .65).replace('#6ec1ff', '#c62828');
      } else if (k === 'limp') {
        o += `<path d="M-14 -60 L-22 0" stroke="#8d6e63" stroke-width="3.5" stroke-linecap="round"/><path d="M-18 -62 L-10 -62" stroke="#8d6e63" stroke-width="3.5" stroke-linecap="round"/>`;
      }
    });
    return o;
  }

  function person(o) {
    const x = o.x || 0, y = o.y == null ? 250 : o.y, s = o.s || 1;
    const skin = o.skin || SKIN[0], shirt = o.shirt || SHIRTS[0], pants = o.pants || PANTS[0];
    const role = o.role || '', woman = !!o.woman, pose = o.pose || 'stand', face = o.face || 'smile';
    let aL = 6, aR = -6, vL = null, vR = null;
    switch (pose) {
      case 'wave': aR = -150; vR = [-135, -172, -135]; break;
      case 'point': aR = -88; vR = [-84, -95, -84]; break;
      case 'phone': aR = -165; vR = [-165, -160, -165]; break;
      case 'sick': aL = 165; aR = -30; break;
      case 'cough': aR = -165; break;
      case 'cheer': aL = 150; aR = -150; vL = [145, 172, 145]; vR = [-145, -172, -145]; break;
      case 'walk': aL = 0; aR = 0; vL = [25, -25, 25]; vR = [-25, 25, -25]; break;
    }
    const arm = (sx, ang, v) => `<g transform="rotate(${ang} ${sx} -58)">${v ? rotAnim(v, .9, sx, -58) : ''}
      <line x1="${sx}" y1="-58" x2="${sx}" y2="-35" stroke="${shirt}" stroke-width="6.5" stroke-linecap="round"/>
      <circle cx="${sx}" cy="-33" r="3.6" fill="${skin}"/></g>`;
    const vest = role ? (role === 'RC' ? '#12a594' : '#1e66d0') : '';
    const wrap = o.wrap || '#e84393';
    let legs;
    if (woman) {
      legs = `<rect x="-6" y="-12" width="5" height="12" fill="${skin}"/><rect x="1" y="-12" width="5" height="12" fill="${skin}"/>
        <path d="M-12 -34 L12 -34 L16 -8 L-16 -8Z" fill="${o.dress || '#c0392b'}"/><path d="M-13 -22 L13 -22" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 3" opacity=".7"/>`;
    } else {
      const leg = (lx, v) => `<g>${v ? rotAnim(v, .8, lx + 3.5, -30) : ''}<rect x="${lx}" y="-30" width="7" height="29" rx="3" fill="${pants}"/><ellipse cx="${lx + 3.5}" cy="-1" rx="6" ry="3" fill="#1b1b1b"/></g>`;
      legs = leg(-8, pose === 'walk' ? [18, -18, 18] : null) + leg(1, pose === 'walk' ? [-18, 18, -18] : null);
    }
    const belly = o.belly ? `<ellipse cx="3" cy="-40" rx="11" ry="9" fill="${o.dress || '#c0392b'}"/><path d="M3 -40 m-3 -2 q3 -4 6 0 q-3 6 -3 6 q0 0 -3 -6z" fill="#ff6b81" opacity=".9"/>` : '';
    const hair = woman
      ? `<path d="M-12 -79 Q-12 -96 0 -96 Q12 -96 12 -79 Q0 -85 -12 -79Z" fill="${wrap}"/><circle cx="2" cy="-96" r="4.5" fill="${wrap}"/>`
      : (role === 'RC'
        ? `<path d="M-11.5 -80 Q0 -96 11.5 -80Z" fill="#0b6b60"/><rect x="6" y="-82" width="12" height="3.4" rx="1.7" fill="#0b6b60"/>`
        : `<path d="M-11 -78 Q-11 -90 0 -90 Q11 -90 11 -78 Q6 -83 0 -83 Q-6 -83 -11 -78Z" fill="#1b1b1b"/>`);
    const mouth = o.mask ? '' : (face === 'sad'
      ? `<path d="M-4 -69.5 Q0 -73 4 -69.5" stroke="#2b1208" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
      : (o.talk ? `<ellipse cx="0" cy="-70.5" rx="2.6" ry="1" fill="#3a1010">${anim('ry', '.6;2.2;.8;1.8;.6', .7)}</ellipse>`
        : `<path d="M-4 -71 Q0 -67.5 4 -71" stroke="#2b1208" stroke-width="1.4" fill="none" stroke-linecap="round"/>`));
    const mask = o.mask ? `<path d="M-6.5 -76 Q0 -73.5 6.5 -76 L5.5 -66.5 Q0 -64.5 -5.5 -66.5Z" fill="#fff" stroke="#8fb8c8" stroke-width=".7"/>` : '';
    const badge = role ? `<rect x="2" y="-57" width="8.5" height="6.5" rx="1.3" fill="#fff"/><text x="6.2" y="-52" font-size="4.4" font-weight="700" text-anchor="middle" fill="${vest}" font-family="Arial,sans-serif">${role}</text>` : '';
    const phone = pose === 'phone' ? `<rect x="15.5" y="-93" width="6" height="11" rx="1.6" fill="#263238"/><rect x="16.5" y="-91.5" width="4" height="7" rx=".8" fill="#80deea"/>` : '';
    const sway = o.sway ? rotAnim([-2, 3, -2], 2.4, 0, 0) : (o.shake ? moveAnim([[0, 0], [2, 0], [-2, 0], [0, 0]], .18) : '');
    return `<g transform="translate(${x} ${y}) scale(${o.flip ? -s : s} ${s})"><ellipse cx="0" cy="0" rx="16" ry="3.2" fill="#000" opacity=".18"/>
      <g>${sway}${legs}${arm(-11, aL, vL)}
      <rect x="-11" y="-62" width="22" height="34" rx="6" fill="${shirt}"/>
      ${vest ? `<path d="M-11 -62 L-3.5 -62 L-3.5 -28 L-11 -28Z M3.5 -62 L11 -62 L11 -28 L3.5 -28Z" fill="${vest}" opacity=".95"/>${badge}` : ''}
      ${belly}${arm(11, aR, vR)}
      <rect x="-3" y="-66" width="6" height="6" fill="${skin}"/><circle cx="0" cy="-76" r="11" fill="${skin}"/>
      ${hair}<circle cx="-4" cy="-78" r="1.4" fill="#111"/><circle cx="4" cy="-78" r="1.4" fill="#111"/>${mouth}${mask}${phone}
      ${fx(o.fx || [])}</g></g>`;
  }

  /* --------------------------------- accessoires --------------------------------- */
  const fly = (x, y, d) => `<g transform="translate(${x} ${y})"><circle r="1.5" fill="#222"><animateMotion path="M0 0 c8 -10 18 4 26 -6 c-8 10 -18 -4 -26 6" dur="${d}s" repeatCount="indefinite"/></circle></g>`;

  function cow(x, y, s, dead) {
    const eye = dead ? `<path d="M49 -52 L53 -48 M53 -52 L49 -48" stroke="#222" stroke-width="1.4"/>` : `<circle cx="51" cy="-50" r="1.8" fill="#222"/>`;
    const body = `<rect x="-27" y="-22" width="6" height="22" rx="2" fill="#e8dfd0"/><rect x="-17" y="-22" width="6" height="22" rx="2" fill="#d9cfbd"/>
      <rect x="14" y="-22" width="6" height="22" rx="2" fill="#d9cfbd"/><rect x="24" y="-22" width="6" height="22" rx="2" fill="#e8dfd0"/>
      ${[-27, -17, 14, 24].map((hx) => `<rect x="${hx}" y="-4" width="6" height="4" fill="#3b2a20"/>`).join('')}
      <path d="M-33 -38 Q-46 -34 -41 -14" stroke="#cdbfa8" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="0" cy="-32" rx="34" ry="18" fill="#f4efe6"/><ellipse cx="-10" cy="-36" rx="10" ry="7" fill="#6d4c41"/><ellipse cx="14" cy="-26" rx="8" ry="6" fill="#6d4c41"/>
      <path d="M26 -44 L40 -58 L52 -48 L40 -32Z" fill="#f4efe6"/><ellipse cx="50" cy="-46" rx="11" ry="9" fill="#f4efe6" transform="rotate(20 50 -46)"/>
      <ellipse cx="58" cy="-42" rx="6" ry="4.5" fill="#f2b6b0"/><path d="M44 -54 Q40 -64 36 -62 M52 -54 Q54 -64 58 -63" stroke="#8d7b68" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="42" cy="-50" rx="5" ry="2.5" fill="#6d4c41" transform="rotate(-30 42 -50)"/>${eye}`;
    return `<g transform="${T(x, y, s)}">${dead ? `<g transform="translate(0 -52) scale(1 -1)">${body}</g>${fly(10, -44, 1.4)}${fly(24, -36, 1.9)}` : body}</g>`;
  }
  function chicken(x, y, s, dead) {
    const body = `<path d="M-10 -18 Q-20 -30 -14 -32 Q-10 -26 -6 -20Z" fill="#c0392b"/><ellipse cx="0" cy="-14" rx="12" ry="9" fill="#f5f0e6"/>
      <path d="M-4 -14 Q2 -8 8 -15" stroke="#d7cdb8" stroke-width="2" fill="none"/><circle cx="12" cy="-24" r="5.2" fill="#f5f0e6"/>
      <path d="M10 -29 q2 -5 4 0 q2 -4 3 1" fill="#e53935"/><path d="M17 -25 l6 2 l-6 2Z" fill="#fb8c00"/>
      ${dead ? `<path d="M10 -26 l3 3 m0 -3 l-3 3" stroke="#222" stroke-width="1"/>` : `<circle cx="13.5" cy="-25.5" r="1.1" fill="#111"/>`}
      <path d="M-2 -6 L-2 0 M3 -6 L3 0" stroke="#fb8c00" stroke-width="2"/>`;
    return `<g transform="${T(x, y, s)}">${dead ? `<g transform="translate(0 -28) scale(1 -1)">${body}</g>${fly(-6, -28, 1.5)}` : `<g>${moveAnim([[0, 0], [0, -2.5], [0, 0]], .6)}${body}</g>`}</g>`;
  }
  function dog(x, y, s, rabid) {
    return `<g transform="${T(x, y, s)}"><g>${rabid ? moveAnim([[0, 0], [1.6, 0], [-1.6, 0], [0, 0]], .16) : ''}
      <rect x="-18" y="-14" width="5" height="14" rx="2" fill="#8d6340"/><rect x="-9" y="-14" width="5" height="14" rx="2" fill="#a97c50"/>
      <rect x="10" y="-14" width="5" height="14" rx="2" fill="#8d6340"/><rect x="18" y="-14" width="5" height="14" rx="2" fill="#a97c50"/>
      <g transform="translate(-20 -22)"><g>${rotAnim([-15, 25, -15], rabid ? .3 : .5, 0, 0)}<path d="M0 0 Q-12 -4 -14 -16" stroke="#8d6340" stroke-width="4" fill="none" stroke-linecap="round"/></g></g>
      <ellipse cx="0" cy="-20" rx="21" ry="10" fill="#a97c50"/><circle cx="24" cy="-28" r="8.5" fill="#a97c50"/>
      <ellipse cx="32" cy="-26" rx="6" ry="4" fill="#c49a6c"/><circle cx="36" cy="-27" r="1.8" fill="#111"/>
      <path d="M20 -35 q-5 -4 -5 6 q4 3 7 -2Z" fill="#6d4c41"/><circle cx="26" cy="-30" r="1.6" fill="${rabid ? '#e53935' : '#111'}"/>
      ${rabid ? [0, .4, .8].map((d) => `<circle cx="33" cy="-22" r="1.8" fill="#fff" opacity="0">${anim('cy', '-22;-12', 1, d)}${anim('opacity', '1;0', 1, d)}</circle>`).join('') + `<path d="M31 -23 q3 2 6 -1" stroke="#fff" stroke-width="2" fill="none"/>` : ''}
      </g></g>`;
  }
  function rat(x, y, s) {
    return `<g transform="${T(x, y, s)}"><g>${moveAnim([[0, 0], [16, 0], [0, 0]], 3.2)}
      <path d="M-10 -6 Q-26 -2 -22 -14 Q-18 -20 -30 -18" stroke="#e8a0a0" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="0" cy="-8" rx="12" ry="7" fill="#8e8e8e"/><ellipse cx="13" cy="-9" rx="7" ry="4.6" fill="#9e9e9e"/>
      <circle cx="9" cy="-14" r="3.4" fill="#e8a0a0"/><circle cx="16" cy="-10" r="1.1" fill="#111"/><circle cx="20" cy="-9" r="1.4" fill="#e57373"/>
      <rect x="-5" y="-3" width="3" height="3" fill="#777"/><rect x="5" y="-3" width="3" height="3" fill="#777"/></g></g>`;
  }
  function mosquito(x, y, s, d, b) {
    return `<g transform="translate(${x} ${y})"><g><animateMotion path="M0 0 q25 -16 50 0 t50 0 t50 0 t-50 10 t-50 -10 t-50 0" dur="${d}s" ${beg(b)} repeatCount="indefinite"/>
      <g transform="scale(${s})"><ellipse cx="0" cy="0" rx="7" ry="2.6" fill="#37474f"/><circle cx="7.5" cy="-.5" r="2.2" fill="#37474f"/>
      <path d="M9 0 L17 3" stroke="#222" stroke-width="1"/><path d="M-3 2 L-6 8 M0 2 L0 8 M3 2 L5 8" stroke="#222" stroke-width=".9"/>
      <ellipse cx="-1" cy="-4" rx="6" ry="1.6" fill="#cfd8dc" opacity=".85">${anim('ry', '1;4.5;1', .14)}</ellipse></g></g></g>`;
  }
  function monkey(x, y, s) {
    return `<g transform="${T(x, y, s)}"><path d="M-12 -12 Q-30 -8 -26 -30 Q-24 -38 -32 -38" stroke="#6d4c41" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="0" cy="-16" rx="13" ry="14" fill="#795548"/><ellipse cx="0" cy="-13" rx="8" ry="9" fill="#a1887f"/>
      <circle cx="0" cy="-36" r="10" fill="#795548"/><ellipse cx="0" cy="-33" rx="7" ry="6" fill="#d7b99a"/><circle cx="-10" cy="-37" r="3.4" fill="#a1887f"/><circle cx="10" cy="-37" r="3.4" fill="#a1887f"/>
      <circle cx="-3" cy="-36" r="1.3" fill="#111"/><circle cx="3" cy="-36" r="1.3" fill="#111"/><path d="M-3 -30 Q0 -28 3 -30" stroke="#4e342e" stroke-width="1.2" fill="none"/>
      <rect x="-11" y="-4" width="7" height="5" rx="2" fill="#6d4c41"/><rect x="4" y="-4" width="7" height="5" rx="2" fill="#6d4c41"/></g>`;
  }
  function bat(x, y, s) {
    const wing = (sg) => `<g transform="scale(${sg} 1)">${`<g>${rotAnim([-18, 22, -18], .45, 0, 0)}<path d="M0 0 Q14 -16 30 -8 Q24 -2 26 4 Q16 -2 12 6 Q8 0 0 4Z" fill="#37474f"/></g>`}</g>`;
    return `<g transform="translate(${x} ${y}) scale(${s})"><g>${moveAnim([[0, 0], [10, -6], [0, 0]], 2.2)}${wing(1)}${wing(-1)}
      <ellipse cx="0" cy="3" rx="5" ry="8" fill="#455a64"/><circle cx="0" cy="-5" r="5" fill="#455a64"/><path d="M-4 -9 L-3 -14 L0 -10 L3 -14 L4 -9Z" fill="#455a64"/>
      <circle cx="-2" cy="-5" r="1" fill="#ffeb3b"/><circle cx="2" cy="-5" r="1" fill="#ffeb3b"/></g></g>`;
  }
  function bucket(x, y, s, water, up) {
    const col = water === 'dirty' ? '#8d6e3b' : (water === 'stagnant' ? '#6b8f5a' : '#6ec6ff');
    const germs = water === 'dirty' ? [[-8, -24], [2, -27], [9, -23]].map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="2.2" fill="#76c043">${anim('cy', `${p[1]};${p[1] - 5};${p[1]}`, 1.3, i * .3)}</circle>`).join('') + fly(-14, -44, 1.3) + fly(2, -40, 1.7) : '';
    const larvae = water === 'stagnant' ? [[-8, -25], [3, -27], [9, -24]].map((p, i) => `<path d="M${p[0]} ${p[1]} q2 -3 4 0" stroke="#1b1b1b" stroke-width="1.4" fill="none">${anim('opacity', '1;.2;1', .8, i * .2)}</path>`).join('') : '';
    const body = `<path d="M-16 -30 L16 -30 L12 0 L-12 0Z" fill="#1e88e5"/><path d="M-16 -30 L16 -30" stroke="#0d47a1" stroke-width="2"/>
      <ellipse cx="0" cy="-30" rx="16" ry="4" fill="${up ? '#1565c0' : col}"/><path d="M-14 -34 Q0 -50 14 -34" stroke="#90a4ae" stroke-width="1.6" fill="none"/>`;
    const upBody = `<path d="M-12 -30 L12 -30 L16 0 L-16 0Z" fill="#1e88e5"/><path d="M-16 0 L16 0" stroke="#0d47a1" stroke-width="2.4"/><ellipse cx="0" cy="-30" rx="12" ry="3" fill="#1565c0"/>
      <path d="M-22 -4 Q-30 -16 -20 -26" stroke="#90a4ae" stroke-width="1.6" fill="none"/>`;
    return `<g transform="${T(x, y, s)}">${up ? upBody : body + germs + larvae}</g>`;
  }
  function handwash(x, y, s) {
    return `<g transform="${T(x, y, s)}"><rect x="-22" y="-58" width="4" height="58" fill="#8d6e63"/><rect x="18" y="-58" width="4" height="58" fill="#8d6e63"/>
      <rect x="-22" y="-62" width="44" height="4" rx="2" fill="#6d4c41"/>
      <g transform="rotate(-8 0 -66)"><rect x="-13" y="-84" width="26" height="30" rx="5" fill="#fbc02d"/><rect x="-6" y="-90" width="12" height="8" rx="2" fill="#f9a825"/><rect x="-9" y="-78" width="18" height="6" rx="2" fill="#fff59d"/></g>
      <path d="M12 -58 L20 -52" stroke="#546e7a" stroke-width="3"/>
      <path d="M20 -50 L20 -14" stroke="#6ec6ff" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round">${anim('stroke-dashoffset', '22;0', .5)}</path>
      <ellipse cx="20" cy="-8" rx="17" ry="5" fill="#90caf9"/><ellipse cx="20" cy="-8" rx="17" ry="5" fill="none" stroke="#1e88e5" stroke-width="2"/>
      <circle cx="14" cy="-30" r="4.2" fill="#8a5a3c"/><circle cx="26" cy="-30" r="4.2" fill="#8a5a3c"/>
      ${[[8, -38], [30, -40], [20, -44]].map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="#fff" stroke="#b3e5fc" stroke-width=".8">${anim('cy', `${p[1]};${p[1] - 6}`, 1.2, i * .4)}${anim('opacity', '1;0', 1.2, i * .4)}</circle>`).join('')}
      <rect x="-14" y="-12" width="14" height="8" rx="3" fill="#f48fb1"/></g>`;
  }
  function net(x, y, s) {
    return `<g transform="${T(x, y, s)}"><rect x="-40" y="-14" width="80" height="6" fill="#8d6e63"/><rect x="-38" y="-8" width="5" height="8" fill="#6d4c41"/><rect x="33" y="-8" width="5" height="8" fill="#6d4c41"/>
      <rect x="-38" y="-24" width="76" height="10" rx="4" fill="#fff3e0"/><circle cx="-14" cy="-30" r="7" fill="#8a5a3c"/><path d="M-20 -26 Q0 -34 30 -24 L30 -17 L-20 -17Z" fill="#26a69a"/>
      <path d="M0 -92 L-44 -16 L44 -16Z" fill="#fff" opacity=".42" stroke="#fff" stroke-width="1.6"/>
      ${[-30, -15, 0, 15, 30].map((px) => `<path d="M0 -92 L${px * 1.45} -16" stroke="#fff" stroke-width=".9" opacity=".7"/>`).join('')}
      <circle cx="0" cy="-94" r="4" fill="none" stroke="#fbc02d" stroke-width="2"/></g>`;
  }
  function vaccine(x, y, s) {
    return `<g transform="${T(x, y, s)}"><path d="M0 -70 L26 -60 L26 -34 Q26 -14 0 -4 Q-26 -14 -26 -34 L-26 -60Z" fill="#2e9e5b">${scaleAnim(['1', '1.06', '1'], 1.6)}</path>
      <path d="M-11 -36 L-3 -26 L13 -48" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <g transform="translate(34 -34) rotate(-40)"><rect x="-4" y="-24" width="8" height="30" rx="2" fill="#e3f2fd" stroke="#1565c0" stroke-width="1.4"/><rect x="-4" y="-12" width="8" height="18" fill="#4fc3f7"/><rect x="-7" y="-26" width="14" height="3" fill="#1565c0"/><rect x="-1" y="-38" width="2" height="12" fill="#1565c0"/><rect x="-1" y="6" width="2" height="12" fill="#90a4ae"/></g>
      <circle cx="-30" cy="-72" r="3" fill="#ffe27a">${anim('opacity', '0;1;0', 1.3)}</circle></g>`;
  }
  function cookpot(x, y, s) {
    return `<g transform="${T(x, y, s)}"><rect x="-26" y="-6" width="52" height="8" rx="4" fill="#5d4037"/>
      <g transform="translate(-9 -6)"><g>${scaleAnim(['1 1', '1 1.35', '1 .9', '1 1'], .7)}<path d="M0 0 Q-8 -10 0 -24 Q4 -14 8 -8 Q10 -2 0 0Z" fill="#ff7043"/><path d="M0 0 Q-3 -6 1 -13 Q4 -8 4 -3Z" fill="#ffd54f"/></g></g>
      <g transform="translate(9 -6)"><g>${scaleAnim(['1 1', '1 1.25', '1 .85', '1 1'], .6, .2)}<path d="M0 0 Q-7 -9 0 -20 Q4 -12 7 -6 Q9 -2 0 0Z" fill="#ff8a65"/></g></g>
      <path d="M-24 -30 L24 -30 L20 -50 L-20 -50Z" fill="#37474f" transform="translate(0 -4)"/><rect x="-26" y="-56" width="52" height="5" rx="2" fill="#455a64"/>
      ${[-10, 2, 12].map((px, i) => `<path d="M${px} -62 q4 -8 0 -16 t0 -14" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0">${anim('opacity', '0;.8;0', 1.6, i * .5)}${moveAnim([[0, 0], [0, -8]], 1.6, i * .5)}</path>`).join('')}</g>`;
  }
  function jar(x, y, s) {
    return `<g transform="${T(x, y, s)}"><path d="M-14 -34 Q-24 -16 -12 0 L12 0 Q24 -16 14 -34Z" fill="#bf6a3a"/><rect x="-10" y="-42" width="20" height="10" rx="3" fill="#a5562c"/>
      <ellipse cx="0" cy="-44" rx="13" ry="4" fill="#795548"/><path d="M-12 -20 L12 -20" stroke="#8d4a22" stroke-width="2"/>
      <g transform="translate(26 -50)"><circle r="9" fill="#2e9e5b">${scaleAnim(['1', '1.12', '1'], 1.4)}</circle><path d="M-4 0 L-1 3 L5 -4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/></g></g>`;
  }
  function clinic(x, y, s) {
    return `<g transform="${T(x, y, s)}"><rect x="-44" y="-52" width="88" height="52" fill="#f5f5f5"/><path d="M-50 -52 L0 -78 L50 -52Z" fill="#2e9e5b"/>
      <rect x="-9" y="-30" width="18" height="30" rx="2" fill="#5d4037"/><rect x="-36" y="-40" width="18" height="14" fill="#90caf9"/><rect x="18" y="-40" width="18" height="14" fill="#90caf9"/>
      <g transform="translate(0 -62)"><rect x="-8" y="-3" width="16" height="6" fill="#e53935"/><rect x="-3" y="-8" width="6" height="16" fill="#e53935"/></g></g>`;
  }
  function meat(x, y, s) {
    return `<g transform="${T(x, y, s)}"><rect x="-30" y="-26" width="60" height="5" fill="#a1887f"/><rect x="-26" y="-21" width="4" height="21" fill="#795548"/><rect x="22" y="-21" width="4" height="21" fill="#795548"/>
      <path d="M-24 -26 Q-22 -38 -10 -36 Q-4 -30 -6 -26Z" fill="#c62828"/><path d="M0 -26 Q2 -40 14 -37 Q22 -32 18 -26Z" fill="#b71c1c"/><path d="M-18 -30 l4 -2 M8 -32 l5 -1" stroke="#ef9a9a" stroke-width="1.5"/>
      ${fly(-20, -46, 1.2)}${fly(0, -44, 1.6)}</g>`;
  }
  function shroud(x, y, s) {
    return `<g transform="${T(x, y, s)}"><rect x="-34" y="-8" width="68" height="8" rx="3" fill="#8d6e63"/><path d="M-32 -8 Q-34 -22 -20 -22 L28 -22 Q36 -22 34 -8Z" fill="#fafafa" stroke="#cfd8dc" stroke-width="1.2"/>
      <path d="M-14 -22 L-14 -8 M10 -22 L10 -8" stroke="#cfd8dc" stroke-width="1"/></g>`;
  }
  function alertTri(x, y, s) {
    return `<g transform="translate(${x} ${y})"><g>${scaleAnim(['1', '1.18', '1'], .8)}<g transform="scale(${s})"><path d="M0 -24 L24 18 L-24 18Z" fill="#ffc400" stroke="#c62828" stroke-width="4" stroke-linejoin="round"/>
      <rect x="-2.6" y="-9" width="5.2" height="16" rx="2" fill="#c62828"/><circle cx="0" cy="12" r="3" fill="#c62828"/></g></g></g>`;
  }
  function check(x, y, s, b) {
    return `<g transform="translate(${x} ${y})"><g>${scaleAnim(['0', '1.15', '1', '1'], 2.4, b)}<circle r="${12 * s}" fill="#2e9e5b" stroke="#fff" stroke-width="2"/><path d="M${-5 * s} ${s} L${-1 * s} ${5 * s} L${6 * s} ${-4 * s}" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;
  }
  function arrow(x1, y1, x2, y2, col) {
    const a = Math.atan2(y2 - y1, x2 - x1), h = 9;
    const p = (ang, r) => `${(x2 - Math.cos(ang) * r).toFixed(1)},${(y2 - Math.sin(ang) * r).toFixed(1)}`;
    return `<path d="M${x1} ${y1} L${x2 - Math.cos(a) * 6} ${y2 - Math.sin(a) * 6}" stroke="${col}" stroke-width="4" stroke-dasharray="9 6" stroke-linecap="round" fill="none">${anim('stroke-dashoffset', '30;0', .7)}</path>
      <polygon points="${x2},${y2} ${p(a - .45, h)} ${p(a + .45, h)}" fill="${col}"/>`;
  }
  function bubble(x, y, w, lines, col) {
    const h = 8 + lines.length * 11;
    return `<g transform="translate(${x} ${y})"><g>${scaleAnim(['0.92', '1', '0.92'], 2.2)}<rect x="0" y="0" width="${w}" height="${h}" rx="9" fill="${col || '#fff'}" stroke="#263238" stroke-width="1.4"/>
      <path d="M12 ${h - 1} l5 9 l5 -9Z" fill="${col || '#fff'}" stroke="#263238" stroke-width="1.4"/><rect x="11" y="${h - 3}" width="12" height="4" fill="${col || '#fff'}"/>
      ${lines.map((t, i) => `<text x="${w / 2}" y="${15 + i * 11}" font-size="9.5" font-weight="700" text-anchor="middle" fill="#263238" font-family="Arial,sans-serif">${t}</text>`).join('')}</g></g>`;
  }
  function signal(x, y) {
    return `<g transform="translate(${x} ${y})">${[10, 18, 26].map((r, i) => `<path d="M${-r} ${-r * .5} A${r} ${r} 0 0 1 ${r} ${-r * .5}" stroke="#ffeb3b" stroke-width="3" fill="none" stroke-linecap="round" opacity="0">${anim('opacity', '0;1;0', 1.5, i * .3)}</path>`).join('')}<circle r="3" fill="#ffeb3b"/></g>`;
  }
  function nosign(x, y, r) {
    return `<g transform="translate(${x} ${y})"><circle r="${r}" fill="none" stroke="#d32f2f" stroke-width="4.5"/><path d="M${-r * .7} ${-r * .7} L${r * .7} ${r * .7}" stroke="#d32f2f" stroke-width="4.5" stroke-linecap="round"/></g>`;
  }

  /* ------------------------------- config par maladie ------------------------------- */
  // sign : signes visibles · vec : vecteur de transmission · prev : gestes de prévention
  const CFG = {
    anthrax:    { sign: ['wound'], vec: 'cowdead', prev: ['cook', 'vaccine'] },
    covid:      { sign: ['cough', 'fever'], vec: 'cough', prev: ['mask', 'handwash'] },
    cholera:    { sign: ['belly', 'drop'], vec: 'dirtywater', prev: ['handwash', 'cleanwater'] },
    dengue:     { sign: ['fever', 'headache'], vec: 'mosq', prev: ['net', 'bucket'] },
    fj:         { sign: ['fever', 'headache'], vec: 'mosq', prev: ['vaccine', 'net'] },
    grippe:     { sign: ['cough', 'fever'], vec: 'chicken', prev: ['handwash', 'cook'] },
    hanta:      { sign: ['fever', 'cough'], vec: 'rat', prev: ['closed', 'handwash'] },
    lassa:      { sign: ['fever', 'bleed'], vec: 'rat', prev: ['closed', 'handwash'] },
    meningite:  { sign: ['headache', 'stiff', 'fever'], vec: 'cough', prev: ['vaccine', 'mask'] },
    mpox:       { sign: ['rash', 'fever'], vec: 'monkey', prev: ['handwash', 'distance'] },
    ebola:      { sign: ['fever', 'bleed'], vec: 'bat', prev: ['handwash', 'distance'] },
    pfa:        { sign: ['limp'], vec: 'dirtywater', prev: ['vaccine', 'handwash'] },
    rage:       { sign: ['bite'], vec: 'dog', prev: ['dogvax', 'handwash'] },
    rougeole:   { sign: ['rash', 'fever', 'cough'], vec: 'cough', prev: ['vaccine'] },
    shigellose: { sign: ['belly', 'fever'], vec: 'dirtywater', prev: ['handwash', 'cleanwater'] },
    deces:      { sign: ['belly'], vec: 'clinic', prev: ['clinic', 'handwash'], woman: true }
  };
  const IDS = Object.keys(CFG);

  function cast(id) {
    const k = Math.max(0, IDS.indexOf(id));
    return {
      sickSkin: SKIN[(k + 1) % 4], sickShirt: SHIRTS[k % 6], sickPants: PANTS[k % 4],
      v1: { skin: SKIN[(k + 2) % 4], shirt: SHIRTS[(k + 2) % 6], pants: PANTS[(k + 1) % 4] },
      v2: { skin: SKIN[k % 4], shirt: SHIRTS[(k + 4) % 6], pants: PANTS[(k + 3) % 4] }
    };
  }
  const RC = (o) => person(Object.assign({ role: 'RC', shirt: '#f4f1e8', skin: SKIN[1], pants: '#37474f' }, o));
  const ASCQ = (o) => person(Object.assign({ role: 'ASCQ', shirt: '#f4f1e8', skin: SKIN[2], pants: '#263238' }, o));

  /* ------------------------------ éléments de mise en scène ------------------------------ */
  function prop(type, x, y, s) {
    switch (type) {
      case 'cowdead': return cow(x, y, s, true);
      case 'meat': return meat(x, y, s);
      case 'chicken': return chicken(x, y, s, true) + chicken(x + 36, y + 6, s * .9, true);
      case 'rat': return rat(x, y, s);
      case 'monkey': return monkey(x, y, s);
      case 'bat': return bat(x + 10, y - 62, s) + shroud(x + 20, y, s);
      case 'dog': return dog(x, y, s, true);
      case 'dirtywater': return bucket(x, y, s, 'dirty');
      case 'cleanwater': return bucket(x, y, s, 'clean') + jar(x + 40, y, s * .9);
      case 'bucket': return bucket(x, y, s, 'stagnant', true);
      case 'handwash': return handwash(x, y, s);
      case 'net': return net(x, y, s);
      case 'vaccine': return vaccine(x, y, s);
      case 'cook': return cookpot(x, y, s);
      case 'closed': return jar(x, y, s);
      case 'dogvax': return dog(x - 6, y, s * .9, false) + vaccine(x + 50, y, s * .65);
      case 'clinic': return clinic(x, y, s);
      default: return '';
    }
  }

  /* --------------------------------- composition --------------------------------- */
  function compose(id, slide) {
    const c = CFG[id] || CFG.covid, cs = cast(id), kind = slide.kind, blk = slide.blk || '';
    const woman = !!c.woman;
    const sick = (extra) => person(Object.assign({ x: 275, skin: cs.sickSkin, shirt: cs.sickShirt, pants: cs.sickPants, woman, belly: woman,
      pose: c.sign.includes('cough') ? 'cough' : 'sick', face: 'sad', fx: c.sign, sway: true, wrap: '#f39c12', dress: '#8e44ad', flip: true }, extra || {}));
    let o = '';

    if (kind === 'intro') {
      o += bg('day');
      o += person(Object.assign({ x: 300, y: 246, s: .9, flip: true, woman: true, wrap: '#e84393', dress: '#16a085' }, cs.v1));
      o += person(Object.assign({ x: 352, y: 240, s: .8, flip: true }, cs.v2));
      o += RC({ x: 140, y: 258, s: 1.15, pose: 'wave', talk: true });
      o += `<g transform="translate(240 80)"><g>${scaleAnim(['1', '1.08', '1'], 2)}<circle r="30" fill="#fff" opacity=".92"/><text y="12" font-size="34" text-anchor="middle">${slide.icon || ''}</text></g></g>`;
    } else if (kind === 'outro' || blk === 'block-cat') {
      o += bg('day') + clinic(210, 214, .8);
      o += RC({ x: 105, y: 258, s: 1.15, pose: 'phone', talk: true });
      o += ASCQ({ x: 315, y: 258, s: 1.15, pose: 'phone', flip: true });
      o += signal(165, 150) + signal(255, 150);
      o += bubble(30, 72, 96, ['Allô ASCQ !', 'Cas suspect !'], '#fff8e1');
      o += bubble(268, 72, 100, ['Bien reçu,', "j'arrive !"], '#e8f5e9');
      o += check(210, 130, 1, .6);
    } else if (blk === 'block-symptoms') {
      o += bg('day');
      o += RC({ x: 105, y: 258, s: 1.1, pose: 'point' });
      o += sick({ y: 258, s: 1.2 });
    } else if (blk === 'block-alert') {
      o += bg('alert');
      o += RC({ x: 110, y: 258, s: 1.1, pose: 'point', talk: true });
      o += sick({ y: 258, s: 1.15, shake: c.sign.includes('bleed') });
      o += alertTri(205, 112, 1.25);
    } else if (blk === 'block-transmission') {
      o += bg('day');
      const v = c.vec;
      if (v === 'cough') {
        o += sick({ x: 95, y: 258, s: 1.1, flip: false, pose: 'cough', fx: ['cough'] });
        o += person(Object.assign({ x: 285, y: 258, s: 1.1, flip: true, face: 'sad', pose: 'stand' }, cs.v1));
        o += arrow(150, 188, 238, 188, '#e53935');
      } else if (v === 'mosq') {
        o += person(Object.assign({ x: 280, y: 258, s: 1.2, flip: true, face: 'sad', woman: true, wrap: '#e84393', dress: '#16a085' }, cs.v1));
        o += mosquito(60, 120, 1.5, 7, -1) + mosquito(100, 160, 1.3, 9, -4) + mosquito(40, 190, 1.4, 8, -2);
        o += arrow(150, 190, 236, 190, '#d32f2f');
      } else if (v === 'clinic') {
        o += prop('clinic', 90, 236, 1.15);
        o += person(Object.assign({ x: 290, y: 258, s: 1.15, flip: true, woman: true, belly: true, wrap: '#f39c12', dress: '#8e44ad', face: 'sad', pose: 'walk' }, cs.v1));
        o += arrow(260, 196, 180, 196, '#2e9e5b');
      } else {
        const px = v === 'cowdead' ? 52 : (v === 'bat' ? 60 : 82);
        o += prop(v, px, 244, v === 'cowdead' ? 1 : 1.25);
        if (v === 'cowdead') o += prop('meat', 160, 244, .75);
        if (v === 'dog') o += person(Object.assign({ x: 290, y: 258, s: 1.15, flip: true, face: 'sad', fx: [] }, cs.v1));
        else o += person(Object.assign({ x: 290, y: 258, s: 1.15, flip: true, face: 'sad' }, cs.v1));
        o += arrow(v === 'cowdead' ? 190 : 160, 196, 240, 196, '#d32f2f');
      }
      o += RC({ x: 362, y: 252, s: .8, flip: true, pose: 'point' });
    } else if (blk === 'block-prevention') {
      o += bg('day');
      const items = c.prev.slice(0, 2).filter((p) => p !== 'mask' && p !== 'distance');
      const mask = c.prev.includes('mask'), dist = c.prev.includes('distance');
      const xs = items.length > 1 ? [62, 190] : [120];
      const H = { handwash: 92, net: 96, vaccine: 72, cook: 82, closed: 46, cleanwater: 46, bucket: 32, dogvax: 72, clinic: 80 };
      items.forEach((p, i) => {
        const sc = p === 'net' ? .95 : (p === 'dogvax' ? .8 : 1.1);
        o += prop(p, xs[i], 246, sc);
        o += check(xs[i] + (p === 'dogvax' ? 20 : 0), Math.max(24, 246 - (H[p] || 60) * sc - 18), 1, .5 + i * .6);
      });
      if (dist) {
        o += person(Object.assign({ x: 200, y: 258, s: 1.05 }, cs.v2)) + person(Object.assign({ x: 285, y: 258, s: 1.05, flip: true }, cs.v1));
        o += `<path d="M222 150 L262 150 M222 150 l8 -5 m-8 5 l8 5 M262 150 l-8 -5 m8 5 l-8 5" stroke="#1565c0" stroke-width="3" stroke-linecap="round" fill="none">${anim('opacity', '.4;1;.4', 1.2)}</path>`;
      } else {
        o += person(Object.assign({ x: 275, y: 258, s: 1.2, flip: true, pose: 'cheer', mask }, cs.v1));
      }
      o += RC({ x: 360, y: 252, s: .85, flip: true, pose: 'wave' });
      if (mask && items.length === 1) o += check(275, 98, 1, .4);
    } else { // block-role et par défaut
      o += bg('day');
      o += RC({ x: 105, y: 258, s: 1.2, pose: 'point', talk: true });
      o += person(Object.assign({ x: 215, y: 254, s: 1, flip: true, woman: true, wrap: '#e84393', dress: '#16a085', pose: 'cheer' }, cs.v1));
      o += person(Object.assign({ x: 275, y: 258, s: 1.1, flip: true }, cs.v2));
      o += person(Object.assign({ x: 335, y: 254, s: 1, flip: true, pose: 'cheer' }, { skin: SKIN[3], shirt: SHIRTS[(IDS.indexOf(id) + 1) % 6], pants: PANTS[2] }));
      o += bubble(60, 70, 130, ['Ensemble, protégeons', 'notre village !'], '#fff');
    }
    return o;
  }

  function bvSceneSvg(moduleId, slide) {
    let inner;
    try { inner = compose(moduleId, slide || {}); } catch (e) { inner = ''; }
    return `<svg class="bv-scene-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustration de la scène" style="overflow:visible">${inner}</svg>`;
  }

  global.bvSceneSvg = bvSceneSvg;
})(typeof window !== 'undefined' ? window : globalThis);
