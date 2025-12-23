
import { describe, it, expect } from 'vitest';
import { Lib3mfEngine } from '../src/lib/lib3mfEngine'; // Adjust import path if needed

// Mock classes
class MockColorGroup {
    constructor(id, colors) {
        this.id = id;
        this.colors = colors;
    }
    GetResourceID() { return this.id; }
    GetCount() { return this.colors.length; }
    GetColor(index) { return this.colors[index]; }
}

describe('Lib3mfEngine Color Mapping', () => {
    it('should correctly map triangle vertex colors from lookup maps', () => {
        const engine = new Lib3mfEngine();

        // Mock lookup maps directly since they are internal
        const colorLookup = new Map();
        // Mock a Color Group with ID 5 (from user snippet) and color #F5F5DC (Beige)
        // #F5F5DC => R=245, G=245, B=220 => Normalized: 0.96, 0.96, 0.86
        const beige = { r: 245 / 255, g: 245 / 255, b: 220 / 255, a: 1 };

        const byId = new Map();
        byId.set(0, beige); // Index 0 -> Beige

        colorLookup.set("5", { byId, ids: [0] });

        const lookupMaps = {
            baseLookup: new Map(),
            colorLookup: colorLookup
        };

        const meshResource = {
            triangleCount: 1,
            triangleProperties: [
                { resourceId: 5, propertyIds: [0, 0, 0] } // Triangle 0 uses Resource 5, Index 0
            ],
            objectLevelProperty: null,
            baseColor: { r: 1, g: 1, b: 1 }
        };

        const result = engine.mapTriangleVertexColors(meshResource, lookupMaps);

        expect(result.vertexColors).toBeDefined();
        expect(result.vertexColors.length).toBe(9); // 1 triangle * 3 vertices * 3 components (RGB)

        // Check first vertex color
        expect(result.vertexColors[0]).toBeCloseTo(beige.r, 4);
        expect(result.vertexColors[1]).toBeCloseTo(beige.g, 4);
        expect(result.vertexColors[2]).toBeCloseTo(beige.b, 4);
    });

    it('should fallback to base color if property ID is invalid', () => {
        const engine = new Lib3mfEngine();
        const lookupMaps = { baseLookup: new Map(), colorLookup: new Map() };

        const meshResource = {
            triangleCount: 1,
            triangleProperties: [
                { resourceId: 999, propertyIds: [0, 0, 0] }
            ],
            baseColor: { r: 0.5, g: 0.5, b: 0.5 }
        };

        const result = engine.mapTriangleVertexColors(meshResource, lookupMaps);

        // Should fallback to baseColor
        expect(result.vertexColors).toBeNull();
    });
});
