"""Original STL Preview demo, dimensions in millimeters. MIT licensed.

Display sample only, not a load-rated mounting bracket.
"""
from cadgen import build123d as bd
from cadgen import stl

BASE_WIDTH = 96
BASE_DEPTH = 72
BASE_THICKNESS = 8
UPRIGHT_Y = 20
BORE_HEIGHT = 43


@stl(mesh_tolerance=3e-4, mesh_angular_tolerance=0.15)
def showcase_bracket():
  base = bd.extrude(bd.RectangleRounded(BASE_WIDTH, BASE_DEPTH, 8), amount=BASE_THICKNESS)
  base = bd.fillet(base.edges().filter_by(bd.Axis.Z, reverse=True), radius=1.2)

  disk = bd.Pos(0, UPRIGHT_Y, BORE_HEIGHT) * bd.Rot(90, 0, 0) * bd.Cylinder(32, 8)
  foot = bd.Pos(0, UPRIGHT_Y, 24) * bd.Box(64, 8, 38)
  upright = disk + foot
  upright = bd.fillet(upright.edges(), radius=1.2)
  body = base + upright

  for x in (-26, 26):
    outline = bd.Plane.YZ * bd.Polygon((-24, 7), (20, 7), (20, 47), align=None)
    opening = bd.Plane.YZ * bd.Polygon((-7, 13), (14, 13), (14, 32), align=None)
    rib = bd.extrude(outline - opening, amount=3, both=True)
    rib = bd.fillet(rib.edges(), radius=0.6)
    body += bd.Pos(x, 0, 0) * rib

  body -= bd.Pos(0, UPRIGHT_Y, BORE_HEIGHT) * bd.Rot(90, 0, 0) * bd.Cylinder(20, 20)
  for x, z in ((0, 69), (-26, 43), (26, 43), (0, 17)):
    body -= bd.Pos(x, UPRIGHT_Y, z) * bd.Rot(90, 0, 0) * bd.Cylinder(2.6, 20)

  for x in (-36, 36):
    for y in (-24, 24):
      body -= bd.Pos(x, y, 4) * bd.Cylinder(3.3, 20)
      body -= bd.Pos(x, y, 7) * bd.Cylinder(5.6, 4)

  if not body.is_valid or len(body.solids()) != 1:
    raise ValueError("The demo must be one valid connected solid")
  body.label = "showcase-bracket"
  return body


if __name__ == "__main__":
  showcase_bracket()
