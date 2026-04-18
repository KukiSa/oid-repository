# Contributing to Signaliks OID Repository

Thank you for your interest in contributing to the Signaliks OID Repository. To ensure a smooth collaboration process
and maintain strict compliance with our licensing model, please review the following guidelines before submitting any
issues or pull requests.

## 1. Issues

We welcome bug reports and feature requests, subject to the following conditions: Issues must be directly related to the
codebase of this repository. If the issue is caused by an upstream dependency, please report it directly to their
respective issue trackers.

Please search existing issues before opening a new one to avoid duplicates.

## 2. Pull Requests & Dual-Licensing Policy

This repository operates under a dual-licensing model as outlined in the `README.md`. 

### Accepted Pull Requests (MIT License)
We accept Pull Requests that modify the software source code and technical infrastructure of the site.
* **Scope:** Configurations, component logic, scripts, and build tools.
* **Condition:** By submitting a Pull Request to these areas, you agree that your contributions will be licensed under
the **MIT License**.

### Rejected Pull Requests (CC BY-SA 4.0)
**We DO NOT accept Pull Requests for policy documents or textual content.**
* **Scope:** All textual content, policy documents, and descriptive materials contained within `.md` and `.mdx` files.
* **Condition:** These files are governed by the **CC BY-SA 4.0**. Any Pull Request attempting to modify, add,
or delete `.md` or `.mdx` files will be rejected. If you have suggestions or corrections for the policy texts, please
open an Issue instead.

## 3. Development Workflow

If your contribution falls under the accepted MIT scope, follow these steps:

1.  **Fork** the repository and create your feature branch.
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the development server:**
    ```bash
    npm run dev
    ```
    *This runs Next.js with Turbopack. You can view the site at `http://localhost:3000`.*
4.  **Test your build:** Ensure the static export works before submitting your PR.
    ```bash
    npm run build
    ```
5.  **Commit and Push:** Write clear, concise commit messages.
6.  **Submit your PR:** Ensure your PR description clearly states what code was changed and confirms no `.md`/`.mdx` files were altered.
