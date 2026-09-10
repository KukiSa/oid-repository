# Contributing to Signaliks OID Repository

Thank you for your interest in contributing to the Signaliks OID Repository. To ensure a smooth collaboration process
and maintain strict compliance with our licensing model, please review the following guidelines before submitting any
issues or pull requests.

## 1. Issues

We welcome bug reports and feature requests, subject to the following conditions: Issues must be directly related to the
codebase of this repository. If the issue is caused by an upstream dependency, please report it directly to their
respective issue trackers.

Please search existing issues before opening a new one to avoid duplicates.

## 2. Registration and Policy Changes

An ordinary pull request is not a registration decision. Changes that allocate an OID, alter an identity-defining object binding, change a lifecycle state, amend a policy, or change a delegation require an approved decision under `GOVERNANCE.md` before they may be merged.

Proposals may be submitted as Issues. Once approved, the canonical change is made in `registry/registry.json`; generated MDX, JSON, CSV, and manifest files are then regenerated with `pnpm registry:generate`.

Generated files must not be edited directly.

## 3. Pull Requests & Dual-Licensing Policy

This repository operates under the dual-licensing model described in `LICENSES/README.md`.

### Accepted Pull Requests (MIT License)
We accept Pull Requests that modify the software source code and technical infrastructure of the site.
* **Scope:** Configurations, component logic, scripts, and build tools.
* **Condition:** By submitting a Pull Request to these areas, you agree that your contributions will be licensed under
the **MIT License**.

### Policy and Text Contributions (CC BY-SA 4.0)

Policy changes require prior approval by the applicable Policy Authority. Descriptive-text corrections may be accepted when they do not alter a registered object's identity or policy semantics. By submitting an accepted contribution to these areas, you agree that it may be distributed under CC BY-SA 4.0.

## 4. Development Workflow

If your contribution falls under the accepted MIT scope, follow these steps:

1.  **Fork** the repository and create your feature branch.
2.  **Install dependencies:**
    ```bash
    corepack enable
    pnpm install --frozen-lockfile
    ```
3.  **Start the development server:**
    ```bash
    pnpm dev
    ```
    *This runs Next.js with Turbopack. You can view the site at `http://localhost:3000`.*
4.  **Test your build:** Ensure the static export works before submitting your PR.
    ```bash
    pnpm check
    pnpm build
    ```
5.  **Commit and Push:** Write clear, concise commit messages.
6.  **Submit your PR:** State whether the change is software-only, descriptive, or governed registry data. Include the registration decision reference for governed changes.
