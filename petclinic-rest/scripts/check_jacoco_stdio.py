#!/usr/bin/env python3
"""A tiny stdio MCP-like server for checking JaCoCo coverage per file:line.

Protocol (JSON per line on stdin):
- Single request (object): {"file": "src/..../VetRestController.java", "line": 75, "report": "target/site/jacoco/jacoco.xml"}
  -> Response (object): { "ok": true, "covered": false, "ci":0, "mi":3, "mb":0, "cb":0, "code":1, "message": "not covered" }

- Batch request (single-line JSON array):
  [{"file":"...","line":75}, {"file":"...","line":81}]
  -> Response (array): [ {resp-for-first}, {resp-for-second} ]

Exit: the server reads until stdin EOF and then exits. (This allows MCP-style persistent running if launched by a supervisor.)
"""

import sys
import os
import json
import xml.etree.ElementTree as ET


def derive_package_slash(source_path):
    path = os.path.normpath(source_path)
    parts = path.split(os.sep)
    for i in range(len(parts)):
        if parts[i] == 'src' and i + 3 < len(parts) and parts[i+2] == 'java':
            pkg_parts = parts[i+3:-1]
            if pkg_parts:
                return '/'.join(pkg_parts)
            return ''
    if 'org' in parts:
        idx = parts.index('org')
        pkg_parts = parts[idx:-1]
        return '/'.join(pkg_parts)
    return None


def find_sourcefile_element(root, basename, package_slash=None):
    candidates = []
    for pkg in root.findall('.//package'):
        pkg_name = pkg.get('name')
        for sf in pkg.findall('sourcefile'):
            if sf.get('name') == basename:
                candidates.append((pkg_name, sf))
    if not candidates:
        return None, 'no-sourcefile'
    if package_slash:
        for pkg_name, sf in candidates:
            if pkg_name == package_slash:
                return sf, None
    if len(candidates) == 1:
        return candidates[0][1], None
    return [pkg for pkg, sf in candidates], 'ambiguous'


def handle_request(req):
    # expected keys: file, line, optional report
    if not isinstance(req, dict):
        return {'ok': False, 'message': 'request must be an object with file and line', 'code': 3}
    if 'file' not in req or 'line' not in req:
        return {'ok': False, 'message': 'missing file or line', 'code': 3}
    source = req['file']
    try:
        line_nr = int(req['line'])
    except Exception:
        return {'ok': False, 'message': 'line must be an integer', 'code': 3}
    report = req.get('report', 'target/site/jacoco/jacoco.xml')

    if not os.path.isfile(report):
        return {'ok': False, 'message': f'jacoco report not found: {report}', 'code': 3}
    try:
        tree = ET.parse(report)
        root = tree.getroot()
    except Exception as e:
        return {'ok': False, 'message': f'failed to parse jacoco xml: {e}', 'code': 3}

    basename = os.path.basename(source)
    pkg_slash = derive_package_slash(source)
    sf_elem, reason = find_sourcefile_element(root, basename, pkg_slash)
    if sf_elem is None:
        return {'ok': False, 'message': f'sourcefile {basename} not found in report', 'code': 3}
    if reason == 'ambiguous':
        return {'ok': False, 'message': 'ambiguous sourcefile match', 'candidates': sf_elem, 'code': 2}

    # find the line element
    for line in sf_elem.findall('line'):
        if line.get('nr') == str(line_nr):
            ci = int(line.get('ci', '0'))
            mi = int(line.get('mi', '0'))
            mb = int(line.get('mb', '0'))
            cb = int(line.get('cb', '0'))
            covered = ci > 0
            return {
                'ok': True,
                'covered': covered,
                'ci': ci,
                'mi': mi,
                'mb': mb,
                'cb': cb,
                'code': 0 if covered else 1,
                'message': 'covered' if covered else 'not covered'
            }

    return {'ok': False, 'message': f'line {line_nr} not present in jacoco report for {basename}', 'code': 3}


def process_input_item(item):
    try:
        return handle_request(item)
    except Exception as e:
        return {'ok': False, 'message': f'internal error: {e}', 'code': 3}


def main():
    # read JSON lines from stdin until EOF
    # respond with JSON per request; support batch (array) requests per line
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
        except Exception as e:
            resp = {'ok': False, 'message': f'invalid json: {e}', 'code': 3}
            print(json.dumps(resp), flush=True)
            continue

        # If parsed is an array -> batch mode: process all items and return an array
        if isinstance(parsed, list):
            responses = [process_input_item(item) for item in parsed]
            print(json.dumps(responses), flush=True)
            continue

        # otherwise single object -> behave as before
        if isinstance(parsed, dict):
            resp = process_input_item(parsed)
            print(json.dumps(resp), flush=True)
            continue

        # unsupported JSON type
        resp = {'ok': False, 'message': 'unsupported json type (expect object or array)', 'code': 3}
        print(json.dumps(resp), flush=True)

if __name__ == '__main__':
    main()
