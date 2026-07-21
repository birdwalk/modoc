from __future__ import annotations

import hashlib
import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile

from .config import Settings
from .models import Artifact, InspectionRun, MeshModel, RepairResult


class Store:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.root = settings.storage_dir.resolve()
        self.uploads = self.root / "uploads"
        self.artifacts = self.root / "artifacts"
        self.uploads.mkdir(parents=True, exist_ok=True)
        self.artifacts.mkdir(parents=True, exist_ok=True)
        self.meshes: dict[str, MeshModel] = {}
        self.files: dict[str, Path] = {}
        self.runs: dict[str, InspectionRun] = {}
        self.artifact_index: dict[str, Artifact] = {}
        self.repairs: dict[str, RepairResult] = {}
        self.checksums: dict[str, str] = {}

    def new_id(self, prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:12]}"

    async def save_upload(self, file: UploadFile) -> tuple[str, Path, str, bool]:
        safe_name = Path(file.filename or "uploaded-model").name
        model_id = self.new_id("model")
        target = self.uploads / model_id / safe_name
        target.parent.mkdir(parents=True, exist_ok=True)
        hasher = hashlib.sha256()
        size = 0
        max_bytes = self.settings.max_upload_mb * 1024 * 1024
        with target.open("wb") as handle:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    target.unlink(missing_ok=True)
                    raise ValueError(f"File exceeds {self.settings.max_upload_mb} MB upload limit.")
                hasher.update(chunk)
                handle.write(chunk)
        checksum = hasher.hexdigest()
        duplicate = checksum in self.checksums
        self.checksums[checksum] = model_id
        self.files[model_id] = target
        return model_id, target, checksum, duplicate

    def register_demo(self, source: Path) -> tuple[str, Path, str, bool]:
        model_id = self.new_id("model")
        target = self.uploads / model_id / source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        checksum = hashlib.sha256(target.read_bytes()).hexdigest()
        duplicate = checksum in self.checksums
        self.checksums[checksum] = model_id
        self.files[model_id] = target
        return model_id, target, checksum, duplicate

    def artifact_path(self, filename: str) -> tuple[str, Path]:
        artifact_id = self.new_id("artifact")
        path = self.artifacts / artifact_id / Path(filename).name
        path.parent.mkdir(parents=True, exist_ok=True)
        return artifact_id, path

    def register_artifact(self, artifact_id: str, path: Path, kind: str, content_type: str) -> Artifact:
        artifact = Artifact(id=artifact_id, kind=kind, filename=path.name, path=str(path), content_type=content_type)
        self.artifact_index[artifact_id] = artifact
        return artifact
