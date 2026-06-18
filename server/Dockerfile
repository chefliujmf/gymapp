# Auth + static + intervals.icu proxy for gymapp.
# The built SPA (dist/) and the data file are mounted at runtime, so updating
# the app is just an rsync + restart — no image rebuild needed.
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js store.js openapi.json ./
ENV STATIC_DIR=/usr/share/nginx/html
ENV DATA_FILE=/data/store.json
ENV PORT=80
EXPOSE 80
CMD ["node", "server.js"]
