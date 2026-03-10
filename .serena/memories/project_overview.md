# Spring PetClinic - Full Stack Application

## Purpose
Full-stack veterinary clinic management application for managing:
- Owners and their pets
- Veterinarians and their specialties
- Visits and appointments
- Pet types

## Architecture
Two separate subprojects:
- **Backend**: Spring Boot REST API (Java 21) - `petclinic-backend/`
- **Frontend**: Angular SPA - `petclinic-frontend/`

## Tech Stack

### Backend
- Java 21
- Spring Boot 3
- Spring Data JPA
- Spring Security
- H2 (default) / PostgreSQL
- Maven
- OpenAPI/Swagger
- API-First approach

### Frontend
- Angular 16.2
- TypeScript 4.9.5
- Angular Material
- Bootstrap 3
- RxJS 6
- Karma + Jasmine (testing)
- ESLint (linting)

## Database
- Default: H2 in-memory (auto-populated)
- Alternative: PostgreSQL via Docker
- Profile switching via `spring.profiles.active`

## API Documentation
- Swagger UI: http://localhost:8080/swagger-ui.html
- OpenAPI spec: http://localhost:8080/v3/api-docs

## Ports
- Backend: http://localhost:8080
- Frontend: http://localhost:4200
