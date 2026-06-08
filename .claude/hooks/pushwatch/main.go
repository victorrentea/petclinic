// Command pushwatch parses a Claude Code Bash-tool hook payload and decides
// whether the command is an actual `git push`, and in which working directory
// it runs. The bash command is parsed into a real shell AST via mvdan.cc/sh
// instead of regex/shlex, so quoting, `cd` chains, and `git -C <dir>` are
// handled correctly.
//
// Input  (stdin):  the PostToolUse hook JSON ({"tool_input":{"command": "..."}})
// Output (stdout): two lines —
//
//	line 1: "PUSH" or "NOPUSH"
//	line 2: the effective working directory of the push ("" = session cwd)
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"mvdan.cc/sh/v3/syntax"
)

type hookInput struct {
	ToolInput struct {
		Command string `json:"command"`
	} `json:"tool_input"`
}

// literal returns the static string value of a word, concatenating plain,
// single-quoted, and double-quoted literal parts. It returns "" if the word
// contains anything that can't be resolved statically (param/command/arith
// expansion), so callers treat such words as opaque rather than guessing.
func literal(w *syntax.Word) string {
	var b strings.Builder
	for _, part := range w.Parts {
		switch p := part.(type) {
		case *syntax.Lit:
			b.WriteString(p.Value)
		case *syntax.SglQuoted:
			b.WriteString(p.Value)
		case *syntax.DblQuoted:
			for _, dp := range p.Parts {
				lit, ok := dp.(*syntax.Lit)
				if !ok {
					return ""
				}
				b.WriteString(lit.Value)
			}
		default:
			return ""
		}
	}
	return b.String()
}

func emit(push bool, workdir string) {
	if push {
		fmt.Println("PUSH")
	} else {
		fmt.Println("NOPUSH")
	}
	fmt.Println(workdir)
}

func main() {
	data, _ := io.ReadAll(os.Stdin)

	var in hookInput
	if err := json.Unmarshal(data, &in); err != nil || in.ToolInput.Command == "" {
		emit(false, "")
		return
	}

	file, err := syntax.NewParser().Parse(strings.NewReader(in.ToolInput.Command), "")
	if err != nil {
		// Unparseable command — be conservative and report no push.
		emit(false, "")
		return
	}

	workdir := ""
	push := false

	// Walk visits the AST in source order, so the last `cd` seen before a
	// `git push` is that push's effective working directory.
	syntax.Walk(file, func(node syntax.Node) bool {
		if push {
			return false
		}
		call, ok := node.(*syntax.CallExpr)
		if !ok || len(call.Args) == 0 {
			return true
		}
		switch literal(call.Args[0]) {
		case "cd":
			if len(call.Args) >= 2 {
				if d := literal(call.Args[1]); d != "" {
					workdir = d
				}
			}
		case "git":
			// git [-C <dir>] [global-flags...] <subcommand> ...
			gitDir, sub := "", ""
			args := call.Args[1:]
			for i := 0; i < len(args); i++ {
				a := literal(args[i])
				if a == "-C" && i+1 < len(args) {
					gitDir = literal(args[i+1])
					i++
					continue
				}
				if strings.HasPrefix(a, "-") {
					continue // skip other global flags (-c, --git-dir handled as flags)
				}
				sub = a
				break
			}
			if sub == "push" {
				if gitDir != "" {
					workdir = gitDir
				}
				push = true
				return false
			}
		}
		return true
	})

	emit(push, workdir)
}
