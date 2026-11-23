# RA Connect para servidor próprio (VPS). O site é gerado sem chaves: o Supabase é configurado
# na hora pelo servidor (/config.js), a partir das variáveis do ra-connect.env.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild esbuild
COPY . .
RUN npx vite build \
 && npx esbuild server/servidor.ts --bundle --platform=node --format=esm --target=node22 \
      --packages=external --outfile=build-servidor/servidor.mjs

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/build-servidor/servidor.mjs ./servidor.mjs
COPY server/dados ./server/dados
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/saude >/dev/null || exit 1
CMD ["node", "servidor.mjs"]
