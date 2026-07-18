# Auth + static + intervals.icu proxy for gymapp.
# The built SPA (dist/) and the data file are mounted at runtime, so updating
# the app is just an rsync + restart — no image rebuild needed.
FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
# Copy ALL server JS (not a hand-listed subset) so adding a new module never
# crash-loops the image with ERR_MODULE_NOT_FOUND. CI smoke-tests this image.
# GLOB every coach engine (was a hand-listed subset that SILENTLY DROPPED
# coach-engine-strength/running/swimming/triathlon → those engines, incl. the
# gym VARIETY work, never reached the coach). Never hand-list engines again.
COPY *.js openapi.json coach-engine*.md ./
ENV STATIC_DIR=/usr/share/nginx/html
ENV DATA_FILE=/data/store.json
ENV PORT=80
EXPOSE 80
CMD ["node", "server.js"]
