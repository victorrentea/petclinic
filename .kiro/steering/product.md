---
inclusion: auto
---

# Product Overview

Pet Clinic is a full-stack veterinary clinic management application demonstrating modern enterprise patterns.

## Architecture
- **Backend**: Spring Boot REST API (Java 21+)
- **Frontend**: Angular SPA (TypeScript)
- **Database**: H2 (dev), PostgreSQL (prod)

## User Personas

- **Receptionist** — Front-desk staff who manage day-to-day operations: registering new owners and pets, scheduling visits, and looking up owner information quickly during phone calls or walk-ins. Values speed and ease of use.

- **Administrator** — Clinic manager responsible for maintaining reference data (pet types, veterinarian specialties) and managing user accounts. Needs oversight of the full system.

- **Veterinarian** — Medical staff who consult patient (pet) history, record visit notes and diagnoses, and review their own schedule. Primarily a read-heavy user focused on clinical information.

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
