# PowerSync JWT — Add `role` Claim (Backend Brief)

**Audience:** Django/backend engineer responsible for the PowerSync token-mint endpoint.

**Asker:** Mobile team. We're enabling role-gated PowerSync sync streams. To do that, every PowerSync JWT needs to carry the user's role so the sync-rules YAML can filter by it. This brief covers the **backend half only** — the sync-rules YAML change will follow once this is deployed.

---

## What to change

Add a single `role` claim to the JWT payload returned by the PowerSync token-mint endpoint. No other auth changes. No signing-key rotation. Additive only.

## Constraints

- **Exact role values, case-sensitive, preserve spaces:**
  - `"Student"`
  - `"Teacher"`
  - `"Academic Director"`
  - `"Program Head"`
- These come from the existing user-role source of truth in Django (likely `accounts_customuser.role`, `accounts_profile.role`, or a similar field — please confirm which).
- Do **not** lowercase, trim, or otherwise transform the values. The sync rules will compare them character-for-character.
- If a user has no role assigned, **fail loudly** (raise an exception, return 4xx) rather than mint a token without the claim. A token without `role` would silently produce zero rows in role-gated streams once the sync-rules YAML ships, which is harder to debug than a clear auth error.

## Code change

Locate the view that mints PowerSync tokens (probably `POST /api/powersync/token/` or similar — search for `jwt.encode` in `accounts/` or `powersync/`). Add a helper and inject one claim into the existing payload:

```python
# accounts/utils.py (or wherever your token helpers live)

ALLOWED_ROLES = {"Student", "Teacher", "Academic Director", "Program Head"}

def get_powersync_role(user) -> str:
    """Return the role string to embed in the PowerSync JWT.
    Must match the sync-rules.yaml values exactly (case-sensitive)."""
    # Adjust attribute path to wherever role actually lives.
    # If it's on the profile, use `user.profile.role` instead.
    role = getattr(user, "role", None)
    if role is None:
        raise ValueError(f"User {user.pk} has no role assigned; refuse to mint PowerSync token.")
    role = str(role)
    if role not in ALLOWED_ROLES:
        raise ValueError(f"User {user.pk} has unknown role {role!r}; refuse to mint PowerSync token.")
    return role
```

```python
# In the existing token-mint view, in the payload dict:

payload = {
    # ... all existing claims unchanged: sub, iat, exp, aud, etc. ...
    "role": get_powersync_role(user),
}

# jwt.encode(payload, ...) — unchanged.
```

That single new key is the entire payload change.

## Recommended test (skip if no test suite)

```python
def test_powersync_token_includes_role(self):
    user = UserFactory(role="Teacher")  # or however the test factory creates users with roles
    response = self.client.post("/api/powersync/token/", auth=user)
    self.assertEqual(response.status_code, 200)
    token = response.json()["token"]  # adjust to your response shape
    decoded = jwt.decode(
        token,
        key=settings.POWERSYNC_JWT_KEY,
        algorithms=["HS256"],          # adjust if you use RS256/etc.
        audience=settings.POWERSYNC_AUDIENCE,
    )
    self.assertEqual(decoded["role"], "Teacher")

def test_powersync_token_refuses_user_without_role(self):
    user = UserFactory(role=None)
    response = self.client.post("/api/powersync/token/", auth=user)
    self.assertNotEqual(response.status_code, 200)
```

## How to verify after deploy

1. Sign in on the mobile app (any environment that points at the deployed backend).
2. Open the React Native dev console / Metro logs, or have a mobile dev capture the `powersyncToken` value from the auth response.
3. Paste the token into [https://jwt.io](https://jwt.io) and confirm the decoded payload contains a `"role"` key with one of the four allowed values.

## Rollout order

This change is **safe to deploy independently**. The current sync-rules YAML doesn't reference the `role` claim yet, so adding it is a no-op for existing sync behavior. Deploy whenever convenient — no coordinated mobile release needed.

The **next** step (done by the mobile team) will deploy the sync-rules YAML that actually filters by `role`. We will only do that AFTER this backend change is live and we've verified at least one freshly-minted token contains the claim. Until then, the new YAML cannot ship.

## Rollback

If anything goes wrong: drop the `"role"` key from the payload and redeploy. No data migrations, no key changes, no client-side impact (the mobile client doesn't read this claim — only PowerSync does, and the current YAML ignores it).

## Questions for you to confirm back to the mobile team

1. **Which attribute holds the user's role?** (`user.role` / `user.profile.role` / `user.groups.first().name` / something else?)
2. **Have all existing users been backfilled** with one of the four allowed values? If not, the loud-failure on missing role will start 4xx-ing for unfilled users at deploy time. Flag any cleanup needed first.
3. **Are there test users in lower environments** (staging / dev) that span all four roles? Useful for end-to-end verification of Phase B.

Thanks. Ping the mobile team when this is deployed and verified per the steps above; we'll then ship the sync-rules YAML.
