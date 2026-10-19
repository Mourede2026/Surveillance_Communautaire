/**
 * SIVEC — spot d'ouverture (≈ 30 s), avec son.
 *
 * L'histoire : un matin dans un village, des enfants tombent malades (fièvre, boutons) ; la communauté
 * prévient le relais communautaire ; le RC enregistre l'alerte sur son application ; l'ASCQ et toute la
 * chaîne sont informés ; l'ASCQ investigue et la riposte s'organise ; le logo de l'application apparaît.
 *
 *  - mode 'film' : le spot complet (assets/sivec-spot.m4a pour le son) ;
 *  - mode 'logo' : uniquement la révélation du logo (≈ 4,6 s, assets/sivec-sting.m4a).
 * Dessin en canvas, sans fichier vidéo : fonctionne hors ligne. Le film est une fonction pure du temps :
 * SivecIntro.draw(ctx, t, largeur, hauteur) (utile aussi pour produire un MP4).
 *
 * SivecIntro.ouvrir({ mode: 'logo' | 'film', onFin: function (mode, termine) {} })
 */
(function (global) {
  'use strict';
  var DUREE = 30, DUREE_LOGO = 4.6, T_FINAL = 25.0, LOGO_URL = 'assets/sivec-logo.png', LOGO = null;
  var SON = { film: 'assets/sivec-spot.m4a', logo: 'assets/sivec-sting.m4a' };
  var C = { t9: '#0B3D3A', t7: '#0E5E59', t5: '#157A72', amber: '#E8A33D', red: '#DC2626', green: '#16A34A', soft: '#B9D3CF' };
  var POLICE = 'Arial, Helvetica, sans-serif';
  var PEAU = ['#8B5A3C', '#7A4B2E', '#9A6A48', '#6E4128'];

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function eOut(p) { return 1 - Math.pow(1 - p, 3); }
  function eBack(p) { var c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }
  function eIO(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function disque(ctx, x, y, r, fill) { if (r <= 0) return; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function demi(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0, false); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  function texte(ctx, s, x, y, taille, couleur, gras, align) {
    ctx.font = (gras ? 'bold ' : '') + taille + 'px ' + POLICE; ctx.fillStyle = couleur; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
  }
  function lignes(ctx, s, maxW, taille, gras) {
    ctx.font = (gras ? 'bold ' : '') + taille + 'px ' + POLICE;
    var mots = s.split(' '), out = [], cur = '';
    for (var i = 0; i < mots.length; i++) {
      var essai = cur ? cur + ' ' + mots[i] : mots[i];
      if (ctx.measureText(essai).width > maxW && cur) { out.push(cur); cur = mots[i]; } else cur = essai;
    }
    if (cur) out.push(cur); return out;
  }
  function motSivec(ctx, cx, y, taille, t, t0) {
    var lettres = 'SIVEC'.split(''), esp = taille * 0.22, larg = [], total = 0, i;
    ctx.font = 'bold ' + taille + 'px ' + POLICE;
    for (i = 0; i < lettres.length; i++) { larg.push(ctx.measureText(lettres[i]).width); total += larg[i]; }
    total += esp * (lettres.length - 1); var x = cx - total / 2;
    for (i = 0; i < lettres.length; i++) {
      var a = eOut(seg(t, t0 + i * 0.12, t0 + 0.35 + i * 0.12)); ctx.save(); ctx.globalAlpha *= a;
      texte(ctx, lettres[i], x + larg[i] / 2, y + (1 - a) * 22, taille, '#FFFFFF', true); ctx.restore(); x += larg[i] + esp;
    }
  }
  function caption(ctx, V, s, t0, t1, t) {
    var a = seg(t, t0, t0 + 0.35) * (1 - seg(t, t1 - 0.3, t1)); if (a <= 0) return;
    var taille = V.p ? 36 : 38, maxW = V.w * (V.p ? 0.80 : 0.74), ls = lignes(ctx, s, maxW, taille, true);
    var h = ls.length * taille * 1.3 + 34, y = V.h - (V.p ? 170 : 104) - h / 2 + 10;
    ctx.save(); ctx.globalAlpha *= a; rr(ctx, V.w * 0.06, y, V.w * 0.88, h, 22); ctx.fillStyle = 'rgba(5,30,28,0.78)'; ctx.fill();
    for (var i = 0; i < ls.length; i++) texte(ctx, ls[i], V.w / 2, y + 17 + taille * 0.65 + i * taille * 1.3, taille, '#FFFFFF', true);
    ctx.restore();
  }

  // ---------- Personnages (dessin plat) ----------
  function pers(ctx, x, y, h, o, t) {
    o = o || {}; var s = h / 120, d = o.dir || 1, pas = o.walk ? Math.sin(t * 9) : 0, bob = o.walk ? Math.abs(Math.sin(t * 9)) * 3 * s : 0, peau = o.peau || PEAU[0];
    ctx.save(); ctx.translate(x, y); ctx.save(); ctx.scale(1, 0.22); disque(ctx, 0, 0, 28 * s, 'rgba(0,0,0,0.15)'); ctx.restore();
    ctx.translate(0, -bob); ctx.scale(d, 1); ctx.lineCap = 'round';
    ctx.strokeStyle = o.bas || '#2B2B2B'; ctx.lineWidth = 9 * s;
    ctx.beginPath(); ctx.moveTo(-8 * s, -48 * s); ctx.lineTo(-8 * s + pas * 12 * s, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8 * s, -48 * s); ctx.lineTo(8 * s - pas * 12 * s, 0); ctx.stroke();
    rr(ctx, -20 * s, -100 * s, 40 * s, 58 * s, 10 * s); ctx.fillStyle = o.haut || '#157A72'; ctx.fill();
    if (o.gilet) { rr(ctx, -20 * s, -100 * s, 15 * s, 58 * s, 6 * s); ctx.fillStyle = o.gilet; ctx.fill(); rr(ctx, 5 * s, -100 * s, 15 * s, 58 * s, 6 * s); ctx.fill(); }
    if (o.badge) texte(ctx, o.badge, 0, -78 * s, 9.5 * s, '#FFFFFF', true);
    if (o.croix) { ctx.fillStyle = '#DC2626'; ctx.fillRect(-2 * s, -92 * s, 4 * s, 14 * s); ctx.fillRect(-7 * s, -87 * s, 14 * s, 4 * s); }
    ctx.strokeStyle = peau; ctx.lineWidth = 8 * s; var pose = o.pose || 'bas';
    if (pose === 'haut') {
      ctx.beginPath(); ctx.moveTo(-18 * s, -92 * s); ctx.lineTo(-24 * s, -62 * s + pas * 6 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(18 * s, -92 * s); ctx.lineTo(36 * s, -126 * s); ctx.stroke();
    } else if (pose === 'tel' || pose === 'tablette') {
      ctx.beginPath(); ctx.moveTo(-18 * s, -92 * s); ctx.lineTo(8 * s, -76 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(18 * s, -92 * s); ctx.lineTo(12 * s, -74 * s); ctx.stroke();
      if (pose === 'tel') { rr(ctx, 4 * s, -92 * s, 15 * s, 26 * s, 3 * s); ctx.fillStyle = '#111'; ctx.fill(); rr(ctx, 6 * s, -89 * s, 11 * s, 20 * s, 2 * s); ctx.fillStyle = '#8EE3D8'; ctx.fill(); }
      else { rr(ctx, -6 * s, -92 * s, 38 * s, 26 * s, 4 * s); ctx.fillStyle = '#1B2A3A'; ctx.fill(); rr(ctx, -3 * s, -89 * s, 32 * s, 20 * s, 3 * s); ctx.fillStyle = '#7FD1C7'; ctx.fill(); }
    } else if (pose === 'porter') {
      ctx.beginPath(); ctx.moveTo(-18 * s, -92 * s); ctx.lineTo(10 * s, -70 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(18 * s, -92 * s); ctx.lineTo(12 * s, -68 * s); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-18 * s, -92 * s); ctx.lineTo(-26 * s, -64 * s + pas * 6 * s, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(18 * s, -92 * s); ctx.lineTo(26 * s, -66 * s - pas * 6 * s); ctx.stroke();
    }
    disque(ctx, 0, -116 * s, 17 * s, peau); disque(ctx, 6 * s, -118 * s, 1.8 * s, '#222'); disque(ctx, -3 * s, -118 * s, 1.6 * s, '#222');
    var hat = o.hat || 'cheveux';
    if (hat === 'casquette') { demi(ctx, 0, -120 * s, 18 * s, o.chap || '#2563EB'); ctx.fillRect(-2 * s, -121 * s, 26 * s, 6 * s); if (o.casqText) texte(ctx, o.casqText, 4 * s, -128 * s, 8 * s, '#FFFFFF', true); }
    else if (hat === 'foulard') { demi(ctx, 0, -120 * s, 19 * s, o.chap || '#F2C14E'); disque(ctx, -2 * s, -137 * s, 8 * s, o.chap || '#F2C14E'); }
    else if (hat === 'paille') { rr(ctx, -31 * s, -129 * s, 62 * s, 7 * s, 3 * s); ctx.fillStyle = '#D9B26C'; ctx.fill(); demi(ctx, 0, -128 * s, 15 * s, '#D9B26C'); }
    else if (hat === 'blouse') { demi(ctx, 0, -120 * s, 18 * s, '#FFFFFF'); }
    else demi(ctx, 0, -121 * s, 17.5 * s, '#1B1B1B');
    ctx.restore();
  }
  var TACHES = [[-4, -4], [6, 3], [-8, 6], [2, -9], [9, -3], [-1, 9]];
  function taches(ctx, x, y, s, a) { for (var i = 0; i < TACHES.length; i++) disque(ctx, x + TACHES[i][0] * s, y + TACHES[i][1] * s, 2.4 * s, 'rgba(185,28,28,' + a + ')'); }
  function enfantPorte(ctx, x, y, h, t) {
    var s = h / 120; ctx.save(); ctx.translate(x, y); rr(ctx, -34 * s, -96 * s, 34 * s, 46 * s, 12 * s); ctx.fillStyle = '#F9A8D4'; ctx.fill();
    disque(ctx, -12 * s, -104 * s, 13 * s, PEAU[2]); taches(ctx, -12 * s, -104 * s, 1.2 * s, 0.9); ctx.restore();
  }
  function enfantCouche(ctx, x, y, t) {
    ctx.save(); ctx.translate(x, y); rr(ctx, -78, -10, 190, 14, 6); ctx.fillStyle = '#B8452E'; ctx.fill(); ctx.fillStyle = '#E8A33D'; ctx.fillRect(-60, -7, 150, 3);
    rr(ctx, -44, -46, 96, 36, 16); ctx.fillStyle = '#60A5FA'; ctx.fill(); rr(ctx, 46, -36, 54, 18, 9); ctx.fillStyle = '#374151'; ctx.fill();
    disque(ctx, -60, -40, 21, PEAU[3]); demi(ctx, -60, -44, 21, '#1B1B1B'); taches(ctx, -60, -38, 1.5, 0.95);
    disque(ctx, -20, -30, 2.6, '#B91C1C'); disque(ctx, 2, -34, 2.6, '#B91C1C'); disque(ctx, 22, -28, 2.6, '#B91C1C');
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(220,38,38,0.6)'; ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) { ctx.beginPath(); for (var k = 0; k <= 10; k++) { var yy = -76 - k * 3.2, xx = -60 + i * 22 - 22 + Math.sin(t * 3 + k * 0.8 + i) * 5; if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); } ctx.stroke(); }
    ctx.restore();
  }
  function bulle(ctx, x, y, type, a) {
    if (a <= 0) return; var sc = eBack(clamp(a, 0, 1)); ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.globalAlpha *= clamp(a * 1.5, 0, 1);
    rr(ctx, -36, -54, 72, 52, 16); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(0, 12); ctx.lineTo(8, -4); ctx.closePath(); ctx.fill();
    if (type === 'taches') { disque(ctx, -12, -30, 6, '#DC2626'); disque(ctx, 4, -36, 6, '#DC2626'); disque(ctx, 14, -22, 6, '#DC2626'); disque(ctx, -2, -20, 6, '#DC2626'); }
    else if (type === '!') { disque(ctx, 0, -28, 18, '#DC2626'); texte(ctx, '!', 0, -27, 28, '#FFFFFF', true); }
    else texte(ctx, type, 0, -28, 32, '#17231F', true);
    ctx.restore();
  }
  function balise(ctx, x, y, t, t0, tg) {
    if (t < t0) return; var pop = eBack(seg(t, t0, t0 + 0.45)), vert = t >= tg, r = 22 * pop;
    ctx.save(); ctx.translate(x, y);
    if (!vert) { for (var k = 0; k < 2; k++) { var ph = ((t - t0) * 0.9 + k * 0.5) % 1; ctx.beginPath(); ctx.arc(0, 0, 22 + ph * 40, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(220,38,38,' + (0.6 * (1 - ph)) + ')'; ctx.lineWidth = 4; ctx.stroke(); } }
    var sv = vert ? 1 + 0.25 * Math.sin(clamp((t - tg) * 6, 0, Math.PI)) : 1;
    disque(ctx, 0, 0, r * sv + 4, '#FFFFFF'); disque(ctx, 0, 0, r * sv, vert ? C.green : C.red); texte(ctx, vert ? '✓' : '!', 0, 1, 30 * pop * sv, '#FFFFFF', true);
    ctx.restore();
  }

  // ---------- Le village (décor) ----------
  function maison(ctx, x, y, w, h, mur, toit, glow) {
    ctx.fillStyle = mur; ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 14, y - h); ctx.lineTo(x, y - h - h * 0.66); ctx.lineTo(x + w / 2 + 14, y - h); ctx.closePath(); ctx.fillStyle = toit; ctx.fill();
    ctx.fillStyle = 'rgba(60,40,20,0.8)'; ctx.fillRect(x - 13, y - h * 0.66, 26, h * 0.66);
    ctx.fillStyle = glow ? 'rgba(255,120,100,0.9)' : 'rgba(255,255,255,0.75)'; ctx.fillRect(x + w / 2 - 34, y - h * 0.8, 20, 20);
  }
  function arbre(ctx, x, y, s) {
    ctx.fillStyle = '#7A5230'; ctx.fillRect(x - 7 * s, y - 70 * s, 14 * s, 70 * s);
    disque(ctx, x, y - 96 * s, 46 * s, '#3F9B5A'); disque(ctx, x - 30 * s, y - 72 * s, 32 * s, '#4DAF68'); disque(ctx, x + 30 * s, y - 74 * s, 32 * s, '#368C50');
  }
  function oiseau(ctx, x, y, t, s) { var f = Math.sin(t * 10) * 7 * s; ctx.strokeStyle = '#4B3A2A'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 14 * s, y - f); ctx.quadraticCurveTo(x - 6 * s, y - 8 * s, x, y); ctx.quadraticCurveTo(x + 6 * s, y - 8 * s, x + 14 * s, y - f); ctx.stroke(); }
  function fxVillage(t, V) {
    if (!V.p) return 640;
    if (t < 4.5) return lerp(860, 440, eIO(seg(t, 0.2, 4.4)));
    if (t < 7.0) return 440;
    if (t < 9.0) return lerp(440, 840, eIO(seg(t, 7.0, 8.6)));
    if (t < 9.6) return lerp(840, 640, eIO(seg(t, 9.0, 9.6)));
    return 640;
  }
  function village(ctx, t, V) {
    var Z = V.p ? 1.5 : 1.2, fx = fxVillage(t, V), tension = 0.22 * seg(t, 4.6, 6.0) * (1 - seg(t, 12.0, 13.2)) * (t < 15 ? 1 : 0);
    ctx.save(); ctx.translate(V.w / 2, V.h / 2 - (V.p ? 80 : 130)); ctx.scale(Z, Z); ctx.translate(-fx, -360);
    var g = ctx.createLinearGradient(0, -500, 0, 540); g.addColorStop(0, '#FFC98A'); g.addColorStop(0.6, '#FFF0D6'); g.addColorStop(1, '#FDF8EC');
    ctx.fillStyle = g; ctx.fillRect(fx - 3000, -1500, 6000, 2040);
    var lever = t >= 15 ? 1 : eOut(seg(t, 0, 4.2)), sy = lerp(400, 250, lever), pulse = 1 + Math.sin(t * 2) * 0.04;
    disque(ctx, 1010, sy, 58 * pulse, '#FFC857'); disque(ctx, 1010, sy, 96 * pulse, 'rgba(255,200,87,0.25)');
    ctx.fillStyle = '#A7D3A0'; ctx.beginPath(); ctx.arc(300, 760, 340, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(1000, 790, 380, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8FC48B'; ctx.fillRect(fx - 3000, 520, 6000, 2000);
    ctx.fillStyle = '#C79A62'; ctx.fillRect(fx - 3000, 556, 6000, 34);
    arbre(ctx, 40, 540, 1.2); arbre(ctx, 1240, 540, 1.1); arbre(ctx, 640, 515, 0.7);
    var glows = t >= 7.8 && t < 23.3;
    maison(ctx, 180, 540, 130, 92, '#F4DDB5', '#B5502F', false); maison(ctx, 420, 540, 138, 98, '#EBCB98', '#A3412A', false);
    maison(ctx, 840, 540, 134, 94, '#F6E3C4', '#C0603B', false); maison(ctx, 1100, 540, 140, 100, '#EBCB98', '#A3412A', glows);
    if (t < 4.6) { oiseau(ctx, lerp(100, 900, seg(t, 0.4, 4.4)), 270 + Math.sin(t * 2) * 12, t, 1); oiseau(ctx, lerp(40, 840, seg(t, 0.7, 4.6)), 320 + Math.sin(t * 2 + 1) * 10, t + 1, 0.8); }
    acteurs(ctx, t);
    ctx.restore();
    if (tension > 0) { ctx.save(); ctx.globalAlpha *= tension; ctx.fillStyle = '#1B1030'; ctx.fillRect(EXT.x, EXT.y, EXT.w, EXT.h); ctx.restore(); }
  }

  // ---------- Les acteurs du récit ----------
  function marche(t, a, b, x0, x1) { return lerp(x0, x1, eIO(seg(t, a, b))); }
  function enMarche(t, a, b) { return t > a && t < b; }
  function acteurs(ctx, t) {
    var Y = 606, H = 178, HC = 118;
    // villageois ordinaires
    var kx = 560 + Math.sin(t * 1.6) * 40; if (t < 9.4) pers(ctx, kx, Y + 6, HC, { haut: '#F59E0B', peau: PEAU[2], dir: Math.cos(t * 1.6) > 0 ? 1 : -1, walk: true }, t);
    // enfant malade allongé (maison de droite)
    var ce = eBack(seg(t, 5.7, 6.3)); if (ce > 0) { ctx.save(); ctx.translate(950, Y + 4); ctx.scale(clamp(ce, 0, 1.1), clamp(ce, 0, 1.1)); enfantCouche(ctx, 0, 0, t); ctx.restore(); }
    // la mère et l'enfant malade
    var mx = marche(t, 9.0, 10.6, 440, 610), mw = enMarche(t, 9.0, 10.6);
    var bw = t >= 5.0;
    { pers(ctx, mx, Y, H, { haut: '#F2C14E', bas: '#7C3AED', hat: 'foulard', chap: '#F2C14E', pose: bw ? 'porter' : 'bas', walk: mw, dir: 1 }, t); if (bw) enfantPorte(ctx, mx, Y, H, t); }
    // l'ancien
    var ex = marche(t, 9.2, 10.4, 1010, 800); pers(ctx, ex, Y, H, { haut: '#F4DDB5', bas: '#8B7355', hat: 'paille', peau: PEAU[1], dir: -1, walk: enMarche(t, 9.2, 10.4), pose: (t > 11.0 && t < 12.6) ? 'haut' : 'bas' }, t);
    // le relais communautaire
    if (t > 9.0) { var rx = marche(t, 9.0, 10.8, 1330, 700); pers(ctx, rx, Y, H, { haut: '#157A72', gilet: '#8B5E34', hat: 'casquette', chap: '#2563EB', casqText: 'RC', dir: -1, walk: enMarche(t, 9.0, 10.8), pose: (t > 12.2 && t < 13.4) ? 'tel' : 'bas' }, t); }
    // bulles de dialogue
    bulle(ctx, mx - 10, Y - H - 12, 'taches', seg(t, 10.7, 11.1) * (1 - seg(t, 12.2, 12.5)));
    bulle(ctx, ex, Y - H - 12, '!', seg(t, 11.2, 11.6) * (1 - seg(t, 12.4, 12.7)));
    // balises de cas
    var tg = [23.3, 23.7, 24.1];
    balise(ctx, mx - 8, Y - H - 86, t, 5.2, tg[0]);
    balise(ctx, 950, Y - 150, t, 6.5, tg[1]); balise(ctx, 1100, 395, t, 7.7, tg[2]);
    // l'équipe de riposte
    if (t > 21.4) {
      pers(ctx, marche(t, 21.6, 23.2, 20, 470), Y, H, { haut: '#3B82F6', gilet: '#6B7280', hat: 'casquette', chap: '#374151', badge: 'ASCQ', pose: t > 23.3 ? 'tablette' : 'bas', walk: enMarche(t, 21.6, 23.2), dir: 1, peau: PEAU[1] }, t);
      pers(ctx, marche(t, 21.8, 23.4, -40, 540), Y, H, { haut: '#FFFFFF', bas: '#1F4E79', hat: 'blouse', croix: true, walk: enMarche(t, 21.8, 23.4), dir: 1, pose: 'porter' }, t);
      pers(ctx, marche(t, 21.6, 23.2, 1330, 870), Y, H, { haut: '#16A34A', bas: '#374151', hat: 'cheveux', walk: enMarche(t, 21.6, 23.2), dir: -1, pose: 'porter', peau: PEAU[3] }, t);
      var sc = seg(t, 23.4, 24.0) * (1 - seg(t, 25.0, 25.4));
      if (sc > 0) { var cs = ['Soins', 'Vaccination', 'Information'], ws = [100, 160, 160], cx0 = 640 - 214; ctx.save(); ctx.globalAlpha *= sc; for (var i = 0; i < 3; i++) { rr(ctx, cx0, 300, ws[i], 40, 20); ctx.fillStyle = C.green; ctx.fill(); texte(ctx, cs[i], cx0 + ws[i] / 2, 321, 20, '#FFFFFF', true); cx0 += ws[i] + 14; } ctx.restore(); }
    }
  }

  // ---------- Le téléphone du RC ----------
  function ecranTel(ctx, t, V) {
    var lt = t - 12.9, cx = V.w / 2, cy = V.p ? V.h * 0.40 : V.h * 0.46, pw = 300, ph = 500, k = V.p ? 1 : 0.80, x = cx - pw / 2, y = cy - ph / 2;
    var entree = eOut(seg(lt, 0.2, 0.9));
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); ctx.translate(0, (1 - entree) * 60); ctx.globalAlpha *= entree;
    rr(ctx, x - 12, y - 12, pw + 24, ph + 24, 46); ctx.fillStyle = '#10211F'; ctx.fill(); rr(ctx, x, y, pw, ph, 36); ctx.fillStyle = '#F3F7F6'; ctx.fill();
    ctx.save(); rr(ctx, x, y, pw, ph, 36); ctx.clip();
    ctx.fillStyle = C.t7; ctx.fillRect(x, y, pw, 78); disque(ctx, x + 38, y + 44, 17, '#FFFFFF'); disque(ctx, x + 38, y + 44, 8, C.amber); texte(ctx, 'SIVEC', x + 70, y + 44, 26, '#FFFFFF', true, 'left');
    texte(ctx, 'Notifier une alerte', cx, y + 118, 24, C.t9, true);
    var champs = [['Événement', 'Fièvre + boutons'], ['Village', 'Mon village'], ['Nombre de cas', '3 enfants']];
    for (var i = 0; i < 3; i++) {
      var a = eOut(seg(lt, 0.9 + i * 0.45, 1.4 + i * 0.45)); ctx.save(); ctx.globalAlpha *= a;
      var fy = y + 150 + i * 82 + (1 - a) * 14; texte(ctx, champs[i][0], x + 28, fy, 16, '#55655F', false, 'left');
      rr(ctx, x + 24, fy + 14, pw - 48, 40, 10); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = '#C9D4D1'; ctx.lineWidth = 1.5; ctx.stroke();
      texte(ctx, champs[i][1], x + 38, fy + 35, 19, '#17231F', true, 'left'); ctx.restore();
    }
    var by = y + ph - 76, press = seg(lt, 2.7, 3.0);
    rr(ctx, x + 24, by, pw - 48, 54, 14); ctx.fillStyle = press > 0.5 ? '#C9871F' : C.amber; ctx.fill(); texte(ctx, 'Envoyer l’alerte', cx, by + 27, 22, '#1B1B1B', true);
    if (lt > 2.8) { var r = seg(lt, 2.8, 3.5); ctx.beginPath(); ctx.arc(cx + 50, by + 30, 10 + r * 80, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - r)) + ')'; ctx.lineWidth = 6; ctx.stroke(); }
    var toast = eBack(seg(lt, 3.2, 3.8)); if (toast > 0) { ctx.save(); ctx.translate(0, (1 - toast) * 60); rr(ctx, x + 18, y + ph - 154, pw - 36, 56, 14); ctx.fillStyle = C.green; ctx.fill(); texte(ctx, '✔ Alerte envoyée', cx, y + ph - 126, 22, '#FFFFFF', true); ctx.restore(); }
    ctx.restore();
    var f = eOut(seg(lt, 2.0, 2.7)), dx = x + pw * 0.78 + (1 - f) * 120, dy = by + 36 + (1 - f) * 150;
    if (lt > 2.0 && lt < 3.8) { ctx.globalAlpha *= 0.9 * (1 - seg(lt, 3.4, 3.8)); disque(ctx, dx, dy, 22, '#E0B08B'); }
    ctx.restore();
    var ond = seg(lt, 3.4, 4.8); for (var j = 0; j < 3; j++) {
      var p2 = clamp(ond * 1.4 - j * 0.25, 0, 1); if (p2 <= 0 || p2 >= 1) continue;
      ctx.beginPath(); ctx.arc(cx, y * 1 + 0, 40 + p2 * 200, -Math.PI * 0.82, -Math.PI * 0.18, false); ctx.strokeStyle = 'rgba(232,163,61,' + (0.9 * (1 - p2)) + ')'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke();
    }
  }

  // ---------- La chaîne : tout le système est informé ----------
  var NOEUDS = [['RC', 'Village', '#DC2626'], ['ASCQ', 'Arrondissement', '#EA580C'], ['PF', 'Commune', '#CA8A04'], ['RCSE', 'Zone sanitaire', '#16A34A'], ['DDS', 'Département', '#2563EB'], ['National', 'Pays', '#7C3AED']];
  function chaine(ctx, t, V) {
    var lt = t - 17.4, n = NOEUDS.length, pos = [], i, r = V.p ? 30 : 36;
    for (i = 0; i < n; i++) pos.push(V.p ? { x: V.w * 0.30, y: V.h * (0.22 + i * 0.085) } : { x: V.w * (0.12 + i * 0.152), y: V.h * 0.42 });
    texte(ctx, 'Du village au niveau national', V.w / 2, V.p ? V.h * 0.10 : V.h * 0.16, V.p ? 36 : 42, C.soft, true);
    var prog = eIO(seg(lt, 0.6, 3.4)) * (n - 1); ctx.lineCap = 'round'; ctx.lineWidth = 8;
    for (i = 0; i < n - 1; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[i + 1].x, pos[i + 1].y); ctx.stroke();
      var f = clamp(prog - i, 0, 1); if (f > 0) { ctx.strokeStyle = NOEUDS[i + 1][2]; ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[i].x + (pos[i + 1].x - pos[i].x) * f, pos[i].y + (pos[i + 1].y - pos[i].y) * f); ctx.stroke(); }
    }
    for (i = 0; i < n; i++) {
      var act = i === 0 ? seg(lt, 0.1, 0.6) : seg(prog, i - 0.08, i + 0.12), sc = eBack(act);
      if (act <= 0) { disque(ctx, pos[i].x, pos[i].y, r * 0.5, 'rgba(255,255,255,0.15)'); continue; }
      var dep = i === 0 ? (lt - 0.3) : (prog - (i - 0.08)) / 0.9;
      if (dep > 0 && dep < 1) { ctx.beginPath(); ctx.arc(pos[i].x, pos[i].y, r + dep * 50, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * (1 - dep)) + ')'; ctx.lineWidth = 4; ctx.stroke(); }
      disque(ctx, pos[i].x, pos[i].y, r * sc, NOEUDS[i][2]); ctx.beginPath(); ctx.arc(pos[i].x, pos[i].y, r * sc, 0, Math.PI * 2); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; ctx.stroke();
      ctx.save(); ctx.globalAlpha *= clamp(sc, 0, 1);
      if (V.p) { texte(ctx, NOEUDS[i][0], pos[i].x, pos[i].y, 20, '#FFFFFF', true); texte(ctx, NOEUDS[i][1], pos[i].x + r + 26, pos[i].y, 26, C.soft, false, 'left'); }
      else { texte(ctx, NOEUDS[i][0], pos[i].x, pos[i].y, i === 5 ? 15 : 22, '#FFFFFF', true); texte(ctx, NOEUDS[i][1], pos[i].x, pos[i].y + r + 26, 18, C.soft, false); }
      ctx.restore();
    }
    if (prog > 0 && prog < n - 1) { var k = Math.floor(prog), fr = prog - k, dx = lerp(pos[k].x, pos[k + 1].x, fr), dy = lerp(pos[k].y, pos[k + 1].y, fr); disque(ctx, dx, dy, 17, 'rgba(255,255,255,0.4)'); disque(ctx, dx, dy, 8, '#FFFFFF'); }
    var ca = eBack(seg(prog, 0.9, 1.4)); // l'ASCQ reçoit l'alerte
    if (ca > 0) {
      var cw = V.p ? V.w * 0.86 : 520, chh = 80, cx0 = V.p ? V.w * 0.07 : pos[1].x - 40, cy0 = V.p ? V.h * 0.72 : V.h * 0.62;
      if (!V.p) cx0 = clamp(cx0, 20, V.w - cw - 20);
      ctx.save(); ctx.globalAlpha *= clamp(ca, 0, 1); ctx.translate(0, (1 - clamp(ca, 0, 1)) * 30); rr(ctx, cx0, cy0, cw, chh, 18); ctx.fillStyle = 'rgba(255,255,255,0.97)'; ctx.fill();
      disque(ctx, cx0 + 42, cy0 + chh / 2, 24, C.red); texte(ctx, '!', cx0 + 42, cy0 + chh / 2 + 1, 32, '#FFFFFF', true);
      texte(ctx, 'ASCQ : nouvelle alerte', cx0 + 82, cy0 + 29, 26, '#17231F', true, 'left'); texte(ctx, 'À investiguer : fièvre + boutons, 3 enfants', cx0 + 82, cy0 + 58, 19, '#55655F', false, 'left'); ctx.restore();
    }
  }

  // ---------- Final : le logo de l'application ----------
  function finale(ctx, lt, V) {
    var cx = V.w / 2, size = V.p ? 540 : 400, cy = V.p ? V.h * 0.31 : V.h * 0.355;
    var halo = eOut(seg(lt, 0.0, 1.6)), i;
    var g = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * 1.1 * halo + 1); g.addColorStop(0, 'rgba(232,163,61,0.35)'); g.addColorStop(0.5, 'rgba(21,122,114,0.35)'); g.addColorStop(1, 'rgba(21,122,114,0)');
    ctx.fillStyle = g; ctx.fillRect(EXT.x, EXT.y, EXT.w, EXT.h);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(lt * 0.12); ctx.globalAlpha *= 0.10 * eOut(seg(lt, 0.4, 1.6));
    for (i = 0; i < 16; i++) { ctx.rotate(Math.PI * 2 / 16); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size * 1.5, -size * 0.06); ctx.lineTo(size * 1.5, size * 0.06); ctx.closePath(); ctx.fillStyle = '#FFFFFF'; ctx.fill(); }
    ctx.restore();
    var a = clamp(seg(lt, 0.15, 0.7), 0, 1), e = 0.45 + 0.55 * eBack(seg(lt, 0.15, 1.3)), R = size * e;
    if (LOGO) { ctx.save(); ctx.globalAlpha *= a; ctx.drawImage(LOGO, cx - R / 2, cy - R / 2, R, R); ctx.restore(); }
    for (i = 0; i < 3; i++) { var q = (lt - 1.0 - i * 0.45) / 1.6; if (q > 0 && q < 1) { ctx.beginPath(); ctx.arc(cx, cy, size * 0.5 + q * size * 0.55, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(232,163,61,' + (0.55 * (1 - q)) + ')'; ctx.lineWidth = 5; ctx.stroke(); } }
    var sw = seg(lt, 1.3, 2.3);
    if (sw > 0 && sw < 1 && LOGO) {
      ctx.save(); rr(ctx, cx - size / 2 + size * 0.03, cy - size / 2 + size * 0.03, size * 0.94, size * 0.94, size * 0.16); ctx.clip();
      var bx = cx - size * 0.8 + sw * size * 1.6, gr = ctx.createLinearGradient(bx - size * 0.18, 0, bx + size * 0.18, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(cx - size, cy - size, size * 2, size * 2); ctx.restore();
    }
    var etoiles = [[-0.62, -0.42], [0.66, -0.3], [-0.58, 0.46], [0.6, 0.5], [0.05, -0.68]];
    for (i = 0; i < etoiles.length; i++) {
      var tw = clamp(Math.sin((lt - 1.2 - i * 0.25) * 3.2), 0, 1) * seg(lt, 1.2, 1.6); if (tw <= 0) continue; var ex = cx + etoiles[i][0] * size, ey = cy + etoiles[i][1] * size, rs = 20 * tw;
      ctx.beginPath(); ctx.moveTo(ex, ey - rs); ctx.lineTo(ex + rs * 0.22, ey - rs * 0.22); ctx.lineTo(ex + rs, ey); ctx.lineTo(ex + rs * 0.22, ey + rs * 0.22); ctx.lineTo(ex, ey + rs); ctx.lineTo(ex - rs * 0.22, ey + rs * 0.22); ctx.lineTo(ex - rs, ey); ctx.lineTo(ex - rs * 0.22, ey - rs * 0.22); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,' + tw + ')'; ctx.fill();
    }
    var wy = cy + size / 2 + (V.p ? 80 : 58);
    motSivec(ctx, cx, wy, V.p ? 96 : 76, lt, 1.6);
    var b = eOut(seg(lt, 2.5, 3.1)); ctx.save(); ctx.globalAlpha *= b;
    var ls = ['Système d’Information et de Veille', 'Épidémiologique Communautaire'];
    for (i = 0; i < 2; i++) texte(ctx, ls[i], cx, wy + (V.p ? 72 : 52) + i * (V.p ? 36 : 30), V.p ? 30 : 25, C.soft, false);
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= eOut(seg(lt, 3.2, 3.8));
    var dv = lignes(ctx, 'Le village veille, le pays répond.', V.w * 0.9, V.p ? 44 : 38, true);
    for (i = 0; i < dv.length; i++) texte(ctx, dv[i], cx, wy + (V.p ? 170 : 132) + i * 50, V.p ? 44 : 38, C.amber, true);
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= eOut(seg(lt, 4.0, 4.6)); texte(ctx, 'Ministère de la Santé — République du Bénin', cx, V.h - (V.p ? 60 : 26), V.p ? 26 : 21, C.soft, false); ctx.restore();
  }

  // ---------- Montage ----------
  var EXT = { x: 0, y: 0, w: 1280, h: 720 };
  function fondSombre(ctx) { var g = ctx.createLinearGradient(EXT.x, EXT.y, EXT.x + EXT.w, EXT.y + EXT.h); g.addColorStop(0, C.t7); g.addColorStop(1, C.t9); ctx.fillStyle = g; ctx.fillRect(EXT.x, EXT.y, EXT.w, EXT.h); }
  function fenetre(t, a, b, debutNet) { return (debutNet ? 1 : seg(t, a, a + 0.4)) * (1 - seg(t, b - 0.4, b)); }

  function histoire(ctx, t, V) {
    var al;
    al = fenetre(t, 0, 13.3, true) * seg(t, 0, 0.5);
    if (al > 0) { ctx.save(); ctx.globalAlpha = al; village(ctx, t, V); ctx.restore(); }
    al = fenetre(t, 21.4, 25.4, false);
    if (t >= 21.4 && al > 0) { ctx.save(); ctx.globalAlpha = al; village(ctx, t, V); ctx.restore(); }
    al = fenetre(t, 12.9, 17.8, false); if (t >= 12.9 && t <= 17.8) { ctx.save(); ctx.globalAlpha = al; fondSombre(ctx); ctx.restore(); ctx.save(); ctx.globalAlpha = al; ecranTel(ctx, t, V); ctx.restore(); }
    al = fenetre(t, 17.4, 21.8, false); if (t >= 17.4 && t <= 21.8) { ctx.save(); ctx.globalAlpha = al; fondSombre(ctx); ctx.restore(); ctx.save(); ctx.globalAlpha = al; chaine(ctx, t, V); ctx.restore(); }
    al = seg(t, T_FINAL, T_FINAL + 0.5); if (t >= T_FINAL) { ctx.save(); ctx.globalAlpha = al; fondSombre(ctx); ctx.restore(); ctx.save(); ctx.globalAlpha = al; finale(ctx, t - T_FINAL, V); ctx.restore(); }
    caption(ctx, V, 'Un matin, dans un village…', 0.3, 4.4, t);
    caption(ctx, V, 'Plusieurs enfants ont de la fièvre et des boutons.', 4.8, 9.0, t);
    caption(ctx, V, 'La communauté alerte le relais communautaire.', 9.2, 12.9, t);
    caption(ctx, V, 'Le relais communautaire enregistre l’alerte sur son application.', 13.2, 17.4, t);
    caption(ctx, V, 'L’ASCQ et toute la chaîne sont informés en quelques minutes.', 17.8, 21.4, t);
    caption(ctx, V, 'L’ASCQ investigue. La riposte s’organise.', 21.6, 25.0, t);
  }

  function draw(ctx, t, W, H, opts) {
    opts = opts || {};
    var portrait = H > W, VW = portrait ? 720 : 1280, VH = portrait ? 1280 : 720, s = Math.min(W / VW, H / VH);
    var V = { w: VW, h: VH, p: portrait }, tx = (W - VW * s) / 2, ty = (H - VH * s) / 2;
    EXT = { x: -tx / s - 2, y: -ty / s - 2, w: W / s + 4, h: H / s + 4 };
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(tx, ty); ctx.scale(s, s);
    fondSombre(ctx);
    if (opts.soloLogo) finale(ctx, clamp(t, 0, DUREE_LOGO), V);
    else histoire(ctx, clamp(t, 0, DUREE), V);
    ctx.restore();
  }

  // ---------- Chargement du logo ----------
  function setLogo(img) { LOGO = img; }
  function chargerLogo(cb) {
    if (LOGO) return cb();
    var img = new Image(), fait = false;
    function fini() { if (fait) return; fait = true; cb(); }
    img.onload = function () { LOGO = img; fini(); }; img.onerror = fini; img.src = LOGO_URL;
    setTimeout(fini, 4000);
  }

  // ---------- Lecteur plein écran (avec le son) ----------
  var CSS = '#sivecIntro{position:fixed;left:0;top:0;right:0;bottom:0;z-index:99999;background:#0B3D3A;transition:opacity .45s;touch-action:manipulation}' +
    '#sivecIntro canvas{width:100%;height:100%;display:block}' +
    '#sivecIntro .si-btn{position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);background:rgba(0,0,0,.5);color:#fff;border:1px solid rgba(255,255,255,.45);border-radius:999px;padding:9px 16px;font:600 14px Arial,sans-serif;cursor:pointer}' +
    '#sivecIntro .si-passer{right:14px}#sivecIntro .si-son{left:14px}' +
    '#sivecIntro .si-son.si-attire{background:#E8A33D;color:#1B1B1B;border-color:#E8A33D}' +
    '#sivecIntro .si-fin{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 26px);display:flex;gap:12px;justify-content:center}' +
    '#sivecIntro .si-fin button{border:0;border-radius:10px;padding:12px 20px;font:700 15px Arial,sans-serif;cursor:pointer}' +
    '#sivecIntro .si-go{background:#E8A33D;color:#1B1B1B}#sivecIntro .si-re{background:rgba(255,255,255,.18);color:#fff}' +
    '#sivecIntro .si-bar{position:absolute;left:0;bottom:0;height:4px;background:#E8A33D;width:0}';

  function ouvrir(opts) {
    opts = opts || {}; var mode = opts.mode === 'logo' ? 'logo' : 'film', duree = mode === 'logo' ? DUREE_LOGO : DUREE, decal = mode === 'logo' ? 0 : 0;
    if (document.getElementById('sivecIntro')) return;
    if (!document.getElementById('sivecIntroCss')) { var st = document.createElement('style'); st.id = 'sivecIntroCss'; st.textContent = CSS; document.head.appendChild(st); }
    var ov = document.createElement('div'); ov.id = 'sivecIntro'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Présentation de SIVEC');
    var cv = document.createElement('canvas'); ov.appendChild(cv);
    var passer = document.createElement('button'); passer.className = 'si-btn si-passer'; passer.type = 'button'; passer.textContent = mode === 'film' ? 'Passer ✕' : 'Passer'; ov.appendChild(passer);
    var sonBtn = document.createElement('button'); sonBtn.className = 'si-btn si-son'; sonBtn.type = 'button'; ov.appendChild(sonBtn);
    var bar = document.createElement('div'); bar.className = 'si-bar'; ov.appendChild(bar);
    document.body.appendChild(ov);
    var ctx = cv.getContext('2d'), dpr = Math.min(global.devicePixelRatio || 1, 2), debut = null, fini = false, raf = 0, tNow = 0;
    var audio = null, sonActif = false;
    try { audio = new Audio(SON[mode]); audio.preload = 'auto'; } catch (e) { audio = null; }
    function majBtn() { if (!audio) { sonBtn.style.display = 'none'; return; } sonBtn.className = 'si-btn si-son' + (sonActif ? '' : ' si-attire'); sonBtn.textContent = sonActif ? '🔊 Son' : '🔇 Activer le son'; }
    function lancerSon(depuis) {
      if (!audio) return; try {
        audio.currentTime = Math.max(0, depuis || 0); var p = audio.play();
        if (p && p.then) p.then(function () { sonActif = true; majBtn(); }, function () { sonActif = false; majBtn(); }); else { sonActif = true; majBtn(); }
      } catch (e) { sonActif = false; majBtn(); }
    }
    sonBtn.onclick = function () { if (!audio) return; if (sonActif) { audio.pause(); sonActif = false; majBtn(); } else lancerSon(tNow); };
    function taille() { var w = global.innerWidth, h = global.innerHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    taille(); global.addEventListener('resize', taille); majBtn();
    function fermer(termine) {
      if (fini) return; fini = true; cancelAnimationFrame(raf); global.removeEventListener('resize', taille);
      if (audio) { try { audio.pause(); } catch (e) { /* ignoré */ } }
      ov.style.opacity = '0'; setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 480);
      if (opts.onFin) { try { opts.onFin(mode, !!termine); } catch (e) { /* sans importance */ } }
    }
    function finFilm() {
      cancelAnimationFrame(raf); draw(ctx, duree, cv.width, cv.height, { soloLogo: mode === 'logo' }); passer.style.display = 'none';
      var z = document.createElement('div'); z.className = 'si-fin';
      var go = document.createElement('button'); go.className = 'si-go'; go.type = 'button'; go.textContent = 'Continuer'; go.onclick = function () { fermer(true); };
      var re = document.createElement('button'); re.className = 'si-re'; re.type = 'button'; re.textContent = '↻ Revoir'; re.onclick = function () { ov.removeChild(z); passer.style.display = ''; debut = null; if (audio && sonActif) lancerSon(0); raf = requestAnimationFrame(boucle); };
      z.appendChild(re); z.appendChild(go); ov.appendChild(z);
    }
    function boucle(now) {
      if (fini) return; if (debut === null) debut = now; var t = (now - debut) / 1000;
      // le son fait référence : on recale l'image sur lui s'il dérive
      if (audio && sonActif && !audio.paused && Math.abs(audio.currentTime - t) > 0.25 && audio.currentTime > 0) { debut = now - audio.currentTime * 1000; t = audio.currentTime; }
      tNow = t; draw(ctx, t, cv.width, cv.height, { soloLogo: mode === 'logo' }); bar.style.width = (clamp(t / duree, 0, 1) * 100) + '%';
      if (t >= duree) { if (mode === 'logo') { setTimeout(function () { fermer(true); }, 350); } else finFilm(); return; }
      raf = requestAnimationFrame(boucle);
    }
    passer.onclick = function () { fermer(false); };
    chargerLogo(function () { if (fini) return; lancerSon(0); raf = requestAnimationFrame(boucle); });
  }

  global.SivecIntro = { draw: draw, ouvrir: ouvrir, setLogo: setLogo, DUREE: DUREE, DUREE_LOGO: DUREE_LOGO };
})(typeof window !== 'undefined' ? window : this);
