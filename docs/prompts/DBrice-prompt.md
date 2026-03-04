# DBrice — Ultra-Detailed Vibe Coding Prompt

## 🧠 Vision du projet

Tu construis **DBrice**, une application desktop MySQL client pour **Windows (x64)** et **macOS (Intel + Apple Silicon universal binary)**. C'est un client MySQL moderne, inspiré fonctionnellement de MySQL Workbench, mais avec un design UI/UX complètement original et moderne. **Aucune donnée ne transite par le cloud.** Tous les credentials, connexions, historiques et paramètres sont stockés **localement uniquement** sur la machine de l'utilisateur.

L'app s'appelle **DBrice**. Le nom est définitif.

---

## 🏗️ Stack technique

| Couche | Technologie |
|---|---|
| Framework desktop | **Tauri v2** |
| Backend | **Rust** (Tauri commands) |
| Frontend | **React 18 + TypeScript** |
| Styling | **Tailwind CSS + shadcn/ui** |
| State management | **Zustand** |
| Éditeur SQL | **CodeMirror 6** (avec extension MySQL) |
| Icônes | **Boxicons Rounded** uniquement — CDN: `https://pro.boxicons.com/fonts/3.0.8/basic/rounded/400/boxicons-rounded.min.css?sig=ab96c20a2776cc82ba2aa8f98e33732941cfeaac0f37290f0ada602bad4c02f9` |
| Driver MySQL | Rust: `sqlx` avec feature MySQL |
| SSH tunneling | Rust: `russh` ou `ssh2` crate |
| Stockage local | **SQLite** via `rusqlite` (connexions, historique, settings, logs) |
| Secrets / Credentials | **OS Keychain** via crate `keyring` (macOS Keychain + Windows Credential Manager) + chiffrement AES-256 pour les données SQLite sensibles |
| Auto-update | Plugin Tauri updater → **GitHub Releases** |
| Tests backend | Rust `tokio::test` + **Docker MySQL 8.0+** |
| Tests frontend | **Vitest + React Testing Library** |
| CI/CD | **GitHub Actions** (monorepo, déclenché sur chaque push) |
| Linting | ESLint + Prettier (config standard, sans contraintes excessives) |
| Commits | **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`) |
| Hooks | `commitlint` + `husky` (enforce conventional commits) |
| Changelog | `standard-version` ou `release-it` (auto-généré depuis les commits) |
| Versioning | **Semver** strict: `v1.0.0` |
| Distribution | Installeur: `.exe` (NSIS) pour Windows, `.dmg` pour macOS |

---

## 📁 Structure monorepo complète

```
dbrice/
├── .github/
│   └── workflows/
│       ├── ci.yml                        # lint + test + build check sur chaque push
│       └── release.yml                   # build binaires + GitHub Release sur tags v*.*.*
├── src/                                  # Frontend React
│   ├── assets/                           # Logo DBrice, images statiques
│   ├── components/
│   │   ├── ui/                           # Composants shadcn/ui (Button, Input, Dialog, etc.)
│   │   ├── layout/
│   │   │   ├── AppShell.tsx              # Layout racine, fenêtre principale
│   │   │   ├── TabBar.tsx                # Barre d'onglets connexions tout en haut
│   │   │   ├── ConnectionTab.tsx         # Un onglet connexion avec gommette + status
│   │   │   ├── Sidebar.tsx               # Sidebar DB/tables redimensionnable
│   │   │   ├── SidebarTree.tsx           # Arbre DB → Tables → Colonnes
│   │   │   ├── WorkspaceMenu.tsx         # Menu horizontal dans la connexion
│   │   │   └── WorkspaceTabs.tsx         # Onglets internes (SQL sheets, designers, etc.)
│   │   ├── connections/
│   │   │   ├── HomeGrid.tsx              # Grille de cards home screen
│   │   │   ├── ConnectionCard.tsx        # Card d'une connexion
│   │   │   ├── FolderCard.tsx            # Card d'un dossier (expand/collapse)
│   │   │   ├── ConnectionFormModal.tsx   # Modal add/edit connexion (3 tabs)
│   │   │   ├── TestConnectionBanner.tsx  # Bannière inline résultat test connexion
│   │   │   └── ColorPickerInput.tsx      # Color picker libre pour couleur connexion
│   │   ├── editor/
│   │   │   ├── SqlEditor.tsx             # CodeMirror 6 avec MySQL + autocomplete
│   │   │   ├── SqlSheetToolbar.tsx       # Toolbar: Execute, LIMIT selector, Save
│   │   │   ├── ResultGrid.tsx            # Grille de résultats SQL
│   │   │   ├── ResultGridCell.tsx        # Cellule éditable inline
│   │   │   ├── ResultGridToolbar.tsx     # Export CSV/JSON, infos résultat
│   │   │   ├── ErrorBanner.tsx           # Bannière erreur SQL inline
│   │   │   └── QueryHistoryPanel.tsx     # Historique requêtes par connexion
│   │   ├── database/
│   │   │   ├── TableDesigner.tsx         # Designer complet (tabs: Columns, Indexes, FK, Triggers, Options)
│   │   │   ├── ColumnEditor.tsx          # Éditeur lignes colonnes
│   │   │   ├── IndexEditor.tsx           # Éditeur index
│   │   │   ├── ForeignKeyEditor.tsx      # Éditeur FK
│   │   │   ├── TriggerEditor.tsx         # Éditeur triggers
│   │   │   ├── PartitionEditor.tsx       # Éditeur partitions
│   │   │   └── TableOptions.tsx          # Engine, charset, collation, etc.
│   │   ├── routines/
│   │   │   ├── RoutineEditor.tsx         # Éditeur SP / Functions avec CodeMirror
│   │   │   └── RoutineParamForm.tsx      # Formulaire paramètres pour exécution
│   │   ├── users/
│   │   │   ├── UserManager.tsx           # Liste users MySQL
│   │   │   ├── UserFormModal.tsx         # Créer / éditer un user
│   │   │   ├── SchemaPrivileges.tsx      # Privileges par schéma
│   │   │   ├── ObjectPrivileges.tsx      # Privileges par table/vue/routine
│   │   │   └── AdminRoles.tsx            # Rôles administratifs
│   │   ├── export/
│   │   │   ├── ExportWizard.tsx          # Wizard export DB
│   │   │   └── ImportWizard.tsx          # Wizard import DB
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx             # Page dashboard complète
│   │   │   ├── ServerMetrics.tsx         # CPU, RAM, uptime, version
│   │   │   ├── ConnectionsChart.tsx      # Graphique connexions temps réel
│   │   │   ├── QueriesChart.tsx          # Graphique queries/sec temps réel
│   │   │   ├── SlowQueriesTable.tsx      # Table slow queries
│   │   │   ├── ProcessList.tsx           # SHOW PROCESSLIST + bouton KILL
│   │   │   └── DbSizeChart.tsx           # Bar chart tailles DBs/tables
│   │   ├── logs/
│   │   │   └── LogsPanel.tsx             # Panel logs par connexion
│   │   ├── settings/
│   │   │   └── SettingsPage.tsx          # Page settings complète
│   │   └── common/
│   │       ├── ConfirmModal.tsx          # Modal confirmation destructive (custom, jamais natif)
│   │       ├── Toast.tsx                 # Toast in-app (succès, erreur, info)
│   │       ├── UpdateBanner.tsx          # Bannière post-update "Updated to vX.X.X"
│   │       ├── ReconnectBanner.tsx       # Bannière connexion perdue + bouton Reconnect
│   │       └── UnsavedChangesModal.tsx   # Modal "unsaved changes, close anyway?"
│   ├── stores/
│   │   ├── useAuthStore.ts               # État login/master password
│   │   ├── useConnectionStore.ts         # Connexions sauvegardées, dossiers
│   │   ├── useSessionStore.ts            # Connexions actives, SSH tunnels ouverts
│   │   ├── useTabStore.ts                # Onglets connexions + onglets workspace internes
│   │   ├── useSettingsStore.ts           # Theme, LIMIT par défaut, etc.
│   │   └── useQueryHistoryStore.ts       # Historique requêtes par connexion
│   ├── hooks/
│   │   ├── useMysqlQuery.ts              # Hook exécution requête MySQL
│   │   ├── useConnectionStatus.ts        # Polling statut connexion active
│   │   ├── useDashboardPolling.ts        # Polling métriques dashboard (5s)
│   │   └── useAutoComplete.ts            # Données autocomplete depuis schema
│   ├── lib/
│   │   ├── tauri.ts                      # Wrappers typés pour invoke() Tauri
│   │   ├── crypto.ts                     # Utilitaires chiffrement côté front si besoin
│   │   └── utils.ts                      # Helpers généraux
│   ├── pages/
│   │   ├── LoginPage.tsx                 # Écran login master password
│   │   ├── HomePage.tsx                  # Grille connexions/dossiers
│   │   └── WorkspacePage.tsx             # Workspace connexion active
│   ├── types/
│   │   ├── connection.ts                 # Types Connection, Folder, ConnectionMethod
│   │   ├── mysql.ts                      # Types QueryResult, Column, Row, etc.
│   │   ├── schema.ts                     # Types Table, Index, FK, Column, Routine
│   │   └── settings.ts                   # Types Settings, Theme
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── commands/
│   │   │   ├── auth.rs                   # Vérif master password, init, reset
│   │   │   ├── connections.rs            # CRUD connexions (SQLite)
│   │   │   ├── mysql.rs                  # Exécution requêtes, schema introspection
│   │   │   ├── ssh.rs                    # Établir/fermer tunnel SSH, cache passphrase
│   │   │   ├── schema.rs                 # CREATE/ALTER/DROP table, index, FK, triggers
│   │   │   ├── routines.rs               # SP et Functions CRUD + exécution
│   │   │   ├── users.rs                  # Gestion users MySQL + privileges
│   │   │   ├── export.rs                 # Export SQL/CSV/JSON
│   │   │   ├── import.rs                 # Import .sql
│   │   │   ├── dashboard.rs              # SHOW STATUS, SHOW VARIABLES, PROCESSLIST
│   │   │   └── logs.rs                   # Écriture/lecture logs locaux
│   │   ├── db/
│   │   │   ├── local.rs                  # SQLite init, migrations, queries internes
│   │   │   └── schema.sql                # Schéma SQLite initial
│   │   ├── crypto/
│   │   │   ├── keychain.rs               # OS keychain read/write via keyring crate
│   │   │   └── aes.rs                    # Chiffrement AES-256 données sensibles SQLite
│   │   ├── ssh/
│   │   │   └── tunnel.rs                 # Gestion tunnel SSH, keepalive, reconnect
│   │   └── models/
│   │       ├── connection.rs             # Structs Connection, ConnectionMethod, SSHConfig, MySQLConfig
│   │       ├── query.rs                  # Structs QueryResult, Row, ColumnMeta
│   │       └── schema.rs                 # Structs TableDef, ColumnDef, IndexDef, FKDef
│   ├── Cargo.toml
│   └── tauri.conf.json
├── tests/
│   ├── integration/
│   │   ├── docker-compose.yml            # MySQL 8.0 + OpenSSH pour tests
│   │   ├── mysql_connection.rs           # Tests connexion TCP/IP
│   │   ├── ssh_tunnel.rs                 # Tests tunnel SSH
│   │   ├── query_execution.rs            # Tests exécution requêtes
│   │   ├── schema_operations.rs          # Tests CREATE/ALTER/DROP
│   │   ├── user_management.rs            # Tests users + privileges
│   │   └── export_import.rs              # Tests export/import round-trip
│   └── frontend/
│       ├── AuthFlow.test.tsx
│       ├── ConnectionForm.test.tsx
│       ├── ResultGrid.test.tsx
│       └── SqlEditor.test.tsx
├── .husky/
│   └── commit-msg                        # Hook commitlint
├── commitlint.config.js
├── CHANGELOG.md
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## 🔐 Sécurité & Authentification

### Stockage des credentials
- Tous les mots de passe MySQL, mots de passe SSH, et passphrases de clés SSH sont stockés dans l'**OS keychain natif** via le crate `keyring` (macOS Keychain / Windows Credential Manager)
- Les autres données de connexion (hostname, port, username, etc.) sont stockées dans **SQLite local** chiffré avec **AES-256**, la clé de chiffrement dérivée du master password
- **Aucune donnée ne sort jamais de la machine locale** — aucune requête réseau vers un serveur tiers, aucun analytics, aucun telemetry

### Master Password — Premier lancement
- Au **tout premier lancement** de DBrice, l'utilisateur est accueilli par un écran d'onboarding lui demandant de **définir un master password**
- Ce password est utilisé pour dériver une clé AES-256 qui chiffre la base SQLite locale
- L'écran explique clairement : "This password protects all your connection credentials. If you forget it, you will need to reset DBrice and all your connections will be lost."

### Login Screen
- À **chaque lancement** de l'app, un **écran de login** est affiché avant d'accéder à DBrice
- Design de cet écran: **beau, moderne, soigné** — c'est la première impression de l'app
  - Fond sombre avec un effet visuel subtil (gradient, particules légères, ou texture)
  - Carte centrée avec le **logo/nom DBrice** en haut
  - Un champ password avec icône toggle show/hide
  - Un bouton "Unlock" stylisé
  - Animation subtile au chargement
  - En cas de mauvais password: message d'erreur inline élégant (pas de popup native)
  - Lien "Forgot password? Reset DBrice" en bas en petit, avec confirmation forte avant reset

### Reset DBrice
- Si l'utilisateur clique "Reset DBrice":
  - Modal de confirmation custom avec texte : **"This will permanently delete all your connections, history, and settings. This cannot be undone."**
  - Bouton rouge "Reset Everything" + bouton "Cancel"
  - Si confirmé: suppression complète de la SQLite locale + nettoyage keychain + retour à l'onboarding premier lancement

### SSH Key Passphrases
- Les passphrases de clés SSH sont demandées **une fois au lancement de la connexion** concernée
- Elles sont **gardées en mémoire RAM** (dans le process Tauri) pendant toute la durée de vie de la session
- Quand l'app est **complètement fermée**, les passphrases en mémoire sont effacées
- Au prochain lancement + reconnexion, la passphrase est redemandée via une **modale custom élégante** (pas une popup native)

---

## 🏠 Home Screen — Gestionnaire de connexions

### Layout général
- Grille de **cards** (pas une liste) avec un layout responsive
- Deux types de cards visuellement distincts mais dans un design cohérent:

#### Folder Card
- Légèrement plus grande visuellement, ou stylistiquement différente (ex: fond légèrement différent, bordure accentuée, icône dossier Boxicons)
- Affiche: nom du dossier + nombre de connexions dedans (ex: "3 connections")
- **Cliquable**: expand/collapse les connexions qu'il contient directement dans la grille (les cards filles apparaissent en dessous avec une légère indentation visuelle)
- Actions au hover: renommer le dossier (icône crayon), supprimer le dossier (icône poubelle — supprime le dossier mais pas les connexions, elles passent en "no folder")

#### Connection Card
- Design compact et élégant — pas trop grande, pas trop petite
- Affiche:
  - **Nom de la connexion** (bold, taille lisible)
  - **Host** (truncated avec ellipsis si trop long)
  - **Port** (si différent de 3306)
  - **Badge "SSH"** si la méthode est TCP/IP over SSH (petit badge coloré)
  - **Gommette colorée** (petit rond de couleur) correspondant à la couleur assignée à la connexion
  - **"Last connected"** date/heure relative (ex: "2 hours ago", "Yesterday", "Never")
- Au **hover**: apparition d'icônes d'actions en overlay ou en bas de la card:
  - Icône connexion / play → **Connect**
  - Icône crayon → **Edit**
  - Icône copier → **Duplicate** (crée une copie avec nom `[Nom] (copy)`)
  - Icône poubelle → **Delete** (avec modal de confirmation)
- **Double-clic sur la card** → Connect directement
- La card est **draggable** pour être réordonnée dans la grille ou déplacée dans/hors d'un dossier

#### Card "New Connection"
- Toujours positionnée en dernier dans la grille
- Style distinct (pointillés, icône "+" centré)
- Clic → ouvre la modal de création de connexion

### Barre du haut de la Home Screen
- Bouton **"+ New Folder"** à gauche
- Bouton **"+ New Connection"** (raccourci)
- Champ de recherche (filtrer les cards par nom)

### Drag & Drop
- Les cards sont réordonnables par drag & drop dans la grille
- On peut drag une connection card et la drop sur une folder card pour la déplacer dans ce dossier
- On peut drag une connection card hors d'un dossier pour la mettre à la racine

---

## 📋 Modal Création / Édition de Connexion

Modal **custom** (jamais native), centrée, avec backdrop blur, animation d'entrée/sortie.

### En-tête de la modal
- Titre: "New Connection" ou "Edit Connection"
- Champ **Connection Name** (text input) — ex: "Production DB", "Local Dev"
- Dropdown **Folder** — liste des dossiers existants + option "No folder"
- **Color Picker** — color picker libre (pas une palette fixe) pour assigner une couleur à la connexion. La couleur choisie est prévisualisée en temps réel comme une gommette à côté du nom
- Dropdown **Connection Method**:
  - `Standard (TCP/IP)`
  - `Standard TCP/IP over SSH`

### Tab SSH (visible uniquement si méthode SSH sélectionnée)
- **SSH Hostname** (text input, placeholder: "ssh.example.com")
- **SSH Port** (number input, default: 22)
- **SSH Username** (text input)
- **SSH Password** (password input avec toggle show/hide) — optionnel si key file fourni
- **SSH Key File** (file picker):
  - Bouton "Browse..." ouvre un file picker natif
  - Supporte tous formats: `.pem`, `.ppk`, ed25519, rsa, ecdsa, etc.
  - Affiche le chemin du fichier sélectionné
- **SSH Key Passphrase** (password input avec toggle) — optionnel

### Tab MySQL
- **Hostname** (text input, placeholder: "127.0.0.1" si SSH, sinon "db.example.com")
- **Port** (number input, default: 3306)
- **Username** (text input)
- **Password** (password input avec toggle show/hide)
- **Default Schema** (text input, optionnel — si renseigné, cette DB est sélectionnée par défaut à la connexion)

### Footer de la modal
- Bouton **"Test Connection"**:
  - Déclenche un vrai test de connexion (TCP/IP ou SSH tunnel + MySQL)
  - Pendant le test: spinner sur le bouton, désactivé
  - Si succès: bannière verte inline sous les tabs "✅ Connection successful"
  - Si échec: bannière rouge inline avec le message d'erreur précis (ex: "Access denied for user 'root'@'localhost'", "Connection refused on port 3306", "SSH authentication failed", "Host unreachable") — **jamais une popup native**
- Bouton **"Save"** — disabled tant que Connection Name est vide
- Bouton **"Cancel"** — ferme la modal sans sauvegarder

---

## 🖥️ Workspace — Layout principal

### Tab Bar tout en haut de l'app
C'est la barre de navigation principale entre les connexions ouvertes.

- Chaque **connexion active** a un onglet dans cette barre
- Chaque onglet affiche:
  - **Gommette colorée** (petit rond, couleur de la connexion) — à gauche du nom
  - **Nom de la connexion**
  - **Indicateur de statut**: petit point vert si connexion MySQL active, rouge si connexion perdue
  - **Bouton ×** pour fermer l'onglet (avec confirmation si des feuilles SQL ont des changements non sauvegardés)
- Bouton **"+"** à droite de tous les onglets → revient à la Home Screen pour ouvrir une nouvelle connexion
- Si la connexion est perdue (MySQL timeout, réseau coupé):
  - Le point de statut devient rouge
  - À l'intérieur du workspace, une **bannière custom** apparaît en haut: "Connection lost. [Reconnect]" avec un bouton Reconnect qui tente de rétablir la connexion

### Sidebar gauche (redimensionnable)
- **Redimensionnable** par drag sur le bord droit
- Taille minimum: 180px, taille maximum: 500px
- En-tête: nom de la DB par défaut sélectionnée (dropdown pour changer de DB active)
- **Arbre hiérarchique**:
  ```
  📁 database_name
    📁 Tables
      📄 users
        └ id          [PK] [NN] [AI]
        └ email       [NN] [UQ]
        └ created_at  [NN] default: CURRENT_TIMESTAMP
      📄 orders
        └ ...
    📁 Views
      📄 active_users
    📁 Stored Procedures
      📄 get_user_by_id
    📁 Functions
      📄 calculate_total
    📁 Triggers
      📄 before_insert_users
    📁 Events
      📄 cleanup_old_logs
  ```
- Les **colonnes** d'une table affichent à droite du nom les badges applicables parmi: `PK`, `NN`, `UQ`, `B`, `UN`, `ZF`, `AI`, `G`, et la valeur par défaut si elle existe (ex: `default: 0`)
- **Clic droit sur une Table** → context menu custom (pas natif):
  - Select Rows (LIMIT appliqué, résultat dans la feuille SQL active)
  - Alter Table (ouvre le Table Designer dans un nouvel onglet workspace)
  - Copy Table Name
  - Copy CREATE Statement (copie dans clipboard)
  - Drop Table → modal de confirmation custom
  - Truncate Table → modal de confirmation custom
- **Clic droit sur une DB** → context menu custom:
  - New SQL Sheet
  - Create Table (ouvre Table Designer vide)
  - Drop Database → modal de confirmation custom forte
  - Export Database
  - Import into Database
- **Clic sur une table** → la sélectionne (highlight)
- **Double-clic sur une table** → ouvre Select Rows dans la feuille SQL active

### Menu horizontal en haut du workspace (dans la connexion)
Barre de menu fine juste sous la TabBar globale:
- `New SQL Sheet` (icône + texte)
- `Create Database` (icône + texte)
- `Users & Privileges` (icône + texte)
- `Export` (icône + texte)
- `Import` (icône + texte)
- `Dashboard` (icône + texte)
- `Logs` (icône + texte)

### Onglets internes du workspace
Sous le menu horizontal, une barre d'onglets pour les contenus ouverts:
- SQL Sheets (`Query 1`, `Query 2`, ...)
- Table Designers (`users — Table Designer`)
- Routine Editors (`get_user_by_id — Procedure`)
- Dashboard
- Users & Privileges
- Export / Import
- Logs

---

## 📝 Feuilles SQL (SQL Sheets)

### Gestion des onglets
- Nommées `Query 1`, `Query 2`, `Query 3`... par ordre de création
- Si une feuille est **sauvegardée** en fichier `.sql`: l'onglet prend le nom du fichier (ex: `migration.sql`)
- Si une feuille a des **modifications non sauvegardées**: un point `●` apparaît dans l'onglet (comme VS Code)
- **Ctrl+S** → ouvre un file picker natif pour sauvegarder en `.sql`. Si déjà sauvegardé, re-sauvegarde au même endroit
- On peut ouvrir un fichier `.sql` existant (depuis le menu File ou drag & drop sur l'app)
- **Fermeture d'un onglet avec modifications non sauvegardées** → modal custom "You have unsaved changes. Are you sure you want to close this sheet?" avec boutons "Close anyway" (destructif, rouge) et "Cancel"
- **Pas d'auto-save** sous aucune condition

### Toolbar de la feuille SQL
Barre au-dessus de l'éditeur:
- Bouton **Execute** (icône play) — ou Ctrl+Enter
- Dropdown **LIMIT**: `10` | `100` | `1000` | `10000` (valeur par défaut configurable dans Settings, default: 1000). Ce LIMIT s'applique aux SELECT Rows depuis la sidebar et peut être changé par la feuille active pour la session
- Bouton **Save** (icône disquette)
- Indicateur DB active (affiche quelle DB est sélectionnée, cliquable pour changer)
- Bouton **Format SQL** (icône formater — formate le SQL selon les conventions MySQL)

### Éditeur CodeMirror 6
- **Coloration syntaxique** MySQL complète (keywords, strings, numbers, comments, operators)
- **Autocomplétion intelligente contextuelle**:
  - Keywords SQL (`SELECT`, `FROM`, `WHERE`, `JOIN`, `GROUP BY`, etc.)
  - Noms de bases de données disponibles
  - Noms de tables de la DB active
  - Noms de colonnes des tables référencées dans la requête courante
  - Noms de fonctions MySQL natives
  - Noms de Stored Procedures et Functions
  - Déclenchée automatiquement après `.` ou après avoir tapé 2+ caractères
- **Numéros de lignes**
- **Code folding** (repliage des blocs)
- **Ctrl+Enter**: exécute la requête entière, ou si du texte est **sélectionné**, exécute uniquement la sélection
- **Indentation automatique**
- **Multi-curseur** (Ctrl+Clic)
- **Highlight de la ligne courante**
- **Bracket matching**

### Panneau de résultats (sous l'éditeur, split pane redimensionnable)

#### Comportement
- Affiche les résultats du **dernier SELECT exécuté**
- Si plusieurs statements exécutés en une fois (ex: `SELECT ... ; SELECT ...`), seule la **première** résultat est affichée
- Pour INSERT/UPDATE/DELETE: affiche un message "X row(s) affected in Xms"
- Pour CREATE/ALTER/DROP: affiche "Query OK in Xms"

#### Result Grid
- **En-têtes de colonnes** cliquables pour trier (ASC/DESC, toggle)
- **Ligne de filtre** sous les en-têtes: un input par colonne pour filtrer les résultats affichés (filtre client-side sur les données chargées)
- **Valeurs NULL**: affichées comme `NULL` en texte grisé italique
- **Édition inline**:
  - Clic sur une cellule → cellule devient éditable (input inline)
  - Une barre d'action apparaît en bas du grid: "Apply" (bouton vert) et "Cancel" (bouton gris)
  - Clic sur "Apply" → exécute directement l'UPDATE correspondant sans preview du SQL
  - Modification de plusieurs cellules possible avant Apply (batch)
- **Ctrl+C** sur une cellule sélectionnée → copie la valeur
- **Ctrl+C** sur une ligne sélectionnée → copie la ligne entière (format TSV)
- Sélection multiple de cellules/lignes avec Shift+Clic
- **Pagination**: affichage par pages selon le LIMIT sélectionné, avec contrôles Précédent/Suivant + indicateur "Showing 1-1000 of 1000+"

#### Toolbar du result grid
- Bouton **Export CSV** → télécharge les résultats en `.csv` (séparateur `;` par défaut)
- Bouton **Export JSON** → télécharge les résultats en `.json`
- Indicateur: "X rows in Xms"
- Bouton **Refresh** → ré-exécute la dernière requête

#### Bannière d'erreur SQL
- Si la requête échoue, une **bannière rouge** s'affiche entre la toolbar et le panneau résultat
- Contient: code d'erreur MySQL (ex: `Error 1064`) + message complet
- Bouton ✕ pour fermer la bannière
- **Jamais une popup native**

---

## 🗃️ Table Designer

S'ouvre dans un **onglet dédié** du workspace. Titre de l'onglet: `[table_name] — Table Designer`

### Tabs du designer

#### Tab "Columns"
Tableau éditable ligne par ligne:
| Colonne | Champ |
|---|---|
| Column Name | Text input |
| Datatype | Dropdown + text (VARCHAR(255), INT, TEXT, DATETIME, etc.) |
| PK | Checkbox |
| NN (Not Null) | Checkbox |
| UQ (Unique) | Checkbox |
| B (Binary) | Checkbox |
| UN (Unsigned) | Checkbox |
| ZF (Zero Fill) | Checkbox |
| AI (Auto Increment) | Checkbox |
| G (Generated) | Checkbox |
| Default/Expression | Text input |
| Comment | Text input |

- Bouton "Add Column" en bas
- Sélectionner une ligne + bouton "Delete Column"
- Drag & drop pour réordonner les colonnes

#### Tab "Indexes"
- Liste des index avec: Name, Type (PRIMARY / UNIQUE / INDEX / FULLTEXT / SPATIAL), Columns (multi-select), Order (ASC/DESC par colonne)
- Add / Edit / Delete index

#### Tab "Foreign Keys"
- Liste des FK avec: Name, Referenced Table, Column mapping, ON DELETE action, ON UPDATE action
- Actions: RESTRICT / CASCADE / SET NULL / NO ACTION / SET DEFAULT
- Add / Edit / Delete FK

#### Tab "Triggers"
- Liste des triggers avec: Name, Timing (BEFORE/AFTER), Event (INSERT/UPDATE/DELETE), Statement (éditeur SQL)
- Add / Edit / Delete trigger

#### Tab "Partitioning"
- Configuration du partitioning MySQL (RANGE, LIST, HASH, KEY)
- Gestion des partitions individuelles

#### Tab "Options"
- Storage Engine (dropdown: InnoDB, MyISAM, etc.)
- Charset (dropdown)
- Collation (dropdown, filtré selon charset)
- Row Format
- Auto Increment initial value
- Comment de la table

### Footer du Table Designer
- Bouton **"Apply"** → génère et exécute le SQL `CREATE TABLE` ou `ALTER TABLE` correspondant. Affiche une preview du SQL dans une modal avant exécution avec bouton "Execute"
- Bouton **"Revert"** → remet le designer à l'état initial (annule toutes les modifications non appliquées)

---

## ⚙️ Stored Procedures & Functions

### Dans la sidebar
- Listées sous chaque DB dans les nœuds "Stored Procedures" et "Functions"
- Clic droit → Create / Alter / Drop / Copy Name / Copy CREATE Statement

### Éditeur de routine
- S'ouvre dans un **onglet dédié**: `[routine_name] — Procedure` ou `[routine_name] — Function`
- Éditeur **CodeMirror 6** avec syntaxe MySQL + autocomplétion
- Toolbar: Save / Execute / Drop
- Bouton **Execute**:
  - Si la routine a des paramètres: ouvre une modale avec un formulaire pour saisir les valeurs des paramètres (un champ par paramètre avec son type affiché)
  - Si pas de paramètres: exécution directe
  - Résultat affiché dans le Result Grid

---

## 👥 Users & Privileges

S'ouvre dans un onglet dédié du workspace.

### Liste des users
- Tableau avec tous les users MySQL: `user@host`, plugin d'auth, password expiry, account locked
- Bouton "Add User", "Edit User", "Delete User"

### Formulaire User (modal ou panneau latéral)

#### Onglet "Login"
- Username
- Host (ex: `%`, `localhost`, `192.168.1.%`)
- Authentication Plugin (dropdown: `caching_sha2_password`, `mysql_native_password`, etc.)
- Password + Confirm Password
- Require SSL checkbox
- Password expiry settings

#### Onglet "Account Limits"
- MAX_QUERIES_PER_HOUR
- MAX_UPDATES_PER_HOUR
- MAX_CONNECTIONS_PER_HOUR
- MAX_USER_CONNECTIONS

#### Onglet "Schema Privileges"
- Liste des schémas accessibles
- Pour chaque schéma: grille de checkboxes pour chaque privilege (SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE, CREATE VIEW, SHOW VIEW, CREATE ROUTINE, ALTER ROUTINE, EVENT, TRIGGER, REFERENCES)
- Boutons "Select All" / "Unselect All"

#### Onglet "Object Privileges"
- Sélection schéma → sélection table/vue/routine → attribution de privileges spécifiques à cet objet

#### Onglet "Administrative Roles"
- Checkboxes pour les rôles admin: SUPER, PROCESS, RELOAD, SHUTDOWN, FILE, REPLICATION CLIENT, REPLICATION SLAVE, CREATE USER, etc.

---

## 📤 Export de DB

S'ouvre dans un onglet dédié.

### Options
- **Connexion & Database**: sélection de la DB à exporter (dropdown)
- **Tables**: liste avec checkboxes de toutes les tables — "Select All" / "Unselect All"
- **Export type**:
  - Structure Only
  - Data Only
  - Structure and Data
- **Format de sortie**:
  - SQL Dump (`.sql`) — inclut DROP TABLE IF EXISTS + CREATE TABLE + INSERT
  - CSV (un fichier par table) — séparateur `;` par défaut
  - JSON (un fichier par table ou un fichier global)
- **Options SQL dump**:
  - Include DROP TABLE IF EXISTS
  - Include CREATE DATABASE
  - Use transactions
  - Disable foreign key checks
- **Destination**: chemin du fichier/dossier de sortie (file picker)
- Bouton **"Start Export"**:
  - Barre de progression avec étapes (ex: "Exporting table users... 3/12")
  - Si erreur: affichage inline de l'erreur
  - Si succès: message "Export completed successfully — [open folder]"

---

## 📥 Import de DB

S'ouvre dans un onglet dédié.

### Options
- **Destination**:
  - Dropdown "Import into existing database" → sélection DB
  - Option "Create new database" → champ nom de la nouvelle DB
- **Fichier source**: file picker `.sql` uniquement
- **Options**:
  - Stop on error / Continue on error
- Bouton **"Start Import"**:
  - Barre de progression
  - Log des statements exécutés en temps réel
  - Si erreur: affichage de la ligne erreur + message MySQL

---

## 📊 Dashboard

S'ouvre dans un onglet dédié. Polling toutes les **5 secondes**.

### Section "Server Status"
- Version MySQL
- Uptime (formaté: "X days, X hours, X minutes")
- Connexions actives / Max connexions (avec barre de progression)
- Questions/sec (queries per second)
- Slow queries count

### Section "Real-time Charts" (graphiques temps réel)
- **Connexions actives** sur les 60 dernières secondes (courbe)
- **Queries/sec** sur les 60 dernières secondes (courbe)
- **InnoDB reads/writes** sur les 60 dernières secondes

### Section "Resource Usage"
- **CPU**: via `SHOW STATUS LIKE 'Threads_%'` et autres indicateurs
- **RAM utilisée** par MySQL
- **Taille totale** de toutes les DBs

### Section "Database Sizes"
- Bar chart horizontal: chaque DB avec sa taille totale
- Cliquable pour voir le détail par table dans un tableau

### Section "Slow Queries"
- Liste des slow queries avec: query text, duration, timestamp
- Bouton "View Full Query" pour les longues requêtes

### Section "Process List" (`SHOW PROCESSLIST`)
- Tableau: Id, User, Host, DB, Command, Time, State, Info
- Bouton **"Kill"** sur chaque ligne (avec confirmation)
- Refresh automatique

---

## 📋 Logs Panel

S'ouvre dans un onglet dédié du workspace. Logs **par connexion uniquement** (pas globaux).

### Contenu des logs
Chaque entrée affiche: timestamp, niveau (INFO / WARNING / ERROR), message
- Connexion ouverte / fermée
- Tunnel SSH établi / fermé
- Chaque requête exécutée: SQL (tronqué si trop long), durée d'exécution, statut (success/error)
- Erreurs MySQL avec code + message
- Reconnexions tentées / réussies / échouées

### UI
- Liste scrollable avec entrées colorées selon le niveau
- Bouton "Clear Logs"
- Bouton "Export Logs" (fichier `.txt`)

---

## 🎨 Design & UI/UX

### Thème
- Choix utilisateur dans Settings: **Light** / **Dark** / **System** (suit le thème OS)
- Persisté entre les sessions

### Design général
- Design **moderne et original** — pas une copie de Workbench
- Police: Inter ou Geist (ou équivalent system font)
- Arrondis doux sur les éléments UI
- Ombres légères, séparateurs subtils
- **Taille minimum de la fenêtre**: 1024×768

### Couleurs de connexion
- Chaque connexion peut avoir une couleur assignée via un **color picker libre**
- Cette couleur s'affiche:
  - Comme **gommette** (petit rond, ~8px) sur les onglets de connexion dans la TabBar
  - Sur la **connection card** de la home screen
- La couleur doit être subtile — elle ne doit pas dominer l'UI

### Règle absolue: zéro popup/dialog native
**Toutes** les confirmations, alertes, modals, et dialogs sont des composants React custom (shadcn/ui + Tailwind). **Jamais** `window.alert()`, `window.confirm()`, ou dialogs OS natifs.

### Confirmations destructives
Pour Drop Table, Truncate Table, Drop Database, Delete Connection, Reset DBrice:
- Modal centrée avec backdrop blur
- Titre rouge ou icône d'avertissement
- Texte décrivant clairement ce qui va être supprimé
- Bouton "Cancel" (secondaire) + bouton destructif rouge ("Drop Table", "Delete", etc.)
- Animation d'entrée

### Toasts in-app
- Coin en bas à droite (stack possible si plusieurs)
- Types: success (vert), error (rouge), info (bleu), warning (orange)
- Auto-dismiss après 4s pour success/info, persistent pour error (fermeture manuelle)
- Utilisés pour: connexion sauvegardée, export terminé, import terminé, requête exécutée avec succès

### Bannière de reconnexion
Quand la connexion est perdue:
- Bannière **non-intrusive** en haut du workspace (sous la toolbar, au-dessus des onglets internes)
- Fond orangé/rouge doux: "⚠️ Connection lost — [Reconnect]"
- Bouton Reconnect déclenche une tentative de reconnexion avec spinner

### Bannière post-update
Après une mise à jour silencieuse, au lancement suivant:
- Petite bannière discrète en haut de l'app (dismissable): "✨ DBrice updated to v1.x.x — See what's new →"
- Lien vers GitHub Releases

---

## ⚙️ Settings Screen

Accessible via icône settings (engrenage) dans un coin persistent de l'UI (ex: bas de la sidebar ou coin de la TabBar).

### Sections

#### Appearance
- **Theme**: Light / Dark / System (radio ou toggle)

#### Editor
- **Default LIMIT**: dropdown `10` | `100` | `1000` | `10000` (valeur appliquée aux nouveaux SQL sheets et Select Rows)

#### Security
- **Change Master Password**: champ "Current password" + "New password" + "Confirm new password" + bouton Save
- **Reset DBrice**: bouton rouge "Reset DBrice" → modal de confirmation forte (décrite plus haut)

#### About
- Version de l'app (ex: `v1.0.0`)
- Lien "View Changelog" → ouvre GitHub Releases dans le navigateur
- Lien "GitHub" → ouvre le repo dans le navigateur

---

## 🖥️ Comportement de la fenêtre

- Quand l'utilisateur clique le **bouton fermer** de la fenêtre (×) ou la **réduit**: l'app passe en **arrière-plan** (minimisée dans la barre des tâches OS)
- L'app se rouvre normalement depuis la barre des tâches
- Quand l'app est **complètement fermée** (via le menu File → Quit ou raccourci OS): les passphrases SSH en mémoire sont effacées

---

## 🔄 Auto-Update

- Check au **lancement de l'app** (après le login)
- Si update disponible: **téléchargement silencieux** en background (Tauri updater plugin)
- **Aucune notification** pendant le téléchargement
- Mise à jour appliquée au **prochain lancement**
- Au lancement post-update: affichage de la bannière in-app discrète (décrite plus haut)
- Source: **GitHub Releases** (tag `v*.*.*`)

---

## 🧪 Tests

### Tests d'intégration Rust (`tests/integration/`)

#### `docker-compose.yml`
```yaml
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: testroot
      MYSQL_DATABASE: testdb
      MYSQL_USER: testuser
      MYSQL_PASSWORD: testpass
    ports:
      - "3307:3306"
  openssh:
    image: lscr.io/linuxserver/openssh-server
    environment:
      - USER_NAME=sshuser
      - USER_PASSWORD=sshpass
    ports:
      - "2222:2222"
```

#### `mysql_connection.rs`
- ✅ Connexion TCP/IP avec credentials valides → succès
- ✅ Connexion avec mauvais mot de passe → erreur "Access denied"
- ✅ Connexion avec host inexistant → erreur "Connection refused" ou "Host unreachable"
- ✅ Connexion avec mauvais port → erreur appropriée
- ✅ Connexion avec user inexistant → erreur "Access denied"
- ✅ Test de la persistance de la connexion active

#### `ssh_tunnel.rs`
- ✅ Établissement tunnel SSH avec password → succès
- ✅ Établissement tunnel SSH avec key file → succès
- ✅ Mauvais password SSH → erreur "Authentication failed"
- ✅ Host SSH inexistant → erreur appropriée
- ✅ Connexion MySQL through SSH tunnel → succès
- ✅ Tunnel reste ouvert (keepalive)

#### `query_execution.rs`
- ✅ SELECT simple → résultat correct
- ✅ SELECT avec LIMIT → nombre de lignes correct
- ✅ INSERT → rows affected = 1
- ✅ UPDATE → rows affected correct
- ✅ DELETE → rows affected correct
- ✅ Requête avec erreur de syntaxe → erreur MySQL 1064
- ✅ Multi-statement → première résultat retournée
- ✅ SELECT sur table vide → résultat vide mais colonnes présentes

#### `schema_operations.rs`
- ✅ CREATE TABLE avec colonnes, PK, NN → succès
- ✅ ALTER TABLE ADD COLUMN → succès
- ✅ ALTER TABLE DROP COLUMN → succès
- ✅ ALTER TABLE MODIFY COLUMN → succès
- ✅ ADD INDEX → succès
- ✅ DROP INDEX → succès
- ✅ ADD FOREIGN KEY → succès
- ✅ DROP FOREIGN KEY → succès
- ✅ DROP TABLE → succès
- ✅ TRUNCATE TABLE → succès + table vide

#### `user_management.rs`
- ✅ CREATE USER → succès
- ✅ GRANT SELECT sur une DB → succès
- ✅ REVOKE SELECT → succès
- ✅ DROP USER → succès
- ✅ Connexion avec le nouvel user → respecte les privileges

#### `export_import.rs`
- ✅ Export SQL dump d'une DB → fichier .sql valide généré
- ✅ Import du .sql exporté dans une nouvelle DB → tables + données intactes
- ✅ Export CSV d'une table → fichier .csv avec séparateur `;`
- ✅ Export JSON d'une table → fichier .json valide

### Tests frontend Vitest (`tests/frontend/`)

#### `AuthFlow.test.tsx`
- ✅ Login screen s'affiche au lancement
- ✅ Champ password présent
- ✅ Mauvais password → message d'erreur inline visible (pas de popup native)
- ✅ Bon password → navigation vers Home Screen
- ✅ Lien "Reset DBrice" présent + modal de confirmation s'affiche au clic

#### `ConnectionForm.test.tsx`
- ✅ Modal s'ouvre au clic "New Connection"
- ✅ Tab SSH masqué par défaut (méthode TCP/IP)
- ✅ Tab SSH visible quand méthode "SSH over TCP/IP" sélectionnée
- ✅ Bouton Save disabled si Connection Name vide
- ✅ Bouton Test Connection déclenche le test
- ✅ Bannière succès/erreur apparaît après test (inline, pas popup)
- ✅ Duplicate connexion crée une copie avec "(copy)" dans le nom

#### `ResultGrid.test.tsx`
- ✅ Grid affiche les données correctement
- ✅ NULL affiché en grisé
- ✅ Clic sur header → tri ASC
- ✅ Deuxième clic → tri DESC
- ✅ Filtre colonne → filtre les lignes affichées
- ✅ Clic cellule → mode édition inline
- ✅ Clic Apply → déclenche l'UPDATE
- ✅ Ctrl+C sur cellule → copie la valeur

#### `SqlEditor.test.tsx`
- ✅ Éditeur CodeMirror rendu correctement
- ✅ Ctrl+Enter → déclenche l'exécution
- ✅ Sélection de texte + Ctrl+Enter → exécute uniquement la sélection
- ✅ Dropdown LIMIT change la valeur
- ✅ Bannière erreur s'affiche si query échoue (inline)
- ✅ Bannière erreur dismissable

---

## 🔁 CI/CD — GitHub Actions

### `ci.yml` — Déclenché sur chaque push (toutes branches)
```yaml
jobs:
  lint-frontend:
    - npm install
    - npm run lint (ESLint)
    - npm run format:check (Prettier)
  
  test-frontend:
    - npm install
    - npm run test (Vitest)
  
  lint-rust:
    - cargo fmt --check
    - cargo clippy -- -D warnings
  
  test-rust-unit:
    - cargo test --lib
  
  test-rust-integration:
    - docker-compose up -d (MySQL 8.0 + OpenSSH)
    - wait for MySQL ready
    - cargo test --test integration
    - docker-compose down
  
  build-check:
    - npm install
    - cargo tauri build --debug (vérification que ça compile)
```

### `release.yml` — Déclenché sur push de tags `v*.*.*`
```yaml
jobs:
  build-windows:
    runs-on: windows-latest
    - cargo tauri build
    - Upload .exe installer to GitHub Release
  
  build-macos:
    runs-on: macos-latest
    - cargo tauri build --target universal-apple-darwin
    - Upload .dmg to GitHub Release
  
  create-release:
    - Génère CHANGELOG depuis commits conventionnels
    - Crée GitHub Release avec binaires attachés
```

---

## 🌿 Git Strategy

- **Branches**: `main` (production stable), `develop` (intégration), `feature/nom-feature` (développement)
- **Conventional Commits** enforced:
  - `feat: add SSH key file support`
  - `fix: resolve connection timeout on reconnect`
  - `chore: update dependencies`
  - `docs: update README`
  - `test: add export round-trip tests`
  - `refactor: simplify query execution handler`
- **commitlint** configuré + hook **husky** `commit-msg` qui bloque les commits non conformes
- **CHANGELOG.md** auto-généré à chaque release via `standard-version` ou `release-it`
- **Semver**: `v1.0.0` → patch: `v1.0.1`, minor: `v1.1.0`, major: `v2.0.0`

---

## 🚫 Hors scope (pour l'instant)

- Diff / compare entre deux schémas ou connexions
- ERD / diagramme visuel des relations
- Import CSV
- Système de snippets SQL
- Multi-langue (anglais uniquement)
- Signing / notarization des binaires
- Recherche dans l'historique des requêtes
- Affichage de multiples resultsets (seul le premier est affiché)
- Explain / Query execution plan visuel
- Notifications OS natives (toast OS)

---

## ✅ Checklist finale

### Infrastructure
- [ ] Monorepo Tauri v2 + React + TypeScript initialisé
- [ ] Tailwind CSS + shadcn/ui configurés
- [ ] Zustand stores créés
- [ ] ESLint + Prettier configurés (standard)
- [ ] commitlint + husky configurés
- [ ] GitHub Actions: ci.yml + release.yml
- [ ] docker-compose.yml pour tests (MySQL 8.0 + OpenSSH)

### Sécurité & Auth
- [ ] Écran onboarding premier lancement (définir master password)
- [ ] Login screen (beau design custom)
- [ ] Chiffrement AES-256 SQLite locale
- [ ] OS Keychain via `keyring` crate
- [ ] Cache passphrase SSH en mémoire session
- [ ] Reset DBrice complet (avec confirmation forte)
- [ ] Comportement fenêtre (minimize en arrière-plan, fermeture efface passphrases)

### Home Screen
- [ ] Grille de cards (Folder + Connection)
- [ ] Drag & drop cards / folders
- [ ] ConnectionFormModal (3 tabs: Info/SSH/MySQL)
- [ ] Test Connection inline (bannière, pas popup)
- [ ] Color picker libre
- [ ] Duplicate connexion
- [ ] Recherche/filtrage de cards

### Workspace
- [ ] TabBar global avec gommette + status indicator
- [ ] Bannière reconnexion (pas popup)
- [ ] Sidebar redimensionnable avec arbre DB
- [ ] Badges colonnes (PK, NN, UQ, AI, etc.)
- [ ] Context menus sidebar (table + DB)
- [ ] Menu horizontal workspace

### SQL Editor
- [ ] CodeMirror 6 avec MySQL syntax + autocomplete contextuelle
- [ ] Ctrl+Enter (full + sélection)
- [ ] LIMIT selector dans toolbar
- [ ] Onglets Query 1, 2, 3... + renommage auto sur save
- [ ] Unsaved changes indicator (●) + modal fermeture
- [ ] Save as .sql (Ctrl+S)
- [ ] Result Grid complet (sort, filter, inline edit, NULL display)
- [ ] Ctrl+C cellule/ligne
- [ ] Export CSV (`;`) + JSON
- [ ] Bannière erreur inline (pas popup)
- [ ] Query history par connexion

### Schema Management
- [ ] Table Designer complet (Columns, Indexes, FK, Triggers, Partitioning, Options)
- [ ] Preview SQL avant Apply
- [ ] DROP/TRUNCATE avec confirmations custom
- [ ] Create Database modal
- [ ] Stored Procedures & Functions editor + exécution avec paramètres

### Users & Privileges
- [ ] Liste users MySQL
- [ ] CRUD users complet
- [ ] Schema Privileges (toutes permissions MySQL)
- [ ] Object Privileges
- [ ] Administrative Roles
- [ ] Account Limits

### Export / Import
- [ ] Export: SQL / CSV / JSON, choix tables, structure/data/both
- [ ] Import: .sql dans DB existante ou nouvelle DB
- [ ] Progress bars + error reporting

### Dashboard
- [ ] Server metrics (uptime, connexions, version)
- [ ] Real-time charts (connexions, queries/sec) polling 5s
- [ ] DB sizes bar chart
- [ ] Slow queries
- [ ] Process list + Kill

### Logs
- [ ] Logs tab par connexion (requêtes, connexions, erreurs, SSH)
- [ ] Clear + Export logs

### Settings
- [ ] Theme (Light/Dark/System)
- [ ] Default LIMIT configurable
- [ ] Change master password
- [ ] Reset DBrice
- [ ] About (version, changelog link)

### Tests
- [ ] Tests intégration Rust: connexion, SSH, queries, schema, users, export/import
- [ ] Tests frontend Vitest: auth, connection form, result grid, SQL editor

### Distribution
- [ ] Build Windows x64 → installeur .exe (NSIS)
- [ ] Build macOS Universal (Intel + Apple Silicon) → .dmg
- [ ] Auto-update silencieux via GitHub Releases
- [ ] Bannière in-app post-update
