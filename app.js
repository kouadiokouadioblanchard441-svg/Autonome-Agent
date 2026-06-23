'use strict';
// Point d'entree CJS pour Phusion Passenger / Plesk
// Passenger cherche app.js a la racine et l'execute avec require()
require('./artifacts/api-server/dist/index.cjs');
