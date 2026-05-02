# Trading Planner XAUUSD

Application web statique pour préparer des plans Gold XAUUSD en scalping, intraday et swing à partir de captures d'écran MT5.

## Fonctionnalités

- 3 onglets adaptés aux horizons de trading.
- Collage ou dépôt de captures par plan.
- Calcul du risque à partir du capital.
- Génération locale d'un plan structuré à partir de la stratégie.
- Mise à jour du plan au fil de la journée via stockage local du navigateur.
- Analyse IA optionnelle via un endpoint compatible OpenAI si vous fournissez vos propres identifiants.

## Lancer localement

Ouvrez simplement `index.html` dans un navigateur moderne.

Pour un meilleur confort, vous pouvez aussi servir le dossier avec un petit serveur statique.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` publie automatiquement le contenu sur GitHub Pages après un push sur `main`.

## Limites

- Sans service IA externe, l'application ne "lit" pas visuellement les graphiques : elle structure votre analyse et votre plan à partir des captures déposées, de vos notes et de vos paramètres de risque.
- L'appel IA se fait côté navigateur. Utilisez une clé dédiée et limitée, ou remplacez ce mécanisme par un backend privé si vous voulez éviter toute exposition côté client.