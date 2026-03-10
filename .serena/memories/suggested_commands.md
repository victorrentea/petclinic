# Suggested Commands

## Backend (petclinic-backend/)
```bash
# Run backend server
./mvnw spring-boot:run

# Build backend
./mvnw clean install

# Run tests
./mvnw test

# Run integration tests
./mvnw verify

# Run with PostgreSQL
docker-compose --profile postgres up
```

## Frontend (petclinic-frontend/)
```bash
# Install dependencies
npm install

# Run dev server (http://localhost:4200)
ng serve
# or
npm start

# Build for production
ng build
# or
npm run build

# Run tests
ng test
# or
npm test

# Run tests headless
npm run test-headless

# Lint code
ng lint
# or
npm run lint

# E2E tests
ng e2e
# or
npm run e2e
```

## Docker
```bash
# Start PostgreSQL
docker-compose --profile postgres up

# Or manually
docker run -e POSTGRES_USER=petclinic -e POSTGRES_PASSWORD=petclinic -e POSTGRES_DB=petclinic -p 5432:5432 postgres:16.3
```

## Full Stack
```bash
# Run everything (from root)
./run-all.sh
```

## macOS Utilities
```bash
# Play completion sound
afplay /System/Library/Sounds/Glass.aiff

# Standard Unix commands work on macOS
git, ls, cd, grep, find, cat, less, tail, head
```
