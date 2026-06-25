# Secrets Workflow

GitHub Actions secrets are the preferred shared store for automation. Local ignored secrets are the fallback for Codex and direct CLI runs on this machine.

## Secret Names

Required now:
- `INTERVALS_ICU_API_KEY`
- `INTERVALS_ICU_ATHLETE_ID`

Optional / workflow-specific:
- `CENTR_EMAIL`
- `CENTR_PASSWORD`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`

## GitHub Actions Secrets

Use repository Actions secrets for anything that runs on GitHub.

With GitHub CLI installed and authenticated:

```bash
gh secret set INTERVALS_ICU_API_KEY --repo chefliujmf/cyclingcoach
gh secret set INTERVALS_ICU_ATHLETE_ID --repo chefliujmf/cyclingcoach --body i28814
gh secret set CENTR_EMAIL --repo chefliujmf/cyclingcoach
gh secret set CENTR_PASSWORD --repo chefliujmf/cyclingcoach
```

GitHub secrets are write-only. They can be injected into GitHub Actions, but they cannot be read back for local COACHCHECK runs.

## Local Fallback

For local Codex/CLI runs, copy the example file:

```bash
mkdir -p .secrets
cp coach.env.example .secrets/coach.env
chmod 600 .secrets/coach.env
```

Then fill in real values.

The Intervals and Centr tools automatically load:
- `.secrets/coach.env`
- `.secrets/intervals.env`
- `.secrets/centr.env`

Exported shell variables still win over local files.

## Rules

- Never commit `.secrets/` or real `.env` files.
- Keep placeholders only in committed example files.
- Rotate any secret that is pasted into chat or logs.
- If a secret is needed both locally and in GitHub Actions, store it in both places with the same name.
