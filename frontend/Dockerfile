FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build               # uses .env.production (API at /api)

FROM nginx:1.27-alpine
# SPA fallback so refreshing /files, /trash... serves index.html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / { try_files $uri /index.html; }\n}\n' \
  > /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
