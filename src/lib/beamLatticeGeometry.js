import * as THREE from 'three'

const DEFAULT_COLOR = 0x0891b2
const EPSILON = 1e-8

const readPoint = (positions, offset) => new THREE.Vector3(
  positions[offset],
  positions[offset + 1],
  positions[offset + 2]
)

const beamBuckets = (beamData) => {
  const buckets = new Map()
  const lineCount = Math.floor((beamData?.positions?.length || 0) / 6)
  for (let line = 0; line < lineCount; line += 1) {
    const instanceId = Number(beamData.instanceIds?.[line] ?? 0)
    if (!buckets.has(instanceId)) buckets.set(instanceId, { beams: [], balls: [] })
    buckets.get(instanceId).beams.push(line)
  }

  const ballCount = Math.floor((beamData?.ballPositions?.length || 0) / 3)
  for (let ball = 0; ball < ballCount; ball += 1) {
    const instanceId = Number(beamData.ballInstanceIds?.[ball] ?? 0)
    if (!buckets.has(instanceId)) buckets.set(instanceId, { beams: [], balls: [] })
    buckets.get(instanceId).balls.push(ball)
  }
  return buckets
}

export const buildBeamGeometry = (beamData, beamIndices, radialSegments = 10) => {
  const positions = []
  const normals = []
  const indices = []
  const axis = new THREE.Vector3()
  const radial = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const reference = new THREE.Vector3()

  beamIndices.forEach((line) => {
    const offset = line * 6
    const start = readPoint(beamData.positions, offset)
    const end = readPoint(beamData.positions, offset + 3)
    axis.subVectors(end, start)
    const length = axis.length()
    if (length < EPSILON) return
    axis.multiplyScalar(1 / length)

    const radius0 = Math.max(0, Number(beamData.radii?.[line * 2] ?? 0))
    const radius1 = Math.max(0, Number(beamData.radii?.[line * 2 + 1] ?? radius0))
    if (radius0 < EPSILON && radius1 < EPSILON) return

    reference.set(Math.abs(axis.y) < 0.9 ? 0 : 1, Math.abs(axis.y) < 0.9 ? 1 : 0, 0)
    tangent.crossVectors(axis, reference).normalize()
    const bitangent = new THREE.Vector3().crossVectors(axis, tangent).normalize()
    const baseVertex = positions.length / 3

    for (let ring = 0; ring < 2; ring += 1) {
      const center = ring === 0 ? start : end
      const radius = ring === 0 ? radius0 : radius1
      for (let segment = 0; segment < radialSegments; segment += 1) {
        const angle = segment / radialSegments * Math.PI * 2
        radial.copy(tangent).multiplyScalar(Math.cos(angle))
          .addScaledVector(bitangent, Math.sin(angle))
        positions.push(
          center.x + radial.x * radius,
          center.y + radial.y * radius,
          center.z + radial.z * radius
        )
        const normal = radial.clone().multiplyScalar(length)
          .addScaledVector(axis, radius0 - radius1)
          .normalize()
        normals.push(normal.x, normal.y, normal.z)
      }
    }

    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments
      const a = baseVertex + segment
      const b = baseVertex + next
      const c = baseVertex + radialSegments + segment
      const d = baseVertex + radialSegments + next
      indices.push(a, c, b, b, c, d)
    }

    const addCap = (center, radius, normal, reverse) => {
      const capCenter = positions.length / 3
      positions.push(center.x, center.y, center.z)
      normals.push(normal.x, normal.y, normal.z)
      const rimStart = positions.length / 3
      for (let segment = 0; segment < radialSegments; segment += 1) {
        const angle = segment / radialSegments * Math.PI * 2
        radial.copy(tangent).multiplyScalar(Math.cos(angle))
          .addScaledVector(bitangent, Math.sin(angle))
        positions.push(
          center.x + radial.x * radius,
          center.y + radial.y * radius,
          center.z + radial.z * radius
        )
        normals.push(normal.x, normal.y, normal.z)
      }
      for (let segment = 0; segment < radialSegments; segment += 1) {
        const next = (segment + 1) % radialSegments
        if (reverse) indices.push(capCenter, rimStart + next, rimStart + segment)
        else indices.push(capCenter, rimStart + segment, rimStart + next)
      }
    }

    addCap(start, radius0, axis.clone().negate(), true)
    addCap(end, radius1, axis, false)
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

const assignIdentity = (object, instance, resourceId) => {
  object.userData.isBeamLattice = true
  object.userData.instanceId = instance?.instanceId ?? null
  object.userData.visibilityId = instance?.visibilityId ?? null
  object.userData.instanceKey = instance?.instanceKey ?? null
  object.userData.resourceId = resourceId ?? instance?.resourceId ?? null
  object.userData.bounds = instance?.bounds ?? null
}

const collectNodeSpheres = (beamData, bucket, dense) => {
  const nodes = new Map()
  const upsert = (center, radius, declared = false) => {
    if (!(radius > EPSILON)) return
    const key = `${center.x}|${center.y}|${center.z}`
    const existing = nodes.get(key)
    if (!existing) {
      nodes.set(key, { center, radius, declared, capCount: declared ? 0 : 1 })
      return
    }
    existing.radius = Math.max(existing.radius, radius)
    existing.declared ||= declared
    if (!declared) existing.capCount += 1
  }

  bucket.balls.forEach((ball) => {
    upsert(
      readPoint(beamData.ballPositions, ball * 3),
      Number(beamData.ballRadii?.[ball] ?? 0),
      true
    )
  })

  bucket.beams.forEach((line) => {
    const positionOffset = line * 6
    const radiusOffset = line * 2
    for (let endpoint = 0; endpoint < 2; endpoint += 1) {
      if (beamData.capModes?.[radiusOffset + endpoint] !== 1) continue
      upsert(
        readPoint(beamData.positions, positionOffset + endpoint * 3),
        Number(beamData.radii?.[radiusOffset + endpoint] ?? 0)
      )
    }
  })
  return [...nodes.values()].filter((node) => (
    !dense || node.declared || node.capCount <= 1
  ))
}

const createTaperedBeamMaterial = () => {
  const material = new THREE.MeshStandardMaterial({
    color: DEFAULT_COLOR,
    roughness: 0.48,
    metalness: 0.08,
  })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `
      attribute float beamRadiusStart;
      attribute float beamRadiusEnd;
    ${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `float beamPosition = clamp(position.y + 0.5, 0.0, 1.0);
       float beamRadius = mix(beamRadiusStart, beamRadiusEnd, beamPosition);
       vec3 transformed = vec3(position.x * beamRadius, position.y, position.z * beamRadius);`
    )
  }
  material.customProgramCacheKey = () => 'tapered-beam-v1'
  return material
}

export const createInstancedBeams = (beamData, beamIndices) => {
  const totalBeamCount = beamData.positions.length / 6
  const dense = totalBeamCount > 50000
  const radialSegments = dense ? 5 : totalBeamCount > 10000 ? 6 : 8
  const hasOnlySphereCaps = beamIndices.every((line) => (
    beamData.capModes?.[line * 2] === 1 && beamData.capModes?.[line * 2 + 1] === 1
  ))
  const geometry = new THREE.CylinderGeometry(
    1,
    1,
    1,
    radialSegments,
    1,
    hasOnlySphereCaps
  )
  const material = createTaperedBeamMaterial()
  const mesh = new THREE.InstancedMesh(geometry, material, beamIndices.length)
  const radiusStarts = new Float32Array(beamIndices.length)
  const radiusEnds = new Float32Array(beamIndices.length)
  const midpoint = new THREE.Vector3()
  const axis = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const matrix = new THREE.Matrix4()
  const up = new THREE.Vector3(0, 1, 0)

  beamIndices.forEach((line, localIndex) => {
    const offset = line * 6
    const start = readPoint(beamData.positions, offset)
    const end = readPoint(beamData.positions, offset + 3)
    midpoint.addVectors(start, end).multiplyScalar(0.5)
    axis.subVectors(end, start)
    const length = Math.max(EPSILON, axis.length())
    axis.multiplyScalar(1 / length)
    rotation.setFromUnitVectors(up, axis)

    const radius0 = Math.max(0, Number(beamData.radii?.[line * 2] ?? 0))
    const radius1 = Math.max(0, Number(beamData.radii?.[line * 2 + 1] ?? radius0))
    const maxRadius = Math.max(EPSILON, radius0, radius1)
    radiusStarts[localIndex] = radius0 / maxRadius
    radiusEnds[localIndex] = radius1 / maxRadius
    if (dense && hasOnlySphereCaps) {
      midpoint.addScaledVector(axis, (radius1 - radius0) * 0.5)
    }
    scale.set(
      maxRadius,
      dense && hasOnlySphereCaps ? length + radius0 + radius1 : length,
      maxRadius
    )
    matrix.compose(midpoint, rotation, scale)
    mesh.setMatrixAt(localIndex, matrix)
  })

  geometry.setAttribute('beamRadiusStart', new THREE.InstancedBufferAttribute(radiusStarts, 1))
  geometry.setAttribute('beamRadiusEnd', new THREE.InstancedBufferAttribute(radiusEnds, 1))
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
  return mesh
}

export const createBeamLatticeGroup = (beamData, instances = [], mode = 'solid') => {
  const group = new THREE.Group()
  group.name = 'Beam lattice'
  group.userData.isBeamLattice = true
  const instanceMap = new Map(instances.map((instance) => [Number(instance.instanceId), instance]))

  beamBuckets(beamData).forEach((bucket, instanceId) => {
    const instance = instanceMap.get(instanceId)
    const resourceId = beamData.resourceIds?.[bucket.beams[0]]
      ?? beamData.ballResourceIds?.[bucket.balls[0]]
      ?? instance?.resourceId

    if (mode === 'centerlines') {
      const linePositions = []
      bucket.beams.forEach((line) => {
        const offset = line * 6
        for (let i = 0; i < 6; i += 1) linePositions.push(beamData.positions[offset + i])
      })
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
      const material = new THREE.LineBasicMaterial({ color: 0x155e75, transparent: true, opacity: 0.9 })
      const lines = new THREE.LineSegments(geometry, material)
      lines.name = 'Beam centerlines'
      assignIdentity(lines, instance, resourceId)
      group.add(lines)
      return
    }

    if (bucket.beams.length) {
      const mesh = createInstancedBeams(beamData, bucket.beams)
      mesh.name = 'Beam lattice'
      mesh.castShadow = true
      mesh.receiveShadow = true
      assignIdentity(mesh, instance, resourceId)
      group.add(mesh)
    }

    const dense = beamData.positions.length / 6 > 50000
    const nodeSpheres = collectNodeSpheres(beamData, bucket, dense)
    if (nodeSpheres.length) {
      const geometry = new THREE.SphereGeometry(1, dense ? 6 : 12, dense ? 4 : 8)
      const material = new THREE.MeshStandardMaterial({
        color: DEFAULT_COLOR,
        roughness: 0.48,
        metalness: 0.08,
      })
      const balls = new THREE.InstancedMesh(geometry, material, nodeSpheres.length)
      const matrix = new THREE.Matrix4()
      nodeSpheres.forEach(({ center, radius }, localIndex) => {
        matrix.compose(center, new THREE.Quaternion(), new THREE.Vector3(radius, radius, radius))
        balls.setMatrixAt(localIndex, matrix)
      })
      balls.instanceMatrix.needsUpdate = true
      balls.name = 'Beam lattice balls'
      balls.castShadow = true
      balls.receiveShadow = true
      assignIdentity(balls, instance, resourceId)
      group.add(balls)
    }
  })

  return group
}
