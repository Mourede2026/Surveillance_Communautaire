/**
 * Contenu des guides d'utilisation, un par niveau (RC, ASCQ, PF_CNLS_TP, RCSE, DEPARTEMENT, NATIONAL).
 * Chaque guide = { titre, intro, sections: [{ id, titre, html }] }. Affichage : assets/guide.js.
 */
(function () {
  const e = (items) => '<ol class="g-etapes">' + items.map(i => '<li>' + i + '</li>').join('') + '</ol>';
  const l = (items) => '<ul>' + items.map(i => '<li>' + i + '</li>').join('') + '</ul>';
  const astuce = (t) => '<div class="g-note g-astuce"><strong>💡 Astuce.</strong> ' + t + '</div>';
  const attention = (t) => '<div class="g-note g-attention"><strong>⚠️ Important.</strong> ' + t + '</div>';
  const menu = (t) => '<span class="g-menu">' + t + '</span>';

  // ---------- Sections communes ----------
  const connexion = (role) => ({
    id: 'connexion', titre: 'Se connecter et installer l\'application',
    html: `<p>L'application fonctionne dans le navigateur du téléphone ou de l'ordinateur, et peut être <strong>installée comme une application</strong>.</p>
      <h4>Se connecter</h4>
      ${e(['Ouvrez l\'application : la page de connexion s\'affiche.', 'Saisissez votre <strong>numéro de téléphone</strong> (c\'est votre identifiant) et votre <strong>mot de passe</strong>, remis par votre responsable' + (role === 'NATIONAL' ? ' (compte national initial : changez son mot de passe tout de suite, voir « Premiers pas »)' : '') + '.', 'Appuyez sur <strong>Se connecter</strong> : vous arrivez directement dans votre espace.'])}
      <p>Votre session reste ouverte sur l'appareil jusqu'à ce que vous vous déconnectiez ou qu'elle expire ; dans ce cas l'application vous demande simplement de vous reconnecter.</p>
      <h4>Installer l'application sur le téléphone</h4>
      ${e(['Ouvrez le site dans <strong>Chrome</strong> (Android) ou <strong>Safari</strong> (iPhone).', 'Android : menu ⋮ → <strong>Installer l\'application</strong> (ou « Ajouter à l\'écran d\'accueil »). iPhone : bouton Partager → <strong>Sur l\'écran d\'accueil</strong>.', 'Lancez-la ensuite depuis l\'icône : elle s\'ouvre en plein écran, et tourne en <strong>portrait comme en paysage</strong> (activez la rotation automatique du téléphone).'])}
      ${astuce('Après une mise à jour importante, si l\'écran ne change pas, fermez complètement l\'application et rouvrez-la ; au besoin désinstallez puis réinstallez-la.')}`
  });

  const profil = () => ({
    id: 'profil', titre: 'Votre profil (bouton en haut à droite)',
    html: `<p>Le <strong>bouton rond</strong> en haut à droite (silhouette blanche, ou votre photo) ouvre le menu du profil :</p>
      ${l(['<strong>⚙️ Modifier mes paramètres</strong> : changez votre nom, prénom, numéro de téléphone (identifiant de connexion) et mot de passe ; ajoutez ou retirez votre <strong>photo de profil</strong> (« Choisir une photo »). La photo est enregistrée dans votre compte et vous suit sur tous vos appareils.',
        '<strong>Thème</strong> : Clair, Sombre ou Auto (suit le réglage du téléphone). Le choix est mémorisé sur l\'appareil.',
        '<strong>Couleur de l\'application</strong> : choisissez parmi plusieurs couleurs (vert, rouge, bleu foncé, bleu océan, violet, orange, rose, gris ardoise) ou une couleur de votre choix (« Autre… »). Elle s\'applique tout de suite à l\'ensemble de l\'application et est enregistrée dans votre compte.',
        '<strong>Changer de compte</strong> : si plusieurs personnes (ou plusieurs comptes) utilisent le même téléphone, vous basculez de l\'un à l\'autre sans retaper le mot de passe tant que la session est valide. « Ajouter un autre compte » ouvre la page de connexion pour un nouveau compte.',
        '<strong>Se déconnecter</strong> : ferme la session de ce compte sur l\'appareil.'])}
      ${attention('Si vous changez votre numéro de téléphone, c\'est le <strong>nouveau numéro</strong> qu\'il faudra utiliser pour vous connecter.')}
      <p>Le bouton <strong>📖 Guide</strong>, à côté du profil, rouvre ce guide à tout moment.</p>`
  });

  const tableauBord = (role) => ({
    id: 'tableau', titre: 'Le tableau de bord',
    html: `<p>Le tableau de bord est la page d'accueil de votre espace (menu ${menu('Tableau de bord')}).</p>
      ${l(['Quatre <strong>compteurs</strong> : alertes notifiées, décès notifiés, éléments en attente d\'investigation, notifications non lues' + (role === 'RC' ? ' (les vôtres).' : ' (pour <strong>votre périmètre</strong>).'), 'La pastille <strong>« Semaine … / année »</strong> en haut indique la semaine épidémiologique courante.'].concat(role === 'RC' ? [] : ['La carte <strong>Détail par site</strong> liste, par village, arrondissement ou commune, où se trouvent les cas ; les onglets permettent de changer de niveau géographique.']))}
      <h4>📊 Tendances par semaine épidémiologique</h4>
      <p>Sous les compteurs, un graphique est tracé <strong>pour chaque événement notifié</strong> (chaque maladie ou type d'alerte, et les décès) : une barre par semaine, de la semaine 1 à la dernière de l'année. <strong>S'il n'y a aucune notification, la série reste à zéro.</strong></p>
      ${l(['<strong>Année</strong> : choisissez l\'année à afficher.', 'Boutons <strong>▮ Histogramme</strong> (barres collées) ou <strong>📈 Courbe</strong> pour changer la forme.',
        role === 'RC' ? 'Vous ne voyez que vos propres notifications.' : 'Les <strong>filtres</strong> Département / Commune / Arrondissement / Village (selon votre niveau) restreignent tous les graphiques à une zone. Un filtre n\'apparaît que s\'il offre un vrai choix dans votre périmètre.',
        'Survolez (ou touchez) une barre pour lire le nombre de notifications de la semaine. Seuls les décès <strong>confirmés</strong> (ou en attente de confirmation) sont comptés, pas ceux refusés.'])}`
  });

  const notifications = (role) => ({
    id: 'notifications', titre: 'Notifications',
    html: `<p>Menu ${menu('🔔 Notifications')} (et pastille de compteur) : toutes les informations qui vous concernent y arrivent.</p>
      ${l(role === 'RC' ? ['Décision de votre ASCQ sur un décès notifié (confirmé ou non, avec le motif).', 'Convocation à un <strong>suivi groupé</strong> planifié par votre ASCQ.', 'Nouvelles <strong>activités</strong> demandées par vos responsables, et leurs commentaires.'] :
        role === 'ASCQ' ? ['Nouvelles alertes et décès notifiés par vos RC.', 'Nouvelles <strong>activités</strong> demandées par vos responsables et leurs commentaires.', 'Les décisions et rappels liés à votre zone.'] :
        ['Alertes et décès remontés par les niveaux inférieurs de votre zone.', 'Nouvelles <strong>activités</strong> demandées par vos responsables (le cas échéant) et leurs commentaires.'])}
      <p>Touchez une notification pour la marquer comme lue, ou utilisez <strong>Tout marquer comme lu</strong>. Une alerte ne reste plus « non lue » une fois l'investigation terminée.</p>`
  });

  const activitesRecues = () => ({
    id: 'activites-recues', titre: 'Activités reçues (liens de collecte, formations, tests)',
    html: `<p>Vos responsables peuvent vous demander de réaliser une <strong>activité</strong> : remplir un formulaire de collecte de données (Google Forms, KoboCollect…), suivre une formation, passer un test, lire un document. Menu ${menu('🔗 Activités')} → onglet <strong>Reçues</strong>.</p>
      ${e(['Chaque carte indique le <strong>type</strong>, le <strong>titre</strong>, qui l\'a demandée, les <strong>consignes</strong>, les <strong>commentaires</strong> du demandeur et l\'<strong>échéance</strong>.', 'Appuyez sur <strong>Ouvrir le lien ↗</strong> : le formulaire, la formation ou le test s\'ouvre dans un nouvel onglet (l\'activité passe à « Ouvert »).', 'Quand c\'est fini, appuyez sur <strong>✔ J\'ai terminé</strong>. Votre responsable voit ainsi qui a terminé. « Annuler “fait” » remet l\'activité à faire.', 'Utilisez le filtre <em>Toutes / À faire / Faites</em> pour retrouver une activité.'])}
      ${attention('<strong>Après l\'échéance, l\'activité disparaît de votre liste</strong> : terminez-la avant la date limite. Vous ne pouvez pas demander d\'activité à un niveau supérieur ; seul un niveau supérieur peut en demander à ceux qui sont en dessous de lui.')}`
  });

  const activitesDemander = (role, cibles) => ({
    id: 'activites-demander', titre: 'Demander une activité aux niveaux inférieurs',
    html: `<p>Votre niveau peut publier des activités pour ${cibles}. Menu ${menu('🔗 Activités')} → <strong>Demander une activité</strong>.</p>
      ${e(['Choisissez le <strong>type</strong> : Collecte de données, Formation, Test / Quiz, Information / Document ou Autre.', 'Saisissez le <strong>titre</strong> et le <strong>lien</strong> (doit commencer par <code>https://</code>), par exemple le lien d\'un formulaire Google Forms, d\'une formation en ligne ou d\'un test.', 'Renseignez l\'<strong>échéance</strong> (<strong>obligatoire</strong>) : passée cette date, les destinataires ne voient plus l\'activité.', 'Ajoutez des <strong>consignes</strong> (public concerné, comment remplir…).', 'Cochez les <strong>niveaux destinataires</strong> : uniquement des niveaux situés <strong>en dessous du vôtre</strong>, et seulement les comptes de <strong>votre propre hiérarchie</strong>.', 'Appuyez sur <strong>Publier l\'activité</strong> : les comptes concernés sont notifiés.'])}
      <h4>Suivre et gérer vos activités</h4>
      ${l(['Le tableau <strong>Mes activités demandées</strong> montre, pour chacune, l\'avancement (X/Y ont terminé, N en cours) et son éventuel état « Échue ».', '<strong>Détails</strong> : voir <em>qui a ouvert / terminé</em>, <strong>modifier</strong> le titre, le lien, les consignes ou l\'échéance (prolonger l\'échéance la rend de nouveau visible), ajouter un <strong>commentaire</strong> (les destinataires sont notifiés), <strong>archiver</strong> (masquer) ou <strong>supprimer</strong>.', 'Vous seul (le demandeur) retrouvez toutes vos activités, même échues ; les subalternes ne voient que celles dont l\'échéance n\'est pas passée.'])}`
  });

  const briefing = () => ({
    id: 'briefing', titre: 'Briefing maladies',
    html: `<p>Menu ${menu('📋 Briefing maladies')} : fiches pédagogiques sur les maladies à surveiller (définition de cas, signes, conduite à tenir) et vidéos. C'est votre aide-mémoire : consultez-le avant de notifier une alerte pour bien choisir le type d'événement.</p>`
  });

  const rapport = (portee) => ({
    id: 'rapport', titre: 'Rapport hebdomadaire',
    html: `<p>Menu ${menu('Rapport hebdomadaire')} : le rapport (« Support 4 ») de ${portee} est <strong>généré automatiquement</strong> à partir des notifications de la semaine épidémiologique, sans saisie.</p>
      ${l(['Choisissez l\'<strong>année</strong> et la <strong>semaine</strong> pour afficher le rapport correspondant ; il reproduit le canevas officiel (alertes détectées, personnes touchées et décédées, alertes vérifiées en 24-48 h, alertes avérées, décès maternels, néonatals, infantiles, etc.).', '<strong>Seuls les décès confirmés par l\'ASCQ</strong> sont comptés.', 'Les rapports des niveaux supérieurs additionnent ceux des niveaux inférieurs.'])}
      ${astuce('Si un chiffre vous semble faux, vérifiez d\'abord que tous les décès ont bien été confirmés (onglet « Décès à confirmer » de l\'ASCQ) et que les alertes ont été investiguées.')}`
  });

  const suiviGroupeLecture = (portee) => ({
    id: 'suivi-lecture', titre: 'Suivis groupés des RC (consultation)',
    html: `<p>Les ASCQ organisent des <strong>suivis groupés</strong> : réunions avec leurs RC dans un ou plusieurs villages. Menu ${menu('👥 Suivi groupé RC')} : vous consultez, en <strong>lecture seule</strong>, les plannings et les comptes rendus de ${portee}.</p>
      ${l(['Les <strong>indicateurs</strong> en haut résument les séances planifiées, réalisées et non réalisées.', 'Utilisez les <strong>filtres</strong> (statut Réalisé / Non réalisé / À venir, ASCQ, dates « du … au … ») pour retrouver une séance.', 'Ouvrez la <strong>fiche</strong> d\'une séance : date, lieu, villages, thèmes, RC présents et absents, commentaires, <strong>photos et documents de preuve</strong> ; elle peut être imprimée.', 'Le planning est visible dès sa création : vous savez à l\'avance quelles séances ont lieu.'])}
      <p>Vous ne pouvez pas modifier ces rapports : ils sont <strong>verrouillés</strong> dès que l'ASCQ les enregistre.</p>`
  });

  const gestionUtilisateurs = (qui) => ({
    id: 'utilisateurs', titre: 'Gérer les comptes (modifier, désactiver, supprimer)',
    html: `<p>Dans la liste des comptes de ${qui}, chaque ligne propose des boutons :</p>
      ${l(['<strong>Modifier</strong> : corrige nom, prénom, téléphone, mot de passe ou rattachement géographique.', '<strong>Désactiver / Réactiver</strong> : bloque temporairement la connexion sans rien supprimer (départ en congé, erreur…).', '<strong>Supprimer</strong> : supprime définitivement le compte <strong>et tous les comptes placés sous lui</strong> (un aperçu liste les comptes concernés ; il faut taper SUPPRIMER pour confirmer). La ligne disparaît aussi du Google Sheet.'])}
      ${attention('Vous ne pouvez supprimer ni votre propre compte, ni un compte national, ni un compte qui ne dépend pas de vous. Les données déjà collectées (alertes, décès…) ne sont pas effacées par la suppression d\'un compte.')}`
  });

  const nettoyage = (niveau) => ({
    id: 'nettoyage', titre: 'Nettoyage',
    html: `<p>Menu ${menu('🗑️ Nettoyage des données')} :</p>
      ${niveau === 'NATIONAL' ? l(['Vous voyez le nombre de lignes par catégorie : alertes et investigations, décès, rapports, suivis groupés, activités, notifications, journal des assignations, calendrier, géographie, comptes.', 'Cochez les catégories à vider, tapez <strong>SUPPRIMER</strong> puis confirmez. Les comptes NATIONAL ne sont jamais supprimés.', 'Utile pour repartir à zéro après des tests ou une formation (par exemple supprimer les données de test avant le démarrage officiel).']) :
        l(['Vous pouvez supprimer les <strong>comptes placés sous vous</strong> et les <strong>activités que vous avez créées</strong>.', 'Les <strong>données collectées</strong> (alertes, décès, investigations, rapports, suivis) ne peuvent pas être supprimées à votre niveau : elles sont réservées au compte national.', 'Cochez la catégorie, tapez <strong>SUPPRIMER</strong> puis confirmez.'])}
      ${attention('La suppression est <strong>définitive</strong> (y compris dans le Google Sheet) et ne peut pas être annulée.')}`
  });

  const faq = (extra) => ({
    id: 'faq', titre: 'Problèmes fréquents',
    html: `<dl class="g-faq">
      <dt>« Session invalide ou expirée »</dt><dd>Reconnectez-vous avec votre téléphone et votre mot de passe.</dd>
      <dt>Numéro de téléphone inconnu ou compte désactivé</dt><dd>Vérifiez le numéro saisi, puis demandez à votre responsable de réactiver votre compte ou de vérifier qu'il existe.</dd>
      <dt>Une page affiche « Erreur de chargement »</dt><dd>Vérifiez la connexion Internet, puis rechargez la page. Si cela persiste, déconnectez-vous et reconnectez-vous.</dd>
      <dt>L'application ne tourne pas en paysage</dt><dd>Activez la rotation automatique du téléphone ; si l'application a été installée avant la dernière mise à jour, désinstallez-la puis réinstallez-la.</dd>
      <dt>L'écran ne se met pas à jour après une mise à jour de l'application</dt><dd>Fermez complètement l'application et rouvrez-la.</dd>
      ${extra || ''}
      </dl>`
  });

  // ---------- RC ----------
  const RC = {
    titre: 'Guide du Relais Communautaire (RC)',
    intro: 'Vous êtes la sentinelle de votre village : vous notifiez, dès que vous les constatez, les événements de santé inhabituels (alertes) et les décès. Votre ASCQ reçoit aussitôt votre notification et va vérifier.',
    sections: [
      { id: 'role', titre: 'Votre rôle et le circuit de l\'information', html: `<p>Chaque notification que vous envoyez suit toute la chaîne :</p>
        <p class="g-chaine">RC → ASCQ (investigue) → PF CNLS-TP (commune) → RCSE (zone sanitaire) → Département → National</p>
        ${l(['<strong>Alerte</strong> : tout événement de santé inhabituel (maladie à surveillance, morsure, animaux malades ou morts, événement étrange…).', '<strong>Décès</strong> : tout décès survenu dans votre village.', 'Vous ne voyez que <strong>vos propres</strong> notifications et vos informations de village / grappe.'])}
        ${astuce('Notifiez <strong>tout de suite</strong>, même si vous n\'êtes pas certain : c\'est l\'ASCQ qui vérifie et confirme.')}` },
      connexion('RC'), profil(),
      tableauBord('RC'),
      { id: 'alerte', titre: 'Notifier une alerte', html: `<p>Menu ${menu('Notifier une alerte')}.</p>
        ${e(['Le formulaire est <strong>déjà prérempli</strong> : semaine épidémiologique, département, commune, arrondissement, village et grappe viennent de votre compte (champs grisés, non modifiables).', '<strong>Identification de la personne</strong> : nom, sexe, téléphone, date de naissance ou âge, adresse.', '<strong>Type d\'événement</strong> : choisissez dans la liste (1. Rougeole, 2. Choléra, 3. Méningite, 4. PFA, 5. FHV Lassa, 6. FHV Ebola, 7. Fièvre jaune, 8. Dengue, 9. Anthrax, 10. Shigellose, 11. Grippes aviaires, 12. Rage, 13. COVID-19, 14. Mpox, 15-17. Morsures, 18. Animaux malades, 19. Animaux morts, 20. Autre événement inhabituel). Pour « Autre », précisez dans le champ prévu.', '<strong>Dates</strong> : début de la maladie et date de notification.', '<strong>Signes</strong> : cochez tous les signes observés.', '<strong>Ampleur</strong> : personnes touchées, personnes décédées, animaux malades, animaux morts.', 'Contrôlez, puis appuyez sur <strong>Envoyer</strong>. Un message confirme : « Alerte notifiée avec succès. Votre ASCQ a été informé. »'])}
        ${attention('Une fois envoyée, l\'alerte ne se modifie plus : relisez avant d\'envoyer. En cas d\'erreur, prévenez votre ASCQ.')}` },
      { id: 'deces', titre: 'Notifier un décès', html: `<p>Menu ${menu('Notifier un décès')}.</p>
        ${e(['Zone, période et grappe sont préremplies comme pour l\'alerte.', '<strong>Identification du défunt</strong> : nom, sexe, âge (années, mois, jours), date de naissance, parent à joindre et son téléphone, adresse.', '<strong>Type de décès</strong> : maternel ; bébé de 0 à 28 jours ; enfant de 1 mois à 1 an ; enfant de 1 à 5 ans ; personne de plus de 5 ans.', '<strong>Circonstances</strong> : date et lieu du décès, circonstances, cause probable, signes observés.', 'Appuyez sur <strong>Envoyer</strong>.'])}
        ${attention('Votre ASCQ doit <strong>confirmer</strong> le décès. Tant qu\'il ne l\'a pas confirmé, il n\'est pas compté dans le rapport hebdomadaire. Vous recevez la décision (confirmé ou non, avec le motif) dans vos notifications.')}` },
      { id: 'historique', titre: 'Historique', html: `<p>Menu ${menu('Historique')} : retrouvez toutes vos notifications passées. Deux boutons permettent de basculer entre vos <strong>alertes</strong> et vos <strong>décès</strong>. Vous y voyez la date, le type, la semaine épidémiologique et l'état (par exemple investiguée, ou décès confirmé / non confirmé).</p>` },
      notifications('RC'), activitesRecues(), briefing(),
      { id: 'suivi-rc', titre: 'Les suivis groupés auxquels vous êtes convoqué', html: `<p>Votre ASCQ organise périodiquement des <strong>suivis groupés</strong> (réunions avec plusieurs RC). Quand une séance est planifiée, vous recevez une notification <strong>📅 Suivi groupé</strong> indiquant la date, l'heure, le lieu et les thèmes. Présentez-vous à la séance ; votre présence est enregistrée par l'ASCQ dans la liste de présence.</p>` },
      faq('')
    ]
  };

  // ---------- ASCQ ----------
  const ASCQ = {
    titre: 'Guide de l\'ASCQ (Agent de Santé Communautaire Qualifié)',
    intro: 'Vous encadrez les relais communautaires de votre arrondissement : vous investiguez les alertes, confirmez les décès, gérez vos RC, organisez les suivis groupés et suivez le rapport hebdomadaire.',
    sections: [
      { id: 'role', titre: 'Votre rôle', html: `<p>Votre compte couvre l'arrondissement (ou les arrondissements) que votre PF CNLS-TP vous a rattaché. Plusieurs ASCQ du même arrondissement partagent les mêmes données et le même rapport.</p>
        ${l(['<strong>Investiguer</strong> chaque alerte notifiée par vos RC.', '<strong>Confirmer ou non</strong> chaque décès notifié.', '<strong>Créer et suivre vos RC</strong> (comptes, villages, grappes).', '<strong>Planifier et enregistrer les suivis groupés</strong> de vos RC.', 'Consulter le <strong>rapport hebdomadaire</strong> de votre arrondissement.', 'Recevoir et demander des <strong>activités</strong> (aux RC).'])}` },
      connexion('ASCQ'), profil(), tableauBord('ASCQ'),
      { id: 'investiguer', titre: 'À investiguer : les alertes en attente', html: `<p>Menu ${menu('À investiguer')} (liste « Alertes en attente d'investigation »).</p>
        ${e(['Chaque ligne est une alerte notifiée par un RC de votre zone, non encore investiguée. Appuyez sur <strong>Investiguer</strong>.', 'Dans la <strong>Fiche d\'investigation</strong>, indiquez d\'abord si l\'<strong>événement est avéré</strong>, puis la source, la maladie, la description et les circonstances, les dates de survenue, de notification et d\'investigation.', 'Renseignez les <strong>cas par catégorie</strong> et les <strong>décès par catégorie</strong>, ainsi que les <strong>actions menées</strong>.', 'Enregistrez : l\'alerte quitte la liste, et la notification correspondante passe automatiquement à « lue ».'])}
        ${attention('L\'investigation doit être faite dans les <strong>24 à 48 heures</strong> : le rapport hebdomadaire compte les alertes vérifiées dans ce délai.')}` },
      { id: 'deces', titre: 'Décès à confirmer', html: `<p>Menu ${menu('⚰️ Décès à confirmer')}. Quand un RC notifie un décès, vous recevez une notification et le décès apparaît ici.</p>
        ${e(['Vérifiez le décès (sur le terrain, auprès de la famille ou du RC).', 'Appuyez sur <strong>Confirmer</strong> si le décès est avéré.', 'Sinon appuyez sur <strong>Ne pas confirmer</strong> et saisissez le <strong>motif</strong> (obligatoire).'])}
        ${attention('La décision est <strong>définitive</strong>. <strong>Seuls les décès confirmés sont comptés dans le rapport hebdomadaire.</strong> Le RC est notifié de votre décision.')}` },
      { id: 'relais', titre: 'Mes relais (RC) : créer et gérer', html: `<p>Menu ${menu('Mes relais (RC)')}.</p>
        <h4>Créer un compte RC</h4>
        ${e(['Remplissez <strong>Nom, Prénom, Téléphone</strong> (identifiant de connexion) et <strong>Mot de passe</strong>.', 'Choisissez le <strong>village</strong> parmi ceux de vos arrondissements : un RC n\'a <strong>qu\'un seul village</strong>.', 'Saisissez le <strong>numéro de sa grappe</strong> (nombre de 1 à 20) ; le <strong>nom de la grappe</strong> est facultatif. Si la grappe existe déjà dans ce village, elle est réutilisée.', 'Appuyez sur <strong>Créer le compte</strong>, puis remettez au RC son téléphone et son mot de passe.'])}
        <h4>Gérer vos RC</h4>
        ${l(['Le tableau « Mes relais communautaires » liste vos RC avec leur village et leurs grappes.', '<strong>Assigner une grappe supplémentaire</strong> (optionnel) : en plus de sa grappe principale, un RC peut couvrir une autre grappe — dans son même village, dans un autre village de son arrondissement ou dans un autre arrondissement de votre commune. Choisissez l\'arrondissement, le village, puis saisissez le numéro (1 à 20) et, si vous le souhaitez, le nom.', '<strong>Importer des RC par village</strong> : collez une liste de RC (colonnes : Nom, Prénom, Téléphone, Mot de passe, Village, Arrondissement si ambiguïté, N° de grappe, Nom de la grappe) pour en créer plusieurs d\'un coup. Le numéro de grappe est obligatoire.', 'Boutons <strong>Modifier, Désactiver / Réactiver, Supprimer</strong> sur chaque ligne (voir la section « Gérer les comptes »).'])}` },
      { id: 'suivi', titre: 'Suivi groupé des RC (de A à Z)', html: `<p>Menu ${menu('👥 Suivi groupé RC')}, avec trois sous-onglets : <strong>Planning</strong>, <strong>Compte rendu</strong> et <strong>Historique</strong>.</p>
        <h4>1. Planifier un suivi (sous-onglet Planning)</h4>
        ${e(['Appuyez sur « Planifier un suivi groupé ».', 'Choisissez la <strong>date prévue</strong>, l\'<strong>heure</strong>, le <strong>lieu</strong> et les <strong>thèmes</strong> à aborder, puis l\'objectif.', 'Choisissez le ou les <strong>villages</strong> concernés (un seul ou plusieurs). Les RC de ces villages sont <strong>cochés automatiquement</strong> ; décochez ceux qui ne sont pas convoqués.', 'Enregistrez : <strong>les RC convoqués reçoivent une notification</strong> et la séance apparaît dans « Mon planning », visible aussi de vos supérieurs (PF, RCSE, Département, National).'])}
        <h4>2. Enregistrer le compte rendu (sous-onglet Compte rendu)</h4>
        ${e(['Si la séance était planifiée, choisissez-la (le formulaire se préremplit) ; sinon c\'est une séance non planifiée.', 'Indiquez la <strong>date réelle</strong> (pas de date future), le lieu et les <strong>thèmes</strong> abordés.', '<strong>Liste de présence</strong> : filtrez par village et cochez les RC <strong>présents</strong> ; les autres convoqués sont enregistrés comme absents.', 'Ajoutez les <strong>preuves</strong> : une ou plusieurs <strong>photos</strong> de la séance (vous pouvez en ajouter plusieurs, une par une, et retirer une photo avec la croix) et/ou des <strong>documents</strong> (PDF, Word, Excel, 5 Mo max).', 'Ajoutez un commentaire si besoin, puis <strong>Enregistrer</strong> et confirmez.'])}
        ${attention('Une fois enregistré, le compte rendu est <strong>verrouillé</strong> : vous pouvez le relire mais plus le modifier. Vérifiez la liste de présence et les preuves avant de valider.')}
        <h4>3. Retrouver vos séances (sous-onglet Historique)</h4>
        <p>Chaque séance apparaît avec son statut <strong>Réalisé</strong> ou <strong>Non réalisé</strong> ; des filtres et des indicateurs aident au suivi. Ouvrez la fiche d'une séance pour revoir présents, absents, photos et documents, ou l'imprimer.</p>` },
      rapport('votre arrondissement'),
      notifications('ASCQ'), activitesRecues(), activitesDemander('ASCQ', 'les <strong>relais communautaires (RC)</strong> de votre hiérarchie'),
      briefing(), gestionUtilisateurs('vos RC'), nettoyage('ASCQ'), faq('')
    ]
  };

  // ---------- PF ----------
  const PF = {
    titre: 'Guide du Point Focal CNLS-TP (niveau commune)',
    intro: 'Vous coordonnez les ASCQ de votre commune : vous créez leurs comptes, les rattachez à des arrondissements, suivez les alertes et décès de la commune et consultez les suivis groupés.',
    sections: [
      { id: 'role', titre: 'Votre rôle', html: `<p>Votre compte couvre les <strong>arrondissements</strong> de votre commune qui vous ont été assignés par le RCSE. Vous voyez les alertes, décès, suivis et rapports de ces arrondissements.</p>` },
      connexion('PF_CNLS_TP'), profil(), tableauBord('PF_CNLS_TP'),
      { id: 'ascq', titre: 'Mes ASCQ : créer et gérer', html: `<p>Menu ${menu('Mes ASCQ')}.</p>
        ${e(['Dans « Créer un compte ASCQ », saisissez <strong>Nom, Prénom, Téléphone</strong> (identifiant) et <strong>Mot de passe</strong>.', 'Choisissez l\'<strong>arrondissement de rattachement</strong>. Plusieurs ASCQ peuvent être rattachés au même arrondissement : ils partagent alors les mêmes données et le même rapport.', 'Appuyez sur <strong>Créer le compte</strong> et transmettez téléphone et mot de passe à l\'ASCQ.'])}
        ${l(['Le tableau « Mes ASCQ » liste vos agents ; boutons <strong>Modifier, Désactiver / Réactiver, Supprimer</strong>.', '<strong>Sites couverts</strong> : arrondissements de vos ASCQ et villages de leurs RC, pour repérer les zones sans couverture.', '<strong>Importer des ASCQ par arrondissement</strong> : création de plusieurs comptes d\'un coup.', '<strong>Assigner un arrondissement supplémentaire</strong> à un ASCQ qui doit en couvrir plusieurs.'])}` },
      { id: 'suivi-alertes', titre: 'Suivi alertes / décès', html: `<p>Menu ${menu('Suivi alertes / décès')} : liste des alertes et décès de votre commune (via les arrondissements assignés), avec leur état d'investigation ou de confirmation. Repérez les alertes non investiguées et relancez l'ASCQ concerné.</p>` },
      suiviGroupeLecture('tous vos ASCQ'),
      rapport('la commune'),
      activitesRecues(), activitesDemander('PF', 'les <strong>ASCQ</strong> et les <strong>RC</strong> de votre commune'),
      briefing(), gestionUtilisateurs('vos ASCQ (et, en cascade, leurs RC)'), nettoyage('PF_CNLS_TP'), faq('')
    ]
  };

  // ---------- RCSE ----------
  const RCSE = {
    titre: 'Guide du RCSE (zone sanitaire)',
    intro: 'Vous coordonnez une zone sanitaire (une ou plusieurs communes) : vous créez les comptes des Points Focaux, leur assignez des arrondissements et suivez toute la zone.',
    sections: [
      { id: 'role', titre: 'Votre rôle', html: `<p>Votre zone sanitaire regroupe les communes qui vous ont été assignées par le Département. Vous voyez toutes les données (alertes, décès, suivis, rapports) de ces communes.</p>` },
      connexion('RCSE'), profil(), tableauBord('RCSE'),
      { id: 'pf', titre: 'Comptes PF CNLS-TP', html: `<p>Menu ${menu('Comptes PF CCLS-TP')}.</p>
        ${e(['Dans « Créer un compte Point Focal », saisissez nom, prénom, téléphone, mot de passe et la <strong>commune</strong> du PF (parmi celles de votre zone).', 'Appuyez sur <strong>Créer le compte</strong> puis transmettez les identifiants.'])}
        ${l(['Le tableau liste vos PF avec <strong>Modifier / Désactiver / Supprimer</strong>.', '<strong>Sites couverts</strong> : communes des PF, arrondissements des ASCQ et villages des RC.', '<strong>Importer des PF</strong> par commune pour en créer plusieurs d\'un coup.'])}` },
      { id: 'geo', titre: 'Géographie de ma zone', html: `<p>Menu ${menu('Géographie de ma zone')}. La structure administrative nationale (départements, communes, arrondissements, villages) est importée par le compte national. Vous pouvez ajouter, <strong>à l'intérieur des communes de votre zone</strong>, un <strong>arrondissement</strong> ou un <strong>village</strong> « hors liste nationale » :</p>
        ${e(['Saisissez le nom, choisissez la commune (et l\'arrondissement pour un village).', 'Appuyez sur <strong>Ajouter</strong> : l\'élément est disponible tout de suite pour créer des comptes et assigner des zones.'])}
        <p>Le tableau « Structure administrative de ma zone sanitaire » montre les 200 premières lignes ; la liste complète est dans le Google Sheet.</p>` },
      { id: 'assign', titre: 'Assignations', html: `<p>Menu ${menu('Assignations')}. Un ASCQ couvre automatiquement l'arrondissement choisi par son PF : il ne reste qu'à assigner des <strong>arrondissements aux PF CNLS-TP</strong>.</p>
        ${e(['Choisissez le <strong>PF</strong>, puis la <strong>commune</strong> et l\'<strong>arrondissement</strong>.', 'Appuyez sur <strong>Assigner</strong>.', 'Le tableau « Assignations actuelles » liste ce qui est assigné ; un arrondissement non assigné reste hors du champ de vision du PF.'])}
        ${attention('Un PF ne voit les alertes, décès, suivis et rapports que des arrondissements qui lui sont assignés : vérifiez les assignations si ses tableaux sont vides.')}` },
      gestionUtilisateurs('votre zone (PF, ASCQ, RC)'),
      suiviGroupeLecture('toute la zone sanitaire'), rapport('la zone sanitaire'),
      activitesRecues(), activitesDemander('RCSE', 'les <strong>PF</strong>, <strong>ASCQ</strong> et <strong>RC</strong> de votre zone'),
      nettoyage('RCSE'), faq('')
    ]
  };

  // ---------- DEPARTEMENT ----------
  const DEPARTEMENT = {
    titre: 'Guide du Département',
    intro: 'Vous coordonnez un département : vous créez les comptes RCSE (zones sanitaires), leur assignez des communes et suivez tout le département.',
    sections: [
      { id: 'role', titre: 'Votre rôle', html: `<p>Le compte national vous a confié <strong>un département</strong>. Vous voyez toutes les données (alertes, décès, suivis, rapports) de ce département, par zone sanitaire.</p>` },
      connexion('DEPARTEMENT'), profil(), tableauBord('DEPARTEMENT'),
      { id: 'rcse', titre: 'Comptes RCSE', html: `<p>Menu ${menu('Comptes RCSE')}.</p>
        ${e(['Dans « Créer un compte RCSE », saisissez nom, prénom, téléphone, mot de passe, le nom de la <strong>zone sanitaire</strong> et la ou les <strong>communes</strong> qui la composent.', 'Appuyez sur <strong>Créer le compte</strong> puis transmettez les identifiants.'])}
        ${l(['Le tableau liste les RCSE avec <strong>Modifier / Désactiver / Supprimer</strong>.', '<strong>Sites couverts</strong> : zones, communes des PF, arrondissements des ASCQ, villages des RC.', '<strong>Importer des RCSE par zone sanitaire</strong> pour en créer plusieurs d\'un coup.'])}` },
      { id: 'geo', titre: 'Géographie de mon département', html: `<p>Menu ${menu('Géographie de mon département')} : ajoutez un <strong>arrondissement</strong> ou un <strong>village</strong> « hors liste nationale » dans une commune de votre département (nom + commune, et arrondissement pour un village). La structure complète du département est affichée en dessous (200 premières lignes, liste complète dans le Google Sheet).</p>` },
      { id: 'assign', titre: 'Assignations', html: `<p>Menu ${menu('Assignations')} : <strong>Assigner une commune supplémentaire à un RCSE</strong>.</p>
        ${e(['Choisissez le <strong>RCSE</strong> et la <strong>commune</strong> à ajouter à sa zone sanitaire.', 'Appuyez sur <strong>Assigner</strong> ; consultez le tableau « Assignations actuelles ».'])}
        ${attention('Un RCSE ne voit que les communes qui lui sont assignées.')}` },
      gestionUtilisateurs('votre département (RCSE, PF, ASCQ, RC)'),
      suiviGroupeLecture('tout le département'), rapport('le département'),
      activitesRecues(), activitesDemander('DEPARTEMENT', 'les <strong>RCSE</strong>, <strong>PF</strong>, <strong>ASCQ</strong> et <strong>RC</strong> de votre département'),
      nettoyage('DEPARTEMENT'), faq('')
    ]
  };

  // ---------- NATIONAL ----------
  const NATIONAL = {
    titre: 'Guide du compte National',
    intro: 'Vous administrez toute la plateforme : mot de passe et comptes, structure administrative, calendrier épidémiologique, comptes Départements, suivi national et nettoyage des données.',
    sections: [
      { id: 'premiers-pas', titre: 'Premiers pas (à faire une fois)', html: `${e(['<strong>Changez le mot de passe</strong> du compte national initial : bouton profil → ⚙️ Modifier mes paramètres.', 'Importez la <strong>structure administrative nationale</strong> (menu Géographie nationale, « Importer la structure administrative nationale »). Elle peut être relancée sans danger : rien n\'est dupliqué.', 'Importez le <strong>calendrier épidémiologique</strong> de l\'année (menu Calendrier épidémiologique).', 'Créez les <strong>comptes Départements</strong> (menu Comptes Départements). Chaque Département créera ensuite ses RCSE, qui créeront leurs PF, etc.'])}
        ${attention('Sans calendrier importé, les formulaires des RC ne connaissent pas la semaine épidémiologique en cours.')}` },
      connexion('NATIONAL'), profil(), tableauBord('NATIONAL'),
      { id: 'departements', titre: 'Comptes Départements', html: `<p>Menu ${menu('Comptes Départements')}.</p>
        ${e(['Dans « Créer un compte Département », saisissez nom, prénom, téléphone, mot de passe.', 'Choisissez le <strong>département pris en charge</strong> (un compte = un département).', 'Appuyez sur <strong>Créer le compte</strong> puis transmettez les identifiants.'])}
        <p>Le tableau liste les comptes avec <strong>Modifier / Désactiver / Supprimer</strong>.</p>` },
      { id: 'geo', titre: 'Géographie nationale', html: `<p>Menu ${menu('Géographie nationale')}.</p>
        ${l(['<strong>Importer la structure administrative nationale</strong> : charge départements, communes, arrondissements et villages.', '<strong>Ajouter une commune / un arrondissement / un village</strong> « hors liste nationale » : saisissez le nom et le parent, puis Ajouter.', '« Structure administrative enregistrée » affiche le contenu (200 premières lignes ; liste complète dans le Google Sheet).'])}` },
      { id: 'calendrier', titre: 'Calendrier épidémiologique', html: `<p>Menu ${menu('Calendrier épidémiologique')}.</p>
        ${e(['Indiquez l\'<strong>année</strong> et la <strong>date du lundi de la semaine 1</strong>.', 'Appuyez sur <strong>Importer 52 semaines</strong> : 52 semaines de lundi à dimanche sont générées. Si l\'année existait déjà, elle est d\'abord remplacée.'])}
        ${l(['« Calendrier importé » liste les semaines.', '<strong>Supprimer cette année</strong> ou <strong>Supprimer tout le calendrier</strong> (confirmation demandée).'])}` },
      { id: 'utilisateurs', titre: 'Tous les utilisateurs', html: `<p>Menu ${menu('Tous les utilisateurs')} : tous les comptes de la plateforme, tous niveaux confondus, avec <strong>Modifier, Désactiver / Réactiver, Supprimer</strong>. La suppression d'un compte supprime aussi tous les comptes placés sous lui (aperçu + saisie de SUPPRIMER). Un compte national ne peut pas être supprimé.</p>` },
      suiviGroupeLecture('toutes les ASCQ du pays'), rapport('niveau national (« Support 4 — Rapport hebdomadaire national »)'),
      activitesDemander('NATIONAL', 'tous les niveaux situés sous vous : <strong>Départements, RCSE, PF, ASCQ et RC</strong>'),
      nettoyage('NATIONAL'),
      { id: 'admin', titre: 'Console d\'administration des données', html: `<p>Si la plateforme tourne sur le <strong>serveur autonome</strong> (au lieu de Google Sheets), le lien <strong>admin</strong> du menu ouvre la console de données : consulter et corriger les tables, exporter (JSON, Excel, CSV), importer, et gérer les sauvegardes quotidiennes. Réservé au compte national.</p>` },
      faq('')
    ]
  };

  window.GUIDES = { RC, ASCQ, PF_CNLS_TP: PF, RCSE, DEPARTEMENT, NATIONAL };
})();
