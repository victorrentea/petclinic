#!/usr/bin/env python3
"""pushwatch — decide whether a Claude Code Bash-tool command is an actual
`git push`, and in which working directory it runs.

The bash command is tokenized with the stdlib ``shlex`` module (posix mode,
punctuation-aware) rather than a regex, so quoting, comments, ``cd`` chains and
``git -C <dir>`` are handled correctly — without pulling a separate language or
build step into the project (``python3`` is already required by the hook that
calls this).

Input  (stdin):  the PostToolUse hook JSON ({"tool_input": {"command": "..."}})
Output (stdout): two lines —
    line 1: "PUSH" or "NOPUSH"
    line 2: the effective working directory of the push ("" = session cwd)
"""
import json
import shlex
import sys

# With punctuation_chars enabled, shlex emits runs of these as standalone
# tokens (`&&`, `||`, `;`, `|`, redirections, subshell parens). Any such token
# ends the current simple command and starts the next.
_OPERATOR_CHARS = set(";&|()<>")

# git global options that consume the FOLLOWING token as their value, so that
# value must not be mistaken for the subcommand (e.g. the `core.x=y` in
# `git -c core.x=y push`). `-C` is handled separately because we capture its dir.
_GIT_VALUE_OPTS = {"-c", "--git-dir", "--work-tree", "--namespace",
                   "--super-prefix", "--config-env", "--exec-path"}


def _emit(push, workdir):
    print("PUSH" if push else "NOPUSH")
    print(workdir)


def _static(word):
    """The static value of a token, or "" if it can't be resolved statically.

    shlex (posix) already stripped quotes but leaves ``$``/backtick expansions
    as literal text. Treat any such word as opaque — matching the previous Go
    helper, which refused to guess at expanded values — so the caller falls
    back to the session cwd rather than a bogus directory.
    """
    if "$" in word or "`" in word:
        return ""
    return word


def _decide(command):
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars=True)
        lexer.whitespace_split = True
        tokens = list(lexer)
    except ValueError:
        # Unbalanced quotes / unterminated string — be conservative.
        return False, ""

    workdir = ""

    def run(cmd):
        """Inspect one simple command; return True if it is a `git push`.

        Tracks the latest `cd <dir>` as the effective working directory, the
        same way the AST walk did — so the last `cd` before the push wins.
        """
        nonlocal workdir
        if not cmd:
            return False
        head = cmd[0]
        if head == "cd" and len(cmd) >= 2:
            d = _static(cmd[1])
            if d:
                workdir = d
            return False
        if head == "git":
            # git [-C <dir>] [global-flags...] <subcommand> ...
            git_dir, sub = "", ""
            args = cmd[1:]
            i = 0
            while i < len(args):
                a = args[i]
                if a == "-C" and i + 1 < len(args):
                    git_dir = _static(args[i + 1])
                    i += 2
                    continue
                if a in _GIT_VALUE_OPTS and i + 1 < len(args):
                    i += 2  # skip the option AND its value (e.g. `-c key=val`)
                    continue
                if a.startswith("-"):
                    i += 1
                    continue  # skip other global flags (incl. --opt=value forms)
                sub = a
                break
            if sub == "push":
                if git_dir:
                    workdir = git_dir
                return True
        return False

    simple = []  # tokens of the current simple command
    for tok in tokens:
        if tok and all(c in _OPERATOR_CHARS for c in tok):
            if run(simple):
                return True, workdir
            simple = []
        else:
            simple.append(tok)
    if run(simple):
        return True, workdir
    return False, ""


def main():
    raw = sys.stdin.read()
    try:
        command = json.loads(raw)["tool_input"]["command"]
    except (ValueError, KeyError, TypeError):
        _emit(False, "")
        return
    if not isinstance(command, str) or not command:
        _emit(False, "")
        return
    _emit(*_decide(command))


if __name__ == "__main__":
    main()
