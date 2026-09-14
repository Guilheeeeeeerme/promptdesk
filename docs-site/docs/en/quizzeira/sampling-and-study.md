# Sampling & study

<span class="status status-verified">VERIFIED</span> Study plane (MySQL + Redis) samples **Eval-approved** items into study pills; grading via `quiz-corrector` (60s loop).

```mermaid
flowchart LR
  PUB[Published bank] --> SAMP[Sampling]
  SAMP --> WEB[web study UX]
  WEB --> API[study api]
  API --> COR[quiz-corrector]
```

User seed only — never fake curriculum fixtures.
