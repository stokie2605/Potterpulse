FROM node:24-bookworm-slim AS checks

WORKDIR /app

COPY index.html ./index.html
COPY potter_pulse.db ./potter_pulse.db
COPY scripts ./scripts
COPY assets ./assets

RUN node --check scripts/server.mjs

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=4173

WORKDIR /app

COPY --from=checks --chown=node:node /app/index.html ./index.html
COPY --from=checks --chown=node:node /app/potter_pulse.db ./potter_pulse.db
COPY --from=checks --chown=node:node /app/scripts ./scripts
COPY --from=checks --chown=node:node /app/assets ./assets

USER node

EXPOSE 4173

CMD ["node", "scripts/server.mjs"]
