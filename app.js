// Point d'entree Phusion Passenger / Plesk
// Passenger cherche app.js ou server.js a la racine
import('./artifacts/api-server/dist/index.mjs').catch((err) => {
  console.error('[app.js] Echec demarrage API:', err);
  process.exit(1);
});
