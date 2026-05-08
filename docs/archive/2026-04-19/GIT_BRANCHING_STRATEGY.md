# Git Branching Strategy (Production Safe)

This project uses a simple trunk-with-integration strategy:

- `main`: production-ready only, protected
- `develop`: integration branch for completed features
- `feature/*`: one feature per branch (short-lived)
- `hotfix/*`: urgent production fixes from `main`

## Daily flow

1. Sync base:

```bash
git checkout develop
git pull origin develop
```

2. Create feature branch:

```bash
git checkout -b feature/<feature-name>
```

3. Commit in small slices:

```bash
git add -A
git commit -m "feat(<scope>): <change>"
```

4. Validate before push:

```bash
make test
pnpm --filter web lint
```

5. Push feature:

```bash
git push -u origin feature/<feature-name>
```

6. Merge order:
- Merge `feature/*` -> `develop`
- Run full checks on `develop`
- Merge `develop` -> `main` only when release-ready

## Emergency hotfix

```bash
git checkout main
git pull origin main
git checkout -b hotfix/<issue>
# fix + test
git push -u origin hotfix/<issue>
```

Merge hotfix into both `main` and `develop`.

## Required branch protections

Apply on GitHub:

- Require pull request reviews (>=1)
- Require status checks before merge
- Restrict direct push to `main`
- Optional: restrict direct push to `develop`

## Safety rules

- Never work directly on `main`
- Keep feature branches short-lived (1-3 days)
- Rebase or merge from `develop` daily
- Every PR must include: test evidence + rollback note
