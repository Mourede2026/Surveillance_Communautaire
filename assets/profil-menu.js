/**
 * Menu « Profil » (barre du haut) + thème clair/sombre/automatique + changement de compte.
 *  • Le thème est appliqué dès le chargement (ce fichier est chargé dans <head>).
 *  • Le bouton rond (silhouette blanche) s'ajoute dans .topbar-right de chaque espace.
 *  • « Changer de compte » : les comptes déjà connectés sur cet appareil sont mémorisés (jeton de
 *    session, jamais le mot de passe) ; on bascule de l'un à l'autre sans ressaisir le mot de passe
 *    tant que la session n'a pas expiré. « Ajouter un compte » ouvre la page de connexion.
 */
(function () {
  const KT = 'scb_theme', KA = 'scb_accounts';
  const PAGES = { RC: 'rc.html', ASCQ: 'ascq.html', PF_CNLS_TP: 'pf.html', RCSE: 'rcse.html', DEPARTEMENT: 'departement.html', NATIONAL: 'national.html' };
  const ROLES = { RC: 'Relais communautaire', ASCQ: 'ASCQ', PF_CNLS_TP: 'Point focal CNLS-TP', RCSE: 'RCSE', DEPARTEMENT: 'Département', NATIONAL: 'National' };
  const lire = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // ---------- thème ----------
  function appliquerTheme(t) {
    const sombre = t === 'sombre' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', sombre ? 'dark' : 'light');
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = sombre ? '#0A1412' : '#0B3D3A';
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
      if (r && r.user) Session.setSession(compte.token, r.user);
      location.href = PAGES[compte.user.Role] || 'index.html';
    } catch (e) {
      // session expirée : on retire ce compte et on revient à la connexion avec son numéro prérempli
      oublier(compte.user.ID);
      if (ancien) Session.setSession(ancien.token, ancien.user); else Session.clear();
      sessionStorage.setItem('scb_prefill', compte.user.Telephone || '');
      location.href = 'index.html?ajout=1';
    }
  }

  // ---------- menu ----------
  const ICONE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" aria-hidden="true"><circle cx="12" cy="8" r="4.2"/><path d="M3.8 21c.4-4.6 3.7-7.2 8.2-7.2s7.8 2.6 8.2 7.2z"/></svg>';

  function construire() {
    const s = typeof Session !== "undefined" && Session.getRaw(); if (!s || !s.user) return;
    const zone = document.querySelector('.topbar-right'); if (!zone || document.getElementById('profilBtn')) return;
    memoriserCompteCourant_();
    const u = s.user, ini = ((u.Prenom || '?')[0] + (u.Nom || '')[0]).toUpperCase();
    const wrap = document.createElement('div'); wrap.className = 'profil-wrap';
    wrap.innerHTML = `<button type="button" id="profilBtn" class="profil-btn" title="Mon profil" aria-haspopup="true" aria-expanded="false">${ICONE}</button><div class="profil-menu" id="profilMenu" hidden></div>`;
    zone.appendChild(wrap);
    const btn = wrap.querySelector('#profilBtn'), menu = wrap.querySelector('#profilMenu');

    function dessiner() {
      const U = Session.getUser() || u, autres = lire(KA, []).filter(a => a.user.ID !== U.ID), th = themeActuel();
      menu.innerHTML = `<div class="profil-tete"><span class="profil-avatar">${escHtml(ini)}</span><div><strong>${escHtml((U.Prenom || '') + ' ' + (U.Nom || ''))}</strong><div class="petit">${escHtml(ROLES[U.Role] || U.Role || '')}</div><div class="petit">${escHtml(U.Telephone || '')}</div></div></div>
        <button type="button" data-p="compte">⚙️ Modifier mes paramètres</button>
        <div class="profil-sec">Thème</div>
        <div class="profil-theme">${[['clair', '☀️ Clair'], ['sombre', '🌙 Sombre'], ['auto', '🖥️ Auto']].map(([k, l]) => `<button type="button" data-theme="${k}" class="${th === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="profil-sec">Changer de compte</div>
        ${autres.map(a => `<button type="button" data-switch="${escHtml(a.user.ID)}">👤 ${escHtml(a.user.Prenom + ' ' + a.user.Nom)} <span class="petit">· ${escHtml(ROLES[a.user.Role] || '')}</span></button>`).join('')}
        <button type="button" data-p="ajout">➕ Ajouter un autre compte</button>
        <button type="button" data-p="logout" class="profil-sortie">⎋ Se déconnecter</button>`;
    }
    const ouvrir = o => { if (o) dessiner(); menu.hidden = !o; btn.setAttribute('aria-expanded', o ? 'true' : 'false'); };
    btn.addEventListener('click', e => { e.stopPropagation(); ouvrir(menu.hidden); });
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) ouvrir(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') ouvrir(false); });
    menu.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.theme) { ecrire(KT, b.dataset.theme); appliquerTheme(b.dataset.theme); dessiner(); return; }
      if (b.dataset.switch) { const c = lire(KA, []).find(a => a.user.ID === b.dataset.switch); if (c) basculer(c); return; }
      if (b.dataset.p === 'compte') { ouvrir(false); const f = document.getElementById('monCompteBtn'); if (f) f.click(); else if (window.openMonCompteModal) openMonCompteModal(); }
      if (b.dataset.p === 'ajout') { location.href = 'index.html?ajout=1'; }
      if (b.dataset.p === 'logout') { const id = (Session.getUser() || {}).ID; oublier(id); await logoutEtRedirige(); }
    });
  }
  document.addEventListener('DOMContentLoaded', construire);
})();
