export const sampleModels = [
  {
    name: "Component Assembly",
    fileName: "ComponentAssembly.3mf",
    urls: ["/data/cube.3mf"],
    badge: "Components",
    description: "Three-part assembly with shared mesh resources and component transforms.",
  },
  {
    name: "Helix",
    fileName: "helix.3mf",
    urls: ["/data/helix.3mf"],
    badge: "Basics",
    description: "Minimal geometry to check navigation, scaling, and lighting.",
  },
  {
    name: "Parts for Bounding Box",
    fileName: "PartsForBoundingBox.3mf",
    urls: ["/data/PartsForBoundingBox.3mf"],
    badge: "Bounds + colours",
    description: "Two-part assembly useful for checking per-part visibility and overall model extents.",
  },
  {
    name: "Property Cube",
    fileName: "PyramidWithProperties.3mf",
    urls: ["/data/PyramidWithProperties.3mf"],
    badge: "Material group",
    description: "Cube-shaped sample demonstrating base material properties assigned through a material group.",
  },
  {
    name: "Colour Cube",
    fileName: "colorcube.3mf",
    urls: ["/data/colorcube.3mf"],
    badge: "Vertex colours",
    description: "Single mesh with a smooth vertex-colour gradient across the cube.",
  },
  {
    name: "Sliced Cube Gears",
    fileName: "cube_gears_sliced.3mf",
    urls: ["/data/slice/cube_gears_sliced.3mf"],
    badge: "Slice extension",
    description: "Official multi-part slice-stack sample with denser geometry for Z-plane inspection.",
  },
  {
    name: "Brake Pedal",
    fileName: "BrakePedal.3mf",
    urls: ["/data/BrakePedal.3mf"],
    badge: "Beam lattice",
    description: "A production-style part combining a solid shell with a lightweight internal beam lattice.",
  },
  {
    name: "Dense Octet Lattice",
    fileName: "OctetLattice.3mf",
    urls: ["/data/OctetLattice.3mf"],
    badge: "Beam stress test",
    description: "A high-density multi-object octet lattice for testing solid rendering performance.",
  },
  {
    name: "Sliced Torus",
    fileName: "torus_sliced.3mf",
    urls: ["/data/slice/torus_sliced.3mf"],
    badge: "Slice extension",
    description: "Reference torus slice-stack sample useful for checking contours and filled cross-sections.",
  },
  {
    name: "Sliced Sphere",
    fileName: "sphere_sliced.3mf",
    urls: ["/data/slice/sphere_sliced.3mf"],
    badge: "Slice extension",
    description: "Reference sphere slice-stack sample for simple layer-by-layer Z slicing.",
  },
  {
    name: "Sliced Box",
    fileName: "box_sliced.3mf",
    urls: ["/data/slice/box_sliced.3mf"],
    badge: "Slice extension",
    description: "Simple official slice sample for validating slice-plane orientation and stack traversal.",
  },
];

export const renderingRoadmap = [
  {
    label: "Core 3MF specification",
    items: [
      { label: "Mesh geometry", status: "now" },
      { label: "Properties", status: "now" },
      { label: "Colors", status: "now" },
      { label: "Textures", status: "now" },
    ],
  },
  { label: "Slice extension", status: "now" },
  { label: "Beam lattice extension", status: "now" },
  { label: "Volumetric extension", status: "soon" },
];

export const upcomingCards = [
  {
    title: "Converter",
    caption: "Common formats to 3MF",
    status: "Planned",
  },
  {
    title: "Validator",
    caption: "Spec compliance checks",
    status: "Live – diagnostics in scene tree",
  },
];
