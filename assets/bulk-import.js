/**
 * Composant réutilisable d'import en masse d'acteurs (PF CCLS-TP, ASCQ ou RC) par site
 * d'intervention. L'utilisateur colle des lignes copiées depuis Excel ou Google Sheets (colonnes
 * séparées par une tabulation, ou par une virgule) ; ce module les découpe et les envoie en un
 * seul appel à l'action API "importActeursBulk". Les doublons (téléphone déjà utilisé, dans le
 * Sheet ou dans le collage lui-même) sont filtrés côté serveur et remontés ici sans bloquer le
 * reste de l'import.
 *
 * config: {
 *   containerId : id de l'élément où injecter le formulaire,
 *   role        : 'PF_CNLS_TP' | 'ASCQ' | 'RC' (rôle des comptes importés),
 *   columns     : [{ key, label }]  colonnes propres au site d'intervention, après
 *                 Nom / Prénom / Téléphone / Mot de passe (déjà inclus automatiquement),
 *   onDone      : rappelé après un import réussi, pour rafraîchir la liste affichée.
 * }
 */
function renderImportActeurs(config) {
  const el = document.getElementById(config.containerId);
  const allColumns = [
    { key: 'nom', label: 'Nom' },
    { key: 'prenom', label: 'Prénom' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'motDePasse', label: 'Mot de passe' },
    ...config.columns
  ];

  el.innerHTML = `
    <p style="font-size:.85rem;color:var(--ink-soft)">
      Collez vos lignes copiées depuis Excel ou Google Sheets (une ligne par personne, colonnes séparées par une tabulation), dans l'ordre :
      <strong>${allColumns.map(c => c.label).join(' · ')}</strong>.
      La première ligne peut être un en-tête (elle sera ignorée). Les doublons (téléphone déjà utilisé) sont automatiquement écartés.
    </p>
    <textarea id="${config.containerId}Textarea" rows="6" style="width:100%;font-family:monospace;font-size:.85rem;padding:10px;border:1px solid var(--line);border-radius:8px"
      placeholder="${allColumns.map(c => c.label).join('\t')}"></textarea>
    <div style="margin-top:10px;display:flex;gap:10px;align-items:center">
      <button id="${config.containerId}Btn" class="btn-secondary">Importer</button>
      <span id="${config.containerId}Status" style="font-size:.85rem;color:var(--ink-soft)"></span>
    </div>
    <div id="${config.containerId}Result" style="margin-top:12px"></div>
  `;

  document.getElementById(config.containerId + 'Btn').addEventListener('click', async () => {
    const textarea = document.getElementById(config.containerId + 'Textarea');
    const statusEl = document.getElementById(config.containerId + 'Status');
    const resultEl = document.getElementById(config.containerId + 'Result');
    resultEl.innerHTML = '';
    const raw = textarea.value.trim();
    if (!raw) { toast('Collez au moins une ligne.', true); return; }

    let lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    // Ignore une éventuelle ligne d'en-tête (si sa première cellule ressemble à "Nom").
    if (lines.length && /^nom$/i.test((lines[0].split(/\t|,/)[0] || '').trim())) lines = lines.slice(1);
    if (!lines.length) { toast('Aucune ligne de données trouvée.', true); return; }

    const rows = lines.map(line => {
      const cells = line.includes('\t') ? line.split('\t') : line.split(',');
      const obj = {};
      allColumns.forEach((c, i) => { obj[c.key] = (cells[i] || '').trim(); });
      return obj;
    });

    statusEl.textContent = `Import de ${rows.length} ligne(s) en cours…`;
    try {
      const res = await Api.call('importActeursBulk', { role: config.role, rows });
      statusEl.textContent = '';
      let html = `<div style="background:#e8f5ee;border:1.5px solid #1a7a4a;border-radius:10px;padding:10px 14px;font-size:.88rem;color:#0d3d24">✅ ${res.created} compte(s) créé(s).</div>`;
      if (res.skipped && res.skipped.length) {
        html += `<div style="margin-top:8px">
          <strong style="font-size:.85rem">${res.skipped.length} ligne(s) ignorée(s) :</strong>
          <ul style="margin:6px 0 0;padding-left:18px;font-size:.83rem;color:var(--ink-soft)">
            ${res.skipped.map(s => `<li>Ligne ${s.line} : ${s.raison}</li>`).join('')}
          </ul>
        </div>`;
      }
      resultEl.innerHTML = html;
      toast(`${res.created} compte(s) importé(s).`);
      textarea.value = '';
      if (config.onDone) config.onDone();
    } catch (err) { statusEl.textContent = ''; toast(err.message, true); }
  });
}
