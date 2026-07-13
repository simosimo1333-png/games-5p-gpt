FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
COPY packages/protocol/package.json packages/protocol/package.json
RUN npm ci --omit=dev --omit=optional --workspace @houkago/server --include-workspace-root=false
COPY tsconfig.base.json ./
COPY apps/server apps/server
COPY packages/protocol packages/protocol
ENV PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1
USER node
CMD ["npm", "run", "start", "--workspace", "@houkago/server"]
