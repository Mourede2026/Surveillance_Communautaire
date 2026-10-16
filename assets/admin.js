/** Administration de la base de données (compte NATIONAL, serveur autonome). */
(function () {
  const user = Session.requireRole(['NATIONAL']);
  const $ = id => document.getElementById(id);
  $('userName').textContent = user.Prenom + ' ' + user.Nom;
  if (!window.SC_SERVER_MODE) { $('avertServeur').style.display = 'block'; $('tab-tables').style.display = 'none'; }

  const LIMITE = 50;
  let tableCourante = '', offset = 0, colonnes = [], lignes = [], total = 0, masques = [], tablesInfo = [], excelOk = false;

  async function admin(chemin, options) {
    const r = await fetch('/admin-api/' + chemin, Object.assign({ headers: { Authorization: 'Bearer ' + Session.getToken() } }, options || {}));
    let d; try { d = await r.json(); } catch (e) { throw new Error('Réponse invalide du serveur.'); }
    if (!d.ok) throw new Error(d.error || 'Erreur.');
    return d;
  }
  const lien = (chemin) => '/admin-api/' + chemin + (chemin.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(Session.getToken());
  const taille = o => o > 1048576 ? (o / 1048576).toFixed(1) + ' Mo' : Math.ceil(o / 1024) + ' Ko';

  document.querySelectorAll('.sidebar nav a[data-tab]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.sidebar nav a').forEach(x => x.classList.remove('active')); a.classList.add('active');
    ['tables', 'sauvegardes', 'import'].forEach(t => { $('tab-' + t).style.display = t === a.dataset.tab ? 'block' : 'none'; });
    if (a.dataset.tab === 'sauvegardes') chargerSauvegardes();
  }));

  async function chargerTables() {
    try {
      const d = await admin('tables');
      tablesInfo = d.tables; excelOk = d.excel;
      $('infoBase').textContent = 'Base : ' + taille(d.tailleBase);
      const nb = n => (tablesInfo.find(t => t.nom === n) || {}).lignes || 0;
      $('kpis').innerHTML = [['Utilisateurs', 'Utilisateurs'], ['Alertes', 'Alertes'], ['Décès', 'Deces'], ['Suivis groupés', 'SuivisGroupes']]
        .map(([l, n]) => `<div class="stat-card"><div class="n">${nb(n)}</div><div class="l">${l}</div></div>`).join('');
      $('tableTabs').innerHTML = tablesInfo.map(t => `<button data-table="${escHtml(t.nom)}" class="${t.nom === tableCourante ? 'active' : ''}">${escHtml(t.nom)} <small>(${t.lignes})</small></button>`).join('');
      if (!tableCourante && tablesInfo.length) { tableCourante = tablesInfo[0].nom; $('tableTabs').querySelector('button').classList.add('active'); }
      await chargerTable();
    } catch (e) { $('tableContenu').innerHTML = '<div class="empty-state">' + escHtml(e.message) + '</div>'; }
  }
  $('tableTabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-table]'); if (!b) return;
    tableCourante = b.dataset.table; offset = 0; $('rechercheTable').value = '';
    $('tableTabs').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    chargerTable();
  });

  async function chargerTable() {
    $('tableContenu').innerHTML = 'Chargement…';
    try {
      const d = await admin(`table?nom=${encodeURIComponent(tableCourante)}&q=${encodeURIComponent($('rechercheTable').value)}&offset=${offset}&limite=${LIMITE}`);
      colonnes = d.colonnes; lignes = d.lignes; total = d.total; masques = d.masques;
      $('compteLignes').textContent = total + ' ligne(s)';
      $('pageInfo').textContent = total ? `${offset + 1}–${Math.min(offset + LIMITE, total)} sur ${total}` : '';
      $('pagePrec').disabled = offset === 0; $('pageSuiv').disabled = offset + LIMITE >= total;
      if (!lignes.length) { $('tableContenu').innerHTML = '<div class="empty-state">Aucune ligne.</div>'; return; }
      let h = '<div class="table-wrap"><table><thead><tr><th></th>' + colonnes.map(c => `<th>${escHtml(c)}</th>`).join('') + '</tr></thead><tbody>';
      lignes.forEach(l => {
        h += `<tr><td style="white-space:nowrap"><button class="btn-inline-edit" data-edit="${l._i}" title="Modifier">✏️</button><button class="btn-inline-edit" data-del="${l._i}" title="Supprimer">🗑️</button></td>` +
          colonnes.map(c => { const v = String(l[c]); return `<td title="${escHtml(v)}">${escHtml(v.length > 60 ? v.slice(0, 60) + '…' : v)}</td>`; }).join('') + '</tr>';
      });
      $('tableContenu').innerHTML = h + '</tbody></table></div>';
    } catch (e) { $('tableContenu').innerHTML = '<div class="empty-state">' + escHtml(e.message) + '</div>'; }
  }
  let minuteur;
  $('rechercheTable').addEventListener('input', () => { clearTimeout(minuteur); minuteur = setTimeout(() => { offset = 0; chargerTable(); }, 300); });
  $('pagePrec').onclick = () => { offset = Math.max(0, offset - LIMITE); chargerTable(); };
  $('pageSuiv').onclick = () => { offset += LIMITE; chargerTable(); };
  $('btnCsv').onclick = () => { window.location.href = lien('export?format=csv&nom=' + encodeURIComponent(tableCourante)); };

  // ---- édition / ajout d'une ligne ----
  let indexEdition = null;
  function ouvrirFormulaire(ligne) {
    indexEdition = ligne ? ligne._i : null;
    $('modalTitre').textContent = (ligne ? 'Modifier une ligne — ' : 'Ajouter une ligne — ') + tableCourante;
    $('formLigne').innerHTML = colonnes.map(c => {
      const v = ligne ? String(ligne[c]) : '';
      const secret = masques.includes(c);
      const long = v.length > 70;
      return `<div class="field"><label>${escHtml(c)}${secret ? ' <small>(laisser vide pour ne pas changer)</small>' : ''}</label>` +
        (long ? `<textarea data-col="${escHtml(c)}" rows="4">${escHtml(v)}</textarea>` : `<input data-col="${escHtml(c)}" value="${secret && ligne ? '' : escHtml(v)}" ${secret ? 'type="password" autocomplete="new-password"' : ''}>`) + '</div>';
    }).join('');
    $('modalLigne').style.display = 'flex';
  }
  $('btnAjouter').onclick = () => ouvrirFormulaire(null);
  $('btnFermerLigne').onclick = () => { $('modalLigne').style.display = 'none'; };
  $('tableContenu').addEventListener('click', async e => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) ouvrirFormulaire(lignes.find(l => String(l._i) === ed.dataset.edit));
    if (del && confirm('Supprimer définitivement cette ligne de « ' + tableCourante + ' » ?\nCette action ne passe pas par les règles de l\'application (aucune cascade).')) {
      try { await admin('delete', { method: 'POST', body: JSON.stringify({ table: tableCourante, index: Number(del.dataset.del) }) }); toast('Ligne supprimée.'); chargerTables(); }
      catch (err) { toast(err.message, true); }
    }
  });
  $('btnSauverLigne').onclick = async () => {
    const valeurs = {}; $('formLigne').querySelectorAll('[data-col]').forEach(i => { valeurs[i.dataset.col] = i.value; });
    try { await admin('row', { method: 'POST', body: JSON.stringify({ table: tableCourante, index: indexEdition, valeurs }) }); toast('Enregistré.'); $('modalLigne').style.display = 'none'; chargerTables(); }
    catch (err) { toast(err.message, true); }
  };

  // ---- sauvegardes / exports ----
  $('btnExportJson').onclick = () => { window.location.href = lien('export?format=json'); };
  $('btnExportXlsx').onclick = () => { if (!excelOk) { toast('Export Excel indisponible : exécutez « npm install » dans le dossier server.', true); return; } window.location.href = lien('export?format=xlsx'); };
  $('btnBackupNow').onclick = async () => { try { const d = await admin('backup', { method: 'POST', body: '{}' }); toast('Sauvegarde créée : ' + d.nom); chargerSauvegardes(); } catch (e) { toast(e.message, true); } };
  async function chargerSauvegardes() {
    try {
      const d = await admin('tables');
      $('listeSauvegardes').innerHTML = d.sauvegardes.length ? '<table><thead><tr><th>Fichier</th><th>Taille</th><th></th></tr></thead><tbody>' +
        d.sauvegardes.map(s => `<tr><td>${escHtml(s.nom)}</td><td>${taille(s.taille)}</td><td><a href="${lien('backup-download?nom=' + encodeURIComponent(s.nom))}">⬇ Télécharger</a></td></tr>`).join('') + '</tbody></table>' : '<div class="empty-state">Aucune sauvegarde.</div>';
    } catch (e) { $('listeSauvegardes').textContent = e.message; }
  }

  // ---- import ----
  async function importer(fichier, type) {
    if (!fichier) return;
    if (!confirm('Remplacer TOUTE la base actuelle par le contenu de « ' + fichier.name + ' » ?\nUne sauvegarde automatique sera créée avant.')) return;
    try {
      const d = await admin('import?type=' + type, { method: 'POST', body: await fichier.arrayBuffer() });
      toast('Import réussi (' + d.tables + ' tables). Reconnectez-vous si besoin.');
      tableCourante = ''; offset = 0; chargerTables();
    } catch (e) { toast(e.message, true); }
  }
  $('fileXlsx').addEventListener('change', e => { importer(e.target.files[0], 'xlsx'); e.target.value = ''; });
  $('fileJson').addEventListener('change', e => { importer(e.target.files[0], 'json'); e.target.value = ''; });

  if (window.SC_SERVER_MODE) chargerTables();
})();
