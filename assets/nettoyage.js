/**
 * « Nettoyage » — tout niveau supérieur au RC peut supprimer définitivement, par
 * catégorie, les données de SON périmètre (le national : toute la plateforme). Le serveur recalcule
 * le périmètre ; l'interface ne fait qu'afficher les catégories et leurs effectifs.
 * Dépend de api.js. initNettoyage(containerId)
 */
async function initNettoyage(containerId) {
  const z = document.getElementById(containerId);
  z.innerHTML = 'Chargement…';
  try {
    const r = await Api.call('apercuNettoyage', {});
    z.innerHTML = `<p class="petit" style="margin:0 0 12px">${r.portee === 'national'
      ? 'Vous voyez toute la plateforme. Les comptes NATIONAL ne sont jamais supprimés.'
      : 'Vous pouvez supprimer les <strong>comptes placés sous vous</strong> et les activités que vous avez créées. Les données collectées (alertes, décès, rapports, suivis) ne peuvent pas être supprimées à ce niveau. Votre propre compte n\'est jamais supprimé.'}
      La suppression est <strong>définitive</strong>, y compris dans le Google Sheet.</p>
      <div class="checks" style="grid-template-columns:1fr">${r.categories.map(c => `<label><input type="checkbox" name="nettoie" value="${escHtml(c.id)}" ${c.nb ? '' : 'disabled'}> <span><strong>${escHtml(c.label)}</strong> — ${c.nb} ligne(s)</span></label>`).join('')}</div>
      <div class="field" style="margin-top:14px;max-width:320px"><label>Tapez SUPPRIMER pour confirmer</label><input id="nettoieConf" autocomplete="off"></div>
      <button class="btn-danger" id="nettoieBtn">Supprimer la sélection</button>`;
    document.getElementById('nettoieBtn').onclick = async () => {
      const cats = [...z.querySelectorAll('input[name=nettoie]:checked')].map(i => i.value);
      if (!cats.length) { toast('Cochez au moins une catégorie.', true); return; }
      if (!confirm('Suppression DÉFINITIVE et irréversible de ' + cats.length + ' catégorie(s). Continuer ?')) return;
      try {
        const x = await Api.call('nettoyerDonnees', { categories: cats, confirmation: document.getElementById('nettoieConf').value });
        toast('Suppression effectuée : ' + Object.values(x.supprime).reduce((a, b) => a + b, 0) + ' ligne(s).');
        initNettoyage(containerId);
      } catch (e) { toast(e.message, true); }
    };
  } catch (e) { z.innerHTML = '<div class="empty-state">' + escHtml(e.message) + '</div>'; }
}
