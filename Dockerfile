# -------------------------------------------
# Étape 1 : Build du front-end React (Vite)
# -------------------------------------------
FROM node:18 AS build-frontend

WORKDIR /app
COPY frontend/ /app/

RUN npm install
RUN npm run build
# => Le build final se retrouve dans /app/dist

# -------------------------------------------
# Étape 2 : Image finale avec Python
# -------------------------------------------
FROM python:3.9-slim

WORKDIR /backend

# On copie le code backend (Python)
COPY backend/ /backend/

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# On copie le build du front (dist) depuis l'étape précédente
COPY --from=build-frontend /app/dist /backend/dist

# Expose le port 80 (ou celui utilisé par server.py)
EXPOSE 80

# Commande de démarrage : lancer server.py
CMD ["python", "server.py"]
