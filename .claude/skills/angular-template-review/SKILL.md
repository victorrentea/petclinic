---
name: angular-template-review
description: >
  Angular code review skill that enforces template purity. Use automatically when
  reviewing Angular HTML templates or Angular component changes, especially under
  petclinic-frontend/src/, to ensure templates contain bindings only and all
  conditional, computed, formatting, and business logic lives in the component.
---

# Angular Template Review

Use this skill during **code review** of Angular code.

## Goal

Treat Angular templates as dumb views. The HTML should only wire data and events.
If logic appears in the template, flag it and recommend moving it into the
component class as a named property, getter, computed view-model field, or method
with a single clear responsibility.

## What is allowed in HTML

- Simple property reads such as `owner.firstName`, `form.valid`, `pet.name`
- Simple structural bindings such as `*ngIf="isLoading"` or `*ngFor="let pet of pets"`
- Direct event wiring such as `(click)="save()"` or `(ngModelChange)="onSearch($event)"`
- Direct attribute/class/style bindings to already-prepared component state such as
  `[disabled]="isSubmitDisabled"` or `[class.error]="hasError"`

## What to flag

Flag template logic such as:

- Ternaries: `condition ? a : b`
- Boolean expressions with operators such as `&&`, `||`, `!`, `??`
- Comparisons and arithmetic such as `count > 0`, `index + 1`, `price * qty`
- Chained null/length/content checks such as `items?.length > 0`
- String-building and formatting logic in the template
- Method calls used to compute UI state or display values
- Array/object creation or transformations such as `map`, `filter`, `find`, `some`, `every`, `sort`
- Complex `[ngClass]`, `[class.*]`, `[style.*]`, `*ngIf`, or interpolation expressions
- Repeated expressions that should be named once in the component

## Review guidance

When you find template logic:

1. Cite the exact Angular template expression.
2. Explain briefly that the template is carrying logic and should stay declarative.
3. Suggest the shape of the fix in the component, for example:
   - `showEmptyState`
   - `ownerDisplayName`
   - `canSubmit`
   - `validationMessage`
   - `rowClasses`
4. Prefer feedback on real logic-bearing expressions, not cosmetic formatting.

## Good review comment shape

- **Problem:** `*ngIf="owner.pets && owner.pets.length > 0"` puts view logic in HTML.
- **Why:** the template now owns the condition instead of reading prepared state.
- **Better:** compute `hasPets` in the component and use `*ngIf="hasPets"`.

## Bad review comment shape

- "Maybe move some stuff to TS."
- "This template looks too smart."

Be direct and specific: point at the expression and name the component property or
getter that should replace it.
