ARG CUAC_NODE_IMAGE
FROM ${CUAC_NODE_IMAGE}
COPY --chown=0:0 --chmod=0555 launcher/ /opt/cuac-launcher/
COPY --chown=0:0 --chmod=0555 release/ /opt/cuac-release/
USER 1000:1000
WORKDIR /opt/cuac-release
ENTRYPOINT ["/usr/local/bin/node", "/opt/cuac-launcher/launch.mjs"]
