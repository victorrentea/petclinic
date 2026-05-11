---
inclusion: auto
---

# Product Overview

Pet Clinic is a full-stack veterinary clinic management application demonstrating modern enterprise patterns.

## Architecture
- **Backend**: Spring Boot REST API (Java 21+)
- **Frontend**: Angular SPA (TypeScript)
- **Database**: Embedded PostgreSQL (Java jar for dev, in-process for tests)

## Core Features
- Pet owners and contact information management
- Pets and pet types
- Veterinarians and specialties
- Veterinary visits and appointments
- Veterinarian reviews with star ratings (1-5) and text feedback

## Key Capabilities
- CRUD operations with validation
- Search and pagination (server-side preferred)
- Form validation
- XSS protection (OWASP sanitization)
- Error handling with consistent error responses
- RESTful API design

## Development Approach
- Java-first API design (not generated from Swagger)
- Domain-driven organization
- Feature module pattern (Angular)
- Constructor injection for dependencies
- Transactional integrity where needed
- Comprehensive testing (unit + integration)
