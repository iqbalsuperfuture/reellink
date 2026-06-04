#!/bin/sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

SSH_HOST="${SSH_HOST:-root@207.180.206.99}"
REMOTE_BASE_DIR="${REMOTE_BASE_DIR:-/projects/reellink}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-$REMOTE_BASE_DIR/on-server}"
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_NAME="${IMAGE_NAME:-reellink-api}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_PLATFORM="${IMAGE_PLATFORM:-linux/amd64}"
REGISTRY_USERNAME="${REGISTRY_USERNAME:-${GITHUB_USERNAME:-}}"
REGISTRY_TOKEN="${REGISTRY_TOKEN:-${GITHUB_TOKEN:-}}"

if [ -z "$REGISTRY_USERNAME" ]; then
  echo "REGISTRY_USERNAME or GITHUB_USERNAME is required."
  exit 1
fi

IMAGE="${REELLINK_API_IMAGE:-$REGISTRY/$REGISTRY_USERNAME/$IMAGE_NAME:$IMAGE_TAG}"

echo "Building $IMAGE for $IMAGE_PLATFORM..."
docker build --platform "$IMAGE_PLATFORM" -f Dockerfile -t "$IMAGE" .

if [ -n "$REGISTRY_TOKEN" ]; then
  echo "Logging in to $REGISTRY locally..."
  printf "%s" "$REGISTRY_TOKEN" | docker login "$REGISTRY" -u "$REGISTRY_USERNAME" --password-stdin
else
  echo "No REGISTRY_TOKEN set; using existing local Docker login for $REGISTRY."
fi

echo "Pushing $IMAGE..."
docker push "$IMAGE"

echo "Creating $REMOTE_APP_DIR on $SSH_HOST..."
ssh "$SSH_HOST" "mkdir -p '$REMOTE_APP_DIR'"

echo "Copying production compose bundle..."
scp on-server/docker-compose.yml "$SSH_HOST:$REMOTE_APP_DIR/docker-compose.yml"
scp on-server/README.md "$SSH_HOST:$REMOTE_APP_DIR/README.md"

if [ "${OVERWRITE_SERVER_ENV:-0}" = "1" ]; then
  echo "Overwriting server .env..."
  scp on-server/.env "$SSH_HOST:$REMOTE_APP_DIR/.env"
else
  echo "Copying .env only if it does not exist..."
  if ssh "$SSH_HOST" "test -f '$REMOTE_APP_DIR/.env'"; then
    echo "Server .env already exists; keeping it."
  else
    scp on-server/.env "$SSH_HOST:$REMOTE_APP_DIR/.env"
  fi
fi

echo "Setting REELLINK_API_IMAGE on server..."
ssh "$SSH_HOST" "cd '$REMOTE_APP_DIR' && if grep -q '^REELLINK_API_IMAGE=' .env; then sed -i.bak 's#^REELLINK_API_IMAGE=.*#REELLINK_API_IMAGE=$IMAGE#' .env; else printf '\nREELLINK_API_IMAGE=$IMAGE\n' >> .env; fi"

if [ -n "$REGISTRY_TOKEN" ]; then
  echo "Logging in to $REGISTRY on server..."
  printf "%s" "$REGISTRY_TOKEN" | ssh "$SSH_HOST" "docker login '$REGISTRY' -u '$REGISTRY_USERNAME' --password-stdin"
else
  echo "No REGISTRY_TOKEN set; using existing server Docker login for $REGISTRY."
fi

echo "Pulling and starting on server..."
ssh "$SSH_HOST" "cd '$REMOTE_APP_DIR' && docker compose pull && docker compose up -d"

echo "Server status:"
ssh "$SSH_HOST" "cd '$REMOTE_APP_DIR' && docker compose ps"
