#!/usr/bin/env python3
"""Turn a JMeter .jtl into a per-scenario latency table.

JMeter's own summariser reports an average, which for a long-tailed latency distribution
is the one number that hides the problem. This reads the raw samples and reports the
percentiles instead, plus the payload size — which for this endpoint is half the story.

Percentiles use the nearest-rank method on the sorted sample list, so every reported
value is a real observed sample rather than an interpolation between two of them.
"""
import csv
import sys
from collections import defaultdict


def pct(sorted_values, p):
    if not sorted_values:
        return 0
    rank = max(1, -(-p * len(sorted_values) // 100))  # ceil(p/100 * n)
    return sorted_values[rank - 1]


def main(path):
    by_label = defaultdict(list)
    with open(path, newline="") as fh:
        for row in csv.DictReader(fh):
            by_label[row["label"]].append((
                int(row["elapsed"]),
                int(row["bytes"]),
                row["success"] == "true",
                float(row["timeStamp"]),
            ))

    header = (f"{'scenario':<44} {'n':>6} {'err':>4} {'p50':>8} {'p95':>8} "
              f"{'p99':>8} {'max':>8} {'req/s':>8} {'MB/resp':>8}")
    print(header)
    print("-" * len(header))
    for label in sorted(by_label):
        samples = by_label[label]
        times = sorted(s[0] for s in samples)
        errors = sum(1 for s in samples if not s[2])
        avg_bytes = sum(s[1] for s in samples) / len(samples)
        # Wall clock of the group: last start minus first start, plus the last sample's
        # own duration. Dividing by the sum of latencies would report the throughput of
        # one thread, not of the run.
        starts = [s[3] for s in samples]
        span_s = ((max(starts) - min(starts)) / 1000.0) + (times[-1] / 1000.0)
        tput = len(samples) / span_s if span_s > 0 else 0
        print(f"{label:<44} {len(samples):>6} {errors:>4} "
              f"{pct(times, 50):>8} {pct(times, 95):>8} {pct(times, 99):>8} "
              f"{times[-1]:>8} {tput:>8.2f} {avg_bytes / 1048576:>8.2f}")
    print("\nlatencies in ms; MB/resp is the mean response body size")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "results/results.jtl")
