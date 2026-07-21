from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from modeldoctor_api.demo_models import ensure_demo_models

if __name__ == "__main__":
    demos = ensure_demo_models(ROOT)
    for name, path in demos.items():
        print(f"{name}: {path}")
