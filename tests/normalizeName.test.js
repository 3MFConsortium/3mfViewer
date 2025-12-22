import { describe, it, expect } from 'vitest'
import { normalizeName } from '../src/lib/normalizeName'

describe('normalizeName', () => {
    it('should return the name from GetName if available', () => {
        const resource = { GetName: () => 'Test Name' }
        expect(normalizeName(resource, 'Fallback')).toBe('Test Name')
    })

    it('should return the fallback if GetName returns empty string', () => {
        const resource = { GetName: () => '' }
        expect(normalizeName(resource, 'Fallback')).toBe('Fallback')
    })

    it('should return the fallback if GetName is missing', () => {
        const resource = {}
        expect(normalizeName(resource, 'Fallback')).toBe('Fallback')
    })

    it('should return the fallback if resource is null', () => {
        expect(normalizeName(null, 'Fallback')).toBe('Fallback')
    })
})
