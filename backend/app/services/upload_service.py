import shutil
import zipfile
from pathlib import Path

from werkzeug.utils import secure_filename

from app.config import settings


class UploadError(Exception):
    pass


def safe_extract_zip(zip_path: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as archive:
        for member in archive.namelist():
            member_path = dest / member
            resolved = member_path.resolve()
            if not str(resolved).startswith(str(dest.resolve())):
                raise UploadError("Zip contains path traversal entries")
        archive.extractall(dest)


def store_upload(session_token: str, filename: str, file_storage) -> tuple[Path, str]:
    safe_name = secure_filename(filename) or "project.zip"
    if not safe_name.lower().endswith(".zip"):
        raise UploadError("Only ZIP uploads are supported")

    session_dir = settings.UPLOAD_ROOT / session_token
    session_dir.mkdir(parents=True, exist_ok=True)

    zip_path = session_dir / safe_name
    file_storage.save(zip_path)

    project_name = safe_name.rsplit(".", 1)[0]
    extract_dir = session_dir / project_name
    if extract_dir.exists():
        shutil.rmtree(extract_dir)

    safe_extract_zip(zip_path, extract_dir)

    # If zip has single top-level folder, use it as project root
    children = [p for p in extract_dir.iterdir() if p.name not in {"__MACOSX"}]
    if len(children) == 1 and children[0].is_dir():
        root = children[0]
    else:
        root = extract_dir

    return root, project_name
