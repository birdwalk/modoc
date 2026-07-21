# Supported Formats

Phase 1 implemented:

- STL, ASCII and binary.
- OBJ, basic polygon triangulation.
- GLB or glTF when the optional `trimesh` dependency can parse the file.

Unsupported:

- STEP/STP in this slice.
- PLY and 3MF.
- SolidWorks SLDPRT, Autodesk Inventor IPT, Fusion archives, CATIA, Creo and Parasolid.

Unsupported proprietary formats should be exported to STEP, STL, OBJ or GLB before inspection.
