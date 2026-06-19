# LXPython Reconciliation Design

## Goal

Bring over the quality additions from the newer AI Studio / GitHub `main` version of LXPython while preserving the local version's UI framework, interaction model, and overall product feel.

## Source-of-Truth Decision

- **Canonical product surface:** the current local version
- **Donor branch:** GitHub `main` / AI Studio version

The local version remains the UX source of truth for auth, dashboard, learning workspace, profile, and forum experiences. The newer version is mined for logic, reliability, and maintainability improvements, not treated as the new visual base.

## Design Principles

1. Preserve the local visual language and screen structure by default.
2. Import behavioral improvements, not wholesale screen replacements.
3. Separate UI decisions from service, state, and platform decisions.
4. Keep the app previewable throughout the reconciliation.
5. Prefer manual extraction when a donor file mixes good logic with unwanted UX regression.

## Architecture

The reconciliation is split into three layers.

### 1. Presentation Layer

This layer stays local-first. Existing local component templates, layout structure, spacing, and interaction patterns remain in place unless a specific change is explicitly approved.

### 2. Application Logic Layer

This is the main harvest zone. Changes from GitHub `main` are evaluated for:

- auth flow correctness
- route guard behavior
- onboarding transitions
- component state handling
- learning-service behavior
- AI request/response handling
- bug fixes and simplifications

### 3. Platform and Security Layer

Security, admin gating, model-provider changes, and deployment/config updates are assessed separately so they do not accidentally rewrite the product experience.

## Migration Strategy

The work proceeds by feature slice rather than file replacement.

### Slice A: Auth and Route Flow

- Keep the local auth screen design.
- Port proven fixes from `main`, including safer auth timing and cleaner guard behavior where compatible.
- Do not automatically adopt admin-only access rules unless they match the intended product direction.

### Slice B: Learning Workspace Internals

- Keep the local learning studio layout and interaction model.
- Review `learning-module` and `learning.service` changes from `main` for cleaner state and runtime behavior.
- Treat any Gemini migration as a service-adapter decision, not a reason to replace the interface.

### Slice C: Dashboard, Profile, Forum, and Onboarding

- Preserve the local shell and styling.
- Port narrowly scoped fixes or maintainability improvements from `main`.
- Reject generic AI Studio styling replacements that dilute the local experience.

### Slice D: Platform Configuration

- Review hosting, environment, auth, and deployment changes independently.
- Reuse only the pieces that improve maintainability without sacrificing local previewability or existing workflow needs.

## Change Classification Rules

Each relevant diff from GitHub `main` is classified into one of three outcomes:

- **Keep local:** local version already better or more aligned
- **Port logic:** extract the non-visual improvement into the local implementation
- **Rework locally:** the donor change is valuable, but must be rewritten to fit the local architecture and UX

This avoids blind merges and keeps each imported change intentional.

## Error Handling and Risk Control

- If a donor change combines valuable logic with unwanted UI regression, extract the logic manually instead of copying the file.
- If a security change conflicts with the intended user flow, pause that change and resolve compatibility first.
- Keep slices isolated so regressions can be traced to a specific integration step.

## Verification Strategy

Validate each slice independently:

- auth and route entry
- onboarding
- dashboard shell
- learning workspace
- profile
- forum

Use targeted local preview checks after each slice so the application remains usable during reconciliation.

## Success Criteria

The first implementation pass is successful when:

1. The app still looks and feels like the current local version.
2. High-value quality improvements from GitHub `main` are integrated into logic and service layers.
3. The result is more reliable and maintainable without drifting toward the confusing AI Studio UI.
