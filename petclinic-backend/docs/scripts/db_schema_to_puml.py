#!/usr/bin/env python3
"""Generate a PlantUML ER diagram from a PostgreSQL schema dump (DB.sql).

The diagram is a plain projection of the current schema: tables become entities,
columns are listed in declaration order with <<PK>>/<<FK>> tags and not-null
markers, and foreign keys become crow's-foot relations. Comparing this snapshot
across git revisions is handled by a separate tool, not baked into the output.

Parsing uses sqlglot (the unsupported PostgreSQL statements in a pg_dump --
CREATE EXTENSION, identity ALTERs, gin indexes -- degrade to opaque Command
nodes instead of failing). Output is deterministic for a given input.

Usage:
    db_schema_to_puml.py --current DB.sql --out DB.puml
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass, field

import sqlglot
from sqlglot import expressions as exp

# Flyway's internal bookkeeping table is not part of the domain model.
EXCLUDED_TABLES = {"flyway_schema_history"}


@dataclass(frozen=True)
class Column:
    name: str
    type: str
    not_null: bool
    pk: bool


@dataclass(frozen=True)
class Fk:
    table: str
    columns: tuple        # local FK columns
    ref_table: str
    ref_columns: tuple    # referenced columns

    def key(self) -> tuple:
        return (self.table, self.columns, self.ref_table, self.ref_columns)


@dataclass
class Schema:
    tables: dict = field(default_factory=dict)   # name -> list[Column] (declaration order)
    fks: list = field(default_factory=list)      # list[Fk]


def _table_name(node) -> str:
    if isinstance(node, exp.Schema):
        return node.this.name
    return node.name


def parse_schema(sql: str) -> Schema:
    """Parse a PostgreSQL schema dump into a Schema model."""
    schema = Schema()
    if not sql or not sql.strip():
        return schema

    statements = [s for s in sqlglot.parse(sql, read="postgres") if s is not None]

    raw_tables: dict = {}        # name -> list[(name, type, not_null, pk_inline)]
    pk_cols: dict = {}           # name -> set[col]

    for s in statements:
        if isinstance(s, exp.Create) and (s.kind or "").upper() == "TABLE":
            sch = s.this
            name = sch.this.name
            cols = []
            for d in sch.expressions:
                if not isinstance(d, exp.ColumnDef):
                    continue
                kind = d.args.get("kind")
                type_str = kind.sql(dialect="postgres").lower() if kind else "?"
                not_null = any(
                    isinstance(c.kind, exp.NotNullColumnConstraint) for c in d.constraints
                )
                pk_inline = any(
                    isinstance(c.kind, exp.PrimaryKeyColumnConstraint) for c in d.constraints
                )
                cols.append((d.name, type_str, not_null, pk_inline))
            raw_tables[name] = cols

    for s in statements:
        if not isinstance(s, exp.Alter):
            continue
        tname = _table_name(s.this)
        for action in s.args.get("actions", []):
            for pk in action.find_all(exp.PrimaryKey):
                pk_cols.setdefault(tname, set()).update(c.name for c in pk.expressions)
            for fk in action.find_all(exp.ForeignKey):
                local = tuple(c.name for c in fk.args.get("expressions", []))
                ref = fk.args.get("reference")
                if ref is None:
                    continue
                refsch = ref.this
                if isinstance(refsch, exp.Schema):
                    ref_table = refsch.this.name
                    ref_columns = tuple(c.name for c in refsch.expressions)
                else:
                    ref_table = refsch.name
                    ref_columns = ()
                schema.fks.append(Fk(tname, local, ref_table, ref_columns))

    for name, cols in raw_tables.items():
        if name in EXCLUDED_TABLES:
            continue
        tpk = pk_cols.get(name, set())
        schema.tables[name] = [
            Column(cname, ctype, nn, (pk_inline or cname in tpk))
            for (cname, ctype, nn, pk_inline) in cols
        ]

    schema.fks = [
        f for f in schema.fks
        if f.table not in EXCLUDED_TABLES and f.ref_table not in EXCLUDED_TABLES
    ]
    return schema


def _col_line(col: Column, fk_cols: set) -> str:
    # `{field}` forces PlantUML to treat the line as an attribute. Without it a
    # type containing parentheses (e.g. varchar(50)) is misparsed as a method
    # and rendered in a separate compartment.
    tags = ""
    if col.pk:
        tags += " <<PK>>"
    if col.name in fk_cols:
        tags += " <<FK>>"
    nn = " not null" if (col.not_null and not col.pk) else ""
    return f"{{field}} {col.name} : {col.type}{tags}{nn}"


def render_puml(cur: Schema) -> str:
    fk_cols_by_table: dict = {}
    for f in cur.fks:
        fk_cols_by_table.setdefault(f.table, set()).update(f.columns)

    out = [
        "@startuml",
        "!pragma layout smetana",
        "title Database Schema (ER)",
        "caption Generated from DB.sql",
        "hide circle",
        "skinparam linetype ortho",
        "",
    ]

    for name in sorted(cur.tables):
        out.append(f'entity "{name}" as {name} {{')
        fk_cols = fk_cols_by_table.get(name, set())
        # Columns in declaration order; PK/FK shown inline via <<PK>>/<<FK>> tags.
        for c in cur.tables[name]:
            out.append(_col_line(c, fk_cols))
        out.append("}")
        out.append("")

    out.append("")
    for f in sorted(cur.fks, key=lambda x: (x.ref_table, x.table, x.columns)):
        label = ", ".join(f.columns) if f.columns else ""
        line = f"{f.ref_table} ||--o{{ {f.table}"
        if label:
            line += f" : {label}"
        out.append(line)

    out.append("")
    out.append("@enduml")
    return "\n".join(out) + "\n"


def generate(current_sql: str) -> str:
    return render_puml(parse_schema(current_sql))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--current", required=True, help="Path to the schema SQL")
    parser.add_argument("--out", required=True, help="Output .puml path")
    args = parser.parse_args(argv)

    with open(args.current, encoding="utf-8") as f:
        current_sql = f.read()

    puml = generate(current_sql)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(puml)
    return 0


if __name__ == "__main__":
    sys.exit(main())
