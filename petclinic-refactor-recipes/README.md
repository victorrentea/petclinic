# petclinic-refactor-recipes

A **self-contained** [OpenRewrite](https://docs.openrewrite.org/) module. It does **not** touch the
backend build in any way — `petclinic-backend/pom.xml` has no OpenRewrite config. You run the recipes
against the backend from the command line, passing this module as a recipe artifact (see below).

It ships two recipes, deliberately of the two different kinds:

| Recipe | Kind | What it does |
|---|---|---|
| `InlineSingleUseLocalVariable` | **Imperative** (`Recipe` + visitor) | Inlines a local variable used exactly once |
| `ListGetFirst` → `ListGetFirstRecipe` | **Refaster template** (before/after) | Rewrites `list.get(0)` to `list.getFirst()` |

## Why two kinds — and why the inline one can't be Refaster

A **Refaster template** is the simplest kind to read: you write a `@BeforeTemplate` snippet and an
`@AfterTemplate` snippet, and the `rewrite-templating` annotation processor turns them into a recipe
at build time. It is a **typed, whitespace-agnostic, one-expression-in / one-expression-out**
replacement. `ListGetFirst.java` is the whole recipe:

```java
@RecipeDescriptor(name = "...", description = "...")
public class ListGetFirst<T> {
    @BeforeTemplate T getZero(List<T> list)  { return list.get(0); }
    @AfterTemplate  T getFirst(List<T> list) { return list.getFirst(); }
}
```

The **inline-single-use** refactoring **cannot** be expressed that way. Refaster matches one
expression and rewrites it in place; it can't:
- **count** how many times a variable is used (the whole safety rule is "exactly one use"),
- **delete** the declaration statement while editing a *different* statement,
- reason about statement **order**, loops, lambdas or conditionals.

That needs data-flow + multi-statement surgery, which is exactly what an **imperative** recipe (a
`Recipe` with a `JavaIsoVisitor`) is for. So it stays imperative — see
`InlineSingleUseLocalVariable.java`.

## `InlineSingleUseLocalVariable` — the safety rules

Inlines `T v = expr;` into its use **only** when all hold, so behaviour can never change:
1. Single-variable declaration with an initializer.
2. The initializer is a high-precedence expression (method call, `new`, field/array access, literal,
   identifier, parenthesized) — safe to drop in without parentheses.
3. The variable is **read exactly once**. Two+ reads (e.g. `save(type); … type.getId()`) are never
   inlined — that would evaluate the initializer twice. Zero reads are left alone (dead code).
4. That single read is in the **immediately following statement**, reached only through
   side-effect-transparent nodes — so no reordering, and never inside a loop/lambda/conditional.

## `ListGetFirst` — note

On an empty list `get(0)` throws `IndexOutOfBoundsException` while `getFirst()` throws
`NoSuchElementException`; both mean "no first element". `getFirst()` comes from Java 21's
`SequencedCollection`.

## Build & test

```sh
cd petclinic-refactor-recipes
mvn test        # 17 tests: 13 for the imperative recipe, 4 for the Refaster one
mvn install     # publishes victor.training.agentic:petclinic-refactor-recipes:1.0 to your ~/.m2
```

The Refaster recipe class `ListGetFirstRecipe` is **generated** at build time by the
`rewrite-templating` annotation processor from `ListGetFirst` (look in
`target/generated-sources/annotations/…` after a build).

## Run against the backend — no backend pom changes

Because nothing is wired into `petclinic-backend/pom.xml`, invoke the plugin ad-hoc and hand it this
module as a recipe artifact. Run from the backend directory:

```sh
cd petclinic-backend

# Preview only — writes target/rewrite/rewrite.patch, changes no sources:
mvn org.openrewrite.maven:rewrite-maven-plugin:6.44.0:dryRun \
  -Drewrite.recipeArtifactCoordinates=victor.training.agentic:petclinic-refactor-recipes:1.0 \
  -Drewrite.activeRecipes=victor.training.petclinic.rewrite.ListGetFirstRecipe,victor.training.petclinic.rewrite.InlineSingleUseLocalVariable

# Apply in place (review with `git diff`, undo with `git checkout .`):
mvn org.openrewrite.maven:rewrite-maven-plugin:6.44.0:run \
  -Drewrite.recipeArtifactCoordinates=victor.training.agentic:petclinic-refactor-recipes:1.0 \
  -Drewrite.activeRecipes=victor.training.petclinic.rewrite.ListGetFirstRecipe,victor.training.petclinic.rewrite.InlineSingleUseLocalVariable
```

Drop either name from `-Drewrite.activeRecipes` to run just one recipe.

### Watch the imperative recipe reproduce the exact hand-refactoring

`getPetType` in `PetTypeRestController` is already inlined by hand, so put the variable back first and
let the recipe redo it:

```sh
cd petclinic-clone
git checkout petclinic-backend/src/main/java/victor/training/petclinic/rest/PetTypeRestController.java
cd petclinic-backend
mvn org.openrewrite.maven:rewrite-maven-plugin:6.44.0:run \
  -Drewrite.recipeArtifactCoordinates=victor.training.agentic:petclinic-refactor-recipes:1.0 \
  -Drewrite.activeRecipes=victor.training.petclinic.rewrite.InlineSingleUseLocalVariable
git diff   # getPetType inlined again — by the recipe; `type` (2 uses) left untouched
```
