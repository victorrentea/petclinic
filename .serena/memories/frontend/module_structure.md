# Frontend Module Structure

## Feature Modules
Each domain feature (owners, pets, vets, visits, etc.) has its own module:

```
src/app/
├── owners/              # Owner management
├── pets/                # Pet management
├── vets/                # Veterinarian management
├── visits/              # Visit management
├── pettypes/            # Pet type management
├── specialties/         # Specialty management
└── parts/               # Shared UI components
```

## Module Pattern
Each feature module includes:
- Lazy-loaded routing
- Feature-specific components
- Service for HTTP calls
- Domain models/interfaces

## Shared Components
`parts/` directory contains:
- `welcome/` - Landing page
- `page-not-found/` - 404 page
- Other reusable UI components

## Root Module
`app.module.ts`:
- Imports all feature modules
- Configures HTTP interceptors
- Sets up global error handling
- Bootstraps AppComponent

## Routing
- Root routing in `app-routing.module.ts`
- Feature routing in `{feature}-routing.module.ts`
- Lazy loading for better performance
