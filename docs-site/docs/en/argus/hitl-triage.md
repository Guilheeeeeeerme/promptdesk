# HITL triage

<span class="status status-verified">VERIFIED</span> Operators work TriageCases in the triage MFE; API pushes near-realtime updates over WebSocket.

| Knob | Default |
| --- | --- |
| Session TTL | **7d** |
| Auth | MVP mock Auth0 (`AUTH_USE_MOCK` / `AUTH0_USE_MOCK`) |

Tenant/company always derived from **server session**, never trusted from client claims alone.
