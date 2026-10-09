# Architecture decisions

Settled choices, with the context that made them right. Don't undo one as a side effect
of a task — if its context no longer holds, say so and ask.

| Decision | Why, in this context | Rejected |
| --- | --- | --- |
| No service layer: controllers call repositories and mappers directly | Almost every use case is CRUD with no business logic, so a service layer would just pass calls through | Controller → Service → Repository everywhere; add a service only for a use case with real logic or 2+ writes |
| Postgres runs embedded (zonky jar in dev, in-process in tests), no Docker | Trainees' laptops often have no Docker, or a corporate policy blocks it; the app must start with Java alone | Testcontainers, docker-compose |
| Notifying the owner is best effort: an HTTP POST to notification-service after the visit is saved; a failure is logged, the booking stands | An SMS outage must not stop the clinic from booking visits | Sending in the same transaction; a message broker (one more thing to run in a training room) |
