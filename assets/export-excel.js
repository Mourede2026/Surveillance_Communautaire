/**
 * Export Excel (.xlsx) sans aucune librairie : fonctionne hors ligne dans l'application installée.
 *
 * ExportExcel.telecharger(nomFichier, feuilles)   -> construit le classeur et le télécharge
 * ExportExcel.creerClasseur(feuilles)             -> Uint8Array du fichier .xlsx
 * ExportExcel.svgVersPng(svgElement, opts)        -> Promise<Uint8Array> (PNG) pour insérer un graphique
 *
 * Une feuille : {
 *   nom: 'Synthèse',
 *   lignes: [[cellule, ...], ...],      // cellule = texte | nombre | null | { v, s } avec s ∈ 'h','b','t','c','n'
 *   entete: 1,                          // nb de lignes d'en-tête (style tableau, figées en haut)
 *   filtre: true,                       // filtre automatique Excel sur la ligne d'en-tête
 *   largeurs: [30, 12, ...],            // largeur des colonnes (en caractères)
 *   hauteurs: { 9: 42 },                // hauteur (points) de lignes précises, index base 0
 *   sansBordure: true,                  // pour les feuilles d'information (libellé / valeur)
 *   images: [{ png: Uint8Array, col: 0, ligne: 3, larg: 560, haut: 210 }]   // col/ligne : base 0 ; px
 * }
 */
(function (global) {
  'use strict';

  // ---------- ZIP (méthode « stockée », sans compression) ----------
  const TABLE_CRC = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
  })();
  function crc32(octets) { let c = 0xFFFFFFFF; for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  const enc = new TextEncoder();
  function octets(x) { return typeof x === 'string' ? enc.encode(x) : x; }

  function zip(fichiers) {
    const DATE = ((2026 - 1980) << 9) | (1 << 5) | 1, HEURE = 0;
    const morceaux = [], centrale = []; let decalage = 0;
    fichiers.forEach(f => {
      const nom = enc.encode(f.nom), data = octets(f.data), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, HEURE, true); lh.setUint16(12, DATE, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nom.length, true); lh.setUint16(28, 0, true);
      morceaux.push(new Uint8Array(lh.buffer), nom, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, HEURE, true); ch.setUint16(14, DATE, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nom.length, true);
      ch.setUint32(42, decalage, true);
      centrale.push(new Uint8Array(ch.buffer), nom);
      decalage += 30 + nom.length + data.length;
    });
    const tailleCentrale = centrale.reduce((t, m) => t + m.length, 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, fichiers.length, true); fin.setUint16(10, fichiers.length, true);
    fin.setUint32(12, tailleCentrale, true); fin.setUint32(16, decalage, true);
    const tout = morceaux.concat(centrale, [new Uint8Array(fin.buffer)]);
    const total = tout.reduce((t, m) => t + m.length, 0), sortie = new Uint8Array(total); let p = 0;
    tout.forEach(m => { sortie.set(m, p); p += m.length; });
    return sortie;
  }

  // ---------- XML ----------
  function esc(v) { return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colLettre(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const STYLES = { h: 1, b: 2, t: 3, c: 4, n: 5 };

  const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="' + NS_MAIN + '">' +
    '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="14"/><color rgb="FF0B3D3A"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF0B3D3A"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFBFC8C5"/></left><right style="thin"><color rgb="FFBFC8C5"/></right><top style="thin"><color rgb="FFBFC8C5"/></top><bottom style="thin"><color rgb="FFBFC8C5"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="6">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function celluleXml(valeur, ref, defautStyle) {
    let v = valeur, s = defautStyle;
    if (valeur !== null && typeof valeur === 'object' && !(valeur instanceof Date)) { v = valeur.v; if (valeur.s) s = STYLES[valeur.s] != null ? STYLES[valeur.s] : s; }
    const sa = s ? ' s="' + s + '"' : '';
    if (v === null || v === undefined || v === '') return s ? '<c r="' + ref + '"' + sa + '/>' : '';
    if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + sa + '><v>' + v + '</v></c>';
    return '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
  }

  function feuilleXml(f, avecDessin) {
    const lignes = f.lignes || [], nbEnt = f.entete || 0;
    const nbCols = lignes.reduce((m, l) => Math.max(m, l.length), 0);
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="' + NS_MAIN + '" xmlns:r="' + NS_R + '">';
    x += '<sheetViews><sheetView workbookViewId="0"' + (f.sansBordure ? ' showGridLines="0"' : '') + '>' +
      (nbEnt ? '<pane ySplit="' + nbEnt + '" topLeftCell="A' + (nbEnt + 1) + '" activePane="bottomLeft" state="frozen"/>' : '') + '</sheetView></sheetViews>';
    x += '<sheetFormatPr defaultRowHeight="15"/>';
    if (f.largeurs && f.largeurs.length) x += '<cols>' + f.largeurs.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>';
    x += '<sheetData>';
    lignes.forEach((l, i) => {
      const defaut = i < nbEnt ? STYLES.h : (f.sansBordure ? 0 : null);
      var ht = (f.hauteurs && f.hauteurs[i]) || (i < nbEnt ? 30 : 0);
      x += '<row r="' + (i + 1) + '"' + (ht ? ' ht="' + ht + '" customHeight="1"' : '') + '>';
      l.forEach((c, j) => {
        let sd = defaut;
        if (sd === null) sd = (typeof c === 'number' || (c && typeof c.v === 'number')) ? STYLES.n : STYLES.c;
        x += celluleXml(c, colLettre(j) + (i + 1), sd);
      });
      x += '</row>';
    });
    x += '</sheetData>';
    if (f.filtre && nbEnt && lignes.length > nbEnt && nbCols) x += '<autoFilter ref="A' + nbEnt + ':' + colLettre(nbCols - 1) + lignes.length + '"/>';
    if (avecDessin) x += '<drawing r:id="rId1"/>';
    return x + '</worksheet>';
  }

  function dessinXml(images, premierIdMedia) {
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="' + NS_R + '">';
    images.forEach((im, k) => {
      const cx = Math.round(im.larg * 9525), cy = Math.round(im.haut * 9525);
      x += '<xdr:oneCellAnchor><xdr:from><xdr:col>' + (im.col || 0) + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + (im.ligne || 0) + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
        '<xdr:ext cx="' + cx + '" cy="' + cy + '"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' + (k + 2) + '" name="Graphique ' + (k + 1) + '"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
        '<xdr:blipFill><a:blip r:embed="rId' + (k + 1) + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
        '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>';
    });
    return x + '</xdr:wsDr>';
  }

  function nomFeuille(nom, pris) {
    let n = String(nom || 'Feuille').replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Feuille', base = n, i = 2;
    while (pris.indexOf(n.toLowerCase()) >= 0) { n = base.slice(0, 28) + ' ' + i++; }
    pris.push(n.toLowerCase()); return n;
  }

  function creerClasseur(feuilles) {
    const fichiers = [], pris = [], noms = [];
    let nMedia = 0, nDessin = 0;
    const types = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>', '<Default Extension="xml" ContentType="application/xml"/>', '<Default Extension="png" ContentType="image/png"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'];
    feuilles.forEach((f, i) => {
      const idx = i + 1, imgs = (f.images || []).filter(im => im && im.png);
      noms.push(nomFeuille(f.nom, pris));
      fichiers.push({ nom: 'xl/worksheets/sheet' + idx + '.xml', data: feuilleXml(f, imgs.length > 0) });
      types.push('<Override PartName="/xl/worksheets/sheet' + idx + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
      if (imgs.length) {
        nDessin++;
        fichiers.push({ nom: 'xl/worksheets/_rels/sheet' + idx + '.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + NS_REL + '"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing' + nDessin + '.xml"/></Relationships>' });
        fichiers.push({ nom: 'xl/drawings/drawing' + nDessin + '.xml', data: dessinXml(imgs) });
        types.push('<Override PartName="/xl/drawings/drawing' + nDessin + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');
        let rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + NS_REL + '">';
        imgs.forEach((im, k) => { nMedia++; rels += '<Relationship Id="rId' + (k + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image' + nMedia + '.png"/>'; fichiers.push({ nom: 'xl/media/image' + nMedia + '.png', data: im.png }); });
        fichiers.push({ nom: 'xl/drawings/_rels/drawing' + nDessin + '.xml.rels', data: rels + '</Relationships>' });
      }
    });
    fichiers.unshift(
      { nom: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' + types.join('') + '</Types>' },
      { nom: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + NS_REL + '"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { nom: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="' + NS_MAIN + '" xmlns:r="' + NS_R + '"><sheets>' + noms.map((n, i) => '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
      { nom: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + NS_REL + '">' + noms.map((n, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (noms.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { nom: 'xl/styles.xml', data: STYLES_XML });
    return zip(fichiers);
  }

  function telecharger(nomFichier, feuilles) {
    const blob = new Blob([creerClasseur(feuilles)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nomFichier.replace(/[\\/:*?"<>|]/g, '-');
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  // Graphique SVG de la page -> PNG (couleurs et styles figés, fond blanc). Retourne Promise<Uint8Array>.
  function svgVersPng(svgEl, opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      try {
        const vb = svgEl.viewBox && svgEl.viewBox.baseVal, L = Math.round((vb && vb.width) || 560), H = Math.round((vb && vb.height) || 210), echelle = opts.echelle || 2;
        const racine = getComputedStyle(document.documentElement);
        const clone = svgEl.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', L); clone.setAttribute('height', H);
        const css = '.tend-grille{stroke:#D9E0DD;stroke-width:1}.tend-txt{fill:#55655F;font-size:13px;font-family:Arial,Helvetica,sans-serif}';
        let src = new XMLSerializer().serializeToString(clone)
          .replace(/var\((--[\w-]+)\)/g, (m, v) => (racine.getPropertyValue(v) || '#555').trim())
          .replace(/<svg([^>]*)>/, '<svg$1><style>' + css + '</style><rect width="100%" height="100%" fill="#FFFFFF"/>');
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas'); cv.width = L * echelle; cv.height = H * echelle;
          const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
          cv.toBlob(b => { if (!b) return reject(new Error('Conversion image impossible')); b.arrayBuffer().then(ab => resolve(new Uint8Array(ab)), reject); }, 'image/png');
        };
        img.onerror = () => reject(new Error('Image du graphique illisible'));
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
      } catch (e) { reject(e); }
    });
  }

  const API = { telecharger, creerClasseur, svgVersPng, _zip: zip, _crc32: crc32 };
  global.ExportExcel = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
