# Guide Accessibilité — Overframe

> Claude lit ce fichier avant toute modification de composants React, interactions clavier, ou UI.
> Standard cible : WCAG 2.1 niveau AA.

---

## Contexte produit

Overframe est une app gaming overlay. Les utilisateurs sont souvent en plein jeu, une main sur la souris.
L'accessibilité ici signifie : utilisable au clavier, lisible sur fond de jeu, et non intrusif.

---

## Règles obligatoires

### 1. Navigation clavier complète

Chaque interaction possible à la souris doit être possible au clavier.

| Touche | Comportement attendu |
|---|---|
| `Tab` | Déplace le focus entre éléments interactifs |
| `Shift+Tab` | Focus en sens inverse |
| `Enter` / `Space` | Active un bouton ou lien focusé |
| `Escape` | Ferme le panneau ou modal ouvert |
| `Arrow` | Navigation dans les listes, onglets |

```tsx
// Mauvais — click uniquement
<div onClick={handleClose}>Fermer</div>

// Bon — keyboard + click + role
<button onClick={handleClose} onKeyDown={e => e.key === 'Enter' && handleClose()}>
  Fermer
</button>
```

### 2. Labels ARIA sur tout élément interactif sans texte visible

```tsx
// Mauvais
<button onClick={closeTab}><X /></button>

// Bon
<button onClick={closeTab} aria-label="Fermer l'onglet">
  <X aria-hidden="true" />
</button>
```

### 3. Focus management dans les modals et popups

Quand un panel s'ouvre :
- [ ] Le focus se déplace sur le premier élément interactif du panel
- [ ] Le focus reste piégé dans le panel tant qu'il est ouvert (focus trap)
- [ ] Quand le panel se ferme, le focus retourne sur l'élément déclencheur

```tsx
// Pattern de focus trap — utiliser useEffect + ref
useEffect(() => {
  if (isOpen) firstFocusableRef.current?.focus()
}, [isOpen])
```

### 4. Contraste des couleurs

- Texte normal : ratio minimum **4.5:1** (WCAG AA)
- Texte large (18px+ ou 14px+ gras) : ratio minimum **3:1**
- L'overlay est transparent — prévoir que le fond peut être clair ou sombre (jeux variés)

Palette Tailwind sûre pour fond sombre (gaming) :
- Texte principal : `text-white` ou `text-gray-100`
- Texte secondaire : `text-gray-300` minimum (pas `text-gray-500` sur fond sombre)
- Boutons actifs : contraste suffisant en hover ET en focus

### 5. États focus visibles

```css
/* Ne jamais supprimer outline sans alternative */
/* Mauvais */
button { outline: none; }

/* Bon — remplacer par un style custom visible */
button:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2px; }
```

Tailwind : utiliser `focus-visible:ring-2 focus-visible:ring-blue-400` sur les boutons.

### 6. Rôles et structure sémantique

```tsx
// Bonnes pratiques
<nav aria-label="Barre des onglets">...</nav>
<main>...</main>
<aside aria-label="Collections">...</aside>

// Listes d'onglets
<div role="tablist">
  <button role="tab" aria-selected={isActive} aria-controls="panel-id">
    Onglet
  </button>
</div>
<div role="tabpanel" id="panel-id">...</div>
```

### 7. Animations et mouvements

Respecter la préférence système `prefers-reduced-motion` :

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

Tailwind : `motion-safe:animate-*` plutôt que `animate-*` directement.

---

## Checklist de revue par composant

Avant de soumettre un composant ou une modification UI, vérifier :

- [ ] Tous les boutons/liens ont un texte visible ou `aria-label`
- [ ] Navigation clavier fonctionne sans souris
- [ ] Icônes décoratives ont `aria-hidden="true"`
- [ ] Modals/popups ont un focus trap et gèrent `Escape`
- [ ] Contraste texte/fond respecte AA (4.5:1 minimum)
- [ ] Pas de `outline: none` sans remplacement visible
- [ ] Les états loading/error sont annoncés (`aria-live="polite"`)

---

## Tests accessibilité

Il n'y a pas encore de tests a11y automatisés. En attendant, tester manuellement :

1. Naviguer l'overlay **uniquement au clavier** (Tab, Enter, Escape)
2. Vérifier que chaque action possible à la souris est possible au clavier
3. Utiliser Windows Narrator (Win+Ctrl+Enter) pour vérifier les labels ARIA
