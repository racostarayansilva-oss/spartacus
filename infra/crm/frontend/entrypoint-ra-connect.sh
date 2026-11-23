#!/bin/sh
set -e
# Permite que só o RA Connect abra o CRM dentro de um iframe.
CONF=/etc/nginx/conf.d/default.conf
if [ -n "$ORIGEM_RA_CONNECT" ] && ! grep -q "frame-ancestors 'self' $ORIGEM_RA_CONNECT" "$CONF"; then
  sed -i "s|frame-ancestors 'self';|frame-ancestors 'self' $ORIGEM_RA_CONNECT;|" "$CONF"
fi
sed -i "s|__ORIGEM_RA_CONNECT__|$ORIGEM_RA_CONNECT|g" /usr/share/nginx/html/sso.html
exec /docker-entrypoint.sh "$@"
