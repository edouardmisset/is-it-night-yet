# is-it-night-yet

Tiny Deno + Hono service that answers one question for Lyon (France):
is it currently daylight?

## What it returns

- `GET /` -> plain text `true` when it is daylight, otherwise `false`.

## Run locally

Requirements: Deno 2+

```sh
deno task dev
```

Server runs on `http://localhost:8787`.

## Useful tasks

```sh
deno task start      # run once
deno task test       # run tests
deno task check      # lint + format + typecheck + tests
```
