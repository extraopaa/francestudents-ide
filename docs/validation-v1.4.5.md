# Validation de FranceStudent IDE 1.4.5

Validation effectuée le 26 octobre 2026 sur le commit `bfb60b6f1af47329cac0bcab45945cd7e6a607f0`, tag `v1.4.5`.

## Windows x64

- `npm test` : 772 tests, 769 réussis, 3 ignorés, aucun échec.
- `npm run test:e2e` : 35 parcours Electron réussis.
- `npm run lint` : aucune erreur ; un avertissement préexistant dans `desktop/main.js`.
- `npm audit --audit-level=low` : aucune vulnérabilité signalée.
- Renderer vérifié (`build:renderer`, `check:renderer`) et EffectCraft vérifié.
- Installateur NSIS construit localement (287 655 494 octets). L’application empaquetée a démarré ; terminal, EffectCraft, Whisper/ONNX CPU et transcription locale via le worker ont été contrôlés.
- Installateur Windows non signé.

## Mac Apple Silicon ARM64

- Workflow [Build and test macOS](https://github.com/extraopaa/francestudents-ide/actions/runs/40242739404) réussi : dépendances, audit, tests unitaires, contrôles de démarrage et construction.
- Le vrai paquet Mac a passé le parcours EffectCraft et l’inférence Whisper locale, puis `codesign --verify` et la vérification du contenu du DMG.
- DMG : `FranceStudentIDE-1.4.5-mac-arm64.dmg`, 316 466 314 octets ; SHA-256 `1de9869b0a4321b669f50b967d2bbba0e77384d14aa953402d661ef9d47dd556`.
- ZIP : `FranceStudentIDE-1.4.5-mac-arm64.zip`, 305 315 691 octets ; SHA-256 `af40d949c8916b476137885b195d0d4a2e3e62568d11cf5445b176fafc226d87`.
- Signature ad hoc, sans notarisation Apple. Le contrôle CI ne remplace pas un essai physique sur M5.

## Publication

La [release v1.4.5](https://github.com/extraopaa/francestudents-ide/releases/tag/v1.4.5) est publique avec les six fichiers prévus : installateur Windows, `.blockmap`, `latest.yml`, DMG ARM64, ZIP ARM64 et `SHA256SUMS.txt`. Les empreintes des cinq paquets/métadonnées ont été recalculées et comparées avant publication. Le workflow Windows [40243220416](https://github.com/extraopaa/francestudents-ide/actions/runs/40243220416) a vérifié la version et les assets existants ; aucun paquet n’a été remplacé après le build validé.

## Dictée locale

Le contrôle empaqueté prépare le modèle Whisper épinglé sur Hugging Face et transcrit avec ONNX Runtime CPU dans un worker. Le téléchargement initial se fait avant l’activation du microphone ; pendant l’inférence, le worker n’autorise pas le réseau. Le texte est remis au brouillon. Ce contrôle prouve le chargement et l’inférence locale sur les runners/Windows de validation, pas la précision de transcription sur toutes les voix, tous les microphones ou toutes les variantes de macOS.

