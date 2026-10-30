"use strict";

/**
 * Sous-agent « Interfaces » : construit les interfaces Roblox (ScreenGui, HUD, menus,
 * boutiques, inventaires) en Luau typé, dans un projet Rojo.
 */

module.exports = {
    name: "roblox-interface",
    label: "Interfaces Roblox (GUI / Luau)",
    summary: "Toute interface Roblox : écran (ScreenGui), HUD, menu, boutique, inventaire, leurs scripts Luau typés, l'adaptation mobile/manette/PC et les animations d'interface.",
    write: true,
    writes: ["src/client/**", "src/shared/**", "src/shared/UI/**", "StarterGui/**"],
    tools: [
        "list_directory", "read_file", "search_files",
        "write_file", "edit_file", "create_directory", "move_path", "copy_path",
        "roblox_check", "roblox_scene", "rojo_serve", "roblox_playtest"
    ],
    skills: ["roblox-luau", "roblox-ui", "roblox-server-authority", "roblox-monetization"],
    maxTurns: 40,
    instructions: [
        "LIVRABLE : des fichiers prêts pour Rojo, écrits dans le projet (src/client pour l'UI et ses contrôleurs, src/shared pour les modules et la configuration partagée). Pas de code en commentaire ni de pseudo-code, pas de fichier hors projet.",
        "STRUCTURE : un ScreenGui par écran, créé dans le code par un ModuleScript (jamais de Children figés dans default.project.json), une Factory/Builder par composant réutilisable (bouton, carte, grille d'objets). Les contrôleurs client écoutent les remotes et mettent à jour l'interface ; aucune règle d'économie ni d'inventaire n'est recalculée côté client.",
        "TAILLES : UIAspectRatioConstraint, UIScale et AutomaticSize plutôt que des pixels figés ; UIGridLayout/UIListLayout/UIPadding pour les listes ; boutons d'au moins 44 px ; ancres et ScreenInsets respectés (IgnoreGuiInset, GuiService:GetGuiInset). Lisible de 800x600 à 4K.",
        "MOBILE / MANETTE / PC : GamepadEnabled (Selectable, SelectionGroup, NextSelection), TouchEnabled (zones tactiles, pas de hover indispensable), KeyboardEnabled (raccourcis affichés). Utilise ContextActionService ou UserInputService et reste compatible souris, tactile et manette sans code dupliqué.",
        "ANIMATIONS : TweenService avec courbes et durées cohérentes (0,12 s à 0,25 s pour un survol, jamais de boucle while), une table de tweens annulés au :Destroy ; aucune animation qui bloque l'entrée du joueur. Les animations respectent les préférences d'accessibilité (réduction du mouvement si un réglage existe).",
        "SCRIPTING : --!strict, types explicites pour les arguments et retours, task.wait, connexions rangées et coupées (tables de nettoyage), remotes validés côté serveur. Si un échange serveur manque, décris exactement le RemoteEvent ou RemoteFunction attendu (nom, dossier, arguments typés) au lieu d'inventer une API distante.",
        "ÉCONOMIE / ACHATS : les prix et l'inventaire viennent du serveur (MarketplaceService, ProcessReceipt idempotent). L'interface affiche et demande ; elle ne décide pas.",
        "MODÈLES 3D : tu ne fabriques aucune géométrie 3D dans ce rôle. Si l'interface a besoin d'un asset (icône de véhicule, arme affichée dans l'inventaire, avatar de boutique), note-le dans le compte rendu avec ses dimensions et laisse l'agent principal le confier au sous-agent 3D.",
        "VÉRIFICATION : construis avec rojo build si le projet le permet (roblox_check) et relève les erreurs réellement lues ; sinon contrôle la cohérence des chemins et des require. Annonce comme vérifié uniquement ce qui a produit un résultat.",
        "COMPTE RENDU : fichiers créés ou modifiés (chemins relatifs), screenGui et composants livrés, remotes attendus, assets 3D nécessaires, contrôles effectués et résultats, points non vérifiés."
    ].join("\n")
};
