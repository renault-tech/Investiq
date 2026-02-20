# Infrastructure

## Local Development

Start local services (PostgreSQL + Redis):

```bash
docker compose up -d
```

Stop services:

```bash
docker compose down
```

Stop and remove all data:

```bash
docker compose down -v
```

## Services

| Service    | Port | Credentials                                       |
|------------|------|---------------------------------------------------|
| PostgreSQL | 5432 | user: investiq / pass: investiq / db: investiq    |
| Redis      | 6379 | no auth                                           |
