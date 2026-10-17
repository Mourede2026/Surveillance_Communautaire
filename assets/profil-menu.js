/**
 * Menu « Profil » (barre du haut) + thème clair/sombre/automatique + couleur de l'application + changement de compte.
 *  • Le thème est appliqué dès le chargement (ce fichier est chargé dans <head>).
 *  • Le bouton rond (silhouette blanche) s'ajoute dans .topbar-right de chaque espace.
 *  • « Changer de compte » : les comptes déjà connectés sur cet appareil sont mémorisés (jeton de
 *    session, jamais le mot de passe) ; on bascule de l'un à l'autre sans ressaisir le mot de passe
 *    tant que la session n'a pas expiré. « Ajouter un compte » ouvre la page de connexion.
 */
(function () {
  const KT = 'scb_theme', KA = 'scb_accounts', KC = 'scb_couleur';
  const PAGES = { RC: 'rc.html', ASCQ: 'ascq.html', PF_CNLS_TP: 'pf.html', RCSE: 'rcse.html', DEPARTEMENT: 'departement.html', NATIONAL: 'national.html' };
  const ROLES = { RC: 'Relais communautaire', ASCQ: 'ASCQ', PF_CNLS_TP: 'Point focal CNLS-TP', RCSE: 'RCSE', DEPARTEMENT: 'Département', NATIONAL: 'National' };
  const lire = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // ---------- couleur d'application (au choix de chaque utilisateur) ----------
  // Chaque couleur est définie par UNE teinte de base (le « 700 » de la palette) ; les autres
  // nuances (foncée, claire, fonds teintés, variante pour le thème sombre) en sont déduites.
  // « vert » = couleur d'origine (aucune surcharge). Le choix est gardé sur l'appareil et dans le
  // compte (colonne Couleur), pour le retrouver sur un autre téléphone.
  const COULEURS = [
    { id: 'vert', nom: 'Vert', hex: '#0E5E59' }, { id: 'rouge', nom: 'Rouge', hex: '#B3261E' },
    { id: 'bleu-fonce', nom: 'Bleu foncé', hex: '#17408B' }, { id: 'bleu-ocean', nom: 'Bleu océan', hex: '#0F6FA8' },
    { id: 'violet', nom: 'Violet', hex: '#5B2E91' }, { id: 'orange', nom: 'Orange', hex: '#B85A0F' },
    { id: 'rose', nom: 'Rose', hex: '#B02A6E' }, { id: 'ardoise', nom: 'Gris ardoise', hex: '#3E4C5E' }
  ];
  const HEX = /^#[0-9a-fA-F]{6}$/;
  function hexVersHsl(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, sat = 0;
    if (d) {
      sat = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = Math.round(h * 60); if (h < 0) h += 360;
    }
    return { h, s: Math.round(sat * 100), l: Math.round(l * 100) };
  }
  const hsl = (h, s, l) => `hsl(${h}, ${Math.max(0, Math.min(100, s))}%, ${Math.max(0, Math.min(100, l))}%)`;
  // Choix enregistré : identifiant de palette ('rouge'…) ou couleur libre '#rrggbb'.
  const valideCouleur = c => typeof c === 'string' && (COULEURS.some(x => x.id === c) || HEX.test(c)) ? c : 'vert';
  const couleurActuelle = () => valideCouleur(lire(KC, 'vert'));
  const hexDe = c => (COULEURS.find(x => x.id === c) || { hex: c }).hex;

  function appliquerCouleur(c) {
    const racine = document.documentElement, sombre = racine.getAttribute('data-theme') === 'dark';
    const VARS = ['--teal-900', '--teal-700', '--teal-500', '--tint', '--tint-2', '--tint-3', '--tint-4', '--side-ink', '--side-soft'];
    let meta = sombre ? '#0A1412' : '#0B3D3A';
    if (c === 'vert') { VARS.forEach(v => racine.style.removeProperty(v)); }
    else {
      const { h, s, l } = hexVersHsl(hexDe(c));
      const base = Math.min(l, 42), sat = Math.max(s, 15); // base assez foncée pour un texte blanc lisible
      const v = {
        '--teal-900': hsl(h, sat, Math.max(8, Math.round(base * 0.52))),
        '--teal-700': sombre ? hsl(h, sat, 52) : hsl(h, sat, base),
        '--teal-500': sombre ? hsl(h, sat, 62) : hsl(h, sat, Math.min(base + 11, 55)),
        '--tint': hsl(h, Math.min(sat, 45), 91), '--tint-2': hsl(h, Math.min(sat, 30), 94),
        '--tint-3': hsl(h, Math.min(sat, 30), 98), '--tint-4': hsl(h, Math.min(sat, 35), 93),
        '--side-ink': hsl(h, Math.min(sat, 45), 88), '--side-soft': hsl(h, Math.min(sat, 35), 80)
      };
      Object.keys(v).forEach(k => racine.style.setProperty(k, v[k]));
      if (!sombre) meta = v['--teal-900'];
    }
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = meta;
  }

  // ---------- thème ----------
  function appliquerTheme(t) {
    const sombre = t === 'sombre' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', sombre ? 'dark' : 'light');
    appliquerCouleur(couleurActuelle());
  }
  const themeActuel = () => lire(KT, 'auto');
  appliquerTheme(themeActuel());
  if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themeActuel() === 'auto') appliquerTheme('auto'); }); } catch (e) {} }

  // ---------- comptes mémorisés ----------
  window.memoriserCompteCourant_ = function () {
    const s = typeof Session !== "undefined" && Session.getRaw(); if (!s || !s.token || !s.user) return;
    const l = lire(KA, []).filter(a => a.user.ID !== s.user.ID);
    l.push({ token: s.token, user: { ID: s.user.ID, Nom: s.user.Nom, Prenom: s.user.Prenom, Role: s.user.Role, Telephone: s.user.Telephone } });
    ecrire(KA, l);
  };
  const oublier = id => ecrire(KA, lire(KA, []).filter(a => a.user.ID !== id));

  async function basculer(compte) {
    const ancien = Session.getRaw();
    Session.setSession(compte.token, compte.user);
    try {
      const r = await Api.call('getMe', {});
      if (r && r.user) { Session.setSession(compte.token, r.user); if (r.user.Couleur) ecrire(KC, valideCouleur(r.user.Couleur)); }
      location.href = PAGES[compte.user.Role] || 'index.html';
    } catch (e) {
      // session expirée : on retire ce compte et on revient à la connexion avec son numéro prérempli
      oublier(compte.user.ID);
      if (ancien) Session.setSession(ancien.token, ancien.user); else Session.clear();
      sessionStorage.setItem('scb_prefill', compte.user.Telephone || '');
      location.href = 'index.html?ajout=1';
    }
  }

  // ---------- guide d'utilisation (chargé à la demande) ----------
  function chargerScript(src) { return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Guide indisponible hors ligne.')); document.head.appendChild(s); }); }
  window.ouvrirGuideProfil_ = async function (section) {
    try {
      if (!window.GUIDES) await chargerScript('assets/guide-data.js');
      if (!window.ouvrirGuide) await chargerScript('assets/guide.js');
      window.ouvrirGuide(section);
    } catch (e) { if (window.toast) toast(e.message, true); }
  };

  // ---------- menu ----------
  const ICONE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" aria-hidden="true"><circle cx="12" cy="8" r="4.2"/><path d="M3.8 21c.4-4.6 3.7-7.2 8.2-7.2s7.8 2.6 8.2 7.2z"/></svg>';

  function construire() {
    const s = typeof Session !== "undefined" && Session.getRaw(); if (!s || !s.user) return;
    const zone = document.querySelector('.topbar-right'); if (!zone || document.getElementById('profilBtn')) return;
    memoriserCompteCourant_();
    const u = s.user, ini = ((u.Prenom || '?')[0] + (u.Nom || '')[0]).toUpperCase();
    const wrap = document.createElement('div'); wrap.className = 'profil-wrap';
    const photoDe = x => (x && /^data:image\//.test(x.Photo || '')) ? x.Photo : '';
    wrap.innerHTML = `<button type="button" id="profilBtn" class="profil-btn" title="Mon profil" aria-haspopup="true" aria-expanded="false">${photoDe(u) ? '<img alt="" src="' + photoDe(u) + '">' : ICONE}</button><div class="profil-menu" id="profilMenu" hidden></div>`;
    const g = document.createElement('button'); g.type = 'button'; g.id = 'guideBtn'; g.className = 'btn-guide'; g.textContent = '📖 Guide'; g.title = 'Guide d\'utilisation';
    g.onclick = () => ouvrirGuideProfil_();
    zone.appendChild(g);
    zone.appendChild(wrap);
    const btn = wrap.querySelector('#profilBtn'), menu = wrap.querySelector('#profilMenu');

    function majAvatar() { const U = Session.getUser() || u; btn.innerHTML = photoDe(U) ? '<img alt="" src="' + photoDe(U) + '">' : ICONE; }
    window.majAvatarProfil_ = majAvatar;
    // rafraîchit la photo depuis le serveur (changement fait depuis un autre appareil)
    Api.call('getMe', {}).then(r => {
      if (r && r.user) {
        Session.setSession(Session.getToken(), r.user); majAvatar();
        // la couleur enregistrée dans le compte prime (utile après un changement d'appareil)
        if (r.user.Couleur && valideCouleur(r.user.Couleur) !== couleurActuelle()) { ecrire(KC, valideCouleur(r.user.Couleur)); appliquerCouleur(couleurActuelle()); }
      }
    }).catch(() => {});
    const choisirCouleur = (c, enregistrer) => {
      ecrire(KC, c); appliquerCouleur(c);
      if (enregistrer) { const U = Session.getUser(); if (U) Api.call('updateUser', { id: U.ID, Couleur: c }).catch(() => {}); }
    };
    function dessiner() {
      const U = Session.getUser() || u, autres = lire(KA, []).filter(a => a.user.ID !== U.ID), th = themeActuel(), cc = couleurActuelle();
      menu.innerHTML = `<div class="profil-tete"><span class="profil-avatar">${photoDe(U) ? '<img alt="" src="' + photoDe(U) + '">' : escHtml(ini)}</span><div><strong>${escHtml((U.Prenom || '') + ' ' + (U.Nom || ''))}</strong><div class="petit">${escHtml(ROLES[U.Role] || U.Role || '')}</div><div class="petit">${escHtml(U.Telephone || '')}</div></div></div>
        <button type="button" data-p="compte">⚙️ Modifier mes paramètres</button>
        <button type="button" data-p="guide">📖 Guide d'utilisation</button>
        <div class="profil-sec">Thème</div>
        <div class="profil-theme">${[['clair', '☀️ Clair'], ['sombre', '🌙 Sombre'], ['auto', '🖥️ Auto']].map(([k, l]) => `<button type="button" data-theme="${k}" class="${th === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="profil-sec">Couleur de l'application</div>
        <div class="profil-couleurs">${COULEURS.map(c => `<button type="button" class="sw ${cc === c.id ? 'on' : ''}" data-couleur="${c.id}" title="${c.nom}" aria-label="${c.nom}" style="background:${c.hex}"></button>`).join('')}
          <input type="color" id="couleurPerso" value="${HEX.test(cc) ? cc : '#0E5E59'}" title="Couleur personnalisée" aria-label="Couleur personnalisée"><span class="sw-lib">Autre…</span></div>
        <div class="profil-sec">Changer de compte</div>
        ${autres.map(a => `<button type="button" data-switch="${escHtml(a.user.ID)}">👤 ${escHtml(a.user.Prenom + ' ' + a.user.Nom)} <span class="petit">· ${escHtml(ROLES[a.user.Role] || '')}</span></button>`).join('')}
        <button type="button" data-p="ajout">➕ Ajouter un autre compte</button>
        <button type="button" data-p="logout" class="profil-sortie">⎋ Se déconnecter</button>`;
    }
    const ouvrir = o => { if (o) dessiner(); menu.hidden = !o; btn.setAttribute('aria-expanded', o ? 'true' : 'false'); };
    // couleur libre : aperçu en direct pendant le choix, enregistrée à la validation
    menu.addEventListener('input', e => { if (e.target.id === 'couleurPerso') { ecrire(KC, e.target.value); appliquerCouleur(e.target.value); } });
    menu.addEventListener('change', e => { if (e.target.id === 'couleurPerso') { choisirCouleur(e.target.value, true); dessiner(); } });
    btn.addEventListener('click', e => { e.stopPropagation(); ouvrir(menu.hidden); });
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) ouvrir(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') ouvrir(false); });
    menu.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.theme) { ecrire(KT, b.dataset.theme); appliquerTheme(b.dataset.theme); dessiner(); return; }
      if (b.dataset.couleur) { choisirCouleur(b.dataset.couleur, true); dessiner(); return; }
      if (b.dataset.switch) { const c = lire(KA, []).find(a => a.user.ID === b.dataset.switch); if (c) basculer(c); return; }
      if (b.dataset.p === 'compte') { ouvrir(false); if (window.openMonCompteModal) openMonCompteModal(u => { const n = document.getElementById('userName'); if (n) n.textContent = u.Prenom + ' ' + u.Nom; majAvatar(); }); }
      if (b.dataset.p === 'guide') { ouvrir(false); ouvrirGuideProfil_(); }
      if (b.dataset.p === 'ajout') { location.href = 'index.html?ajout=1'; }
      if (b.dataset.p === 'logout') { const id = (Session.getUser() || {}).ID; oublier(id); await logoutEtRedirige(); }
    });
  }
  document.addEventListener('DOMContentLoaded', construire);

  // Application installée : lève tout verrouillage d'orientation (portrait/paysage dans tous les sens).
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
})();
