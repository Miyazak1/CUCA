ARG CUAC_NODE_IMAGE=node@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5
FROM ${CUAC_NODE_IMAGE} AS build

WORKDIR /opt/cuac
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build \
  && npm prune --omit=dev --ignore-scripts \
  && npm cache clean --force

FROM ${CUAC_NODE_IMAGE} AS runtime

ENV NODE_ENV=production \
    CUAC_HTTP_HOST=0.0.0.0 \
    PORT=3000
WORKDIR /opt/cuac

COPY --from=build --chown=0:0 /opt/cuac/package.json /opt/cuac/package-lock.json ./
COPY --from=build --chown=0:0 /opt/cuac/node_modules ./node_modules
COPY --from=build --chown=0:0 /opt/cuac/dist ./dist
COPY --from=build --chown=0:0 /opt/cuac/src/server ./src/server
COPY --from=build --chown=0:0 /opt/cuac/scripts/application-container-entry.ts ./scripts/application-container-entry.ts
COPY --from=build --chown=0:0 /opt/cuac/scripts/start-app.ts ./scripts/start-app.ts
COPY --from=build --chown=0:0 /opt/cuac/scripts/start-staging-candidate.ts ./scripts/start-staging-candidate.ts
COPY --from=build --chown=0:0 /opt/cuac/scripts/start-reviewed-release.ts ./scripts/start-reviewed-release.ts
COPY --from=build --chown=0:0 /opt/cuac/scripts/lib ./scripts/lib

USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||'3000')+'/api/v1/health').then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))"]
ENTRYPOINT ["node", "scripts/application-container-entry.ts"]
