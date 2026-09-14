# Reproducible Linux dev/build/test environment for OpenFlyCut.
#
# This mirrors exactly what's needed to build and functionally test the app
# on Ubuntu: Node.js, Electron's GTK/X11 runtime libraries, the extra tools
# electron-builder's fpm needs for .deb packaging, and Xvfb for running the
# (otherwise GUI-only) Electron app headlessly in CI/containers.
#
# Usage (see README.md "Docker" section for the full workflow):
#   docker build -t openflycut-dev .
#   docker run --rm -v "$PWD":/app -v /app/node_modules openflycut-dev npm run typecheck
#   docker run --rm -v "$PWD":/app -v /app/node_modules openflycut-dev npm run build:linux
#   docker run --rm -v "$PWD":/app -v /app/node_modules openflycut-dev npm run smoke-test

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg git \
    && curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get install -y --no-install-recommends \
      # Electron/Chromium runtime (GTK3 + X11 + friends)
      libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libgbm1 libasound2t64 libpango-1.0-0 libcairo2 libgtk-3-0t64 \
      libx11-xcb1 libglib2.0-0t64 libnspr4 libdbus-1-3 xdg-utils \
      # Headless display for running/smoke-testing the packaged app
      xvfb \
      # electron-builder's .deb target (fpm) needs these at pack time
      binutils xz-utils \
      # PID 1 init: reaps Chromium's zombie child processes. Without this,
      # Electron hangs on shutdown in a container ("Failed to shutdown"),
      # which silently hangs anything (like Playwright) waiting on it to exit.
      tini \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps in their own layer so `docker build` only re-runs npm install
# when package.json/package-lock.json actually change, not on every source edit.
COPY package.json package-lock.json ./
RUN npm install

COPY . .

ENTRYPOINT ["tini", "--"]
CMD ["bash"]
