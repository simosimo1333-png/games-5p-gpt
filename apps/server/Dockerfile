FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
COPY packages/protocol/package.json packages/protocol/package.json
RUN npm ci --omit=optional
COPY tsconfig.base.json ./
COPY apps/server apps/server
COPY packages/protocol packages/protocol
ENV PORT=8787
EXPOSE 8787
CMD ["npm", "run", "start", "--workspace", "@houkago/server"]
