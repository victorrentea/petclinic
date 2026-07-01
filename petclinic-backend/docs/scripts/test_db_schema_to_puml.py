"""Tests for db_schema_to_puml. Run: python -m pytest -q (from this dir)."""
import os

import db_schema_to_puml as m

HERE = os.path.dirname(__file__)
DB_SQL = os.path.join(HERE, "..", "generated", "DB.sql")


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


# ── Diff + render: no change ⇒ no red ───────────────────────────────────────

def test_no_change_no_red():
    sql = _real_schema_sql()
    cur = m.parse_schema(sql)
    puml = m.render_puml(cur, m.diff_schemas(cur, cur), cur)
    assert "color:red" not in puml
    assert "#line:red" not in puml
    assert "#red" not in puml
    assert 'entity "owners"' in puml
    assert "owners ||--o{ pets" in puml


def _has_red_markup(puml: str) -> bool:
    return ("color:red" in puml) or ("#line:red" in puml) or ("#red" in puml)


def test_bootstrap_generate_has_no_red():
    sql = _real_schema_sql()
    puml = m.generate(sql, "")  # empty baseline
    assert not _has_red_markup(puml)


# ── Diff cases ──────────────────────────────────────────────────────────────

BASE = """
CREATE TABLE public.owners (id integer NOT NULL, first_name text);
CREATE TABLE public.pets (id integer NOT NULL, owner_id integer);
ALTER TABLE ONLY public.owners ADD CONSTRAINT owners_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pets ADD CONSTRAINT pets_pkey PRIMARY KEY (id);
"""


def _gen(base_sql, cur_sql):
    base = m.parse_schema(base_sql)
    cur = m.parse_schema(cur_sql)
    return m.render_puml(cur, m.diff_schemas(base, cur), base)


def test_added_column_is_red():
    cur = BASE.replace(
        "CREATE TABLE public.owners (id integer NOT NULL, first_name text);",
        "CREATE TABLE public.owners (id integer NOT NULL, first_name text, city text);",
    )
    puml = _gen(BASE, cur)
    assert "<color:red>city : text" in puml
    assert "<color:red>first_name" not in puml          # unchanged stays black


def test_added_table_is_red_entity():
    cur = BASE + "\nCREATE TABLE public.visits (id integer NOT NULL);\nALTER TABLE ONLY public.visits ADD CONSTRAINT visits_pkey PRIMARY KEY (id);"
    puml = _gen(BASE, cur)
    assert 'entity "visits" as visits #line:red;text:red' in puml
    assert 'entity "owners" as owners {' in puml          # existing entity not red


def test_added_fk_is_red_line():
    cur = BASE + "\nALTER TABLE ONLY public.pets ADD CONSTRAINT pets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id);"
    puml = _gen(BASE, cur)
    assert "owners ||-[#red]-o{ pets" in puml


def test_changed_column_type_is_red():
    cur = BASE.replace("first_name text", "first_name varchar(50)")
    puml = _gen(BASE, cur)
    assert "<color:red>first_name : varchar(50)" in puml


def test_removed_column_is_struck_red():
    cur = BASE.replace(", first_name text", "")
    puml = _gen(BASE, cur)
    assert "<s>first_name : text</s>" in puml
    assert "<color:red>" in puml


# ── Determinism ─────────────────────────────────────────────────────────────

def test_deterministic_output():
    sql = _real_schema_sql()
    a = m.generate(sql, "")
    b = m.generate(sql, "")
    assert a == b
