#!/bin/sh
# Een vers aangekoppeld volume is eigendom van root. Zet het goed en laat de app
# daarna als de onbevoorrechte gebruiker draaien.
set -e

if [ "$(id -u)" = "0" ]; then
  mkdir -p "${DATA_DIR:-/data}"
  chown -R node:node "${DATA_DIR:-/data}"
  exec su-exec node "$@"
fi

exec "$@"
