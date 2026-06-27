# Fly.io Deployment Manual

This manual deploys the API to one Fly.io machine with SQLite persisted on an attached volume.

## 1. Set deployment arguments

```sh
export FLY_APP="google-maps-shared-list-to-json-api"
export FLY_REGION="sin"
export FLY_VOLUME_NAME="app_data"
export FLY_VOLUME_SIZE="10"
export ADMIN_TOKEN="$(openssl rand -hex 32)"
```

Optional runtime arguments:

```sh
export RATE_LIMIT_WINDOW_SECONDS="60"
export RATE_LIMIT_MAX_REQUESTS="60"
```

## 2. Create the Fly app

```sh
fly apps create "$FLY_APP" --org personal
```

## 3. Create the SQLite volume

```sh
fly --app "$FLY_APP" volumes create "$FLY_VOLUME_NAME" \
  --region "$FLY_REGION" \
  --size "$FLY_VOLUME_SIZE"
```

The volume name must match `source = "app_data"` in `fly.toml`. If you changed `FLY_VOLUME_NAME`, update `fly.toml` too.

## 4. Set production secrets

```sh
fly --app "$FLY_APP" secrets set \
  ADMIN_TOKEN="$ADMIN_TOKEN" \
  RATE_LIMIT_WINDOW_SECONDS="$RATE_LIMIT_WINDOW_SECONDS" \
  RATE_LIMIT_MAX_REQUESTS="$RATE_LIMIT_MAX_REQUESTS"
```

`NODE_ENV`, `PORT`, and `DATABASE_PATH` are already configured in `fly.toml`.

## 5. Deploy

```sh
fly --app "$FLY_APP" deploy
```

The container starts `node dist/index.js`. Database migrations run automatically on startup.

## 6. Verify the deployment

```sh
curl "https://$FLY_APP.fly.dev/healthz"
```

Expected response:

```json
{"ok":true}
```

Open the API docs:

```sh
open "https://$FLY_APP.fly.dev/docs"
```

## 7. Useful operations

View logs:

```sh
fly --app "$FLY_APP" logs
```

Check machine status:

```sh
fly --app "$FLY_APP" status
```

List volumes:

```sh
fly --app "$FLY_APP" volumes list
```

Redeploy after code changes:

```sh
fly --app "$FLY_APP" deploy
```

Rotate the admin token:

```sh
export ADMIN_TOKEN="$(openssl rand -hex 32)"
fly --app "$FLY_APP" secrets set ADMIN_TOKEN="$ADMIN_TOKEN"
```
