import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# TODO: Move file into a new folder named: Backend/directory, use to help with testing and debugging. This will allow for better organization of the codebase and make it easier to locate and manage test files.