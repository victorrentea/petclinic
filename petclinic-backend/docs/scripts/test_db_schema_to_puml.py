"""Tests for db_schema_to_puml. Run: python -m pytest -q (from this dir)."""
import os

import db_schema_to_puml as m

HERE = os.path.dirname(__file__)
DB_SQL = os.path.join(HERE, "..", "..", "DB.sql")


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


# ── Render: plain projection of the current schema, no diff markup ──────────

def test_render_has_no_diff_markup():
    puml = m.generate(_real_schema_sql())
    assert "color:red" not in puml
    assert "#line:red" not in puml
    assert "#red" not in puml
    assert "<s>" not in puml           # no struck-through (removed) columns
    assert "(removed)" not in puml     # no ghost relations


def test_render_entities_and_fk_lines():
    puml = m.generate(_real_schema_sql())
    assert 'entity "owners" as owners {' in puml
    assert "owners ||--o{ pets" in puml


def test_render_pk_fk_and_not_null_tags():
    puml = m.generate(_real_schema_sql())
    assert "<<PK>>" in puml
    assert "<<FK>>" in puml
    assert "not null" in puml


# ── Determinism ─────────────────────────────────────────────────────────────

def test_deterministic_output():
    sql = _real_schema_sql()
    assert m.generate(sql) == m.generate(sql)
