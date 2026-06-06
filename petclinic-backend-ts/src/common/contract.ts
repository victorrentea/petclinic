/**
 * Compile-time exact-match check between a DTO class and its OpenAPI contract
 * type (generated into `src/generated/api-types.ts` from the root
 * `openapi.yaml`). Resolves to `true` only when the two types are mutually
 * assignable — an extra, missing or differently-typed field makes it `never`,
 * which breaks the `true satisfies Exact<...>` assertions in the DTO files.
 */
export type Exact<A, B> = A extends B ? (B extends A ? true : never) : never;
