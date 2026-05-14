---
applyTo:
  - "petclinic-frontend/src/**/*.html"
  - "petclinic-frontend/src/**/*.component.ts"
excludeAgent: cloud-agent
---

# Angular template purity review

Use the `angular-template-review` skill when available.

For Angular review, enforce this rule strictly:

- HTML templates must stay declarative.
- Logic belongs in the component class, not in the template.

## Flag in templates

- ternaries
- `&&`, `||`, `!`, `??`
- comparisons or arithmetic
- `items?.length > 0`-style checks
- string formatting/building
- method calls that compute display state
- `map`, `filter`, `find`, `some`, `every`, `sort`
- complex `*ngIf`, `[ngClass]`, `[class.*]`, `[style.*]`, or interpolation expressions

## Preferred fix

Ask for a named field, getter, or view-model value in the component and a simple
binding in HTML.

Good target patterns:

- `*ngIf="hasPets"`
- `{{ ownerDisplayName }}`
- `[disabled]="canSubmit"`
- `[class.error]="showValidationError"`

When commenting, cite the exact template expression and say what should move into
the component.
