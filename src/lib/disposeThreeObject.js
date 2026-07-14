const TEXTURE_KEYS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'specularMap',
]

export const disposeThreeObject = (object) => {
  if (!object?.traverse) return
  const geometries = new Set()
  const materials = new Set()
  const textures = new Set()

  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry)
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material]
    childMaterials.filter(Boolean).forEach((material) => materials.add(material))
  })

  materials.forEach((material) => {
    TEXTURE_KEYS.forEach((key) => {
      if (material[key]?.isTexture) textures.add(material[key])
    })
    Object.values(material.uniforms || {}).forEach((uniform) => {
      if (uniform?.value?.isTexture) textures.add(uniform.value)
    })
  })

  textures.forEach((texture) => texture.dispose?.())
  materials.forEach((material) => material.dispose?.())
  geometries.forEach((geometry) => geometry.dispose?.())
}
