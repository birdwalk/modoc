from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from .models import MeshModel
from .parsers import parse_model


@dataclass(frozen=True)
class ParsedGeometry:
    mesh: MeshModel
    parser: str
    parser_version: str


class GeometryAnalysisEngine(Protocol):
    def parse(self, path: Path) -> ParsedGeometry:
        """Parse source geometry into MODOC's internal mesh representation."""


class LocalGeometryAnalysisEngine:
    def parse(self, path: Path) -> ParsedGeometry:
        mesh, parser, parser_version = parse_model(path)
        return ParsedGeometry(mesh=mesh, parser=parser, parser_version=parser_version)
