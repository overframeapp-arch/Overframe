# Guide Design UX/UI — Overframe

> Claude lit ce fichier avant toute modification visuelle ou création de composant.
> Le design system existe déjà — ce guide le documente. **Ne jamais le réinventer.**

---

## Philosophie : un overlay, pas une app

Overframe se superpose à un jeu. Contraintes qui découlent de ça, et qui priment sur tout :

1. **Discret** — l'UI ne doit jamais dominer l'écran. D'où la densité élevée (boutons `h-6`/`h-7`, texte `11px`/`text-xs`). Ne pas agrandir « pour faire joli ».
2. **Lisible sur fond variable** — le jeu derrière peut être clair ou sombre, et l'overlay est semi-transparent. Le contraste doit tenir dans les deux cas.
3. **Glanceable** — l'utilisateur jette un œil entre deux actions de jeu. Hiérarchie visuelle immédiate, pas de lecture.
4. **Zéro friction clavier** — voir [ACCESSIBILITY.md](ACCESSIBILITY.md). Toute action souris a son équivalent clavier.

---

## Design tokens — source unique de vérité

Définis en variables CSS HSL dans [src/renderer/styles.css](../../src/renderer/styles.css), exposés à Tailwind dans [tailwind.config.js](../../tailwind.config.js). **Toujours utiliser le token Tailwind, jamais une couleur en dur.**

| Token Tailwind | HSL | Hex | Usage |
|---|---|---|---|
| `bg-background` | `0 0% 8%` | `#141414` | Fond de base (carbone) |
| `text-foreground` | `0 0% 92%` | `#EBEBEB` | Texte principal |
| `bg-muted` | `0 0% 13%` | `#212121` | Surface élevée (cards, hover) |
| `text-muted-foreground` | `0 0% 46%` | `#757575` | Texte secondaire |
| `border-border` | `0 0% 19%` | `#303030` | Bordures, séparateurs |
| `bg-primary` / `text-primary` | `262 83% 58%` | `#7c3aed` | Violet — action principale, accent, focus ring |
| `text-primary-foreground` | `0 0% 100%` | `#FFFFFF` | Texte sur fond primary |
| `bg-destructive` | `4 68% 55%` | rouge | Suppression, action dangereuse |
| `rounded` (`--radius`) | — | `0.35rem` | Rayon par défaut (compact) |

```tsx
// Mauvais — couleur en dur, casse le theming
<div className="bg-[#141414] text-[#EBEBEB] border-[#303030]">

// Bon — tokens sémantiques
<div className="bg-background text-foreground border border-border">
```

**Opacité d'un token** : `bg-primary/85` (hover), `disabled:opacity-40`. Ne pas créer de nouvelles teintes — moduler l'opacité d'un token existant.

---

## Composants primitifs — réutiliser, ne pas dupliquer

Avant de créer un élément d'UI, vérifier [src/renderer/components/ui/](../../src/renderer/components/ui/) :

| Composant | Usage |
|---|---|
| `Button` | Tout bouton — variants `default`/`ghost`/`outline`/`destructive`, tailles `sm`/`md`/`icon` |
| `Input` | Tout champ texte |
| `Slider` | Valeur continue (opacité, etc.) |
| `Tooltip` | Info au survol/focus |
| `ShortcutInput` | Capture d'un raccourci clavier |

Le défaut de `Button` est `ghost`/`md` — l'action principale d'un écran utilise `variant="default"` (violet).

---

## Pattern de composant — la convention du projet

Tous les composants UI suivent ce pattern (style shadcn/ui). **Le respecter pour toute création.**

```tsx
import * as React from 'react'
import { cn } from '../../lib/cn'   // merge de classes — toujours l'utiliser

const variantClasses = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/85',
  ghost:   'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
} as const

export interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variantClasses
}

export const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  ({ className, variant = 'ghost', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        variantClasses[variant],
        className,   // toujours en dernier — permet l'override par l'appelant
      )}
      {...props}
    />
  ),
)
MyComponent.displayName = 'MyComponent'
```

Règles :
- `cn()` (depuis `lib/cn`) pour fusionner les classes, jamais de concaténation de strings
- `className` en dernier dans `cn()` pour que l'appelant puisse surcharger
- `forwardRef` + `displayName` sur tout composant réutilisable
- Variants typés via `keyof typeof` — pas de string libre

---

## Densité & espacement

L'UI est **volontairement compacte**. Échelle observée dans le code, à respecter :

- Hauteurs interactives : `h-6` (24px) / `h-7` (28px) — pas plus pour les contrôles de la chrome
- Texte : `text-[11px]` (dense) / `text-xs` (12px) standard
- Padding bouton : `px-2` à `px-2.5`
- Icônes : Lucide React, taille `14`–`16px` (`h-4 w-4`)

Ne pas introduire de `text-base`, `h-10`, `p-4` dans la chrome de l'overlay — ce serait hors échelle. Les exceptions : pages plein écran (WelcomePage, onboarding) où plus d'air est acceptable.

---

## États visuels obligatoires

Tout élément interactif doit gérer ses 4 états :

| État | Classe |
|---|---|
| Hover | `hover:bg-muted` ou `hover:bg-primary/85` |
| Focus (clavier) | `focus-visible:ring-1 focus-visible:ring-ring` — **jamais `outline-none` seul** |
| Disabled | `disabled:opacity-40 disabled:pointer-events-none` |
| Loading | spinner + `aria-busy`, voir NotificationCenter pour le pattern |

---

## Animations

- Transitions de couleur : `transition-colors` (déjà standard sur Button)
- Respecter `prefers-reduced-motion` (voir ACCESSIBILITY.md)
- Pas d'animation gratuite — chaque mouvement doit communiquer un changement d'état
- Les notifications glissent (slide), géré côté PopupWindow — réutiliser, ne pas réimplémenter

---

## Checklist de revue design

Avant de soumettre une modification visuelle :

- [ ] Aucune couleur en dur — uniquement des tokens Tailwind sémantiques
- [ ] Composant primitif réutilisé si existant (pas de bouton custom)
- [ ] Pattern `cn()` + `forwardRef` + variants typés respecté
- [ ] Densité cohérente avec la chrome (`h-6`/`h-7`, `text-xs`)
- [ ] Les 4 états visuels gérés (hover/focus/disabled/loading)
- [ ] Lisible sur fond clair ET sombre (overlay transparent)
- [ ] Focus ring visible (accessibilité)
- [ ] Vérifié visuellement via `curl http://127.0.0.1:9119/screenshot`
