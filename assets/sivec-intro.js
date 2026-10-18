/**
 * SIVEC — animation d'ouverture.
 *  - mode 'logo' : logo animé (≈ 4,6 s) ;
 *  - mode 'film' : présentation de ≈ 30 s (village → alerte du RC → remontée de la chaîne → riposte → logo).
 * Dessin en canvas, sans aucune dépendance ni fichier vidéo : fonctionne hors ligne dans l'application installée.
 * Le film est une fonction pure du temps : SivecIntro.draw(ctx, t, largeur, hauteur) (utile aussi pour produire un MP4).
 *
 * SivecIntro.ouvrir({ mode: 'logo' | 'film', onFin: function (mode, termine) {} })
 */
(function (global) {
  'use strict';
  var DUREE = 30, DUREE_LOGO = 4.6;
  var C = { t9: '#0B3D3A', t7: '#0E5E59', t5: '#157A72', amber: '#E8A33D', red: '#DC2626', white: '#FFFFFF', soft: '#B9D3CF' };
  var POLICE = 'Arial, Helvetica, sans-serif';

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function eOut(p) { return 1 - Math.pow(1 - p, 3); }
  function eBack(p) { var c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }
  function eIO(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function disque(ctx, x, y, r, fill) { if (r <= 0) return; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
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

  // ---------- Le logo (même dessin que assets/sivec-mark.svg), avec progression d'animation ----------
  function marque(ctx, cx, cy, size, p) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(size / 512, size / 512); ctx.translate(-256, -256);
    var ts = p.tile; ctx.save(); ctx.translate(256, 256); ctx.scale(ts, ts); ctx.translate(-256, -256); ctx.globalAlpha *= clamp(ts, 0, 1);
    var g = ctx.createLinearGradient(0, 0, 512, 512); g.addColorStop(0, C.t7); g.addColorStop(1, C.t9);
    rr(ctx, 0, 0, 512, 512, 112); ctx.fillStyle = g; ctx.fill();
    if (p.dot > 0) disque(ctx, 256, 196, 16 * p.dot, C.amber);
    var rayons = [42, 86, 130], opac = [1, 0.85, 0.7], pa = [p.a1, p.a2, p.a3];
    ctx.lineWidth = 22; ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      if (pa[i] <= 0) continue;
      var d = -Math.PI * 150 / 180, f = d + (Math.PI * 120 / 180) * pa[i];
      ctx.beginPath(); ctx.arc(256, 196, rayons[i], d, f, false); ctx.strokeStyle = 'rgba(255,255,255,' + opac[i] + ')'; ctx.stroke();
    }
    if (p.eye > 0) {
      ctx.save(); ctx.translate(256, 312); ctx.scale(1, p.eye); ctx.translate(-256, -312);
      ctx.beginPath(); ctx.moveTo(52, 312); ctx.bezierCurveTo(118, 226, 394, 226, 460, 312); ctx.bezierCurveTo(394, 398, 118, 398, 52, 312); ctx.closePath();
      ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.restore();
    }
    if (p.iris > 0) { disque(ctx, 256, 312, 72 * p.iris, C.amber); disque(ctx, 256, 312, 34 * p.iris, C.t9); disque(ctx, 273, 295, 10 * p.iris, '#FFFFFF'); }
    ctx.restore(); ctx.restore();
  }
  function marquePleine(ctx, cx, cy, size) { marque(ctx, cx, cy, size, { tile: 1, eye: 1, iris: 1, dot: 1, a1: 1, a2: 1, a3: 1 }); }
  function marqueAnimee(ctx, cx, cy, size, t) {
    marque(ctx, cx, cy, size, { tile: eBack(seg(t, 0.1, 0.9)), eye: eOut(seg(t, 0.8, 1.5)), iris: eBack(seg(t, 1.4, 2.0)),
      dot: eOut(seg(t, 1.9, 2.2)), a1: eOut(seg(t, 2.1, 2.5)), a2: eOut(seg(t, 2.4, 2.8)), a3: eOut(seg(t, 2.7, 3.1)) });
  }
  function motSivec(ctx, cx, y, taille, t, t0, couleur) {
    var lettres = 'SIVEC'.split(''), esp = taille * 0.22, larg = [], total = 0, i;
    ctx.font = 'bold ' + taille + 'px ' + POLICE;
    for (i = 0; i < lettres.length; i++) { larg.push(ctx.measureText(lettres[i]).width); total += larg[i]; }
    total += esp * (lettres.length - 1); var x = cx - total / 2;
    for (i = 0; i < lettres.length; i++) {
      var a = eOut(seg(t, t0 + i * 0.12, t0 + 0.35 + i * 0.12)); ctx.save(); ctx.globalAlpha *= a;
      texte(ctx, lettres[i], x + larg[i] / 2, y + (1 - a) * 22, taille, couleur, true); ctx.restore(); x += larg[i] + esp;
    }
  }
  function caption(ctx, V, s, t0, t1, lt) {
    var a = seg(lt, t0, t0 + 0.35) * (1 - seg(lt, t1 - 0.3, t1)); if (a <= 0) return;
    var taille = V.p ? 36 : 40, maxW = V.w * (V.p ? 0.80 : 0.74), ls = lignes(ctx, s, maxW, taille, true);
    var h = ls.length * taille * 1.3 + 34, y = V.h - (V.p ? 230 : 112) - h / 2 + 10;
    ctx.save(); ctx.globalAlpha *= a; rr(ctx, V.w * 0.06, y, V.w * 0.88, h, 22); ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fill();
    for (var i = 0; i < ls.length; i++) texte(ctx, ls[i], V.w / 2, y + 17 + taille * 0.65 + i * taille * 1.3, taille, '#FFFFFF', true);
    ctx.restore();
  }

  // ---------- Scène 0 : le logo ----------
  function sceneLogo(ctx, t, V) {
    var size = V.p ? 340 : 300, cy = V.p ? V.h * 0.36 : V.h * 0.38;
    var halo = eOut(seg(t, 0.2, 2.4)); var g = ctx.createRadialGradient(V.w / 2, cy, 10, V.w / 2, cy, size * 1.2 * halo + 1);
    g.addColorStop(0, 'rgba(21,122,114,0.55)'); g.addColorStop(1, 'rgba(21,122,114,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, V.w, V.h);
    marqueAnimee(ctx, V.w / 2, cy, size, t);
    motSivec(ctx, V.w / 2, cy + size / 2 + (V.p ? 100 : 92), V.p ? 96 : 92, t, 3.0, '#FFFFFF');
    var a = eOut(seg(t, 3.6, 4.2)); ctx.save(); ctx.globalAlpha *= a;
    var ls = ['Système d’Information et de Veille', 'Épidémiologique Communautaire'], ty = cy + size / 2 + (V.p ? 190 : 180);
    for (var i = 0; i < 2; i++) texte(ctx, ls[i], V.w / 2, ty + i * (V.p ? 38 : 40), V.p ? 30 : 32, C.soft, false);
    ctx.restore();
  }

  // ---------- Scène 1 : un village ----------
  function maison(ctx, x, y, w, h, mur, toit) {
    ctx.fillStyle = mur; ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 12, y - h); ctx.lineTo(x, y - h - h * 0.62); ctx.lineTo(x + w / 2 + 12, y - h); ctx.closePath(); ctx.fillStyle = toit; ctx.fill();
    ctx.fillStyle = 'rgba(60,40,20,0.75)'; ctx.fillRect(x - 11, y - h * 0.62, 22, h * 0.62);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x + w / 2 - 28, y - h * 0.78, 16, 16);
  }
  function arbre(ctx, x, y, s) {
    ctx.fillStyle = '#7A5230'; ctx.fillRect(x - 6 * s, y - 60 * s, 12 * s, 60 * s);
    disque(ctx, x, y - 82 * s, 40 * s, '#3F9B5A'); disque(ctx, x - 26 * s, y - 62 * s, 28 * s, '#4DAF68'); disque(ctx, x + 26 * s, y - 64 * s, 28 * s, '#368C50');
  }
  function personne(ctx, x, y, h, gilet, marche, t) {
    var s = h / 120, pas = marche ? Math.sin(t * 9) : 0, bob = marche ? Math.abs(Math.sin(t * 9)) * 3 * s : 0;
    ctx.save(); ctx.translate(x, y - bob); ctx.lineCap = 'round';
    ctx.strokeStyle = '#2B2B2B'; ctx.lineWidth = 9 * s;
    ctx.beginPath(); ctx.moveTo(-8 * s, -48 * s); ctx.lineTo(-8 * s + pas * 12 * s, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8 * s, -48 * s); ctx.lineTo(8 * s - pas * 12 * s, 0); ctx.stroke();
    rr(ctx, -20 * s, -100 * s, 40 * s, 58 * s, 10 * s); ctx.fillStyle = gilet; ctx.fill();
    ctx.strokeStyle = '#8B5A3C'; ctx.lineWidth = 8 * s; ctx.beginPath(); ctx.moveTo(-18 * s, -92 * s); ctx.lineTo(-26 * s, -64 * s + pas * 6 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18 * s, -92 * s); ctx.lineTo(28 * s, -66 * s - pas * 6 * s); ctx.stroke();
    disque(ctx, 0, -116 * s, 17 * s, '#8B5A3C');
    ctx.beginPath(); ctx.arc(0, -120 * s, 18 * s, Math.PI, 0, false); ctx.closePath(); ctx.fillStyle = '#2563EB'; ctx.fill();
    ctx.fillRect(-2 * s, -121 * s, 26 * s, 6 * s);
    ctx.restore();
  }
  function sceneVillage(ctx, t, V, W, H, ty, s) {
    var sg = ctx.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, '#FFE2B0'); sg.addColorStop(0.65, '#FFF3DB'); sg.addColorStop(1, '#FDF8EC');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H); ctx.restore();
    var gy = V.h * 0.72, realGy = ty + gy * s;
    ctx.save(); ctx.translate(0, 0);
    var pulse = 1 + Math.sin(t * 2) * 0.04; disque(ctx, V.w * 0.82, V.h * 0.18, 64 * pulse, '#FFC857'); disque(ctx, V.w * 0.82, V.h * 0.18, 92 * pulse, 'rgba(255,200,87,0.25)');
    ctx.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#8FC48B'; ctx.fillRect(0, realGy - 30 * s, W, H - realGy + 30 * s); ctx.restore();
    ctx.fillStyle = '#A7D3A0'; ctx.beginPath(); ctx.ellipse ? ctx.ellipse(V.w * 0.3, gy + 30, 640, 150, 0, 0, Math.PI * 2) : ctx.arc(V.w * 0.3, gy + 30, 400, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#C79A62'; ctx.fillRect(-400, gy, V.w + 800, 26);
    arbre(ctx, V.w * 0.07, gy + 10, V.p ? 1.0 : 1.2); arbre(ctx, V.w * 0.93, gy + 8, V.p ? 0.9 : 1.1);
    var xs = V.p ? [0.22, 0.5, 0.78, 0.5] : [0.24, 0.41, 0.58, 0.75], hs = V.p ? [72, 80, 70, 0] : [86, 96, 82, 90];
    var murs = ['#F4DDB5', '#EBCB98', '#F6E3C4', '#EBCB98'], toits = ['#B5502F', '#A3412A', '#C0603B', '#A3412A'];
    var nb = V.p ? 3 : 4, ys = V.p ? [gy, gy - 90, gy] : [gy, gy, gy, gy];
    for (var i = 0; i < nb; i++) maison(ctx, V.w * xs[i], ys[i], V.p ? 118 : 130, hs[i], murs[i], toits[i]);
    var hx = V.w * xs[1], hy = ys[1] - hs[1] * 1.7;
    if (t > 2.6) {
      var q = t - 2.6;
      for (var k = 0; k < 3; k++) { var ph = ((q * 0.8 + k * 0.33) % 1); ctx.beginPath(); ctx.arc(hx, hy + 20, 24 + ph * 90, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(220,38,38,' + (0.7 * (1 - ph)) + ')'; ctx.lineWidth = 5; ctx.stroke(); }
      var pop = eBack(seg(q, 0, 0.5)); disque(ctx, hx, hy - 10, 26 * pop, C.red); if (pop > 0.5) texte(ctx, '!', hx, hy - 9, 34 * pop, '#FFFFFF', true);
    }
    var px = V.w * (V.p ? 0.10 : 0.07) + (V.w * (V.p ? 0.20 : 0.20)) * eIO(seg(t, 0.5, 2.8));
    personne(ctx, px, gy + 70, V.p ? 170 : 190, '#157A72', seg(t, 0.5, 2.8) < 1, t);
    caption(ctx, V, 'Tout commence dans un village…', 0.3, 2.7, t);
    caption(ctx, V, 'Un enfant tombe malade. Puis un autre.', 2.9, 5.9, t);
  }

  // ---------- Scène 2 : le RC donne l'alerte ----------
  function sceneAlerte(ctx, t, V) {
    var cx = V.w / 2, cy = V.p ? V.h * 0.40 : V.h * 0.45, pw = 300, ph = 500, x = cx - pw / 2, y = cy - ph / 2, k = V.p ? 1 : 0.80;
    var entree = eOut(seg(t, 0, 0.7)); ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); ctx.translate(0, (1 - entree) * 60); ctx.globalAlpha *= entree;
    rr(ctx, x - 12, y - 12, pw + 24, ph + 24, 46); ctx.fillStyle = '#10211F'; ctx.fill();
    rr(ctx, x, y, pw, ph, 36); ctx.fillStyle = '#F3F7F6'; ctx.fill();
    ctx.save(); rr(ctx, x, y, pw, ph, 36); ctx.clip();
    ctx.fillStyle = C.t7; ctx.fillRect(x, y, pw, 78); marquePleine(ctx, x + 40, y + 44, 40); texte(ctx, 'SIVEC', x + 74, y + 44, 26, '#FFFFFF', true, 'left');
    texte(ctx, 'Notifier une alerte', cx, y + 118, 24, C.t9, true);
    var champs = [['Événement', 'Fièvre + éruption'], ['Village', 'Mon village'], ['Cas', '2 enfants']];
    for (var i = 0; i < 3; i++) {
      var a = eOut(seg(t, 0.7 + i * 0.35, 1.2 + i * 0.35)); ctx.save(); ctx.globalAlpha *= a;
      var fy = y + 150 + i * 82 + (1 - a) * 14; texte(ctx, champs[i][0], x + 28, fy, 16, '#55655F', false, 'left');
      rr(ctx, x + 24, fy + 14, pw - 48, 40, 10); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = '#C9D4D1'; ctx.lineWidth = 1.5; ctx.stroke();
      texte(ctx, champs[i][1], x + 38, fy + 35, 19, '#17231F', true, 'left'); ctx.restore();
    }
    var press = seg(t, 2.6, 2.9), by = y + ph - 76;
    rr(ctx, x + 24, by, pw - 48, 54, 14); ctx.fillStyle = press > 0.5 ? '#C9871F' : C.amber; ctx.fill();
    texte(ctx, 'Notifier l’alerte', cx, by + 27, 22, '#1B1B1B', true);
    if (t > 2.7) { var r = seg(t, 2.7, 3.4); ctx.beginPath(); ctx.arc(cx + 50, by + 30, 10 + r * 80, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - r)) + ')'; ctx.lineWidth = 6; ctx.stroke(); }
    var toast = eBack(seg(t, 3.1, 3.7)); if (toast > 0) { ctx.save(); ctx.translate(0, (1 - toast) * 60); rr(ctx, x + 18, y + ph - 150, pw - 36, 56, 14); ctx.fillStyle = '#16A34A'; ctx.fill(); texte(ctx, '✔ Alerte envoyée', cx, y + ph - 122, 22, '#FFFFFF', true); ctx.restore(); }
    ctx.restore();
    var dx = x + pw * 0.78 + (1 - eOut(seg(t, 1.9, 2.6))) * 120, dy = by + 36 + (1 - eOut(seg(t, 1.9, 2.6))) * 150;
    if (t > 1.9 && t < 3.7) { ctx.globalAlpha *= 0.9 * (1 - seg(t, 3.3, 3.7)); disque(ctx, dx, dy, 22, '#E0B08B'); }
    ctx.restore();
    var ond = seg(t, 3.2, 5.4); for (var k = 0; k < 3; k++) {
      var p2 = clamp(ond * 1.4 - k * 0.25, 0, 1); if (p2 <= 0 || p2 >= 1) continue;
      ctx.beginPath(); ctx.arc(cx, y - 10, 40 + p2 * 190, -Math.PI * 0.82, -Math.PI * 0.18, false); ctx.strokeStyle = 'rgba(232,163,61,' + (0.9 * (1 - p2)) + ')'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke();
    }
    caption(ctx, V, 'Le relais communautaire donne l’alerte, depuis son téléphone.', 0.5, 5.6, t);
  }

  // ---------- Scène 3 : la chaîne ----------
  var NOEUDS = [['RC', 'Village', '#DC2626'], ['ASCQ', 'Arrondissement', '#EA580C'], ['PF', 'Commune', '#CA8A04'], ['RCSE', 'Zone sanitaire', '#16A34A'], ['DDS', 'Département', '#2563EB'], ['National', 'Pays', '#7C3AED']];
  function sceneChaine(ctx, t, V) {
    var n = NOEUDS.length, pos = [], i;
    for (i = 0; i < n; i++) pos.push(V.p ? { x: V.w * 0.30, y: V.h * 0.17 + i * (V.h * 0.095) } : { x: V.w * (0.11 + i * 0.156), y: V.h * 0.40 });
    texte(ctx, 'Du village au niveau national', V.w / 2, V.p ? V.h * 0.075 : V.h * 0.14, V.p ? 34 : 40, C.soft, true);
    var prog = eIO(seg(t, 0.6, 4.9)) * (n - 1);
    ctx.lineCap = 'round'; ctx.lineWidth = 8;
    for (i = 0; i < n - 1; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[i + 1].x, pos[i + 1].y); ctx.stroke();
      var f = clamp(prog - i, 0, 1); if (f > 0) { ctx.strokeStyle = NOEUDS[i + 1][2]; ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[i].x + (pos[i + 1].x - pos[i].x) * f, pos[i].y + (pos[i + 1].y - pos[i].y) * f); ctx.stroke(); }
    }
    for (i = 0; i < n; i++) {
      var act = i === 0 ? seg(t, 0.2, 0.7) : seg(prog, i - 0.08, i + 0.12), sc = eBack(act), r = V.p ? 38 : 50;
      if (act <= 0) { disque(ctx, pos[i].x, pos[i].y, r * 0.55, 'rgba(255,255,255,0.15)'); continue; }
      var dep = (i === 0 ? t - 0.5 : (prog - i) / 4.3 * 5 + 0.2);
      if (dep > 0 && dep < 1.2) { ctx.beginPath(); ctx.arc(pos[i].x, pos[i].y, r + dep * 46, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * (1 - dep / 1.2)) + ')'; ctx.lineWidth = 4; ctx.stroke(); }
      disque(ctx, pos[i].x, pos[i].y, r * sc, NOEUDS[i][2]); ctx.beginPath(); ctx.arc(pos[i].x, pos[i].y, r * sc, 0, Math.PI * 2); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; ctx.stroke();
      ctx.save(); ctx.globalAlpha *= clamp(sc, 0, 1);
      if (V.p) { texte(ctx, NOEUDS[i][0], pos[i].x, pos[i].y, 24, '#FFFFFF', true); texte(ctx, NOEUDS[i][1], pos[i].x + r + 30, pos[i].y, 28, C.soft, false, 'left'); }
      else { texte(ctx, NOEUDS[i][0], pos[i].x, pos[i].y, i === 5 ? 17 : 26, '#FFFFFF', true); texte(ctx, NOEUDS[i][1], pos[i].x, pos[i].y + r + 30, 24, C.soft, false); }
      ctx.restore();
    }
    if (prog > 0 && prog < n - 1) { var k = Math.floor(prog), fr = prog - k, px = pos[k].x + (pos[k + 1].x - pos[k].x) * fr, py = pos[k].y + (pos[k + 1].y - pos[k].y) * fr; disque(ctx, px, py, 24, 'rgba(255,255,255,0.35)'); disque(ctx, px, py, 12, '#FFFFFF'); }
    caption(ctx, V, 'En quelques minutes, l’alerte remonte toute la chaîne.', 0.4, 6.4, t);
  }

  // ---------- Scène 4 : la riposte ----------
  function sceneRiposte(ctx, t, V) {
    var cx = V.w / 2, cy = V.p ? V.h * 0.28 : V.h * 0.31, e = eBack(seg(t, 0.2, 1.0));
    ctx.save(); ctx.translate(cx, cy); ctx.scale(e * 1.25, e * 1.25);
    ctx.beginPath(); ctx.moveTo(0, -100); ctx.lineTo(80, -70); ctx.lineTo(80, 10); ctx.bezierCurveTo(80, 60, 40, 90, 0, 112); ctx.bezierCurveTo(-40, 90, -80, 60, -80, 10); ctx.lineTo(-80, -70); ctx.closePath();
    ctx.fillStyle = C.t5; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
    var pts = [[-36, 6], [-8, 36], [42, -26]], len1 = 40, len2 = 78, tot = len1 + len2, pr = eOut(seg(t, 1.0, 1.7)) * tot;
    ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    if (pr <= len1) ctx.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * pr / len1, pts[0][1] + (pts[1][1] - pts[0][1]) * pr / len1);
    else { ctx.lineTo(pts[1][0], pts[1][1]); var f = (pr - len1) / len2; ctx.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * f, pts[1][1] + (pts[2][1] - pts[1][1]) * f); }
    ctx.stroke(); ctx.restore();
    var mots = ['Détecter tôt', 'Réagir vite', 'Protéger la communauté'], couleurs = ['#FFFFFF', C.amber, '#FFFFFF'];
    for (var i = 0; i < 3; i++) {
      var a = eOut(seg(t, 1.6 + i * 0.8, 2.2 + i * 0.8)), yy = (V.p ? V.h * 0.50 : V.h * 0.575) + i * (V.p ? 76 : 50);
      ctx.save(); ctx.globalAlpha *= a; texte(ctx, mots[i], cx + (1 - a) * 40, yy, V.p ? 50 : 42, couleurs[i], true); ctx.restore();
    }
    caption(ctx, V, 'L’ASCQ investigue. La riposte s’organise.', 0.4, 5.0, t);
  }

  // ---------- Scène 5 : final ----------
  function sceneFinal(ctx, t, V) {
    var size = V.p ? 300 : 240, cy = V.p ? V.h * 0.30 : V.h * 0.27, a = eOut(seg(t, 0.1, 0.8));
    ctx.save(); ctx.globalAlpha *= a; marquePleine(ctx, V.w / 2, cy, size * (0.85 + 0.15 * a)); ctx.restore();
    motSivec(ctx, V.w / 2, cy + size / 2 + (V.p ? 90 : 78), V.p ? 96 : 92, t, 0.5, '#FFFFFF');
    var b = eOut(seg(t, 1.3, 1.9)); ctx.save(); ctx.globalAlpha *= b;
    var devise = lignes(ctx, 'Le village veille, le pays répond.', V.w * 0.86, V.p ? 44 : 46, true);
    for (var i = 0; i < devise.length; i++) texte(ctx, devise[i], V.w / 2, cy + size / 2 + (V.p ? 190 : 175) + i * 56, V.p ? 44 : 46, C.amber, true);
    ctx.restore();
    var c = eOut(seg(t, 2.0, 2.6)); ctx.save(); ctx.globalAlpha *= c;
    texte(ctx, 'Ministère de la Santé — République du Bénin', V.w / 2, V.h - (V.p ? 120 : 70), V.p ? 26 : 28, C.soft, false); ctx.restore();
  }

  // ---------- Montage ----------
  var SCENES = [
    { a: 0, b: 4.9 }, { a: 4.5, b: 10.5 }, { a: 10.1, b: 16.1 }, { a: 15.7, b: 22.5 }, { a: 22.1, b: 27.4 }, { a: 27.0, b: 30.0 }
  ];
  function fondSombre(ctx, W, H) { var g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.t7); g.addColorStop(1, C.t9); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }

  function draw(ctx, t, W, H, opts) {
    opts = opts || {};
    var portrait = H > W, VW = portrait ? 720 : 1280, VH = portrait ? 1280 : 720, s = Math.min(W / VW, H / VH);
    var V = { w: VW, h: VH, p: portrait }, tx = (W - VW * s) / 2, ty = (H - VH * s) / 2;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); fondSombre(ctx, W, H);
    if (opts.soloLogo) {
      ctx.translate(tx, ty); ctx.scale(s, s); sceneLogo(ctx, clamp(t, 0, DUREE_LOGO), V); ctx.restore(); return;
    }
    t = clamp(t, 0, DUREE);
    for (var i = 0; i < SCENES.length; i++) {
      var sc = SCENES[i]; if (t < sc.a || t > sc.b) continue;
      var lt = t - sc.a, dur = sc.b - sc.a;
      var al = (i === 0 ? 1 : seg(lt, 0, 0.4)) * (i === SCENES.length - 1 ? 1 : 1 - seg(lt, dur - 0.4, dur));
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = al;
      if (i === 1) { ctx.translate(tx, ty); ctx.scale(s, s); sceneVillage(ctx, lt, V, W, H, ty, s); }
      else { if (i !== 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); fondSombre(ctx, W, H); ctx.restore(); } ctx.translate(tx, ty); ctx.scale(s, s);
        [sceneLogo, null, sceneAlerte, sceneChaine, sceneRiposte, sceneFinal][i](ctx, lt, V); }
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- Lecteur plein écran ----------
  var CSS = '#sivecIntro{position:fixed;left:0;top:0;right:0;bottom:0;z-index:99999;background:#0B3D3A;transition:opacity .45s;touch-action:manipulation}' +
    '#sivecIntro canvas{width:100%;height:100%;display:block}' +
    '#sivecIntro .si-passer{position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);right:14px;background:rgba(0,0,0,.45);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:9px 16px;font:600 14px Arial,sans-serif;cursor:pointer}' +
    '#sivecIntro .si-fin{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 26px);display:flex;gap:12px;justify-content:center}' +
    '#sivecIntro .si-fin button{border:0;border-radius:10px;padding:12px 20px;font:700 15px Arial,sans-serif;cursor:pointer}' +
    '#sivecIntro .si-go{background:#E8A33D;color:#1B1B1B}#sivecIntro .si-re{background:rgba(255,255,255,.18);color:#fff}' +
    '#sivecIntro .si-bar{position:absolute;left:0;bottom:0;height:4px;background:#E8A33D;width:0}';

  function ouvrir(opts) {
    opts = opts || {}; var mode = opts.mode === 'logo' ? 'logo' : 'film', duree = mode === 'logo' ? DUREE_LOGO : DUREE;
    if (document.getElementById('sivecIntro')) return;
    if (!document.getElementById('sivecIntroCss')) { var st = document.createElement('style'); st.id = 'sivecIntroCss'; st.textContent = CSS; document.head.appendChild(st); }
    var ov = document.createElement('div'); ov.id = 'sivecIntro'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Présentation de SIVEC');
    var cv = document.createElement('canvas'); ov.appendChild(cv);
    var passer = document.createElement('button'); passer.className = 'si-passer'; passer.type = 'button'; passer.textContent = mode === 'film' ? 'Passer ✕' : 'Passer'; ov.appendChild(passer);
    var bar = document.createElement('div'); bar.className = 'si-bar'; ov.appendChild(bar);
    document.body.appendChild(ov);
    var ctx = cv.getContext('2d'), dpr = Math.min(global.devicePixelRatio || 1, 2), debut = null, fini = false, raf = 0;
    function taille() { var w = global.innerWidth, h = global.innerHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    taille(); global.addEventListener('resize', taille);
    function fermer(termine) {
      if (fini) return; fini = true; cancelAnimationFrame(raf); global.removeEventListener('resize', taille);
      ov.style.opacity = '0'; setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 480);
      if (opts.onFin) { try { opts.onFin(mode, !!termine); } catch (e) { /* sans importance */ } }
    }
    function fin() {
      cancelAnimationFrame(raf); draw(ctx, duree, cv.width, cv.height, { soloLogo: mode === 'logo' }); passer.style.display = 'none';
      var z = document.createElement('div'); z.className = 'si-fin';
      var go = document.createElement('button'); go.className = 'si-go'; go.type = 'button'; go.textContent = 'Continuer'; go.onclick = function () { fermer(true); };
      var re = document.createElement('button'); re.className = 'si-re'; re.type = 'button'; re.textContent = '↻ Revoir'; re.onclick = function () { ov.removeChild(z); passer.style.display = ''; debut = null; raf = requestAnimationFrame(boucle); };
      z.appendChild(re); z.appendChild(go); ov.appendChild(z);
    }
    function boucle(now) {
      if (fini) return; if (debut === null) debut = now; var t = (now - debut) / 1000;
      draw(ctx, t, cv.width, cv.height, { soloLogo: mode === 'logo' }); bar.style.width = (clamp(t / duree, 0, 1) * 100) + '%';
      if (t >= duree) { if (mode === 'logo') { setTimeout(function () { fermer(true); }, 350); } else fin(); return; }
      raf = requestAnimationFrame(boucle);
    }
    passer.onclick = function () { fermer(false); };
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(false); });
    raf = requestAnimationFrame(boucle);
  }

  global.SivecIntro = { draw: draw, ouvrir: ouvrir, DUREE: DUREE, DUREE_LOGO: DUREE_LOGO };
})(typeof window !== 'undefined' ? window : this);
