#!/usr/bin/env python3
"""
Parse a JaCoCo XML report and print uncovered lines (ci==0) for a given source file.
Usage:
  python3 scripts/extract_jacoco_uncovered.py \
    target/site/jacoco/jacoco.xml \
    src/main/java/org/springframework/samples/petclinic/rest/dto/BindingErrorsResponse.java

Prints a compact list of uncovered line numbers and ranges.
"""

import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def compact_ranges(lines):
    if not lines:
        return []
    lines = sorted(lines)
    ranges = []
    start = prev = lines[0]
    for n in lines[1:]:
        if n == prev + 1:
            prev = n
            continue
        if start == prev:
            ranges.append(str(start))
        else:
            ranges.append(f"{start}-{prev}")
        start = prev = n
    if start == prev:
        ranges.append(str(start))
    else:
        ranges.append(f"{start}-{prev}")
    return ranges


def find_uncovered(jacoco_xml_path, source_file_path):
    tree = ET.parse(jacoco_xml_path)
    root = tree.getroot()

    source_path = Path(source_file_path)
    target_filename = source_path.name

    uncovered = []

    # JaCoCo XML structure: <report> -> <package name="..."> -> <sourcefile name="..."> -> <line nr=".." mi=".." ci=".."/>
    for package_el in root.findall('package'):
        for sourcefile_el in package_el.findall('sourcefile'):
            if sourcefile_el.get('name') != target_filename:
                continue
            # Found a candidate sourcefile; collect uncovered lines where ci==0
            for line_el in sourcefile_el.findall('line'):
                ci = line_el.get('ci')
                nr = line_el.get('nr')
                if ci is None or nr is None:
                    continue
                try:
                    ci_val = int(ci)
                    nr_val = int(nr)
                except ValueError:
                    continue
                if ci_val == 0:
                    uncovered.append(nr_val)
            # If we found any uncovered lines in this sourcefile, return them (assume filename unique)
            if uncovered:
                return uncovered
    return []


def main(argv):
    if len(argv) != 3:
        print(__doc__)
        sys.exit(2)
    jacoco_xml = argv[1]
    source_file = argv[2]

    if not Path(jacoco_xml).exists():
        print(f"Jacoco XML not found: {jacoco_xml}")
        sys.exit(3)
    if not Path(source_file).exists():
        print(f"Source file not found: {source_file}")
        sys.exit(4)

    uncovered = find_uncovered(jacoco_xml, source_file)
    if not uncovered:
        print(f"No uncovered lines reported for {source_file}")
        return 0

    ranges = compact_ranges(uncovered)
    print(f"Uncovered lines for {source_file}:")
    print(', '.join(ranges))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
