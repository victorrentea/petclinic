"""Tests for puml_diff. Run: python3 -m pytest -q, or `python3 test_puml_diff.py`."""
import os

import puml_diff as m

HERE = os.path.dirname(__file__)
BEFORE = os.path.join(HERE, "testdata", "domain_before.puml")
AFTER = os.path.join(HERE, "testdata", "domain_after.puml")


def _parse(path):
    with open(path, encoding="utf-8") as f:
        return m.parse(f.read())


def _diff():
    return m.diff(_parse(BEFORE), _parse(AFTER))


# ── Parsing ─────────────────────────────────────────────────────────────────

def test_parse_elements_and_members():
    d = _parse(BEFORE)
    assert set(d.elements) == {"Owner", "Pet", "PetType", "Role",
                               "Specialty", "User", "Vet", "Visit"}
    assert d.elements["Owner"].members[0] == "id : Integer"
    assert "email : String" not in d.elements["Owner"].members


def test_cardinality_dots_not_mistaken_for_connector():
    d = _parse(BEFORE)
    vet_rel = next(r for r in d.relationships if r[0].startswith("Vet"))
    assert vet_rel[1] == "--"                 # connector, not the "0..*" cardinality
    assert vet_rel[3] == "specialties"        # label


# ── Added → red (solid) ─────────────────────────────────────────────────────

def test_added_member_red():
    assert "<color:red>email : String</color>" in _diff()


def test_added_class_red_solid_header():
    assert "class Invoice #line:red;text:red {" in _diff()


def test_added_relationship_and_label_red():
    assert 'Owner "1" -[#red]- "0..*" Invoice : <color:red>invoices</color>' in _diff()


# ── Removed → red + struck-through ───────────────────────────────────────────

def test_removed_member_struck():
    assert "<color:red><s>time : LocalTime</s></color>" in _diff()


def test_removed_class_title_struck():        # struck, not just red → distinct from added
    out = _diff()
    assert 'class "<color:red><s>Role</s></color>" as Role #line:red;text:red {' in out
    assert "<color:red><s>name : String</s></color>" in out   # its members struck too


def test_removed_relationship_label_struck():
    assert 'User "1" -[#red]- "0..*" Role : <color:red><s>user</s></color>' in _diff()


# ── Changed member = removed old + added new ─────────────────────────────────

def test_changed_member_shows_both():
    out = _diff()
    assert "<color:red>id : Long</color>" in out               # new type added
    assert "<color:red><s>id : Integer</s></color>" in out     # old type struck


# ── No-op: identical snapshots carry no diff markup (bar the legend caption) ──

def test_identical_snapshots_have_no_diff_markup():
    out = m.diff(_parse(AFTER), _parse(AFTER))
    body = "\n".join(ln for ln in out.splitlines() if not ln.startswith("caption"))
    assert "<color:red>" not in body
    assert "#line:red" not in body
    assert "<s>" not in body


if __name__ == "__main__":
    tests = sorted(n for n, v in list(globals().items())
                   if n.startswith("test_") and callable(v))
    for name in tests:
        globals()[name]()
        print("PASS", name)
    print(f"--- all {len(tests)} tests passed ---")
