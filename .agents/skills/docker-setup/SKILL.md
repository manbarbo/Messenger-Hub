---
name: docker-setup
description: "Use when setting up Docker containers for PostgreSQL (pgvector) and MongoDB, or configuring the local development environment. Triggers: docker-compose, database containers, pgvector extension, MongoDB setup, development environment."
metadata:
  author: messengerhub
  version: "1.0.0"
---

# Docker Setup Skill

Guide for setting up Docker containers for the MessengerHub development environment with PostgreSQL (pgvector) and MongoDB.

## When to Apply

- Initial project setup with Docker Compose
- Configuring PostgreSQL with pgvector extension
- Setting up MongoDB with authentication
- Troubleshooting database container issues
- Adding new services to Docker Compose

## Docker Compose Configuration

### PostgreSQL + pgvector

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: messengerhub-postgres
    environment:
      POSTGRES_USER: messenger
      POSTGRES_PASSWORD: messenger
      POSTGRES_DB: messenger_hub
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U messenger -d messenger_hub"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**Key points:**
- Use `pgvector/pgvector:pg16` image (includes pgvector extension pre-installed)
- Health check ensures database is ready before other services connect
- Named volume persists data across container restarts

### MongoDB

```yaml
  mongo:
    image: mongo:7
    container_name: messengerhub-mongo
    environment:
      MONGO_INITDB_ROOT_USERNAME: messenger
      MONGO_INITDB_ROOT_PASSWORD: messenger
      MONGO_INITDB_DB: messenger_hub
    ports:
      - "27017:27017"
    volumes:
      - mongodata:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh --quiet
      interval: 5s
      timeout: 5s
      retries: 5
```

**Key points:**
- `MONGO_INITDB_ROOT_USERNAME/PASSWORD` creates the admin user
- `MONGO_INITDB_DB` creates the initial database
- Health check uses `mongosh` (available in mongo:7 image)
- Named volume persists data

### Full docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: messengerhub-postgres
    environment:
      POSTGRES_USER: messenger
      POSTGRES_PASSWORD: messenger
      POSTGRES_DB: messenger_hub
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U messenger -d messenger_hub"]
      interval: 5s
      timeout: 5s
      retries: 5

  mongo:
    image: mongo:7
    container_name: messengerhub-mongo
    environment:
      MONGO_INITDB_ROOT_USERNAME: messenger
      MONGO_INITDB_ROOT_PASSWORD: messenger
      MONGO_INITDB_DB: messenger_hub
    ports:
      - "27017:27017"
    volumes:
      - mongodata:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh --quiet
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  mongodata:
```

## Connection Strings

### PostgreSQL (Prisma)

```env
DATABASE_URL=postgresql://messenger:messenger@localhost:5432/messenger_hub
```

### MongoDB

```env
MONGODB_URI=mongodb://messenger:messenger@localhost:27017/messenger_hub?authSource=admin
```

**Key points:**
- `authSource=admin` is required when using `MONGO_INITDB_ROOT_USERNAME`
- The database name in the URI must match `MONGO_INITDB_DB`

## pgvector Setup

### Verify Extension

After containers are up, verify pgvector is available:

```bash
docker exec -it messengerhub-postgres psql -U messenger -d messenger_hub -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

### Enable Extension (if not auto-enabled)

```bash
docker exec -it messengerhub-postgres psql -U messenger -d messenger_hub -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

## MongoDB Setup

### Verify Connection

```bash
docker exec -it messengerhub-mongo mongosh -u messenger -p messenger --authenticationDatabase admin messenger_hub --eval "db.runCommand('ping')"
```

### Create Indexes

Indexes are created programmatically by `MongoService.onModuleInit()`. Verify:

```bash
docker exec -it messengerhub-mongo mongosh -u messenger -p messenger --authenticationDatabase admin messenger_hub --eval "db.messages.getIndexes()"
```

## Common Commands

```bash
# Start all services
docker compose up -d

# Start with rebuild
docker compose up -d --build

# View logs
docker compose logs -f postgres
docker compose logs -f mongo

# Stop all services
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v

# Check container status
docker compose ps

# Execute psql in PostgreSQL container
docker exec -it messengerhub-postgres psql -U messenger -d messenger_hub

# Execute mongosh in MongoDB container
docker exec -it messengerhub-mongo mongosh -u messenger -p messenger --authenticationDatabase admin messenger_hub
```

## Troubleshooting

### PostgreSQL won't start

```bash
# Check logs
docker compose logs postgres

# Common issues:
# - Port 5432 already in use → change port mapping
# - Volume permissions → docker compose down -v and restart
```

### MongoDB won't start

```bash
# Check logs
docker compose logs mongo

# Common issues:
# - Port 27017 already in use → change port mapping
# - Auth issues → ensure authSource=admin in connection string
```

### pgvector extension not found

```bash
# Verify you're using the correct image
docker compose images
# Should show pgvector/pgvector:pg16

# If using standard postgres image, you need to install pgvector manually
# Better: switch to pgvector/pgvector image
```

## Requirements

- Docker and Docker Compose installed
- Ports 5432 and 27017 available
- Named volumes for data persistence
- Health checks for service readiness
- Never commit `.env` files with real credentials

## References

- [pgvector Docker Hub](https://hub.docker.com/r/pgvector/pgvector)
- [MongoDB Docker Hub](https://hub.docker.com/_/mongo)
- [DESIGN.md](../../DESIGN.md) — Section 1 (Data Model)
- [AGENTS.md](../../AGENTS.md) — Section 15 (Database)