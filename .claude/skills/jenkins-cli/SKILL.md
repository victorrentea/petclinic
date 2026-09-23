---
name: jenkins-cli
description: Drive Jenkins from the shell — list jobs, trigger builds with parameters and wait for the result, stream console output, manage job config.xml, queue, agents, plugins, run Groovy on the controller. A stdlib-only Python client (Windows/macOS/Linux) over the Jenkins REST API. Use whenever a task needs Jenkins AND no Jenkins MCP tools are available (no mcp__jenkins__*), which is the normal situation on corporate controllers. Also use when explicitly asked to "use the jenkins-cli skill".
allowed-tools: Bash(.claude/skills/jenkins-cli/jenkins.py:*), Bash(python3 .claude/skills/jenkins-cli/jenkins.py:*), Bash(python .claude/skills/jenkins-cli/jenkins.py:*), Bash(py .claude/skills/jenkins-cli/jenkins.py:*), Bash(jq:*)
---

# Jenkins from the shell, without the jar

`jenkins.py` does what `jenkins-cli.jar` does — same command names — but over the
REST API. **Python 3.8+, standard library only**: no Java, no downloaded jar, no
SSH key, no `pip install`, identical on Windows, macOS and Linux.

```sh
python3 .claude/skills/jenkins-cli/jenkins.py version   # macOS / Linux (also runs as ./jenkins.py)
python  .claude/skills/jenkins-cli/jenkins.py version   # Windows: python or py; `python3` there
                                                        # is often just the Microsoft Store stub
```

Below, `$J` stands for whichever of those your OS needs.

## 1. One-time setup

The token lives in `~/.claude/jenkins.env`, outside every repo:

```sh
install -m 600 /dev/null ~/.claude/jenkins.env    # Windows: %USERPROFILE%\.claude\jenkins.env
cat > ~/.claude/jenkins.env <<'ENV'
JENKINS_URL=https://jenkins.your-company.com
JENKINS_USER_ID=victor
JENKINS_API_TOKEN=<avatar -> Security -> API Token -> Add new token>
ENV
```

Lookup order, first file wins — real env vars always win over the file:

```
$JENKINS_ENV_FILE  ->  ./.jenkins.env  ->  ~/.claude/jenkins.env  ->  ~/.jenkins.env
```

`jenkins.env.example` documents every variable (`JENKINS_AUTH=user:token` like the
jar's `-auth`, `JENKINS_INSECURE=1` for self-signed certs). Check the wiring with
`$J config` — it prints the URL and user, never the token.

## 2. Reading

```sh
$J list-jobs                  # add -r to descend into folders
$J job petclinic-build        # buildable? in queue? last result?
$J builds petclinic-build -n 20
$J console petclinic-build            # last build; also: 7, success, failed, last
$J console petclinic-build -f         # stream a running build
$J queue ; $J nodes ; $J plugins --updates
```

Folders are plain slashes: `$J job ops/nightly`. Build aliases beyond a number:
`last`, `success`, `failed`, `stable`, `completed`.

## 3. Building

```sh
$J build petclinic-build                          # fire and forget, prints queue id
$J build petclinic-build -w                       # wait; exit code 1 unless SUCCESS
$J build petclinic-build -p BRANCH=main -p SKIP_TESTS=false -f   # wait + stream
$J build petclinic-build -c                       # poll SCM first
$J stop petclinic-build ; $J cancel-queue 412
```

`-w`/`-f` make the exit code the build result, so `$J build x -w && ./deploy.sh`
works as a shell gate.

## 4. Writing

```sh
$J get-job petclinic-build > config.xml           # config.xml is the whole API
$J update-job petclinic-build -c config.xml
$J create-job nightly-e2e -c config.xml           # '-c -' reads stdin
$J copy-job petclinic-build petclinic-build-pr
$J disable-job release ; $J enable-job release
$J delete-job scratch
$J set-description petclinic-build 42 "release candidate"
$J offline-node agent-1 -m "disk full" ; $J online-node agent-1
$J install-plugin git@5.2.1 --restart
$J quiet-down ; $J cancel-quiet-down ; $J safe-restart
```

Anything not wrapped goes through the escape hatch, which still handles auth, the
CSRF crumb, errors and JSON formatting:

```sh
$J raw GET  "/job/petclinic-build/api/json?tree=builds[number,result]"
$J raw POST "/job/petclinic-build/42/submitDescription" '{"description":"x"}'
$J groovy -  <<< 'println Jenkins.instance.numExecutors'
```

## 5. Rules for agents

- **Never print or echo the API token**, and never write it into a repo file.
  `$J config` is safe; `cat ~/.claude/jenkins.env` is not.
- **Confirm before writing.** `build`, `delete-job`, `update-job`, `install-plugin`,
  `restart`, `shutdown` and `offline-node` are visible to the whole team and mostly
  irreversible — ask first unless the user's request already names the action.
  `restart`/`shutdown` kill running builds; prefer the `safe-` variants.
- `groovy` runs arbitrary code as the controller. Treat it as a last resort, show
  the script before running it, and never pipe in something you didn't write.
- Prefer `--json | jq` (if installed; Git for Windows does not ship it) when you need one field; prefer the default text tables when
  you need to *read*. Don't dump whole `--json` payloads into the transcript, and
  use `console -n 200` instead of tailing a 50k-line log into context.
- Errors always carry the HTTP status: `jenkins.py: HTTP 403 on POST .../build - ...`.
  401 = wrong/expired token, 403 = the token lacks the permission (or CSRF is
  configured oddly), 404 on a job that exists is usually also a permissions problem.
- Job names with spaces or `/` folders: quote them — `$J job "ops/nightly build"`.

Tests (hermetic fake Jenkins, no Docker) are described in [TESTING.md](TESTING.md).
