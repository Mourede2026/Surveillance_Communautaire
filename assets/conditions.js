/** Évaluateur de conditions d'affichage (« Afficher cette question seulement si… ») — même code que dans Code.gs. À charger avant taches.js. */
(function (g) { g.Conditions =
(function () {
  // Une condition = { op: 'et' | 'ou', regles: [ { champ: <id de la question source>, op, valeur } ] }.
  // Opérateurs : = != > >= < <= contient ne_contient_pas renseigne vide.
  var OPS = ['=', '!=', '>', '>=', '<', '<=', 'contient', 'ne_contient_pas', 'renseigne', 'vide'];
  function vide(v) { return v === '' || v == null || (Array.isArray(v) && v.length === 0); }
  function num(v) { if (v === '' || v == null || Array.isArray(v) || typeof v === 'object') return NaN; var n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; }
  function regle(r, v) {
    var val = r.valeur == null ? '' : String(r.valeur);
    switch (r.op) {
      case 'renseigne': return !vide(v);
      case 'vide': return vide(v);
      case 'contient':
        if (Array.isArray(v)) return v.indexOf(val) !== -1;
        return String(v == null ? '' : v).toLowerCase().indexOf(val.toLowerCase()) !== -1;
      case 'ne_contient_pas': return !regle({ op: 'contient', valeur: val }, v);
      case '=': case '!=': {
        var egal;
        if (Array.isArray(v)) egal = v.length === 1 && v[0] === val;
        else if (vide(v)) egal = false;
        else { var a = num(v), b = num(val); egal = (isFinite(a) && isFinite(b)) ? a === b : String(v) === val; }
        return r.op === '=' ? egal : !egal;
      }
      default: {
        if (vide(v) || Array.isArray(v)) return false;
        var x = num(v), y = num(val), c;
        if (isFinite(x) && isFinite(y)) c = x < y ? -1 : (x > y ? 1 : 0);
        else { var s = String(v); c = s < val ? -1 : (s > val ? 1 : 0); }   // dates AAAA-MM-JJ et heures HH:MM : comparaison de texte
        return r.op === '>' ? c > 0 : r.op === '>=' ? c >= 0 : r.op === '<' ? c < 0 : r.op === '<=' ? c <= 0 : false;
      }
    }
  }
  // valeurDe(id) : réponse (texte, nombre ou liste) donnée à la question `id` ; une question masquée vaut « vide ».
  function evaluer(cond, valeurDe) {
    if (!cond || !Array.isArray(cond.regles) || !cond.regles.length) return true;
    var res = cond.regles.map(function (r) { return regle(r, valeurDe(r.champ)); });
    return cond.op === 'ou' ? res.some(Boolean) : res.every(Boolean);
  }
  return { OPS: OPS, evaluer: evaluer, regle: regle, vide: vide };
})()
; })(typeof window !== 'undefined' ? window : globalThis);
