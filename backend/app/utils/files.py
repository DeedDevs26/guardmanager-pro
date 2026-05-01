import re
from pathlib import Path

def sanitize_filename(name: str) -> str:
    """Removes non-alphanumeric characters and replaces spaces with underscores.
    Ensures the name is not empty and doesn't contain path traversal components.
    """
    # Remove directory components
    name = Path(name).name
    # Replace non-alphanumeric (keep dot for extension if present)
    sanitized = re.sub(r'[^a-zA-Z0-9._-]', '_', name).strip('_')
    return sanitized or "unnamed_file"
