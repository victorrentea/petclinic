# Testing jenkins-cli

Two suites, both driven from one entry point:

```sh
python3 test/run_tests.py           # hermetic only (default, ~2s)
python3 test/run_tests.py --live    # against a real Jenkins
python3 test/run_tests.py --all
```

## Hermetic (`test/e2e_fake.py`)

`test/fake_jenkins.py` is a ~250-line `http.server` impersonating the parts of the
Jenkins REST API the CLI touches: basic auth, the CSRF crumb, jobs and folders,
the build queue (an item that only becomes `executable` on the second poll, like
the real one), progressive console log with `X-More-Data`/`X-Text-Size`, nodes,
plugins and `scriptText`.

The tests run the **real `jenkins.py` as a subprocess** — argument parsing, exit
codes and stdout are part of what is asserted, not bypassed. No Docker, no Java,
no network, so it also runs in CI and on Windows.

Tests are named `test_*` and discovered from the module globals, so they run in
alphabetical order. Some of them build, which changes the build numbers the later
ones see — assert on what is stable (`#6 FAILURE`, `last build:  #`), never on
"the newest build is #7".

## Live (`test/e2e_live.py`)

Skipped (exit 2) unless a Jenkins is configured. It only reads — `version`,
`who-am-i`, `list-jobs`, `nodes`, `plugins` — so it is safe against a corporate
controller. To get a throwaway one:

```sh
docker compose -f docker/docker-compose.yml up -d     # http://localhost:8088
docker compose -f docker/docker-compose.yml logs jenkins | grep -A2 password
```

Then put that URL plus a user/token in `~/.claude/jenkins.env`.
