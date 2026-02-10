#!/usr/bin/env python3
"""Check whether a given line in a source file is covered according to JaCoCo XML report.

Usage:
  ./scripts/check_jacoco_line.py <source-file-path> <line-number> [--report target/site/jacoco/jacoco.xml]

Exit codes:
  0 => covered
  1 => not covered
  2 => ambiguous sourcefile match (multiple sourcefiles with same name)
  3 => jacoco report or sourcefile or line not found

Prints a short human-readable result to stdout (and a machine-friendly JSON to stderr when --json is used).
"""

import argparse
import json
import os
import sys
import xml.etree.ElementTree as ET


def find_sourcefile_element(root, basename, package_slash=None):
    """Return the matching <sourcefile> element or (None, reason)."""
    candidates = []
    for pkg in root.findall('.//package'):
        pkg_name = pkg.get('name')
        for sf in pkg.findall('sourcefile'):
            if sf.get('name') == basename:
                candidates.append((pkg_name, sf))
    if not candidates:
        return None, 'no-sourcefile'
    # If package provided, prefer exact package match
    if package_slash:
        for pkg_name, sf in candidates:
            if pkg_name == package_slash:
                return sf, None
    # If only one candidate, return it
    if len(candidates) == 1:
        return candidates[0][1], None
    # Ambiguous: multiple candidates and no package disambiguation
    return [pkg for pkg, sf in candidates], 'ambiguous'


def derive_package_slash(source_path):
    """Try to derive the package path in slash form from a source path.
    Example: src/main/java/org/springframework/.../VetRestController.java -> org/springframework/...
    Returns None if not derivable.
    """
    path = os.path.normpath(source_path)
    parts = path.split(os.sep)
    # look for src/main/java or src/test/java
    for i in range(len(parts)):
        if parts[i] == 'src' and i + 3 < len(parts) and parts[i+2] == 'java':
            pkg_parts = parts[i+3:-1]  # between src/.../java and filename
            if pkg_parts:
                return '/'.join(pkg_parts)
            return ''
    # fallback: find 'org' directory and assume package starts there
    if 'org' in parts:
        idx = parts.index('org')
        pkg_parts = parts[idx:-1]
        return '/'.join(pkg_parts)
    return None


def main():
    p = argparse.ArgumentParser(description='Check JaCoCo XML whether a file:line is covered')
    p.add_argument('source', help='Path to the source file (absolute or relative)')
    p.add_argument('line', type=int, help='Line number to check')
    p.add_argument('--report', default='target/site/jacoco/jacoco.xml', help='Path to jacoco.xml')
    p.add_argument('--json', action='store_true', help='Also print machine-friendly JSON to stdout')
    args = p.parse_args()

    jacoco = args.report
    if not os.path.isfile(jacoco):
        print(f'ERROR: jacoco XML report not found at: {jacoco}', file=sys.stderr)
        sys.exit(3)

    try:
        tree = ET.parse(jacoco)
        root = tree.getroot()
    except Exception as e:
        print(f'ERROR: failed to parse jacoco xml: {e}', file=sys.stderr)
        sys.exit(3)

    source = args.source
    basename = os.path.basename(source)

    package_slash = derive_package_slash(source)

    sf_elem, reason = find_sourcefile_element(root, basename, package_slash)
    if sf_elem is None:
        print(f'ERROR: sourcefile for {basename} not found in {jacoco}', file=sys.stderr)
        sys.exit(3)
    if reason == 'ambiguous':
        # sf_elem is a list of package names
        print('ERROR: ambiguous sourcefile match; multiple packages contain', basename, file=sys.stderr)
        print('Candidates:', file=sys.stderr)
        for pkg_name in sf_elem:
            print('  -', pkg_name, file=sys.stderr)
        sys.exit(2)

    # sf_elem is an Element representing <sourcefile>
    target_nr = str(args.line)
    for line in sf_elem.findall('line'):
        if line.get('nr') == target_nr:
            ci = int(line.get('ci', '0'))
            mi = int(line.get('mi', '0'))
            mb = int(line.get('mb', '0'))
            cb = int(line.get('cb', '0'))
            covered = ci > 0
            if covered:
                msg = f'covered: {source}:{target_nr} (ci={ci}, mi={mi}, mb={mb}, cb={cb})'
                print(msg)
                if args.json:
                    print(json.dumps({'file': source, 'line': args.line, 'covered': True, 'ci': ci, 'mi': mi, 'mb': mb, 'cb': cb}))
                sys.exit(0)
            else:
                msg = f'not covered: {source}:{target_nr} (ci={ci}, mi={mi}, mb={mb}, cb={cb})'
                print(msg)
                if args.json:
                    print(json.dumps({'file': source, 'line': args.line, 'covered': False, 'ci': ci, 'mi': mi, 'mb': mb, 'cb': cb}))
                sys.exit(1)

    # If we reach here: no line element for that line number
    print(f'ERROR: line {target_nr} not present in jacoco report for sourcefile {basename}', file=sys.stderr)
    sys.exit(3)


if __name__ == '__main__':
    main()
