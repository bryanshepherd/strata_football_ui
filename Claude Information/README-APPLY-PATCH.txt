
# How to apply the patch

From your repo root (strata-football-ui-new/):

```bash
git checkout -b fix/validation-contracts
git apply --index ../0001-tighten-validation-and-transform.patch   # adjust path if needed
git commit -m "Tighten validation, restore spec tests, support mixed-field transforms"
npm run test
```

If a hunk fails:
- Open the files mentioned and manually copy the changed snippets.
- Re-run tests with `npm run test:run`.
