import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Lib3mfEngine } from '../src/lib/lib3mfEngine'

describe('Lib3mfEngine', () => {
    let mockLib
    let engine

    beforeEach(() => {
        mockLib = {
            FS: { unlink: vi.fn() },
            eModelUnit: { MilliMeter: 1, Meter: 2 }
        }
        engine = new Lib3mfEngine(mockLib)
    })

    describe('getUUIDSafe', () => {
        it('should return nulls for invalid input', () => {
            expect(engine.getUUIDSafe(null)).toEqual({ uuid: null, hasUUID: false })
            expect(engine.getUUIDSafe(undefined)).toEqual({ uuid: null, hasUUID: false })
            expect(engine.getUUIDSafe('not an object')).toEqual({ uuid: null, hasUUID: false })
        })

        it('should use GetUUIDString if available', () => {
            const mockObj = { GetUUIDString: vi.fn(() => 'test-uuid-string') }
            expect(engine.getUUIDSafe(mockObj)).toEqual({ uuid: 'test-uuid-string', hasUUID: true })
        })

        it('should fall back to GetUUID if GetUUIDString is missing', () => {
            const mockObj = { GetUUID: vi.fn(() => 'test-uuid-v4') }
            expect(engine.getUUIDSafe(mockObj)).toEqual({ uuid: 'test-uuid-v4', hasUUID: true })
        })

        it('should handle complex object returned from GetUUID', () => {
            const mockObj = {
                GetUUID: vi.fn(() => ({
                    UUID: 'complex-uuid',
                    HasUUID: true,
                    delete: vi.fn()
                }))
            }
            expect(engine.getUUIDSafe(mockObj)).toEqual({ uuid: 'complex-uuid', hasUUID: true })
        })

        it('should use GetUniqueID as a last resort', () => {
            const mockObj = {
                GetUniqueID: vi.fn(() => ({
                    return: 'unique-id-uuid',
                    delete: vi.fn()
                }))
            }
            expect(engine.getUUIDSafe(mockObj)).toEqual({ uuid: 'unique-id-uuid', hasUUID: true })
        })
    })

    describe('decodeWarningResult', () => {
        it('should handle string input', () => {
            expect(engine.decodeWarningResult('Simple warning')).toEqual({ message: 'Simple warning', code: undefined })
        })

        it('should handle object with return field', () => {
            const raw = { return: 'Warning message', ErrorCode: 123 }
            expect(engine.decodeWarningResult(raw)).toEqual({ message: 'Warning message', code: 123 })
        })

        it('should handle object with Message field', () => {
            const raw = { Message: 'Another message', code: 456 }
            expect(engine.decodeWarningResult(raw)).toEqual({ message: 'Another message', code: 456 })
        })
    })

    describe('readTransform3mf', () => {
        it('should return null for null input', () => {
            expect(engine.readTransform3mf(null)).toBeNull()
        })

        it('should parse a valid transform object', () => {
            const mockTransform = {
                get_Fields_0_0: () => 1, get_Fields_0_1: () => 0, get_Fields_0_2: () => 0,
                get_Fields_1_0: () => 0, get_Fields_1_1: () => 1, get_Fields_1_2: () => 0,
                get_Fields_2_0: () => 0, get_Fields_2_1: () => 0, get_Fields_2_2: () => 1,
                get_Fields_3_0: () => 10, get_Fields_3_1: () => 20, get_Fields_3_2: () => 30,
            }
            const result = engine.readTransform3mf(mockTransform)
            expect(result).toEqual([
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
                [10, 20, 30]
            ])
        })

        it('should return null if any field is not a number', () => {
            const mockTransform = {
                get_Fields_0_0: () => 1, get_Fields_0_1: () => 'invalid', get_Fields_0_2: () => 0,
                // ... other fields
            }
            expect(engine.readTransform3mf(mockTransform)).toBeNull()
        })
    })

    describe('resolveMaterialColor', () => {
        const lookupMaps = {
            baseLookup: new Map([
                ['1', {
                    byId: new Map([[100, { r: 1, g: 0, b: 0, a: 1 }]]),
                    ids: [100]
                }]
            ]),
            colorLookup: new Map([
                ['2', {
                    byId: new Map([[200, { r: 0, g: 1, b: 0, a: 1 }]]),
                    ids: [200]
                }]
            ])
        }

        it('should resolve base material color', () => {
            const color = engine.resolveMaterialColor(1, 100, lookupMaps)
            expect(color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
        })

        it('should resolve color group color', () => {
            const color = engine.resolveMaterialColor(2, 200, lookupMaps)
            expect(color).toEqual({ r: 0, g: 1, b: 0, a: 1 })
        })

        it('should return null if not found', () => {
            expect(engine.resolveMaterialColor(1, 999, lookupMaps)).toBeNull()
            expect(engine.resolveMaterialColor(3, 100, lookupMaps)).toBeNull()
        })

        it('should handle string resourceId', () => {
            const color = engine.resolveMaterialColor('1', 100, lookupMaps)
            expect(color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
        })
    })

    describe('coerceTrianglePid', () => {
        const lookupMaps = {
            baseLookup: new Map([
                ['1', { byId: new Map([[100, { r: 1 }]]), ids: [100, 101] }]
            ]),
            colorLookup: new Map()
        }

        it('should keep pid if not found in lookup', () => {
            expect(engine.coerceTrianglePid(99, 5, lookupMaps)).toBe(5)
        })

        it('should use pid directly if interpretTrianglePidAsIndex is false and id exists', () => {
            engine.options.interpretTrianglePidAsIndex = false
            expect(engine.coerceTrianglePid(1, 100, lookupMaps)).toBe(100)
        })

        it('should map index to ID if interpretTrianglePidAsIndex is true', () => {
            engine.options.interpretTrianglePidAsIndex = true
            expect(engine.coerceTrianglePid(1, 1, lookupMaps)).toBe(101) // 1-based index 1 -> ids[1] -> 101
        })
    })

    describe('readColorStruct', () => {
        it('should return null for null input', () => {
            expect(engine.readColorStruct(null)).toBeNull()
        })

        it('should normalize colors to 0-1 range', () => {
            const mockColor = {
                get_Red: () => 255,
                get_Green: () => 127.5,
                get_Blue: () => 0,
                get_Alpha: () => 255,
                delete: vi.fn()
            }
            expect(engine.readColorStruct(mockColor)).toEqual({ r: 1, g: 0.5, b: 0, a: 1 })
        })

        it('should use alternate getter names', () => {
            const mockColor = {
                get_Red0: () => 255,
                get_Green0: () => 0,
                get_Blue0: () => 0,
                get_Alpha0: () => 127.5,
                delete: vi.fn()
            }
            expect(engine.readColorStruct(mockColor)).toEqual({ r: 1, g: 0, b: 0, a: 0.5 })
        })
    })

    describe('collectWarnings', () => {
        it('should return empty array if GetWarningCount is missing', () => {
            expect(engine.collectWarnings({})).toEqual([])
        })

        it('should collect and decode multiple warnings', () => {
            const mockReader = {
                GetWarningCount: vi.fn(() => 2),
                GetWarning: vi.fn((i) => {
                    if (i === 0) return { return: 'Warning 0', ErrorCode: 10 }
                    if (i === 1) return { return: 'Warning 1', ErrorCode: 20 }
                })
            }
            const warnings = engine.collectWarnings(mockReader)
            expect(warnings).toEqual([
                { index: 0, message: 'Warning 0', code: 10 },
                { index: 1, message: 'Warning 1', code: 20 }
            ])
        })

        it('should handle errors during warning collection', () => {
            const mockReader = {
                GetWarningCount: vi.fn(() => 1),
                GetWarning: vi.fn(() => { throw new Error('Failed') })
            }
            // It catches the error and tries a fallback
            // In our mock, if the fallback also fails, it returns JSON string of the error
            const warnings = engine.collectWarnings(mockReader)
            expect(warnings[0].message).toContain('Failed')
        })
    })

    describe('getTrianglePropertiesSafe', () => {
        it('should handle objects with Property ID field', () => {
            const mockProp = {
                get_ResourceID: vi.fn(() => 10),
                get_PropertyIDs0: vi.fn(() => 1),
                get_PropertyIDs1: vi.fn(() => 2),
                get_PropertyIDs2: vi.fn(() => 3),
                delete: vi.fn()
            }
            const mockMesh = {
                GetTriangleProperties: vi.fn(() => ({
                    Property: mockProp,
                    delete: vi.fn()
                }))
            }
            const result = engine.getTrianglePropertiesSafe(mockMesh, 0)
            expect(result).toEqual({ resourceId: 10, propertyIds: [1, 2, 3] })
        })

        it('should use fallback getter names for property slots', () => {
            const mockProp = {
                get_ResourceID: vi.fn(() => 20),
                get_PropertyIDs_0: vi.fn(() => 100),
                get_PropertyIDs_1: vi.fn(() => 200),
                get_PropertyIDs_2: vi.fn(() => 300),
                delete: vi.fn()
            }
            const mockMesh = {
                GetTriangleProperties: vi.fn(() => mockProp)
            }
            const result = engine.getTrianglePropertiesSafe(mockMesh, 0)
            expect(result).toEqual({ resourceId: 20, propertyIds: [100, 200, 300] })
        })
    })

    describe('resolveMaterialColor fallback logic', () => {
        const lookupMaps = {
            baseLookup: new Map([
                ['5', {
                    byId: new Map([[1, { r: 1, g: 1, b: 1 }]]),
                    ids: [1]
                }]
            ]),
            colorLookup: new Map()
        }

        it('should fall back to index if ID not found and propertyId is indexable', () => {
            // propertyId = 0, normalized = 0. ids[0] = 1. byId has 1.
            expect(engine.resolveMaterialColor(5, 0, lookupMaps)).toEqual({ r: 1, g: 1, b: 1 })
        })

        it('should fall back to 1-based index if 0-based index fails', () => {
            // propertyId = 1, normalized = 1. ids[1] is undefined.
            // But normalized = 1. ids[1-1] = ids[0] = 1. byId has 1.
            expect(engine.resolveMaterialColor(5, 1, lookupMaps)).toEqual({ r: 1, g: 1, b: 1 })
        })
    })

    describe('mapTriangleVertexColors', () => {
        it('should generate vertex colors array and stats', () => {
            const meshResource = {
                triangleCount: 1,
                triangleProperties: [{ resourceId: 1, propertyIds: [100, 100, 100] }],
                baseColor: { r: 1, g: 1, b: 1 }
            }
            const lookupMaps = {
                baseLookup: new Map([
                    ['1', { byId: new Map([[100, { r: 1, g: 0, b: 0 }]]), ids: [100] }]
                ]),
                colorLookup: new Map()
            }
            const result = engine.mapTriangleVertexColors(meshResource, lookupMaps)
            expect(result.vertexColors).toBeInstanceOf(Float32Array)
            expect(result.vertexColors.length).toBe(9) // 1 triangle * 3 vertices * 3 components
            expect(result.vertexColors[0]).toBe(1) // R
            expect(result.vertexColors[1]).toBe(0) // G
            expect(result.vertexColors[2]).toBe(0) // B
            expect(result.stats.trianglesWithColor).toBe(1)
        })

        it('should use fallback color if no material found', () => {
            const meshResource = {
                triangleCount: 1,
                triangleProperties: [],
                baseColor: { r: 0, g: 1, b: 0 }
            }
            const lookupMaps = { baseLookup: new Map(), colorLookup: new Map() }
            const result = engine.mapTriangleVertexColors(meshResource, lookupMaps)
            expect(result.vertexColors).toBeNull() // trianglesWithColor is 0
            expect(result.stats.trianglesWithColor).toBe(0)
        })
    })

    describe('readMeshGeometry', () => {
        it('should return null if mesh is empty', () => {
            const mockMesh = { GetVertexCount: () => 0, GetTriangleCount: () => 0 }
            expect(engine.readMeshGeometry(mockMesh)).toBeNull()
        })

        it('should parse vertices and triangles', () => {
            const mockMesh = {
                GetVertexCount: () => 1,
                GetTriangleCount: () => 1,
                GetVertex: vi.fn(() => ({
                    get_Coordinates0: () => 1, get_Coordinates1: () => 2, get_Coordinates2: () => 3,
                    delete: vi.fn()
                })),
                GetTriangle: vi.fn(() => ({
                    get_Indices0: () => 0, get_Indices1: () => 0, get_Indices2: () => 0,
                    delete: vi.fn()
                })),
                getTrianglePropertiesSafe: vi.fn()
            }
            // Note: Lib3mfEngine.readMeshGeometry calls this.getTrianglePropertiesSafe
            const result = engine.readMeshGeometry(mockMesh)
            expect(result.positions).toEqual(new Float32Array([1, 2, 3]))
            expect(result.indices).toEqual(new Uint16Array([0, 0, 0]))
            expect(result.vertexCount).toBe(1)
            expect(result.triangleCount).toBe(1)
        })
    })

    describe('getObjectLevelPropertySafe', () => {
        it('should return failed result if method missing', () => {
            expect(engine.getObjectLevelPropertySafe({})).toEqual({ ok: false, resourceId: null, propertyId: null })
        })

        it('should handle boolean return value', () => {
            const mockMesh = { GetObjectLevelProperty: () => true }
            expect(engine.getObjectLevelPropertySafe(mockMesh)).toEqual({ ok: true, resourceId: null, propertyId: null })
        })

        it('should handle object return value', () => {
            const mockMesh = {
                GetObjectLevelProperty: () => ({ result: true, uniqueResourceId: 50, propertyId: 5 })
            }
            expect(engine.getObjectLevelPropertySafe(mockMesh)).toEqual({ ok: true, resourceId: 50, propertyId: 5 })
        })
    })

    describe('getMeshSummary', () => {
        it('should return empty summary for null input', () => {
            expect(engine.getMeshSummary(null)).toEqual({
                vertexCount: null,
                triangleCount: null,
                hasSlices: false,
                manifoldOriented: undefined,
                uuid: null,
                hasUUID: false,
            })
        })

        it('should collect mesh statistics', () => {
            const mockMesh = {
                GetVertexCount: () => 100,
                GetTriangleCount: () => 200,
                HasSlices: () => true,
                IsManifoldAndOriented: () => true,
                GetUUIDString: () => 'mesh-uuid'
            }
            const summary = engine.getMeshSummary(mockMesh)
            expect(summary.vertexCount).toBe(100)
            expect(summary.triangleCount).toBe(200)
            expect(summary.hasSlices).toBe(true)
            expect(summary.manifoldOriented).toBe(true)
            expect(summary.uuid).toBe('mesh-uuid')
        })
    })

    describe('describeModelUnit', () => {
        it('should map unit codes to symbols and scales', () => {
            mockLib.eModelUnit = { MilliMeter: 1, Meter: 2 }
            expect(engine.describeModelUnit(1)).toEqual({ code: 1, name: 'MilliMeter', symbol: 'mm', toMeters: 0.001 })
            expect(engine.describeModelUnit(2)).toEqual({ code: 2, name: 'Meter', symbol: 'm', toMeters: 1 })
            expect(engine.describeModelUnit(99)).toEqual({ code: 99, name: 'Unknown', symbol: '', toMeters: 1 })
        })
    })

    describe('collectBuildItemMetadata', () => {
        it('should return empty array if no group', () => {
            expect(engine.collectBuildItemMetadata(null)).toEqual([])
        })

        it('should collect entries from metadata group', () => {
            const mockMeta = {
                GetKey: () => 'key',
                GetValue: () => 'val',
                GetName: () => 'name',
                GetNameSpace: () => 'ns',
                GetType: () => 'str',
                GetMustPreserve: () => true,
                delete: vi.fn()
            }
            const mockGroup = {
                GetMetaDataCount: () => 1,
                GetMetaData: () => mockMeta,
                delete: vi.fn()
            }
            const mockItem = { GetMetaDataGroup: () => mockGroup }
            const entries = engine.collectBuildItemMetadata(mockItem)
            expect(entries).toHaveLength(1)
            expect(entries[0]).toEqual({
                key: 'key', value: 'val', name: 'name', namespace: 'ns', type: 'str', mustPreserve: true
            })
        })
    })
})
