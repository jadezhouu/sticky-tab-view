## Summary

<!-- Describe what this PR changes and why. -->

## Test plan

<!-- How did you verify this change? List the commands you ran and the results. -->

## Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm --dir example exec tsc --noEmit` passes
- [ ] New public exports are re-exported from `src/index.ts`
- [ ] No Expo imports in `src/`
- [ ] README is updated if public API or behavior changed
