# Validation de FranceStudent IDE 1.4.6

Publication du 26 octobre 2026. Commit applicatif `7c5e0e3ac73dcc72c1b27b25c3fbfa1eb7f2084f`, tag immuable `v1.4.6`.

## Windows x64

- `npm test` : 774 tests, 771 réussis, 3 ignorés, aucun échec.
- `npm run test:e2e` : 35 parcours Electron réussis.
- `npm run lint` : aucune erreur ; un avertissement préexistant dans `desktop/main.js`.
- `npm audit --audit-level=low` : aucune vulnérabilité signalée.
- Renderer (build et vérification) et EffectCraft vérifiés.
- L’application empaquetée a passé le parcours EffectCraft. L’installateur NSIS a été construit, mais son installation par-dessus une version existante n’a pas été testée.
- Installateur non signé ; SHA-256 : `b79f8ee15d24f74549280db146c3ff4d1164f6874a7d92f42e7cfdbeeef0c976`.

## Mac Apple Silicon ARM64

- Workflow [Build and test macOS](https://github.com/extraopaa/francestudents-ide/actions/runs/40253667464) réussi : tests, construction, parcours du vrai paquet, vérification de signature et contenu du DMG.
- DMG : `FranceStudentIDE-1.4.6-mac-arm64.dmg`, 316 463 438 octets ; SHA-256 `0c8a8a35b7ccf32624ad20e68cbfa928c93350d3a49f10ba6d4f7bdc98e41ed1`.
- ZIP : `FranceStudentIDE-1.4.6-mac-arm64.zip`, 305 316 540 octets ; SHA-256 `192f21bb7ea883a643a2cac16a04558f2f104bfb18ebb41d2ba1274af5c27347`.
- Signature ad hoc sans notarisation : Gatekeeper rejette l’app sur macOS standard. Ce build CI ne remplace pas un essai physique sur un Mac M5.

## CI et publication

- CI Node 22 Windows/Linux/macOS : [40253664595](https://github.com/extraopaa/francestudents-ide/actions/runs/40253664595), toutes les plateformes réussies.
- Vérification des assets Windows : [40254266563](https://github.com/extraopaa/francestudents-ide/actions/runs/40254266563), les assets déjà construits ont été conservés sans reconstruction.
- La [release v1.4.6](https://github.com/extraopaa/francestudents-ide/releases/tag/v1.4.6) est publique, stable et comprend les six assets prévus. Les sommes SHA-256 de l’installateur, du `.blockmap`, de `latest.yml`, du DMG et du ZIP sont dans `SHA256SUMS.txt`.
