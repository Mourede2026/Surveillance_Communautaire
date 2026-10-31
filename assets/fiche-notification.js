/**
 * Module « Fiche de notification » (niveau RCSE) : fiche officielle
 * « 1_BJ_FORMULAIRE GENERIQUE DE NOTIFICATION DES MALADIES SOUS SURVEILLANCE ».
 *   • Page de remplissage indépendante (cases à cocher + champs) ;
 *   • à chaque enregistrement, la liste de tous les cas remplis s'affiche avec leurs informations ;
 *   • chaque cas peut être imprimé sur la fiche officielle (cases cochées, champs remplis), modifié ou supprimé.
 * Dépend de api.js (Api, toast, fmtDate, escHtml).
 *
 * initFicheNotification({ containerId, user })
 */
(function () {
  const MALADIES = ['Rougeole', 'Fièvre Jaune', 'Choléra', 'Shigellose', 'Méningite', 'Intoxication', 'Hépatites', 'F Typhoïde', 'Syphilis End.',
    'Noma', 'Dracunculose', 'Lèpre', 'Peste', 'Ulcère Buruli', 'Pian', 'Zika', 'Anthrax', 'Grippe HP'];
  const SIGNES = ['Fièvre', 'Eruption cutanée', 'Diarrhée aqueuse', 'Vomissement', 'Selles sanguinolente',
    'Céphalée', 'Hémorragie', 'Raideur nuque', 'Altération conscience', 'Bombement fontanelle',
    'Photophobie', 'Hydrophobie', 'Convulsions', 'Ictère', 'Fatigue intense',
    'Nausée', 'Maux de gorge', 'Toux', 'Douleurs abdominales', 'Anorexie',
    'Gonflement des ganglions', 'Crachats teintés de sang', 'Lésions cutanées', 'Difficultés respiratoires'];
  const PROFESSIONS = [['1', 'Salarié'], ['2', 'Cultivateur'], ['3', 'Eleveur/Chasseur'], ['4', 'Commerçant'], ['5', 'Artisan'], ['6', 'Elève/Etudiant'],
    ['7', 'Professionnel de santé'], ['8', 'Ménagère'], ['9', 'Aucun'], ['10', 'NA'], ['11', 'Autre']];
  const MATRIMONIAL = [['1', 'Marié'], ['2', 'Célibataire'], ['3', 'Veuf'], ['4', 'Divorcé'], ['5', 'NA']];
  const NIVEAUX = [['1', 'Non scolarisé'], ['2', 'Alphabétisé'], ['3', 'Primaire'], ['4', 'Secondaire'], ['5', 'Université'], ['6', 'NA']];
  const NATIONALITES = [['1', 'Béninoise'], ['2', 'Autre nationalité']];
  const CLASSIF = ['Suspect', 'Probable', 'Confirmé par le laboratoire', 'Confirmé par lien épidémiologique', 'Confirmé cliniquement'];
  const PRELEV = ['Sang', 'Selles', 'LCR'];

  let ctx = null, fiches = [], editId = null, semaineCourante = null;

  // ---------------- utilitaires ----------------
  const E = escHtml;
  const nomSigne = i => 'sg' + i;
  const clientId = () => 'fn-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  function lireDonnees(f) { try { const d = JSON.parse(f.Donnees || '{}'); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; } }
  const coche = v => v ? '☒' : '☐';

  // ---------------- champs du formulaire ----------------
  const txt = (name, label, extra) => `<div class="field"><label>${label}</label><input name="${name}" ${extra || ''}></div>`;
  const dat = (name, label) => `<div class="field"><label>${label}</label><input type="date" name="${name}"></div>`;
  const radios = (name, liste) => liste.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<label class="fn-opt"><input type="radio" name="${name}" value="${E(v)}"> ${E(Array.isArray(o) ? v + ' — ' + l : l)}</label>`; }).join('');

  function formulaireHtml() {
    return `<form id="fnForm" autocomplete="off">
      <div class="fn-bloc"><h3>Localisation de la formation sanitaire</h3>
        <div class="grid grid-2">${txt('departement', 'Département')}${txt('zoneSanitaire', 'Zone sanitaire')}${txt('commune', 'Commune')}${txt('formationSanitaire', 'Formation sanitaire')}</div>
      </div>

      <div class="fn-bloc"><h3>Maladie notifiée <span class="petit">(cochez une seule maladie)</span></h3>
        <div class="fn-grille">${radios('maladie', MALADIES)}
          <label class="fn-opt"><input type="radio" name="maladie" value="Autre"> Autre à préciser :</label></div>
        <div class="field" style="margin-top:8px"><input name="maladieAutre" placeholder="Précisez la maladie si « Autre »"></div>
      </div>

      <div class="fn-bloc"><h3>Notification</h3>
        <div class="grid grid-2">${txt('annee', 'Année de notification', 'inputmode="numeric" maxlength="4"')}${txt('semaine', 'Semaine épidémiologique', 'inputmode="numeric" maxlength="2"')}</div>
        <div class="field"><label>Statut épidémiologique</label><div class="fn-ligne">${radios('statutEpi', ['En routine', 'En épidémie'])}</div></div>
      </div>

      <div class="fn-bloc"><h3>Résidence et identification du cas</h3>
        <div class="grid grid-2">${txt('pays', 'Pays')}${txt('depResidence', 'Département')}${txt('comResidence', 'Commune')}${txt('arrondissement', 'Arrondissement')}
          ${txt('village', 'Ville / Village')}${txt('quartier', 'Quartier')}${txt('adresse', 'Adresse')}</div>
        <div class="field"><label>Urbaine / Rurale</label><div class="fn-ligne">${radios('zoneType', [['U', 'Urbaine'], ['R', 'Rurale']])}</div></div>
        <div class="grid grid-2">${txt('nomPatient', 'Nom du patient *', 'required')}${txt('parent', 'Père / Mère')}${txt('telephone', 'Téléphone')}${txt('adresseParents', 'Adresse des parents / tuteurs')}</div>
        <div class="grid grid-2">${dat('dateNaissance', 'Date de naissance')}
          <div class="field"><label>… ou âge</label><div class="fn-age"><input name="ageAns" inputmode="numeric" placeholder="ans"><input name="ageMois" inputmode="numeric" placeholder="mois"><input name="ageJours" inputmode="numeric" placeholder="jours"></div></div></div>
        <div class="field"><label>Sexe</label><div class="fn-ligne">${radios('sexe', [['F', 'Féminin'], ['M', 'Masculin']])}</div></div>
        <div class="grid grid-2">
          <div class="field"><label>Profession</label><div class="fn-col">${radios('profession', PROFESSIONS)}</div><input name="professionAutre" placeholder="Si autre, précisez" style="margin-top:6px"></div>
          <div class="field"><label>Statut matrimonial</label><div class="fn-col">${radios('matrimonial', MATRIMONIAL)}</div></div>
          <div class="field"><label>Niveau scolaire</label><div class="fn-col">${radios('niveau', NIVEAUX)}</div></div>
          <div class="field"><label>Nationalité</label><div class="fn-col">${radios('nationalite', NATIONALITES)}</div><input name="nationaliteAutre" placeholder="Si autre nationalité, précisez" style="margin-top:6px"></div>
        </div>
        <div class="grid grid-2">${txt('gpsLon', 'Coordonnées GPS — Longitude')}${txt('gpsLat', 'Coordonnées GPS — Latitude')}</div>
        <button type="button" class="btn-secondary" id="fnGps" style="font-size:.8rem;padding:6px 12px">📍 Utiliser ma position actuelle</button>
      </div>

      <div class="fn-bloc"><h3>Histoire de la maladie</h3>
        <div class="grid grid-3">${dat('dateDebut', 'Date de début des symptômes')}${dat('dateConsultation', 'Date de consultation')}${dat('dateNotification', 'Date de notification')}</div>
        <div class="field"><label>Signes et symptômes</label><div class="fn-grille">${SIGNES.map((s, i) => `<label class="fn-opt"><input type="checkbox" name="${nomSigne(i)}"> ${E(s)}</label>`).join('')}</div>
          <input name="signesAutres" placeholder="Autres signes à préciser" style="margin-top:8px"></div>
        <div class="field"><label>Type de consultation</label><div class="fn-ligne">${radios('consultation', ['Externe', 'Hospitalisé'])}</div></div>
        <div class="field"><label>Évolution</label><div class="fn-ligne">${radios('evolution', ['Vivant', 'Décédé', 'Inconnu'])}</div></div>
        <div class="field"><label>Statut vaccinal</label><div class="fn-ligne">${radios('vaccinal', ['Vacciné', 'Non vacciné'])}</div></div>
        <div class="grid grid-2">${txt('nbDoses', 'Si vacciné — nombre de doses', 'inputmode="numeric"')}${dat('dateDerniereDose', 'Date de la dernière dose')}</div>
        <div class="field"><label>Classification finale</label><div class="fn-ligne">${radios('classification', CLASSIF)}</div></div>
      </div>

      <div class="fn-bloc"><h3>Notificateur</h3>
        <div class="grid grid-2">${txt('notifNom', 'Nom du notificateur')}${txt('notifTel', 'Téléphone')}${txt('notifQualif', 'Qualification')}</div>
        <p class="petit">La signature se fait à la main sur la fiche imprimée.</p>
      </div>

      <div class="fn-bloc"><h3>Prélèvement</h3>
        <div class="field"><label>Type de prélèvement</label><div class="fn-ligne">${PRELEV.map((s, i) => `<label class="fn-opt"><input type="checkbox" name="prel${i}"> ${s}</label>`).join('')}
          <label class="fn-opt"><input type="checkbox" name="prelGorge"> Prélèvement de gorge</label></div></div>
        <div class="grid grid-2">${txt('aspectLcr', 'Aspect du LCR')}${txt('prelAutre', 'Autre prélèvement à préciser')}${dat('datePrelevement', 'Date de prélèvement')}${txt('heurePrelevement', 'Heure de prélèvement', 'type="time"')}
          ${dat('dateEnvoi', "Date d'envoi du prélèvement")}${txt('heureEnvoi', "Heure d'envoi", 'type="time"')}</div>
      </div>

      <div class="fn-actions"><button type="submit" id="fnSave">💾 Enregistrer la fiche</button>
        <button type="button" class="btn-secondary" id="fnReset">Vider le formulaire</button>
        <span id="fnEditInfo" class="petit"></span></div>
    </form>`;
  }

  // ---------------- lecture / écriture du formulaire ----------------
  function lireFormulaire() {
    const f = document.getElementById('fnForm'), d = {};
    f.querySelectorAll('input').forEach(el => {
      if (!el.name) return;
      if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; }
      else if (el.type === 'checkbox') { d[el.name] = el.checked; }
      else d[el.name] = el.value.trim();
    });
    d.signes = SIGNES.filter((s, i) => d[nomSigne(i)]);
    SIGNES.forEach((s, i) => delete d[nomSigne(i)]);
    d.prelevements = PRELEV.filter((s, i) => d['prel' + i]);
    PRELEV.forEach((s, i) => delete d['prel' + i]);
    d.prelGorge = !!d.prelGorge;
    return d;
  }

  function remplirFormulaire(d) {
    const f = document.getElementById('fnForm');
    f.reset();
    f.querySelectorAll('input').forEach(el => {
      if (!el.name) return;
      if (el.type === 'radio') el.checked = d[el.name] === el.value;
      else if (el.type === 'checkbox') {
        let m = /^sg(\d+)$/.exec(el.name), p = /^prel(\d+)$/.exec(el.name);
        if (m) el.checked = (d.signes || []).indexOf(SIGNES[+m[1]]) !== -1;
        else if (p) el.checked = (d.prelevements || []).indexOf(PRELEV[+p[1]]) !== -1;
        else el.checked = !!d[el.name];
      } else el.value = d[el.name] !== undefined ? d[el.name] : '';
    });
  }

  // Valeurs par défaut tirées du compte RCSE (zone sanitaire, notificateur) et de la semaine en cours.
  function valeursParDefaut() {
    const u = ctx.user, auj = new Date().toISOString().slice(0, 10);
    return {
      departement: u.DepartementNom || '', zoneSanitaire: u.ZoneSanitaireNom || '', pays: 'Bénin',
      annee: semaineCourante ? String(semaineCourante.Annee) : String(new Date().getFullYear()),
      semaine: semaineCourante ? String(semaineCourante.SemaineEpi) : '',
      dateNotification: auj, notifNom: ((u.Prenom || '') + ' ' + (u.Nom || '')).trim(), notifTel: u.Telephone || ''
    };
  }

  function nouvelleFiche() {
    editId = null;
    remplirFormulaire(valeursParDefaut());
    document.getElementById('fnEditInfo').textContent = '';
    document.getElementById('fnSave').textContent = '💾 Enregistrer la fiche';
  }

  function modifierFiche(id) {
    const f = fiches.find(x => x.ID === id); if (!f) return;
    editId = id;
    remplirFormulaire(lireDonnees(f));
    document.getElementById('fnEditInfo').textContent = '✏️ Modification de la fiche de ' + (f.NomPatient || '');
    document.getElementById('fnSave').textContent = '💾 Enregistrer les modifications';
    document.getElementById('fnForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------------- fiche imprimable (reprend la mise en page de la fiche officielle) ----------------
  const CSS_IMPR = `
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #000; margin: 0; }
    .fiche { page-break-after: always; break-after: page; padding: 2mm; }
    .fiche:last-child { page-break-after: auto; break-after: auto; }
    .top { display: flex; justify-content: space-between; font-weight: 700; font-size: 9pt; }
    h1 { text-align: center; font-size: 12pt; margin: 3mm 0 2mm; }
    .l { display: flex; flex-wrap: wrap; gap: 2mm 8mm; margin: 1.6mm 0; align-items: baseline; }
    .l b { font-weight: 700; } .v { border-bottom: 1px solid #000; min-width: 28mm; padding: 0 1mm; display: inline-block; min-height: 4.5mm; }
    .v.g { min-width: 60mm; } .v.p { min-width: 14mm; text-align: center; }
    .sec { border-top: 1.5px solid #000; margin-top: 2mm; padding-top: 1mm; font-weight: 700; text-transform: uppercase; }
    table { border-collapse: collapse; width: 100%; margin: 1.5mm 0; }
    td, th { border: 1px solid #000; padding: 1mm 1.5mm; vertical-align: top; font-size: 8.8pt; }
    th { text-align: left; font-weight: 700; }
    .mal td { text-align: left; white-space: nowrap; }
    .cb { font-size: 11pt; line-height: 1; }
    .sig { height: 11mm; }
    .nb { font-size: 8pt; }
  `;

  function ficheImprimable(f) {
    const d = lireDonnees(f);
    const v = (k, cls) => `<span class="v ${cls || ''}">${E(d[k] || '')}</span>`;
    const cb = (ok, lib) => `<span><span class="cb">${coche(ok)}</span> ${E(lib)}</span>`;
    const choix = (name, liste) => liste.map(o => { const [val, lib] = Array.isArray(o) ? o : [o, o]; return cb(d[name] === val, lib); }).join('&nbsp;&nbsp; ');
    const code = (name, liste, autre) => liste.map(([val, lib]) => `<div>${coche(d[name] === val)} ${E(val)} — ${E(lib)}${autre && val === autre.code && d[autre.champ] ? ' : <u>' + E(d[autre.champ]) + '</u>' : ''}</div>`).join('');
    const sg = SIGNES.map(s => cb((d.signes || []).indexOf(s) !== -1, s));
    const lignesSignes = [];
    for (let i = 0; i < sg.length; i += 5) lignesSignes.push(sg.slice(i, i + 5));
    const dernier = lignesSignes[lignesSignes.length - 1] || [];
    // La dernière cellule de la grille reprend « Autres à préciser » comme sur la fiche papier.
    const autres = `<span>${E(d.signesAutres ? '☒' : '☐')} Autres à préciser : <u>${E(d.signesAutres || '')}</u></span>`;
    dernier.push(autres);
    const mal = MALADIES.map(m => cb(d.maladie === m, m));
    const lignesMal = [];
    for (let i = 0; i < mal.length; i += 9) lignesMal.push(mal.slice(i, i + 9));
    const dn = d.dateNaissance ? fmtDate(d.dateNaissance) : '';
    const dt = k => d[k] ? fmtDate(d[k]) : '';
    return `<div class="fiche">
      <div class="top"><span>Ministère de la Santé</span><span>République du Bénin</span></div>
      <h1>1_BJ_FORMULAIRE GENERIQUE DE NOTIFICATION DES MALADIES SOUS SURVEILLANCE</h1>
      <div class="l"><span><b>Département :</b> ${v('departement')}</span><span><b>Zone Sanitaire :</b> ${v('zoneSanitaire')}</span><span><b>Commune :</b> ${v('commune')}</span></div>
      <div class="l"><span><b>Formation Sanitaire :</b> ${v('formationSanitaire', 'g')}</span></div>
      <table class="mal">${lignesMal.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('')}
        <tr><td colspan="9">${cb(d.maladie === 'Autre', 'Autre à préciser :')} <u>${E(d.maladie === 'Autre' ? (d.maladieAutre || '') : '')}</u></td></tr></table>
      <div class="l"><span><b>Année de notification :</b> ${v('annee', 'p')}</span><span><b>Semaine épidémiologique :</b> ${v('semaine', 'p')}</span>
        <span><b>Statut épidémiologique :</b> ${choix('statutEpi', ['En routine', 'En épidémie'])}</span></div>
      <div class="sec">Résidence et identification du cas</div>
      <div class="l"><span><b>Pays</b> ${v('pays')}</span><span><b>Département :</b> ${v('depResidence')}</span><span><b>Commune :</b> ${v('comResidence')}</span><span><b>Arrondissement :</b> ${v('arrondissement')}</span></div>
      <div class="l"><span><b>Ville / Village :</b> ${v('village')}</span><span><b>Quartier :</b> ${v('quartier')}</span><span><b>Adresse :</b> ${v('adresse')}</span>
        <span><b>Urbaine/Rurale</b> ${cb(d.zoneType === 'U', 'U')} ${cb(d.zoneType === 'R', 'R')}</span></div>
      <div class="l"><span><b>Nom du patient :</b> ${v('nomPatient', 'g')}</span><span><b>Père/Mère :</b> ${v('parent')}</span><span><b>Téléphone :</b> ${v('telephone')}</span></div>
      <div class="l"><span><b>Adresse des parents/tuteurs :</b> ${v('adresseParents', 'g')}</span></div>
      <div class="l"><span><b>Date de naissance :</b> <span class="v">${E(dn)}</span></span><span><b>ou Age :</b> ${v('ageAns', 'p')} ans ${v('ageMois', 'p')} mois ${v('ageJours', 'p')} jour</span>
        <span><b>Sexe :</b> ${cb(d.sexe === 'F', 'F')} ${cb(d.sexe === 'M', 'M')}</span></div>
      <table><tr><th>Profession</th><th>Statut matrimonial</th><th>Niveau scolaire</th><th>Nationalité</th></tr>
        <tr class="nb"><td class="nb">${code('profession', PROFESSIONS, { code: '11', champ: 'professionAutre' })}</td><td class="nb">${code('matrimonial', MATRIMONIAL)}</td>
          <td class="nb">${code('niveau', NIVEAUX)}</td><td class="nb">${code('nationalite', NATIONALITES, { code: '2', champ: 'nationaliteAutre' })}</td></tr></table>
      <div class="l"><span><b>Coordonnées GPS : Longitude :</b> ${v('gpsLon')}</span><span><b>Latitude :</b> ${v('gpsLat')}</span></div>
      <div class="sec">Histoire de la maladie</div>
      <div class="l"><span>Date de début des symptômes : <span class="v">${E(dt('dateDebut'))}</span></span><span>Date de consultation : <span class="v">${E(dt('dateConsultation'))}</span></span><span>Date Notification : <span class="v">${E(dt('dateNotification'))}</span></span></div>
      <table>${lignesSignes.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('')}</table>
      <div class="l"><span><b>Type de consultation :</b> ${choix('consultation', ['Externe', 'Hospitalisé'])}</span><span><b>Evolution :</b> ${choix('evolution', ['Vivant', 'Décédé', 'Inconnu'])}</span></div>
      <div class="l"><span><b>Statut vaccinal :</b> ${choix('vaccinal', ['Vacciné', 'Non vacciné'])}</span><span>Si oui, nombre de doses ${v('nbDoses', 'p')}</span><span>Date dernière dose : <span class="v">${E(dt('dateDerniereDose'))}</span></span></div>
      <div class="l"><span><b>Classification Finale :</b></span>${choix('classification', CLASSIF)}</div>
      <div class="l"><span><b>Nom du Notificateur :</b> ${v('notifNom')}</span><span><b>Tél :</b> ${v('notifTel')}</span><span><b>Qualification :</b> ${v('notifQualif')}</span><span><b>Signature :</b> <span class="v sig g"></span></span></div>
      <div class="l"><span>Type de prélèvement : ${PRELEV.map(p => cb((d.prelevements || []).indexOf(p) !== -1, p)).join('&nbsp;&nbsp; ')}</span><span>Aspect LCR : ${v('aspectLcr', 'g')}</span></div>
      <div class="l"><span>${cb(d.prelGorge, 'Prélèvement de gorge')}</span><span>Autre à préciser : ${v('prelAutre', 'g')}</span><span>Date de prélèvement : <span class="v">${E(dt('datePrelevement'))}</span></span></div>
      <div class="l"><span>Heure de prélèvement : ${v('heurePrelevement', 'p')}</span><span>Date d'envoi du prélèvement : <span class="v">${E(dt('dateEnvoi'))}</span></span><span>Heure d'envoi : ${v('heureEnvoi', 'p')}</span></div>
    </div>`;
  }

  // Impression via un iframe caché (évite les blocages de fenêtres surgissantes, notamment sur smartphone).
  function imprimer(liste) {
    if (!liste.length) { toast('Aucune fiche à imprimer.', true); return; }
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Fiche de notification</title><style>${CSS_IMPR}</style></head><body>${liste.map(ficheImprimable).join('')}</body></html>`;
    let fr = document.getElementById('fnPrintFrame');
    if (fr) fr.remove();
    fr = document.createElement('iframe');
    fr.id = 'fnPrintFrame';
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(fr);
    fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { toast("Impression impossible sur cet appareil.", true); } };
    fr.srcdoc = html;
  }

  // ---------------- liste des cas remplis ----------------
  function dessinerListe() {
    const z = document.getElementById('fnListe');
    document.getElementById('fnCompteur').textContent = fiches.length ? '(' + fiches.length + ')' : '';
    if (!fiches.length) { z.innerHTML = '<div class="empty-state">Aucune fiche remplie pour le moment.</div>'; return; }
    let h = `<div class="no-print" style="margin-bottom:10px"><button type="button" class="btn-secondary" id="fnImprTout" style="font-size:.8rem;padding:6px 12px">🖨️ Imprimer toutes les fiches (${fiches.length})</button></div>
      <div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Maladie</th><th>Patient</th><th>Sexe / Âge</th><th>Village</th><th>Sem.</th><th>Évolution</th><th>Classification</th><th></th></tr></thead><tbody>`;
    fiches.forEach(f => {
      h += `<tr><td>${E(fmtDate(f.DateSaisie))}</td><td><strong>${E(f.Maladie)}</strong></td><td>${E(f.NomPatient)}</td><td>${E(f.Sexe)}${f.Age ? ' · ' + E(f.Age) : ''}</td>
        <td>${E(f.Village)}</td><td>${E(f.SemaineEpi)}/${E(f.Annee)}</td><td>${E(f.Evolution)}</td><td>${E(f.Classification)}</td>
        <td style="white-space:nowrap"><button type="button" class="btn-secondary" data-fn="voir" data-id="${E(f.ID)}" style="font-size:.78rem;padding:5px 9px">👁️ Voir</button>
          <button type="button" class="btn-secondary" data-fn="imprimer" data-id="${E(f.ID)}" style="font-size:.78rem;padding:5px 9px">🖨️ Imprimer</button>
          <button type="button" class="btn-secondary" data-fn="modifier" data-id="${E(f.ID)}" style="font-size:.78rem;padding:5px 9px">✏️</button>
          <button type="button" class="btn-danger" data-fn="supprimer" data-id="${E(f.ID)}" style="font-size:.78rem;padding:5px 9px">🗑️</button></td></tr>`;
    });
    z.innerHTML = h + '</tbody></table></div>';
    document.getElementById('fnImprTout').onclick = () => imprimer(fiches);
    z.querySelectorAll('[data-fn]').forEach(b => b.addEventListener('click', () => actionLigne(b.dataset.fn, b.dataset.id)));
  }

  async function actionLigne(action, id) {
    const f = fiches.find(x => x.ID === id); if (!f) return;
    if (action === 'imprimer') imprimer([f]);
    else if (action === 'modifier') modifierFiche(id);
    else if (action === 'voir') apercu(f);
    else if (action === 'supprimer') {
      if (!confirm('Supprimer définitivement la fiche de « ' + (f.NomPatient || '') + ' » ?')) return;
      try { await Api.call('deleteFicheNotif', { id }); toast('Fiche supprimée.'); if (editId === id) nouvelleFiche(); await charger(); }
      catch (e) { toast(e.message, true); }
    }
  }

  function apercu(f) {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.innerHTML = `<div class="modal-box" style="width:860px;max-height:90vh;overflow:auto;background:#fff;color:#000">
      <style>${CSS_IMPR.replace(/@page[^}]*}/, '').replace(/body\s*{[^}]*}/, '').replace(/\.fiche\s*{[^}]*}/, '.fiche{padding:0}')}</style>
      ${ficheImprimable(f)}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button type="button" id="fnApImpr">🖨️ Imprimer</button><button type="button" class="btn-secondary" id="fnApFerm">Fermer</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#fnApFerm').onclick = () => ov.remove();
    ov.querySelector('#fnApImpr').onclick = () => imprimer([f]);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }

  async function charger() {
    try { const r = await Api.call('listFichesNotif', {}); fiches = r.fiches || []; }
    catch (e) { document.getElementById('fnListe').innerHTML = '<div class="empty-state">Erreur de chargement : ' + E(e.message) + '</div>'; return; }
    dessinerListe();
  }

  // ---------------- point d'entrée ----------------
  window.initFicheNotification = async function (opts) {
    ctx = opts;
    const el = document.getElementById(opts.containerId);
    if (!document.getElementById('fnStyle')) {
      const st = document.createElement('style'); st.id = 'fnStyle';
      st.textContent = `.fn-bloc{border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:14px}
        .fn-bloc h3{margin:0 0 10px;font-size:.92rem;color:var(--teal-900)}
        .fn-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px 12px}
        .fn-ligne{display:flex;flex-wrap:wrap;gap:6px 18px}.fn-col{display:flex;flex-direction:column;gap:4px}
        .fn-opt{display:flex;align-items:center;gap:6px;font-weight:400;font-size:.85rem;margin:0;cursor:pointer}
        .fn-opt input{width:auto;margin:0}.fn-age{display:flex;gap:6px}.fn-age input{width:90px}
        .fn-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}`;
      document.head.appendChild(st);
    }
    el.innerHTML = `<p class="petit" style="margin:0 0 12px">Remplissez la fiche officielle de notification (cases à cocher et champs). Chaque fiche enregistrée apparaît dans la liste en bas de page, d'où vous pouvez l'imprimer sur la fiche officielle, la modifier ou la supprimer.</p>
      ${formulaireHtml()}
      <div class="card" style="margin:22px 0 0"><h2>📋 Cas remplis <span id="fnCompteur" class="petit"></span></h2><div id="fnListe">Chargement…</div></div>`;
    // Semaine épidémiologique en cours (calendrier importé par le National), pour pré-remplir année et semaine.
    try {
      const cal = await Api.call('listCalendrier', {});
      const auj = new Date();
      semaineCourante = (cal.calendrier || []).find(r => debutJournee_(r.DateDebut) <= auj && auj <= finJournee_(r.DateFin)) || null;
    } catch (e) { semaineCourante = null; }
    nouvelleFiche();
    document.getElementById('fnReset').onclick = () => { if (confirm('Vider le formulaire ?')) nouvelleFiche(); };
    document.getElementById('fnGps').onclick = () => {
      if (!navigator.geolocation) { toast('La géolocalisation n\'est pas disponible sur cet appareil.', true); return; }
      navigator.geolocation.getCurrentPosition(p => {
        const f = document.getElementById('fnForm');
        f.gpsLon.value = p.coords.longitude.toFixed(6); f.gpsLat.value = p.coords.latitude.toFixed(6);
      }, () => toast('Position introuvable : autorisez la localisation ou saisissez les coordonnées.', true), { enableHighAccuracy: true, timeout: 10000 });
    };
    document.getElementById('fnForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = lireFormulaire();
      if (!d.nomPatient) { toast('Indiquez le nom du patient.', true); return; }
      if (!d.maladie) { toast('Cochez la maladie notifiée.', true); return; }
      const btn = document.getElementById('fnSave'); btn.disabled = true;
      try {
        await Api.call('saveFicheNotif', { id: editId || '', clientId: editId ? '' : clientId(), donnees: d });
        toast(editId ? 'Fiche modifiée.' : 'Fiche enregistrée.');
        nouvelleFiche();
        await charger();
        document.getElementById('fnListe').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) { toast(err.message, true); }
      btn.disabled = false;
    });
    charger();
  };
})();
