#!/bin/sh
set -eu
umask 077
mkdir -p /tmp/dayfeel-keys
printf '%s' "${JWT_PRIVATE_KEY_BASE64:?Set JWT_PRIVATE_KEY_BASE64}" | base64 -d > /tmp/dayfeel-keys/private.pem
printf '%s' "${JWT_PUBLIC_KEY_BASE64:?Set JWT_PUBLIC_KEY_BASE64}" | base64 -d > /tmp/dayfeel-keys/public.pem
export JWT_PRIVATE_KEY=/tmp/dayfeel-keys/private.pem
export JWT_PUBLIC_KEY=/tmp/dayfeel-keys/public.pem
unset JWT_PRIVATE_KEY_BASE64 JWT_PUBLIC_KEY_BASE64
exec java -jar /app/app.jar
