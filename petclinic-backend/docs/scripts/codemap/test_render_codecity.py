#!/usr/bin/env python3
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[3]
SAMPLE_TSV = REPO_ROOT / "petclinic-backend/docs/generated/codemap/codemap.tsv"


class RenderCodecityTest(unittest.TestCase):
    def test_renders_standalone_threejs_codecity(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["HEATMAP_OUT"] = tmp
            env["HEATMAP_TITLE"] = "Code City"
            subprocess.run(
                [
                    "python3",
                    str(SCRIPT_DIR / "render_codecity.py"),
                    str(SAMPLE_TSV),
                ],
                check=True,
                cwd=SCRIPT_DIR,
                env=env,
            )

            html_path = Path(tmp) / "codecity.html"
            html = html_path.read_text()

            self.assertIn("<title>Code City</title>", html)
            self.assertIn("three.module.js", html)
            self.assertIn("OrbitControls", html)
            self.assertIn("d3@7", html)
            self.assertIn('id="scene"', html)
            self.assertIn("__CODEMAP_3D_READY__", html)
            self.assertIn("const FILES =", html)
            self.assertIn('id="areaMetric"', html)
            self.assertIn("const areaSelect", html)
            self.assertIn("areaMetric", html)
            self.assertIn("cognitive complexity", html)
            self.assertNotIn("cyclomatic", html)   # the metric is Sonar cognitive complexity, not cyclomatic
            self.assertIn(">committers</option>", html)   # committers-per-file metric (short label)
            self.assertIn("commits: ${commits} (by ${devs} devs)", html)   # class label commits line
            self.assertIn("instability", html)           # Ce/(Ce+Ca) metric
            self.assertLess(html.index('id="colorMetric"'), html.index('id="heightMetric"'))
            self.assertLess(html.index('id="heightMetric"'), html.index('id="areaMetric"'))
            self.assertIn("PetClinicMcp.java", html)
            self.assertIn('"district": "victor.training.petclinic.mcp"', html)
            self.assertIn("new THREE.BoxGeometry", html)
            self.assertIn("controls.mouseButtons.LEFT = THREE.MOUSE.PAN", html)
            self.assertIn("event.metaKey", html)
            self.assertIn("event.ctrlKey", html)
            self.assertIn("CSS2DRenderer", html)
            # Class labels: up to MAX_LABELS candidates, de-overlapped in screen space each frame.
            self.assertIn("setupLabels", html)
            self.assertIn("updateLabelVisibility", html)
            self.assertIn("city-label", html)
            # Drill-down: Shift-click a floor/building to scope in, breadcrumb / ground to step out.
            self.assertIn('id="breadcrumb"', html)
            self.assertIn("let scopePath", html)
            self.assertIn("function targetAtPointer", html)
            self.assertIn("function scopeUp", html)
            self.assertIn("function qualifiedName", html)
            self.assertIn("districtStep", html)
            self.assertIn('rel="icon"', html)
            self.assertIn("formatDistrictHover", html)
            self.assertIn("insertPackage", html)
            self.assertIn("for (const node of root.descendants())", html)
            self.assertIn('userData.kind = "package"', html)
            self.assertIn("controls.zoomToCursor = true", html)
            self.assertIn("function openInEditor", html)
            self.assertIn("vscode://file", html)
            self.assertIn('window.addEventListener("dblclick", onDoubleClick)', html)
            self.assertIn("positionHoverNearObject", html)
            self.assertIn("object.getWorldPosition", html)
            self.assertIn("setRotationPivotToViewportCenter", html)
            self.assertIn("new THREE.Plane", html)
            # "Build this for your own repo" recipe: button, overlay, baked-in command.
            self.assertIn('id="howtoToggle"', html)
            self.assertIn("Build a Code City for any source folder", html)
            self.assertIn("const BUILD_CMD =", html)
            # BUILD_CMD is JSON-embedded, so quotes are backslash-escaped in the HTML.
            self.assertIn(r'HEATMAP_REPO=\"$REPO\" HEATMAP_OUT=\"$REPO/.codecity\"', html)
            self.assertIn(str(SCRIPT_DIR), html)
            # First-run intro: an annotated hero building wired to the metric selectors,
            # with AREA drawn on the roof (top face), not the base.
            self.assertIn("function buildIntro", html)
            self.assertIn("What each building tells you", html)
            self.assertIn("introHatch", html)
            self.assertIn("top face = footprint, drawn on the roof", html)


if __name__ == "__main__":
    unittest.main()
