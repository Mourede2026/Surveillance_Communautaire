// Enregistre le service worker qui rend l'application installable sur téléphone (PWA) et
// utilisable même hors-ligne pour l'interface (les données restent en ligne uniquement).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
