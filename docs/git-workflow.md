# Git Workflow

- Default branch: `main`.
- Feature work: create a `codex/<short-topic>` branch.
- Use atomic commits.
- Open a PR to `main` for review and merge.
- Merge strategy: squash unless we explicitly agree otherwise.
- PRs should require green checks: `phpunit`, `vitest`, and `playwright` (e2e).

Notes
- Direct pushes to `main` are allowed only for hotfixes or agreed fast paths.
- CI must be green before merge.
- Enforce via branch protection rules in GitHub.
