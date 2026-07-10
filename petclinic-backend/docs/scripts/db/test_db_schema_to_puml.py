"""Tests for db_schema_to_puml. Run: python -m pytest -q (from this dir)."""
import os

import db_schema_to_puml as m

HERE = os.path.dirname(__file__)
DB_SQL = os.path.join(HERE, "..", "..", "..", "DB.sql")


def _real_schema_sql():
    with open(DB_SQL, encoding="utf-8") as f:
        return f.read()


# ── Parser ────────────────────────────────────────────────────────────────

def test_parse_real_schema_tables_and_columns():
    s = m.parse_schema(_real_schema_sql())
    assert "flyway_schema_history" not in s.tables          # excluded
    assert len(s.tables) == 9                                # 10 - flyway
    owners = {c.name: c for c in s.tables["owners"]}
    assert set(owners) == {"id", "first_name", "last_name", "address", "city", "telephone"}
    assert owners["id"].pk is True
    assert owners["first_name"].pk is False


def test_parse_real_schema_foreign_keys():
    s = m.parse_schema(_real_schema_sql())
    rels = {(f.table, f.ref_table) for f in s.fks}
    assert ("pets", "owners") in rels
    assert ("pets", "types") in rels
    assert ("visits", "pets") in rels
    assert ("vet_specialties", "vets") in rels
    assert ("vet_specialties", "specialties") in rels
    pets_owner = next(f for f in s.fks if f.table == "pets" and f.ref_table == "owners")
    assert pets_owner.columns == ("owner_id",)
    assert pets_owner.ref_columns == ("id",)


def test_not_null_detected():
    s = m.parse_schema(_real_schema_sql())
    users = {c.name: c for c in s.tables["users"]}
    assert users["username"].not_null is True


# ── Render: plain snapshot, never any diff markup ───────────────────────────

def _has_diff_markup(puml: str) -> bool:
    return any(t in puml for t in ("color:red", "#line:red", "#red", "<s>", "(removed)"))


def test_render_is_plain_snapshot():
    puml = m.generate(_real_schema_sql())
    assert not _has_diff_markup(puml)                        # never bakes a diff into the snapshot
    assert 'entity "owners"' in puml
    assert "owners ||--o{ pets" in puml
    assert "{field} id : int <<PK>>" in puml


def test_footer_credits_generator_and_makes_no_diff_claim():
    puml = m.generate(_real_schema_sql())
    assert "footer Generated from DB.sql by db_schema_to_puml.py" in puml
    assert "red" not in puml.lower()


def test_columns_render_in_declaration_order():
    # owners is the first entity; its columns declared id, first_name, last_name, …
    after_owners = m.generate(_real_schema_sql()).split('entity "owners"', 1)[1]
    assert after_owners.index("{field} id ") < after_owners.index("{field} first_name ")


# ── Determinism ─────────────────────────────────────────────────────────────

def test_deterministic_output():
    sql = _real_schema_sql()
    assert m.generate(sql) == m.generate(sql)
