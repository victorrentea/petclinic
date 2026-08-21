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
    assert set(d.elements) == {
        "Owner",
        "Pet",
        "PetType",
        "Role",
        "Specialty",
        "User",
        "Vet",
        "Visit",
    }
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
    tests = sorted(
        n for n, v in list(globals().items())
        if n.startswith("test_") and callable(v)
    )
    for name in tests:
        globals()[name]()
        print("PASS", name)
    print(f"--- all {len(tests)} tests passed ---")


# ── Component shorthand: `[Name] <<stereotype>>`, as packages.puml uses ──────

_PKG_BEFORE = """@startuml
title Logical Architecture
[Domain] <<..domain>>
[Repository] <<..repository>>
[Repository] --> [Domain]
@enduml
"""

_PKG_AFTER = """@startuml
title Logical Architecture
[Domain] <<..domain>>
[Notification] <<..notification>>
[Notification] --> [Domain]
@enduml
"""


def _pkg_diff():
    return m.diff(m.parse(_PKG_BEFORE), m.parse(_PKG_AFTER))


def test_bracket_component_parsed_as_element_not_preamble():
    d = m.parse(_PKG_BEFORE)
    assert set(d.elements) == {"[Domain]", "[Repository]"}
    assert not any("[Domain]" in line for line in d.preamble)


def test_added_bracket_component_gets_red_header():
    assert "[Notification] <<..notification>> #line:red;text:red" in _pkg_diff()


def test_unchanged_bracket_component_stays_plain():
    assert "\n[Domain] <<..domain>>\n" in _pkg_diff()


def test_removed_bracket_component_struck_but_keeps_alias():
    # Aliased so relationships still pointing at [Repository] resolve to the
    # struck box instead of spawning a second, unstyled one.
    assert 'component "<color:red><s>Repository</s></color>" as Repository' in _pkg_diff()


# ── Focus levels ─────────────────────────────────────────────────────────────
# DomainModel and DB are large enough that a two-line change arrives as a wall the
# reviewer has to search for red in. `--focus` keeps what changed plus N relationships
# outwards, so the same delta can be read at whatever radius makes it legible.

def _focused(level):
    return m.diff(_parse(BEFORE), _parse(AFTER), level)


def _elements(out):
    """The elements a rendered diff draws, by name — a removed one wears its strikeout."""
    return {m._element_name(m._strip_markup(ln).rstrip("{").strip())
            for ln in out.splitlines() if ln.startswith(("class ", "enum "))}


def test_focus_zero_keeps_only_what_changed():
    kept = _elements(_focused("0"))
    # Owner gained a field and an Invoice; Vet's id changed type; Visit lost `time`;
    # Invoice is new; Role was deleted — and User with it, since the relationship
    # between them disappeared and a relationship has two ends.
    assert kept == {"Owner", "Vet", "Visit", "Invoice", "Role", "User"}
    assert "Specialty" not in kept        # untouched, and one hop from Vet
    assert "PetType" not in kept


def test_each_hop_pulls_in_the_next_ring():
    assert "Pet" not in _elements(_focused("0"))
    assert "Pet" in _elements(_focused("1"))        # Owner -- Pet
    assert "PetType" not in _elements(_focused("1"))
    assert "PetType" in _elements(_focused("2"))    # PetType -- Pet -- Owner


def test_focus_all_is_the_whole_diagram_and_the_default():
    assert _focused(m.ALL) == _diff()
    assert _elements(_focused(m.ALL)) >= _elements(_focused("3"))


# A relationship whose far end was pruned would draw an arrow into nothing.
def test_a_pruned_end_takes_its_relationship_with_it():
    out = _focused("0")
    assert "Invoice" in out
    assert "PetType" not in out
    for line in out.splitlines():
        if " -- " in line or "-[#red]-" in line:
            left, right = line.split()[0], line.split()[-1].split(":")[0]
            assert "PetType" not in (left, right)


def test_the_caption_says_what_is_being_shown():
    assert "the impacted elements only (6 of 9 shown)" in _focused("0")
    assert "impacted + 1 neighbour" in _focused("1")
    assert "impacted + 2 neighbours" in _focused("2")
    assert "shown)" not in _diff()          # the whole diagram needs no qualifier


# An identical pair has nothing impacted, and an empty diagram is a PlantUML error page.
def test_nothing_changed_at_focus_zero_still_renders():
    same = _parse(BEFORE)
    out = m.diff(same, _parse(BEFORE), "0")
    assert "nothing changed at this focus level" in out
    assert out.strip().endswith("@enduml")


# The domain-model generator hangs a `[[src://…]]` link on every class and field, and
# the line it points at moves whenever anything above it moves. Identity is what the
# diagram says; a link is how you get somewhere else.
def test_a_source_link_is_not_a_change():
    plain = m.parse("""@startuml
class Owner {
  id : Integer
}
@enduml""")
    linked = m.parse("""@startuml
class Owner [[src://a/Owner.java:12{open Owner}]] {
  id : Integer [[src://a/Owner.java:15{open id}]]
}
@enduml""")
    out = m.diff(plain, linked)
    assert "<color:red>" not in out.replace(
        "caption <color:red>added</color> or <color:red><s>removed</s></color>", "")
    assert m._impacted(plain, linked) == set()
    # …and the link still renders, rewrapped around the member it points at
    assert "[[src://a/Owner.java:15{open id} id : Integer]]" in out


# ── Sequence diagrams: a changed statement is one red arrow, not a pair ──────
# An arrow carries `[[genseq://<id>{…} label]]`, and the id is a fingerprint of what the
# arrow reveals. When only that moves, the call is unchanged and the statement behind it
# is not — telling the reviewer that twice, once struck and once red, is twice the red
# for one fact.
import seq_puml_diff as sq


def _seq(old_arrow, new_arrow):
    frame = "@startuml\nparticipant Backend\nparticipant DB\n%s\n@enduml\n"
    return sq.diff(frame % old_arrow, frame % new_arrow)


ARROW = 'Backend -> DB: [[genseq://%s{Click for the statement} select visits]]'


def test_a_changed_statement_reddens_the_arrow_it_hides_behind():
    out = _seq(ARROW % "aaa1111", ARROW % "bbb2222")
    assert "<s>" not in out                       # not a removal
    assert out.count("select visits") == 1        # not a pair
    assert f"<color:{sq.RED}>" in out             # but marked


def test_an_untouched_arrow_stays_plain():
    out = _seq(ARROW % "aaa1111", ARROW % "aaa1111")
    assert f"<color:{sq.RED}>" not in out
    assert "-[#" not in out


# The label itself changing is a different call, not the same one restated: that is a
# genuine removal plus a genuine addition.
def test_a_changed_label_is_still_a_removal_and_an_addition():
    other = 'Backend -> DB: [[genseq://bbb2222{Click for the statement} select pets]]'
    out = _seq(ARROW % "aaa1111", other)
    assert "<s>" in out
    assert "select pets" in out and "select visits" in out


# ── Member links: wrapping, whichever form the input used ────────────────────
# PlantUML prints the URL when a `[[...]]` has no label. The generator wraps the member
# text now, but the base side of a diff predates that — and a delta has to stay readable
# against a base that predates every change in it.

def _members(out, cls):
    body = out.split(f"class {cls}", 1)[1].split("\n}", 1)[0]
    return [ln.strip() for ln in body.splitlines() if ln.strip().startswith("[[")]


OLD_FORM = """@startuml
class Owner {
  id : Integer [[src://a/Owner.java:5{open id}]]
  gone : String [[src://a/Owner.java:9{open gone}]]
}
@enduml"""

NEW_FORM = """@startuml
class Owner {
  [[src://a/Owner.java:5{open id} id : Integer]]
  [[src://a/Owner.java:12{open added} added : String]]
}
@enduml"""


def test_a_trailing_link_is_rewrapped_around_its_member():
    out = m.diff(m.parse(OLD_FORM), m.parse(NEW_FORM))
    for line in _members(out, "Owner"):
        # nothing may sit outside the link, or PlantUML renders the raw URL
        assert line.startswith("[[") and line.endswith("]]")
    assert "{open id} id : Integer]]" in out          # unchanged, still plain


def test_the_diff_colour_goes_inside_the_link():
    out = m.diff(m.parse(OLD_FORM), m.parse(NEW_FORM))
    assert "{open added} <color:red>added : String</color>]]" in out
    assert "{open gone} <color:red><s>gone : String</s></color>]]" in out


def test_a_member_with_no_link_is_untouched():
    plain = "@startuml\nclass X {\n  a : int\n}\n@enduml"
    assert "  a : int" in m.diff(m.parse(plain), m.parse(plain))


# ── Directives survive the diff ──────────────────────────────────────────────
# `footer domain/*.java -> DomainModel.puml` parses as a relationship on the strength of
# its arrow. Everything after it was then treated as content, so the skinparams and the
# legend never reached the delta — and the rendered diff disagreed with the diagram it
# was a diff of: underlined links, no legend, different icon sizes.

DIRECTIVES = """@startuml
title Domain Model
footer domain/*.java -> petclinic-backend/docs/generated/DomainModel.puml
hide empty members
skinparam hyperlinkUnderline false
legend bottom
  Click any class or field to jump to the source code.
end legend
class Owner {
  id : Integer
}
@enduml"""


def test_a_footer_with_an_arrow_is_not_a_relationship():
    d = m.parse(DIRECTIVES)
    assert d.relationships == []
    assert list(d.elements) == ["Owner"]


def test_every_directive_reaches_the_delta():
    out = m.diff(m.parse(DIRECTIVES), m.parse(DIRECTIVES))
    for directive in ("footer domain/*.java", "hide empty members",
                      "skinparam hyperlinkUnderline false"):
        assert directive in out


def test_a_legend_survives_body_and_all():
    out = m.diff(m.parse(DIRECTIVES), m.parse(DIRECTIVES))
    assert "legend bottom" in out
    assert "Click any class or field to jump to the source code." in out
    assert "end legend" in out
