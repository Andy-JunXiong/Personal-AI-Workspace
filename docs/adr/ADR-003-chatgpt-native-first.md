# ADR-003 — ChatGPT-native first

**Status:** Accepted

## Decision
ChatGPT is the primary interaction and reasoning host for the first product path.

The Workspace integrates with ChatGPT rather than rebuilding a parallel general-purpose chat product.

## Constraint
The Workspace backend and state model remain conceptually separable from ChatGPT so a future secondary client is possible.
