# GitHub Branch Protection (Main)

1. Open the repository settings in GitHub.
2. Go to Branches → Branch protection rules → Add rule.
3. Target branch name pattern: `main`.
4. Enable:
   - Require a pull request before merging.
   - Require status checks to pass before merging.
   - Required checks: `phpunit`, `vitest`, `playwright`.
   - Require approvals (1+).
   - Require conversation resolution.
   - Do not allow force pushes.
5. Save the rule.

Note: If we want to allow emergency hotfixes, create a separate bypass role or temporary rule update.
