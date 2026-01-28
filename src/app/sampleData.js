export const sampleModels = [
  {
    name: "Cube",
    fileName: "cube.3mf",
    urls: ["/data/cube.3mf"],
    badge: "Components",
    description: "Component assembly with transforms and shared meshes.",
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
    badge: "Colour group",
    description: "Two-part assembly coloured via a 3MF colour group (orange + grey).",
  },
  {
    name: "Pyramid with Properties",
    fileName: "PyramidWithProperties.3mf",
    urls: ["/data/PyramidWithProperties.3mf"],
    badge: "Material group",
    description: "Demonstrates base material groups assigning different faces per material.",
  },
  {
    name: "Colour Cube",
    fileName: "colorcube.3mf",
    urls: ["/data/colorcube.3mf"],
    badge: "Vertex colours",
    description: "Single mesh with a smooth vertex-colour gradient across the cube.",
  },
  {
    name: "Sliced Cube",
    fileName: "P_SXX_0101_03.3mf",
    urls: ["/data/slice/P_SXX_0101_03.3mf"],
    badge: "Slice extension",
    description: "Cube with slice stack data for layer-by-layer visualization.",
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
  { label: "Beam lattice extension", status: "soon" },
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
