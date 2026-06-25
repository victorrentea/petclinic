#!/usr/bin/env python3
"""Generate a PlantUML ER diagram from a PostgreSQL schema dump (DB.sql).

Changes relative to a baseline schema are highlighted in red:
  * new table          -> red entity
  * new / changed col  -> red column line
  * removed column     -> red struck-through column line (kept in the entity)
  * new FK relation    -> red crow's-foot line
  * removed FK relation-> red crow's-foot line labelled "(removed)"

Parsing uses sqlglot (the unsupported PostgreSQL statements in a pg_dump --
CREATE EXTENSION, identity ALTERs, gin indexes -- degrade to opaque Command
nodes instead of failing). Output is deterministic for given inputs.

Usage:
    db_schema_to_puml.py --current DB.sql --baseline old.sql --out DbSchema.puml
    db_schema_to_puml.py --current DB.sql --baseline '' --out DbSchema.puml   # bootstrap, no red
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


@dataclass
class Delta:
    new_tables: set = field(default_factory=set)
    new_cols: dict = field(default_factory=dict)       # table -> set[col]
    changed_cols: dict = field(default_factory=dict)   # table -> set[col]
    removed_cols: dict = field(default_factory=dict)    # table -> set[col]
    new_fks: set = field(default_factory=set)           # set[fk.key()]
    removed_fks: set = field(default_factory=set)

    def is_empty(self) -> bool:
        return not (
            self.new_tables or self.new_cols or self.changed_cols
            or self.removed_cols or self.new_fks or self.removed_fks
        )


def diff_schemas(base: Schema, cur: Schema) -> Delta:
    """Commit-scoped diff: what `cur` adds/changes/removes relative to `base`."""
    delta = Delta()
    base_tables, cur_tables = set(base.tables), set(cur.tables)
    delta.new_tables = cur_tables - base_tables

    for t in cur_tables & base_tables:
        bcols = {c.name: c for c in base.tables[t]}
        ccols = {c.name: c for c in cur.tables[t]}
        new = set(ccols) - set(bcols)
        removed = set(bcols) - set(ccols)
        changed = {
            name for name in set(ccols) & set(bcols)
            if (bcols[name].type, bcols[name].not_null, bcols[name].pk)
            != (ccols[name].type, ccols[name].not_null, ccols[name].pk)
        }
        if new:
            delta.new_cols[t] = new
        if changed:
            delta.changed_cols[t] = changed
        if removed:
            delta.removed_cols[t] = removed

    base_fk = {f.key() for f in base.fks}
    cur_fk = {f.key() for f in cur.fks}
    delta.new_fks = cur_fk - base_fk
    delta.removed_fks = base_fk - cur_fk
    return delta


def _red(text: str) -> str:
    return f"<color:red>{text}</color>"


def _col_line(col: Column, fk_cols: set, mark: str | None) -> str:
    # `{field}` forces PlantUML to treat the line as an attribute. Without it a
    # type containing parentheses (e.g. varchar(50)) is misparsed as a method
    # and rendered in a separate compartment.
    tags = ""
    if col.pk:
        tags += " <<PK>>"
    if col.name in fk_cols:
        tags += " <<FK>>"
    nn = " not null" if (col.not_null and not col.pk) else ""
    body = f"{col.name} : {col.type}{tags}{nn}"
    if mark == "removed":
        body = f"<s>{body}</s>"
    if mark in ("new", "changed", "removed"):
        body = _red(body)
    return f"{{field}} {body}"


def render_puml(cur: Schema, delta: Delta, base: Schema | None = None) -> str:
    base = base or Schema()
    fk_cols_by_table: dict = {}
    for f in cur.fks:
        fk_cols_by_table.setdefault(f.table, set()).update(f.columns)

    out = [
        "@startuml",
        "title Database Schema (ER)",
        "caption Generated from DB.sql — red = changed in this commit",
        "hide circle",
        "skinparam linetype ortho",
        "",
    ]

    for name in sorted(cur.tables):
        is_new_table = name in delta.new_tables
        header = f'entity "{name}" as {name}'
        if is_new_table:
            header += " #line:red;text:red"
        out.append(header + " {")

        new_cols = delta.new_cols.get(name, set())
        changed_cols = delta.changed_cols.get(name, set())
        fk_cols = fk_cols_by_table.get(name, set())

        def mark_for(c: Column) -> str | None:
            if is_new_table:
                return None  # entity already fully red
            if c.name in new_cols:
                return "new"
            if c.name in changed_cols:
                return "changed"
            return None

        # Columns in declaration order; PK/FK shown inline via <<PK>>/<<FK>> tags.
        for c in cur.tables[name]:
            out.append(_col_line(c, fk_cols, mark_for(c)))

        # Removed columns are gone from `cur`; pull their definition from `base`.
        removed = delta.removed_cols.get(name, set())
        if removed and not is_new_table:
            base_cols = {c.name: c for c in base.tables.get(name, [])}
            for cname in sorted(removed):
                bc = base_cols.get(cname)
                if bc is not None:
                    out.append(_col_line(bc, fk_cols, "removed"))

        out.append("}")
        out.append("")

    out.append("")
    for f in sorted(cur.fks, key=lambda x: (x.ref_table, x.table, x.columns)):
        label = ", ".join(f.columns) if f.columns else ""
        is_new = f.key() in delta.new_fks
        connector = "||-[#red]-o{" if is_new else "||--o{"
        lbl = _red(label) if (is_new and label) else label
        line = f"{f.ref_table} {connector} {f.table}"
        if lbl:
            line += f" : {lbl}"
        out.append(line)

    # Removed FKs: the relation no longer exists in `cur`; render it red as a ghost.
    for key in sorted(delta.removed_fks):
        table, columns, ref_table, _ref_cols = key
        label = ", ".join(columns) if columns else ""
        lbl = _red(f"{label} (removed)" if label else "(removed)")
        out.append(f"{ref_table} ||-[#red]-o{{ {table} : {lbl}")

    out.append("")
    out.append("@enduml")
    return "\n".join(out) + "\n"


def generate(current_sql: str, baseline_sql: str) -> str:
    cur = parse_schema(current_sql)
    if baseline_sql and baseline_sql.strip():
        base = parse_schema(baseline_sql)
        delta = diff_schemas(base, cur)
    else:
        base = Schema()
        delta = Delta()  # bootstrap: no highlights
    return render_puml(cur, delta, base)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--current", required=True, help="Path to the new schema SQL")
    parser.add_argument(
        "--baseline", default="",
        help="Path to the previous schema SQL, or empty for bootstrap (no red)",
    )
    parser.add_argument("--out", required=True, help="Output .puml path")
    args = parser.parse_args(argv)

    with open(args.current, encoding="utf-8") as f:
        current_sql = f.read()
    baseline_sql = ""
    if args.baseline:
        with open(args.baseline, encoding="utf-8") as f:
            baseline_sql = f.read()

    puml = generate(current_sql, baseline_sql)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(puml)
    return 0


if __name__ == "__main__":
    sys.exit(main())
