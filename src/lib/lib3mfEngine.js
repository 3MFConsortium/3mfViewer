// lib3mfEngine.js
function logCatch(context, error) {
    try {
        if (typeof console !== "undefined" && typeof console.log === "function") {
            console.log(`[lib3mfEngine] ${context}`, error);
        }
    } catch {
        // Swallow logging failures silently to avoid recursive errors.

    }
}

function safeDelete(subject) {
    try {
        subject?.delete?.();
    } catch (err) {
        logCatch("safeDelete failed to dispose object", err);
    }
}

function normalizePropertyId(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" && value.length) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return numeric;
        return value;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    return null;
}

function toInt(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

const SPECIFICATION_URL = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02";

// --- Matrix Math Helpers for Component Transforms ---
function mat4Identity() {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
}

function mat4Multiply(a, b) {
    const out = new Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
}

function mat4From3mf(matrix43) {
    if (!Array.isArray(matrix43) || matrix43.length !== 4) return mat4Identity();
    // 3MF is 4x3. We convert to 4x4 column-major (OpenGL/WebGL standard).
    // matrix43 is usually row-major [ [m00, m01, m02], [m10, m11, m12], ... ]
    // or column vectors? 3MF spec says 4 rows, 3 columns.
    // The previous loader MatrixFromTransform43 implementation used:
    // set(0,0, 0,1, 0,2, 3,0 ...)  <-- wait, THREE Matrix4 set() is row-major arguments but stores column-major.
    // Let's match the THREE.Matrix4 logic:
    // row 1: m00 m01 m02 m30(tx) ? No. 
    // 3MF transform is:
    // m00 m01 m02
    // m10 m11 m12
    // m20 m21 m22
    // m30 m31 m32 (translation)
    //
    // THREE.Matrix4 is column-major internal:
    // 0:m00 4:m01 8:m02 12:tx
    // 1:m10 5:m11 9:m12 13:ty
    // 2:m20 6:m21 10:m22 14:tz
    // 3:0   7:0   11:0   15:1

    const m = matrix43;
    return [
        m[0][0], m[0][1], m[0][2], 0,
        m[1][0], m[1][1], m[1][2], 0,
        m[2][0], m[2][1], m[2][2], 0,
        m[3][0], m[3][1], m[3][2], 1
    ];
}

function applyMat4ToPoint(m, x, y, z) {
    const tx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const ty = m[1] * x + m[5] * y + m[9] * z + m[13];
    const tz = m[2] * x + m[6] * y + m[10] * z + m[14];
    return { x: tx, y: ty, z: tz };
}


export class Lib3mfEngine {
    constructor(lib, options = {}) {
        this.lib = lib;
        this.options = options || {};
    }

    safeFsUnlink(virtualPath) {
        try {
            this.lib.FS.unlink?.(virtualPath);
        } catch (err) {
            logCatch(`safeFsUnlink could not remove ${virtualPath}`, err);
        }
    }

    getUUIDSafe(subject) {
        if (!subject || typeof subject !== "object") {
            return { uuid: null, hasUUID: false };
        }

        const coerceString = (value) => {
            if (!value) return null;
            if (typeof value === "string") return value || null;
            if (typeof value === "object") {
                const text =
                    value.return ??
                    value.UUID ??
                    value.uuid ??
                    value.Value ??
                    value.value ??
                    (typeof value.toString === "function" ? value.toString() : null);
                return typeof text === "string" && text.length ? text : null;
            }
            return null;
        };

        try {
            if (typeof subject.GetUUIDString === "function") {
                const str = subject.GetUUIDString();
                if (typeof str === "string" && str.length) {
                    return { uuid: str, hasUUID: true };
                }
            }
        } catch (err) {
            logCatch("getUUIDSafe.GetUUIDString threw", err);
        }

        let result = null;
        try {
            if (typeof subject.GetUUID === "function") {
                result = subject.GetUUID();
                if (typeof result === "string") {
                    const uuid = result || null;
                    return { uuid, hasUUID: !!uuid };
                }
                if (result && typeof result === "object") {
                    const uuid = coerceString(result) || null;
                    const hasField = result.HasUUID ?? result.bHasUUID ?? result.hasUUID ?? result.HasUniqueID;
                    const hasUUID = typeof hasField === "boolean" ? hasField : !!uuid;
                    return { uuid, hasUUID };
                }
            }
        } catch (err) {
            logCatch("getUUIDSafe.GetUUID threw", err);
        } finally {
            if (result && typeof result.delete === "function") {
                safeDelete(result);
            }
        }

        try {
            if (typeof subject.GetUniqueID === "function") {
                const unique = subject.GetUniqueID();
                const uuid = coerceString(unique);
                if (unique && typeof unique.delete === "function") {
                    safeDelete(unique);
                }
                if (uuid) return { uuid, hasUUID: true };
            }
        } catch (err) {
            logCatch("getUUIDSafe.GetUniqueID threw", err);
        }

        return { uuid: null, hasUUID: false };
    }

    decodeWarningResult(result) {
        if (typeof result === "string") {
            return { message: result, code: undefined };
        }
        if (result && typeof result === "object") {
            const code = result.ErrorCode ?? result.code ?? result.Code;
            const messageCandidate =
                result.return ??
                result.Return ??
                result.Message ??
                result.message ??
                result.msg ??
                result.text ??
                result.description ??
                result.Details ??
                result.detail;
            return {
                message:
                    typeof messageCandidate === "string"
                        ? messageCandidate
                        : JSON.stringify(messageCandidate ?? result),
                code,
            };
        }
        return { message: JSON.stringify(result), code: undefined };
    }

    collectWarnings(readerInstance) {
        if (!readerInstance?.GetWarningCount) return [];
        const warnings = [];
        let count = 0;
        try {
            count = readerInstance.GetWarningCount() ?? 0;
        } catch (err) {
            logCatch("collectWarnings.GetWarningCount failed", err);
            count = 0;
        }
        for (let i = 0; i < count; i += 1) {
            let message;
            let code;
            try {
                const raw = readerInstance.GetWarning(i);
                const decoded = this.decodeWarningResult(raw);
                message = decoded.message;
                code = decoded.code;
            } catch (err) {
                logCatch(`collectWarnings.GetWarning(${i}) failed`, err);
                try {
                    const fallback = readerInstance.GetWarning(i, 0);
                    message = typeof fallback === "string" ? fallback : JSON.stringify(fallback);
                } catch (fallbackErr) {
                    logCatch(`collectWarnings fallback GetWarning(${i}, 0) failed`, fallbackErr);
                    message = JSON.stringify(fallbackErr?.message || fallbackErr || "unknown warning");
                }
            }
            warnings.push({ index: i, message, code });
        }
        return warnings;
    }

    getLastErrorString(instance, wrapper) {
        if (!instance) return null;
        try {
            const result = wrapper.GetLastError(instance);
            if (typeof result === "string") {
                return result || null;
            }
            if (result && typeof result === "object") {
                const message =
                    result.sLastErrorString ??
                    result.LastErrorString ??
                    result.lastErrorString ??
                    result.message ??
                    result.Message;
                if (typeof message === "string" && message.length) return message;
            }
        } catch (err) {
            logCatch("getLastErrorString failed", err);
        }
        return null;
    }

    readTransform3mf(transform) {
        if (!transform) return null;
        const get = (i, j) => transform[`get_Fields_${i}_${j}`]?.();
        const d = [
            [get(0, 0), get(0, 1), get(0, 2)],
            [get(1, 0), get(1, 1), get(1, 2)],
            [get(2, 0), get(2, 1), get(2, 2)],
            [get(3, 0), get(3, 1), get(3, 2)],
        ];
        const hasInvalid = d.some((row) => row.some((value) => typeof value !== "number"));
        return hasInvalid ? null : d;
    }

    getObjectLevelPropertySafe(meshObject) {
        try {
            const result = meshObject.GetObjectLevelProperty?.();
            if (result == null) return { ok: false, resourceId: null, propertyId: null };
            if (typeof result === "boolean") {
                return { ok: result, resourceId: null, propertyId: null };
            }
            if (typeof result === "object") {
                const okField =
                    result.return ??
                    result.Result ??
                    result.result ??
                    result[0];
                const ok = typeof okField === "boolean" ? okField : !!okField;
                const resourceId =
                    result.nUniqueResourceID ??
                    result.UniqueResourceID ??
                    result.uniqueResourceId ??
                    result.ResourceID ??
                    result[1] ??
                    null;
                const propertyId =
                    result.nPropertyID ??
                    result.PropertyID ??
                    result.propertyId ??
                    result[2] ??
                    null;
                if (ok && resourceId != null && propertyId != null) {
                    return {
                        ok: true,
                        resourceId,
                        propertyId,
                    };
                }
                if (typeof result === "boolean") {
                    return { ok: result, resourceId: null, propertyId: null };
                }
            }
        } catch (err) {
            logCatch("getObjectLevelPropertySafe failed", err);
        }
        return { ok: false, resourceId: null, propertyId: null };
    }

    getTrianglePropertiesSafe(meshObject, triangleIndex) {
        try {
            const p = meshObject.GetTriangleProperties?.(triangleIndex);
            if (!p) return null;

            const prop = p.Property ?? p.property ?? p["Property"];
            if (prop && typeof prop.get_ResourceID === "function") {
                const resourceId = prop.get_ResourceID();
                const propertyIds = [
                    prop.get_PropertyIDs0?.() ?? 0,
                    prop.get_PropertyIDs1?.() ?? 0,
                    prop.get_PropertyIDs2?.() ?? 0,
                ];
                safeDelete(prop);
                safeDelete(p);
                return { resourceId, propertyIds };
            }

            const resourceId =
                p.get_ResourceID?.() ??
                p.ResourceID ??
                p.get_ResourceID0?.() ??
                p.nResourceID ??
                p.nUniqueResourceID ??
                p.uniqueResourceId ??
                null;

            const propertyIds = [0, 1, 2].map((slot) => {
                if (typeof p.get_PropertyIDs === "function") {
                    try {
                        const res = p.get_PropertyIDs(slot);
                        if (res != null) return res;
                    } catch (err) {
                        logCatch(`getTrianglePropertiesSafe.get_PropertyIDs(${slot}) failed`, err);
                    }
                }
                const getterVariants = [
                    `get_PropertyIDs_${slot}`,
                    `get_PropertyID${slot}`,
                    `get_PropertyIDs${slot}`,
                    `get_PropertyID_${slot}`, // <-- fixed bracket
                    `get_Property${slot}`,
                    `get_Property${slot + 1}`,
                ];
                for (const name of getterVariants) {
                    if (typeof p[name] === "function") {
                        const value = p[name]();
                        if (value != null) return value;
                    }
                }
                return 0;
            });

            safeDelete(p);
            return { resourceId, propertyIds };
        } catch (err) {
            logCatch("getTrianglePropertiesSafe failed", err);
            return null;
        }
    }

    readBaseMaterialEntries(group) {
        const count = group.GetCount?.() ?? 0;
        const entries = [];

        for (let index = 0; index < count; index += 1) {
            const candidates = [];
            candidates.push(index + 1, index);

            let chosenId = null;
            let rgba = null;
            let name = "";

            for (const candidate of candidates) {
                if (candidate == null) continue;
                try {
                    name = group.GetName?.(candidate) ?? name;
                } catch (err) {
                    logCatch(`readBaseMaterialEntries.GetName(${candidate}) failed`, err);
                }
                try {
                    const color = group.GetDisplayColor?.(candidate);
                    if (color) {
                        const parsed = this.readColorStruct(color);
                        if (parsed) {
                            chosenId = normalizePropertyId(candidate) ?? candidate;
                            rgba = parsed;
                            break;
                        }
                    }
                } catch (err) {
                    logCatch(`readBaseMaterialEntries.GetDisplayColor(${candidate}) failed`, err);
                }
            }

            if (!rgba) {
                try {
                    const fallbackColor = group.GetDisplayColor?.(index);
                    const parsed = this.readColorStruct(fallbackColor);
                    if (parsed) {
                        chosenId = chosenId ?? normalizePropertyId(index) ?? index;
                        rgba = parsed;
                    }
                } catch (err) {
                    logCatch(`readBaseMaterialEntries fallback GetDisplayColor(${index}) failed`, err);
                }
            }

            entries.push({
                propertyId: chosenId ?? (normalizePropertyId(index + 1) ?? index + 1),
                propertyIndex: index,
                name: name || `Material ${index}`,
                color: rgba,
            });
        }

        return entries;
    }

    readColorStruct(colorStruct) {
        if (!colorStruct) return null;
        try {
            const r = (colorStruct.get_Red?.() ?? colorStruct.get_Red0?.() ?? 0) / 255;
            const g = (colorStruct.get_Green?.() ?? colorStruct.get_Green0?.() ?? 0) / 255;
            const b = (colorStruct.get_Blue?.() ?? colorStruct.get_Blue0?.() ?? 0) / 255;
            const a = (colorStruct.get_Alpha?.() ?? colorStruct.get_Alpha0?.() ?? 255) / 255;
            return { r, g, b, a };
        } catch (err) {
            logCatch("readColorStruct failed", err);
            return null;
        } finally {
            safeDelete(colorStruct);
        }
    }

    readColorGroupEntries(group) {
        const count = group.GetCount?.() ?? 0;
        const entries = [];

        for (let index = 0; index < count; index += 1) {
            const candidates = [];
            candidates.push(index + 1, index);

            const actualId = normalizePropertyId(index + 1) ?? index + 1;

            let rgba = null;
            let propertyId = actualId;

            const tryFetch = (pid) => {
                if (pid == null) return null;
                if (typeof group.GetColor !== "function") return null;
                try {
                    const colorStruct = group.GetColor(pid);
                    return this.readColorStruct(colorStruct);
                } catch (err) {
                    logCatch(`readColorGroupEntries.GetColor(${pid}) failed`, err);
                    return null;
                }
            };

            for (const candidate of candidates) {
                const color = tryFetch(candidate);
                if (color) {
                    rgba = color;
                    propertyId = actualId;
                    break;
                }
            }

            entries.push({
                propertyId,
                propertyIndex: index,
                color: rgba,
            });
        }

        return entries;
    }

    readAttachmentBuffer(attachment) {
        if (!attachment) return null;
        try {
            const res = attachment.WriteToBuffer();
            const buffer = res?.Buffer ?? res;
            if (ArrayBuffer.isView(buffer)) return buffer;
            if (Array.isArray(buffer)) return Uint8Array.from(buffer);
            return null;
        } catch (err) {
            try {
                const path = attachment.GetPath?.() || "attachment.bin";
                const safeName = String(path).replace(/[^\w.-]+/g, "_");
                const fsPath = `/tmp/${Date.now()}_${safeName}`;
                attachment.WriteToFile?.(fsPath);
                const data = this.lib?.FS?.readFile?.(fsPath);
                this.safeFsUnlink(fsPath);
                if (data) return data;
            } catch (fallbackErr) {
                logCatch("readAttachmentBuffer fallback WriteToFile failed", fallbackErr);
            }
            logCatch("readAttachmentBuffer failed", err);
            return null;
        }
    }

    readTexture2DEntries(model) {
        const entries = [];
        const iterator = model.GetTexture2Ds?.();
        if (!iterator) return entries;
        while (iterator.MoveNext?.()) {
            const texture = iterator.GetCurrentTexture2D?.();
            if (!texture) continue;
            try {
                const textureId = texture.GetResourceID?.();
                const uniqueResourceId = texture.GetUniqueResourceID?.();
                const contentType = texture.GetContentType?.();
                const tileStyles = texture.GetTileStyleUV?.();
                const filter = texture.GetFilter?.();
                let attachmentPath = null;
                let buffer = null;

                const attachment = texture.GetAttachment?.();
                if (attachment) {
                    try {
                        attachmentPath = attachment.GetPath?.() ?? null;
                        buffer = this.readAttachmentBuffer(attachment);
                    } finally {
                        safeDelete(attachment);
                    }
                }

                entries.push({
                    textureId,
                    uniqueResourceId,
                    contentType,
                    tileStyleU: tileStyles?.TileStyleU ?? null,
                    tileStyleV: tileStyles?.TileStyleV ?? null,
                    filter,
                    attachmentPath,
                    buffer,
                });
            } catch (err) {
                logCatch("readTexture2DEntries failed", err);
            } finally {
                safeDelete(texture);
            }
        }
        safeDelete(iterator);
        return entries;
    }

    readTexture2DGroupEntries(model) {
        const entries = [];
        const iterator = model.GetTexture2DGroups?.();
        if (!iterator) return entries;
        while (iterator.MoveNext?.()) {
            const group = iterator.GetCurrentTexture2DGroup?.();
            if (!group) continue;
            try {
                const groupId = group.GetResourceID?.();
                const uniqueResourceId = group.GetUniqueResourceID?.();
                const count = group.GetCount?.() ?? 0;
                let textureId = null;

                const texture = group.GetTexture2D?.();
                if (texture) {
                    try {
                        textureId = texture.GetResourceID?.();
                    } finally {
                        safeDelete(texture);
                    }
                }

                const coords = [];
                const ids = [];
                for (let index = 0; index < count; index += 1) {
                    const candidates = [];
                    candidates.push(index + 1, index);

                    let chosenId = null;
                    let coord = null;

                    for (const candidate of candidates) {
                        if (candidate == null) continue;
                        try {
                            const texCoord = group.GetTex2Coord?.(candidate);
                            const u =
                                typeof texCoord?.get_U === "function"
                                    ? texCoord.get_U()
                                    : texCoord?.U ?? texCoord?.u ?? null;
                            const v =
                                typeof texCoord?.get_V === "function"
                                    ? texCoord.get_V()
                                    : texCoord?.V ?? texCoord?.v ?? null;
                            if (Number.isFinite(u) && Number.isFinite(v)) {
                                chosenId = normalizePropertyId(candidate) ?? candidate;
                                coord = { u, v };
                                break;
                            }
                        } catch (err) {
                            logCatch(`readTexture2DGroupEntries.GetTex2Coord(${candidate}) failed`, err);
                        }
                    }

                    if (chosenId == null && coord == null) {
                        continue;
                    }

                    ids.push(chosenId);
                    coords.push({
                        propertyId: chosenId,
                        u: coord?.u ?? 0,
                        v: coord?.v ?? 0,
                    });
                }

                entries.push({
                    groupId,
                    uniqueResourceId,
                    textureId,
                    propertyIds: ids,
                    coords,
                });
            } catch (err) {
                logCatch("readTexture2DGroupEntries failed", err);
            } finally {
                safeDelete(group);
            }
        }
        safeDelete(iterator);
        return entries;
    }

    readSliceStackEntries(model) {
        const stacks = [];
        const iterator = model.GetSliceStacks?.();
        if (!iterator) return stacks;
        try {
            while (iterator.MoveNext?.()) {
                const stack = iterator.GetCurrentSliceStack?.();
                if (!stack) continue;
                try {
                    const resourceId = stack.GetResourceID?.();
                    const uniqueResourceId = stack.GetUniqueResourceID?.();
                    const uuidInfo = this.getUUIDSafe(stack);
                    const bottomZValue = stack.GetBottomZ?.();
                    const bottomZ = Number.isFinite(Number(bottomZValue)) ? Number(bottomZValue) : null;
                    const sliceCountValue = stack.GetSliceCount?.();
                    const sliceCount = Number.isFinite(Number(sliceCountValue)) ? Number(sliceCountValue) : 0;
                    let ownPath = null;
                    try {
                        ownPath = stack.GetOwnPath?.() ?? null;
                    } catch (err) {
                        logCatch("readSliceStackEntries.GetOwnPath failed", err);
                    }

                    const references = [];
                    const refCount = stack.GetSliceRefCount?.() ?? 0;
                    for (let i = 0; i < refCount; i += 1) {
                        const reference = stack.GetSliceStackReference?.(i);
                        if (!reference) continue;
                        try {
                            const refUuid = this.getUUIDSafe(reference);
                            references.push({
                                resourceId: reference.GetResourceID?.() ?? null,
                                uniqueResourceId: reference.GetUniqueResourceID?.() ?? null,
                                uuid: refUuid.uuid,
                                hasUUID: refUuid.hasUUID,
                            });
                        } finally {
                            safeDelete(reference);
                        }
                    }

                    const slices = [];
                    for (let i = 0; i < sliceCount; i += 1) {
                        const slice = stack.GetSlice?.(i);
                        if (!slice) continue;
                        try {
                        const zTopValue = slice.GetZTop?.();
                        const zTop = Number.isFinite(Number(zTopValue)) ? Number(zTopValue) : null;
                        const vertexCountValue = slice.GetVertexCount?.();
                        const vertexCount = Number.isFinite(Number(vertexCountValue)) ? Number(vertexCountValue) : 0;
                        const polygonCountValue = slice.GetPolygonCount?.();
                        const polygonCount = Number.isFinite(Number(polygonCountValue)) ? Number(polygonCountValue) : 0;
                            const vertices = [];
                            for (let v = 0; v < vertexCount; v += 1) {
                                const vertex = slice.GetVertex?.(v);
                                if (!vertex) continue;
                                try {
                                    const x = vertex.get_Coordinates0?.();
                                    const y = vertex.get_Coordinates1?.();
                                    vertices.push({
                                        x: Number.isFinite(x) ? x : 0,
                                        y: Number.isFinite(y) ? y : 0,
                                    });
                                } finally {
                                    safeDelete(vertex);
                                }
                            }

                        const polygonIndexCounts = [];
                        for (let p = 0; p < polygonCount; p += 1) {
                            const countValue = slice.GetPolygonIndexCount?.(p);
                            const count = Number.isFinite(Number(countValue)) ? Number(countValue) : null;
                            polygonIndexCounts.push(count);
                        }

                            slices.push({
                                index: i,
                                zTop,
                            vertexCount,
                            polygonCount,
                            vertices,
                            polygonIndexCounts,
                        });
                        } finally {
                            safeDelete(slice);
                        }
                    }

                    stacks.push({
                        resourceId,
                        uniqueResourceId,
                        uuid: uuidInfo.uuid,
                        hasUUID: uuidInfo.hasUUID,
                        bottomZ,
                        sliceCount,
                        ownPath,
                        references,
                        slices,
                    });
                } finally {
                    safeDelete(stack);
                }
            }
        } finally {
            safeDelete(iterator);
        }
        return stacks;
    }

    buildMaterialLookupMaps(baseGroups, colorGroups) {
        const baseLookup = new Map();
        const colorLookup = new Map();

        const register = (target, group, entries) => {
            if (!group || !entries) return;
            const byId = new Map();
            const ordered = [];
            entries.forEach((entry, index) => {
                if (!entry) return;
                const normalized = normalizePropertyId(entry.propertyId);
                const value = entry.color ?? entry.material ?? null;
                if (!value) return;
                if (normalized != null) {
                    byId.set(normalized, value);
                    ordered.push(normalized);
                } else {
                    const indexKey = entry.propertyIndex ?? index;
                    byId.set(indexKey, value);
                    ordered.push(indexKey);
                }
            });
            if (!byId.size) return;
            const uniqueOrdered = Array.from(new Set(ordered));
            const keys = [group.groupId, group.uniqueResourceId]
                .map((value) => (value === undefined || value === null ? null : String(value)))
                .filter(Boolean);
            keys.forEach((key) => target.set(key, { byId, ids: uniqueOrdered }));
        };

        baseGroups.forEach((group) => register(baseLookup, group, group.materials));
        colorGroups.forEach((group) => register(colorLookup, group, group.colors));

        return { baseLookup, colorLookup };
    }

    buildTextureLookupMaps(textureGroups) {
        const textureLookup = new Map();

        const register = (group) => {
            if (!group) return;
            // Map propertyID -> { u, v }
            const byId = new Map();
            const ordered = [];

            // group.coords is array of { propertyId, u, v }
            group.coords.forEach((entry) => {
                const normalized = normalizePropertyId(entry.propertyId);
                const uv = { u: entry.u, v: 1.0 - entry.v };

                if (normalized != null) {
                    byId.set(normalized, uv);
                    ordered.push(normalized);
                } else {
                    // fall back to index if no property ID? 
                    // ideally texture groups usually have property IDs
                    // checking existing readTexture2DGroupEntries logic...
                    // "coords" are populated there.
                }

                // If the group has explicit propertyIds array distinct from coords?
                // readTexture2DGroupEntries puts chosenId into ids[], and {propertyId, u, v} into coords[] matched by index.
            });

            // Re-reading readTexture2DGroupEntries:
            // It pushes to `ids` and `coords` in lock-step.
            // But `coords` has explicit objects.
            // Let's just use what we have in `coords`.

            // To support both (ID-based and Index-based) lookups efficiently:
            // We can just mirror what buildMaterialLookupMaps does.

            // group.coords is array of objects { propertyId, u, v } corresponding to 'ids' indices?
            // Actually readTexture2DGroupEntries implementation:
            // ids.push(chosenId);
            // coords.push({ propertyId: chosenId, u, v });
            // So they align 1:1.


            const keys = [group.groupId, group.uniqueResourceId]
                .map((value) => (value === undefined || value === null ? null : String(value)))
                .filter(Boolean);

            keys.forEach((key) => textureLookup.set(key, {
                byId,
                ids: group.propertyIds,
                textureId: group.textureId
            }));
        };

        textureGroups.forEach(register);
        return { textureLookup };
    }

    resolveMaterialColor(resourceId, propertyId, lookupMaps) {
        if (resourceId === undefined || resourceId === null) return null;
        if (propertyId === undefined || propertyId === null) return null;
        const key = String(resourceId);
        const { baseLookup, colorLookup } = lookupMaps;

        const fromGroup = (entry) => {
            if (!entry) return null;
            const { byId, ids } = entry;
            if (!byId || !ids) return null;

            const normalized = normalizePropertyId(propertyId);
            if (normalized != null && byId.has(normalized)) {
                return byId.get(normalized);
            }

            if (Number.isInteger(propertyId) && byId.has(propertyId)) {
                return byId.get(propertyId);
            }

            if (Number.isInteger(normalized) && normalized >= 0 && normalized < ids.length) {
                const pid = ids[normalized];
                if (byId.has(pid)) return byId.get(pid);
            }

            if (Number.isInteger(normalized) && normalized >= 1 && normalized <= ids.length) {
                const pid = ids[normalized - 1];
                if (byId.has(pid)) return byId.get(pid);
            }

            return null;
        };

        return fromGroup(baseLookup.get(key)) ?? fromGroup(colorLookup.get(key)) ?? null;
    }

    resolveTextureUV(resourceId, propertyId, textureLookup) {
        if (resourceId === undefined || resourceId === null) return null;
        if (propertyId === undefined || propertyId === null) return null;

        const key = String(resourceId);
        const entry = textureLookup.get(key);
        if (!entry) return null; // Not a texture group

        const { byId, ids, textureId } = entry;

        const normalized = normalizePropertyId(propertyId);
        let uv = null;

        if (normalized != null && byId.has(normalized)) {
            uv = byId.get(normalized);
        } else if (Number.isInteger(propertyId) && byId.has(propertyId)) {
            uv = byId.get(propertyId);
        } else if (Number.isInteger(normalized) && normalized >= 0 && normalized < ids.length) {
            const pid = ids[normalized];
            if (byId.has(pid)) uv = byId.get(pid);
        } else if (Number.isInteger(normalized) && normalized >= 1 && normalized <= ids.length) {
            const pid = ids[normalized - 1]; // 1-based fallback
            if (byId.has(pid)) uv = byId.get(pid);
        }

        return { uv, textureId };
    }

    // Map triangle p# → actual PropertyID depending on mode (ID-first vs index-first)
    coerceTrianglePid(resourceId, pid, lookupMaps) {
        const key = resourceId == null ? null : String(resourceId);
        if (!key) return pid;

        const entry =
            lookupMaps.baseLookup.get(key) ||
            lookupMaps.colorLookup.get(key);

        if (!entry) return pid;

        const byId = entry.byId;
        const ids = entry.ids || [];
        const n = toInt(pid);
        if (n == null) return pid;

        if (this.options?.interpretTrianglePidAsIndex === true) {
            // index-first (compat)
            if (n >= 0 && n < ids.length) return ids[n];       // 0-based
            if (n >= 1 && n <= ids.length) return ids[n - 1];  // 1-based fallback
            return pid;
        }

        // spec-first (ID-first). If not found, fall back to interpreting as index.
        if (byId?.has(n)) return n;
        if (n >= 0 && n < ids.length) return ids[n];
        if (n >= 1 && n <= ids.length) return ids[n - 1];
        return pid;
    }

    mapTriangleVertexColors(meshResource, lookupMaps) {
        const { triangleProperties, objectLevelProperty, triangleCount } = meshResource;
        const { baseLookup, colorLookup } = lookupMaps;
        const vertexColors = new Float32Array(triangleCount * 9);
        const stats = {
            triangleCount,
            groups: {},
        };
        let trianglesWithColor = 0;

        const usage = stats.groups;

        const registerUsage = (rid, groupType, colored, propertyIds) => {
            const key = rid === undefined || rid === null ? "None" : String(rid);
            const entry =
                usage[key] || {
                    groupType,
                    triangles: 0,
                    withColors: 0,
                    propertyIds: new Set(),
                    coloredPropertyIds: new Set(),
                };
            entry.groupType = groupType;
            entry.triangles += 1;
            if (Array.isArray(propertyIds)) {
                propertyIds.forEach((pid) => entry.propertyIds.add(normalizePropertyId(pid) ?? pid));
            }
            if (colored) {
                entry.withColors += 1;
                if (Array.isArray(propertyIds)) {
                    propertyIds.forEach((pid) => entry.coloredPropertyIds.add(normalizePropertyId(pid) ?? pid));
                }
            }
            usage[key] = entry;
        };

        const groupTypeOf = (rid) => {
            if (rid == null) return "None";
            const key = String(rid);
            if (baseLookup.has(key)) return "BaseMaterialGroup";
            if (colorLookup.has(key)) return "ColorGroup";
            return "Other";
        };

        const fallbackColor = meshResource.baseColor;
        const fallbackRGB = fallbackColor
            ? [fallbackColor.r, fallbackColor.g, fallbackColor.b]
            : [1, 1, 1];

        for (let tri = 0; tri < triangleCount; tri += 1) {
            const info = triangleProperties[tri] || null;
            let resourceId = info?.resourceId ?? null;
            let propertyIds = Array.isArray(info?.propertyIds) && info.propertyIds.length === 3
                ? info.propertyIds
                : null;

            if ((!propertyIds || resourceId == null) && objectLevelProperty?.ok) {
                resourceId = resourceId ?? objectLevelProperty.resourceId;
                if (!propertyIds) {
                    propertyIds = [
                        objectLevelProperty.propertyId,
                        objectLevelProperty.propertyId,
                        objectLevelProperty.propertyId,
                    ];
                }
            }

            // Coerce triangle PIDs to actual PropertyIDs if needed
            if (resourceId != null && propertyIds) {
                propertyIds = propertyIds.map(pid =>
                    this.coerceTrianglePid(resourceId, pid, lookupMaps)
                );
            }

            let resolvedColors = null;
            const type = groupTypeOf(resourceId);
            if (resourceId != null && (type === "BaseMaterialGroup" || type === "ColorGroup") && propertyIds) {
                resolvedColors = propertyIds.map((pid) =>
                    this.resolveMaterialColor(resourceId, pid, lookupMaps)
                );
            }

            const hasColor = Array.isArray(resolvedColors) && resolvedColors.some(Boolean);

            const offset = tri * 9;
            for (let v = 0; v < 3; v += 1) {
                const color = hasColor && resolvedColors?.[v] ? resolvedColors[v] : null;
                vertexColors[offset + v * 3 + 0] = color?.r ?? fallbackRGB[0];
                vertexColors[offset + v * 3 + 1] = color?.g ?? fallbackRGB[1];
                vertexColors[offset + v * 3 + 2] = color?.b ?? fallbackRGB[2];
            }

            registerUsage(resourceId, type, hasColor, propertyIds);
            if (hasColor) trianglesWithColor += 1;
        }

        const groups = {};
        Object.entries(usage).forEach(([key, entry]) => {
            groups[key] = {
                groupType: entry.groupType,
                triangles: entry.triangles,
                withColors: entry.withColors,
                propertyIds: Array.from(entry.propertyIds ?? []),
                propertyIdsWithColors: Array.from(entry.coloredPropertyIds ?? []),
            };
        });

        stats.trianglesWithColor = trianglesWithColor;
        stats.groups = groups;
        stats.referencedResourceIds = Object.keys(groups).filter((key) => key !== "None");
        stats.objectLevelProperty = meshResource.objectLevelProperty?.ok
            ? meshResource.objectLevelProperty
            : null;

        return {
            vertexColors: trianglesWithColor ? vertexColors : null,
            stats,
        };
    }


    mapTriangleTextureCoordinates(meshResource, textureLookup) {
        const { triangleProperties, objectLevelProperty, triangleCount } = meshResource;
        // Output: Float32Array (triangleCount * 3 * 2) -> [u1, v1, u2, v2, u3, v3, ...] per triangle
        const textureCoordinates = new Float32Array(triangleCount * 6);
        let trianglesWithTexture = 0;
        // We'll track which texture IDs are used. 
        // Ideally a mesh uses a single texture map, but 3MF allows per-triangle materials.
        // We'll optimistically look for a dominant texture ID. 
        // If there are multiple, things get complex (multi-material), we might just return the first one or a set.
        const usedTextureIds = new Set();

        for (let tri = 0; tri < triangleCount; tri += 1) {
            const info = triangleProperties[tri] || null;
            let resourceId = info?.resourceId ?? null;
            let propertyIds = Array.isArray(info?.propertyIds) && info.propertyIds.length === 3
                ? info.propertyIds
                : null;

            if ((!propertyIds || resourceId == null) && objectLevelProperty?.ok) {
                resourceId = resourceId ?? objectLevelProperty.resourceId;
                if (!propertyIds) {
                    propertyIds = [
                        objectLevelProperty.propertyId,
                        objectLevelProperty.propertyId,
                        objectLevelProperty.propertyId,
                    ];
                }
            }

            // Unlike colors, for textures, we specifically need the resourceId to match a Texture2DGroup
            if (resourceId == null || !propertyIds) continue;

            // Check if this resource ID is a texture group
            const key = String(resourceId);
            if (!textureLookup.has(key)) continue;

            // Note: coerceTrianglePid logic is for resolving the PropertyID (index vs ID)
            // We can duplicate that logic here or make it generic. 
            // Since we passed lookupMaps to coerceTrianglePid, we might need to handle it.
            // But textureLookup entries have 'ids' so we can probably trust resolveTextureUV to handle index lookup if we don't pre-coerce.
            // Actually resolveTextureUV logic above mirrors standard material lookup, so it tries index lookup too.

            const resolved = propertyIds.map(pid => this.resolveTextureUV(resourceId, pid, textureLookup));

            // Check if we got valid UVs
            if (resolved.every(r => r && r.uv)) {
                trianglesWithTexture++;
                resolved.forEach(r => {
                    if (r.textureId) usedTextureIds.add(r.textureId);
                });

                const offset = tri * 6;
                // v1
                textureCoordinates[offset + 0] = resolved[0].uv.u;
                textureCoordinates[offset + 1] = resolved[0].uv.v;
                // v2
                textureCoordinates[offset + 2] = resolved[1].uv.u;
                textureCoordinates[offset + 3] = resolved[1].uv.v;
                // v3
                textureCoordinates[offset + 4] = resolved[2].uv.u;
                textureCoordinates[offset + 5] = resolved[2].uv.v;
            }
        }

        return {
            textureCoordinates: trianglesWithTexture > 0 ? textureCoordinates : null,
            textureId: usedTextureIds.size === 1 ? usedTextureIds.values().next().value : null // Return single texture if unique
        };
    }

    getMeshSummary(meshObj) {
        if (!meshObj) {
            return {
                vertexCount: null,
                triangleCount: null,
                hasSlices: false,
                manifoldOriented: undefined,
                sliceStackId: null,
                sliceStackUuid: null,
                sliceStackHasUUID: false,
                sliceCount: null,
                sliceBottomZ: null,
                slicesMeshResolution: null,
                uuid: null,
                hasUUID: false,
            };
        }
        const vertexCount = meshObj.GetVertexCount?.() ?? null;
        const triangleCount = meshObj.GetTriangleCount?.() ?? null;
        const hasSlices = meshObj.HasSlices?.(false) ? true : false;
        const manifoldOriented = undefined;
        let sliceStackId = null;
        let sliceStackUuid = null;
        let sliceStackHasUUID = false;
        let sliceCount = null;
        let sliceBottomZ = null;
        let slicesMeshResolution = null;
        if (hasSlices) {
            try {
                const resolutionValue = meshObj.GetSlicesMeshResolution?.();
                if (resolutionValue !== undefined) {
                    slicesMeshResolution = this.describeSlicesMeshResolution(resolutionValue);
                }
            } catch (err) {
                logCatch("getMeshSummary.GetSlicesMeshResolution failed", err);
            }
            try {
                const sliceStack = meshObj.GetSliceStack?.();
                if (sliceStack) {
                    sliceStackId = sliceStack.GetResourceID?.() ?? null;
                    const sliceCountValue = sliceStack.GetSliceCount?.();
                    sliceCount = Number.isFinite(Number(sliceCountValue)) ? Number(sliceCountValue) : null;
                    const sliceBottomZValue = sliceStack.GetBottomZ?.();
                    sliceBottomZ = Number.isFinite(Number(sliceBottomZValue)) ? Number(sliceBottomZValue) : null;
                    const uuidInfo = this.getUUIDSafe(sliceStack);
                    sliceStackUuid = uuidInfo.uuid;
                    sliceStackHasUUID = uuidInfo.hasUUID;
                }
                safeDelete(sliceStack);
            } catch (err) {
                logCatch("getMeshSummary.GetSliceStack failed", err);
            }
        }
        const uuidInfo = this.getUUIDSafe(meshObj);
        return {
            vertexCount,
            triangleCount,
            hasSlices,
            manifoldOriented,
            sliceStackId,
            sliceStackUuid,
            sliceStackHasUUID,
            sliceCount,
            sliceBottomZ,
            slicesMeshResolution,
            uuid: uuidInfo.uuid,
            hasUUID: uuidInfo.hasUUID,
        };
    }

    describeModelUnit(value) {
        const code = Number(value);
        const units = this.lib.eModelUnit;
        switch (value) {
            case units?.MicroMeter:
                return { code, name: "MicroMeter", symbol: "um", toMeters: 1e-6 };
            case units?.MilliMeter:
                return { code, name: "MilliMeter", symbol: "mm", toMeters: 1e-3 };
            case units?.CentiMeter:
                return { code, name: "CentiMeter", symbol: "cm", toMeters: 1e-2 };
            case units?.Inch:
                return { code, name: "Inch", symbol: "in", toMeters: 0.0254 };
            case units?.Foot:
                return { code, name: "Foot", symbol: "ft", toMeters: 0.3048 };
            case units?.Meter:
                return { code, name: "Meter", symbol: "m", toMeters: 1 };
            default:
                return { code, name: "Unknown", symbol: "", toMeters: 1 };
        }
    }

    describeSlicesMeshResolution(value) {
        const code = Number(value);
        const resolution = this.lib.eSlicesMeshResolution;
        if (resolution?.Fullres !== undefined && value === resolution.Fullres) {
            return { code, name: "Fullres" };
        }
        if (resolution?.Lowres !== undefined && value === resolution.Lowres) {
            return { code, name: "Lowres" };
        }
        return { code, name: "Unknown" };
    }

    collectBuildItemMetadata(buildItem) {
        const entries = [];
        const group = buildItem?.GetMetaDataGroup?.();
        if (!group) return entries;
        try {
            const count = group.GetMetaDataCount?.() ?? 0;
            for (let i = 0; i < count; i += 1) {
                try {
                    const meta = group.GetMetaData?.(i);
                    if (!meta) continue;
                    entries.push({
                        key: meta.GetKey?.(),
                        value: meta.GetValue?.(),
                        name: meta.GetName?.(),
                        namespace: meta.GetNameSpace?.(),
                        type: meta.GetType?.(),
                        mustPreserve: !!meta.GetMustPreserve?.(),
                    });
                    safeDelete(meta);
                } catch (err) {
                    logCatch(`collectBuildItemMetadata.GetMetaData(${i}) failed`, err);
                }
            }
        } finally {
            safeDelete(group);
        }
        return entries;
    }

    readMeshGeometry(meshObj) {
        const vertexCount = meshObj.GetVertexCount?.() ?? 0;
        const triangleCount = meshObj.GetTriangleCount?.() ?? 0;
        if (!vertexCount || !triangleCount) {
            return null;
        }

        const positions = new Float32Array(vertexCount * 3);
        for (let i = 0; i < vertexCount; i += 1) {
            const vertex = meshObj.GetVertex(i);
            const offset = i * 3;
            positions[offset] = vertex.get_Coordinates0();
            positions[offset + 1] = vertex.get_Coordinates1();
            positions[offset + 2] = vertex.get_Coordinates2();
            safeDelete(vertex);
        }

        const indexArray =
            vertexCount > 65535
                ? new Uint32Array(triangleCount * 3)
                : new Uint16Array(triangleCount * 3);

        for (let t = 0; t < triangleCount; t += 1) {
            const triangle = meshObj.GetTriangle(t);
            const offset = t * 3;
            indexArray[offset] = triangle.get_Indices0();
            indexArray[offset + 1] = triangle.get_Indices1();
            indexArray[offset + 2] = triangle.get_Indices2();
            safeDelete(triangle);
        }

        const triangleProperties = [];
        for (let t = 0; t < triangleCount; t += 1) {
            const props = this.getTrianglePropertiesSafe(meshObj, t);
            triangleProperties.push(props ?? { resourceId: null, propertyIds: [0, 0, 0] });
        }

        return {
            positions,
            indices: indexArray,
            triangleProperties,
            vertexCount,
            triangleCount,
        };
    }

    readBeamLattice(meshObj) {
        let beamLattice = null;
        try {
            beamLattice = meshObj.BeamLattice?.();
        } catch (err) {
            logCatch("readBeamLattice.BeamLattice() failed", err);
            return null;
        }
        if (!beamLattice) return null;

        try {
            const beamCount = beamLattice.GetBeamCount?.() ?? 0;
            if (beamCount === 0) {
                safeDelete(beamLattice);
                return null;
            }

            const beams = [];
            for (let i = 0; i < beamCount; i++) {
                try {
                    const beam = beamLattice.GetBeam?.(i);
                    if (beam) {
                        beams.push({
                            indices: [beam.get_Indices0?.() ?? 0, beam.get_Indices1?.() ?? 0],
                            radii: [beam.get_Radii0?.() ?? 1, beam.get_Radii1?.() ?? 1],
                            capModes: [beam.get_CapModes0?.() ?? 0, beam.get_CapModes1?.() ?? 0],
                        });
                        safeDelete(beam);
                    }
                } catch (err) {
                    logCatch(`readBeamLattice.GetBeam(${i}) failed`, err);
                }
            }

            // Get ball options to determine if we should auto-generate balls
            let defaultBallRadius = 0;
            try {
                const ballOptions = beamLattice.GetBallOptions?.();
                if (ballOptions) {
                    defaultBallRadius = ballOptions.BallRadius ?? 0;
                }
            } catch (err) {
                logCatch("readBeamLattice.GetBallOptions failed", err);
            }

            const balls = [];
            const ballCount = beamLattice.GetBallCount?.() ?? 0;
            for (let i = 0; i < ballCount; i++) {
                try {
                    const ball = beamLattice.GetBall?.(i);
                    if (ball) {
                        balls.push({
                            index: ball.get_Index?.() ?? 0,
                            radius: ball.get_Radius?.() ?? defaultBallRadius,
                        });
                        safeDelete(ball);
                    }
                } catch (err) {
                    logCatch(`readBeamLattice.GetBall(${i}) failed`, err);
                }
            }

            // Auto-generate balls at all beam nodes for visual effect
            // Calculate average radius at each node from connected beams
            const nodeRadii = new Map(); // nodeIndex -> [radii]
            for (const beam of beams) {
                const idx0 = beam.indices[0];
                const idx1 = beam.indices[1];
                if (!nodeRadii.has(idx0)) nodeRadii.set(idx0, []);
                if (!nodeRadii.has(idx1)) nodeRadii.set(idx1, []);
                nodeRadii.get(idx0).push(beam.radii[0]);
                nodeRadii.get(idx1).push(beam.radii[1]);
            }

            // Add balls at nodes that don't already have explicit balls
            const existingBallNodes = new Set(balls.map(b => b.index));
            for (const [nodeIndex, radii] of nodeRadii) {
                if (!existingBallNodes.has(nodeIndex)) {
                    // Use average radius of connected beams, larger for visual effect to cover intersections
                    const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
                    balls.push({
                        index: nodeIndex,
                        radius: avgRadius * 1.5, // 50% larger than beam radius to cover intersections
                    });
                }
            }

            const minLength = beamLattice.GetMinLength?.() ?? 0;

            safeDelete(beamLattice);

            if (beams.length === 0) return null;

            return {
                beams,
                balls,
                minLength,
                beamCount: beams.length,
                ballCount: balls.length,
            };
        } catch (err) {
            logCatch("readBeamLattice failed", err);
            safeDelete(beamLattice);
            return null;
        }
    }

    generateBeamGeometry(beamLattice, vertexPositions, options = {}) {
        const segments = Number.isFinite(options.segments) ? Math.max(3, Math.floor(options.segments)) : 4;
        const includeCaps = options.includeCaps !== false;
        const includeBalls = options.includeBalls !== false;
        const { beams, balls } = beamLattice;
        if (!beams || beams.length === 0) return null;

        const getVertex = (index) => {
            const offset = index * 3;
            return {
                x: vertexPositions[offset],
                y: vertexPositions[offset + 1],
                z: vertexPositions[offset + 2],
            };
        };

        const normalize = (v) => {
            const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
            if (len < 1e-10) return { x: 0, y: 1, z: 0 };
            return { x: v.x / len, y: v.y / len, z: v.z / len };
        };

        const cross = (a, b) => ({
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x,
        });

        const findPerpendicular = (v) => {
            const absX = Math.abs(v.x), absY = Math.abs(v.y), absZ = Math.abs(v.z);
            let other;
            if (absX <= absY && absX <= absZ) {
                other = { x: 1, y: 0, z: 0 };
            } else if (absY <= absZ) {
                other = { x: 0, y: 1, z: 0 };
            } else {
                other = { x: 0, y: 0, z: 1 };
            }
            return normalize(cross(v, other));
        };

        // Calculate total triangles needed
        // Tube sides: segments * 2 triangles, plus end caps: segments * 2 triangles (one per end)
        const trianglesPerBeam = segments * 2 + (includeCaps ? segments * 2 : 0); // Sides + optional caps
        const trianglesPerBall = includeBalls ? segments * (segments / 2) * 2 : 0; // Simplified sphere
        const totalBeamTriangles = beams.length * trianglesPerBeam;
        const totalBallTriangles = includeBalls ? (balls?.length ?? 0) * trianglesPerBall : 0;
        const totalTriangles = totalBeamTriangles + totalBallTriangles;
        const totalVertices = totalTriangles * 3;

        const positions = new Float32Array(totalVertices * 3);
        let posIdx = 0;

        const writeVertex = (x, y, z) => {
            positions[posIdx++] = x;
            positions[posIdx++] = y;
            positions[posIdx++] = z;
        };

        // Generate beam cylinders with end caps
        for (const beam of beams) {
            const p0 = getVertex(beam.indices[0]);
            const p1 = getVertex(beam.indices[1]);
            const r0 = beam.radii[0];
            const r1 = beam.radii[1];

            const axis = normalize({
                x: p1.x - p0.x,
                y: p1.y - p0.y,
                z: p1.z - p0.z,
            });
            const perp1 = findPerpendicular(axis);
            const perp2 = cross(axis, perp1);

            const ring0 = [];
            const ring1 = [];
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                ring0.push({
                    x: p0.x + (perp1.x * cos + perp2.x * sin) * r0,
                    y: p0.y + (perp1.y * cos + perp2.y * sin) * r0,
                    z: p0.z + (perp1.z * cos + perp2.z * sin) * r0,
                });
                ring1.push({
                    x: p1.x + (perp1.x * cos + perp2.x * sin) * r1,
                    y: p1.y + (perp1.y * cos + perp2.y * sin) * r1,
                    z: p1.z + (perp1.z * cos + perp2.z * sin) * r1,
                });
            }

            // Generate tube sides
            for (let i = 0; i < segments; i++) {
                const next = (i + 1) % segments;
                const v0 = ring0[i], v1 = ring1[i], v2 = ring0[next], v3 = ring1[next];
                writeVertex(v0.x, v0.y, v0.z);
                writeVertex(v1.x, v1.y, v1.z);
                writeVertex(v2.x, v2.y, v2.z);
                writeVertex(v2.x, v2.y, v2.z);
                writeVertex(v1.x, v1.y, v1.z);
                writeVertex(v3.x, v3.y, v3.z);
            }

            if (includeCaps) {
                // Generate end caps (triangle fans from center to ring)
                // Cap at p0 end
                for (let i = 0; i < segments; i++) {
                    const next = (i + 1) % segments;
                    writeVertex(p0.x, p0.y, p0.z);
                    writeVertex(ring0[next].x, ring0[next].y, ring0[next].z);
                    writeVertex(ring0[i].x, ring0[i].y, ring0[i].z);
                }
                // Cap at p1 end
                for (let i = 0; i < segments; i++) {
                    const next = (i + 1) % segments;
                    writeVertex(p1.x, p1.y, p1.z);
                    writeVertex(ring1[i].x, ring1[i].y, ring1[i].z);
                    writeVertex(ring1[next].x, ring1[next].y, ring1[next].z);
                }
            }
        }

        // Generate simplified balls (low-poly spheres)
        if (includeBalls && balls && balls.length > 0) {
            const latSegments = segments / 2;
            const lonSegments = segments;
            for (const ball of balls) {
                const center = getVertex(ball.index);
                const radius = ball.radius;
                for (let lat = 0; lat < latSegments; lat++) {
                    const theta0 = (lat / latSegments) * Math.PI;
                    const theta1 = ((lat + 1) / latSegments) * Math.PI;
                    const sinT0 = Math.sin(theta0), cosT0 = Math.cos(theta0);
                    const sinT1 = Math.sin(theta1), cosT1 = Math.cos(theta1);
                    for (let lon = 0; lon < lonSegments; lon++) {
                        const phi0 = (lon / lonSegments) * Math.PI * 2;
                        const phi1 = ((lon + 1) / lonSegments) * Math.PI * 2;
                        const sinP0 = Math.sin(phi0), cosP0 = Math.cos(phi0);
                        const sinP1 = Math.sin(phi1), cosP1 = Math.cos(phi1);
                        const p00 = {
                            x: center.x + radius * sinT0 * cosP0,
                            y: center.y + radius * sinT0 * sinP0,
                            z: center.z + radius * cosT0,
                        };
                        const p01 = {
                            x: center.x + radius * sinT0 * cosP1,
                            y: center.y + radius * sinT0 * sinP1,
                            z: center.z + radius * cosT0,
                        };
                        const p10 = {
                            x: center.x + radius * sinT1 * cosP0,
                            y: center.y + radius * sinT1 * sinP0,
                            z: center.z + radius * cosT1,
                        };
                        const p11 = {
                            x: center.x + radius * sinT1 * cosP1,
                            y: center.y + radius * sinT1 * sinP1,
                            z: center.z + radius * cosT1,
                        };
                        writeVertex(p00.x, p00.y, p00.z);
                        writeVertex(p10.x, p10.y, p10.z);
                        writeVertex(p01.x, p01.y, p01.z);
                        writeVertex(p01.x, p01.y, p01.z);
                        writeVertex(p10.x, p10.y, p10.z);
                        writeVertex(p11.x, p11.y, p11.z);
                    }
                }
            }
        }

        const triangleCount = posIdx / 9;
        return {
            positions,
            triangleCount,
            vertexCount: triangleCount * 3,
        };
    }

    loadFromBuffer(arrayBuffer, fileName, options = {}) {
        // merge options into instance
        this.options = { ...(this.options || {}), ...(options || {}) };

        const lib = this.lib;
        const wrapper = new lib.CWrapper();
        const model = wrapper.CreateModel();
        const reader = model.QueryReader("3mf");

        const id = Date.now().toString(36);
        const virtualInput = `/input_${id}.3mf`;
        lib.FS.writeFile(virtualInput, new Uint8Array(arrayBuffer));

        const diagnostics = {
            nonStrict: { warnings: [], errors: [] },
            strict: { warnings: [], errors: [] },
        };

        let objectIterator;
        let buildItemIterator;
        let strictModel;
        let strictReader;

        try {
            try {
                reader.SetStrictModeActive?.(false);
            } catch (err) {
                logCatch("loadFromBuffer.SetStrictModeActive(false) failed", err);
            }

            let readError = null;
            try {
                reader.ReadFromFile(virtualInput);
            } catch (err) {
                diagnostics.nonStrict.errors.push({ kind: "exception", message: err?.message || String(err) });
                readError = err;
            }

            const nonStrictReaderError = this.getLastErrorString(reader, wrapper);
            if (nonStrictReaderError) {
                diagnostics.nonStrict.errors.push({ kind: "readerLastError", message: nonStrictReaderError });
            }
            const nonStrictModelError = this.getLastErrorString(model, wrapper);
            if (nonStrictModelError) {
                diagnostics.nonStrict.errors.push({ kind: "modelLastError", message: nonStrictModelError });
            }
            diagnostics.nonStrict.warnings = this.collectWarnings(reader);

            strictModel = wrapper.CreateModel();
            strictReader = strictModel.QueryReader("3mf");
            try {
                strictReader.SetStrictModeActive?.(true);
            } catch (err) {
                logCatch("loadFromBuffer.SetStrictModeActive(true) failed", err);
            }
            try {
                strictReader.ReadFromFile(virtualInput);
            } catch (err) {
                diagnostics.strict.errors.push({ kind: "exception", message: err?.message || String(err) });
            }
            const strictReaderError = this.getLastErrorString(strictReader, wrapper);
            if (strictReaderError) {
                diagnostics.strict.errors.push({ kind: "readerLastError", message: strictReaderError });
            }
            const strictModelError = this.getLastErrorString(strictModel, wrapper);
            if (strictModelError) {
                diagnostics.strict.errors.push({ kind: "modelLastError", message: strictModelError });
            }
            diagnostics.strict.warnings = this.collectWarnings(strictReader);

            if (readError) {
                throw readError;
            }

            const meshResources = new Map();
            const componentResources = new Map();

            objectIterator = model.GetObjects();
            while (objectIterator?.MoveNext?.()) {
                const current = objectIterator.GetCurrentObject?.();
                if (!current) continue;
                const resourceId = current.GetResourceID?.();
                const resourceUuidInfo = this.getUUIDSafe(current);
                const resourceUuid = resourceUuidInfo.uuid;
                const resourceHasUUID = resourceUuidInfo.hasUUID;
                const uniqueResourceId = current.GetUniqueResourceID?.();
                try {
                    if (current.IsMeshObject?.()) {
                        if (resourceId !== undefined && meshResources.has(resourceId)) {
                            safeDelete(current);
                            continue;
                        }

                        const vertexCount = current.GetVertexCount?.() ?? 0;
                        const triangleCount = current.GetTriangleCount?.() ?? 0;

                        let geometryInfo = null;
                        let beamLatticeInfo = null;
                        let isBeamLattice = false;

                        if (triangleCount > 0) {
                            geometryInfo = this.readMeshGeometry(current);
                        }

                        if (!geometryInfo && vertexCount > 0) {
                            const nodePositions = new Float32Array(vertexCount * 3);
                            for (let i = 0; i < vertexCount; i += 1) {
                                const vertex = current.GetVertex(i);
                                const offset = i * 3;
                                nodePositions[offset] = vertex.get_Coordinates0();
                                nodePositions[offset + 1] = vertex.get_Coordinates1();
                                nodePositions[offset + 2] = vertex.get_Coordinates2();
                                safeDelete(vertex);
                            }

                            beamLatticeInfo = this.readBeamLattice(current);
                            if (beamLatticeInfo) {
                                const linesOnly = this.options?.beamLatticeLinesOnly === true;
                                if (linesOnly) {
                                    isBeamLattice = true;
                                    geometryInfo = {
                                        positions: new Float32Array(0),
                                        indices: null,
                                        triangleProperties: [],
                                        vertexCount: 0,
                                        triangleCount: 0,
                                        isBeamLattice: true,
                                        beamLattice: beamLatticeInfo,
                                        nodePositions,
                                    };
                                } else {
                                    const beamGeometry = this.generateBeamGeometry(beamLatticeInfo, nodePositions, {
                                        segments: 3,
                                        includeCaps: false,
                                        includeBalls: false,
                                    });
                                    if (beamGeometry && beamGeometry.triangleCount > 0) {
                                        isBeamLattice = true;
                                        geometryInfo = {
                                            positions: beamGeometry.positions,
                                            indices: null,
                                            triangleProperties: [],
                                            vertexCount: beamGeometry.vertexCount,
                                            triangleCount: beamGeometry.triangleCount,
                                            isBeamLattice: true,
                                            beamLattice: beamLatticeInfo,
                                            nodePositions,
                                        };
                                    }
                                }
                            }
                        }

                        if (!geometryInfo) {
                            safeDelete(current);
                            continue;
                        }

                        const paletteColor = isBeamLattice
                            ? { r: 0.6, g: 0.6, b: 0.6, a: 1 }
                            : { r: 0.223, g: 0.741, b: 0.974, a: 1 };
                        let rawName = null;
                        try {
                            rawName = typeof current.GetName === "function" ? current.GetName() : null;
                        } catch (err) {
                            logCatch("loadFromBuffer.GetName for mesh object failed", err);
                            rawName = null;
                        }
                        const trimmedName = rawName?.trim?.() || "";
                        // Check if name is meaningful (not just underscores/numbers like "_1")
                        const isMeaningfulName = trimmedName.length > 0 && !/^[_\-\d\s]+$/.test(trimmedName);
                        const displayName = isMeaningfulName
                            ? trimmedName
                            : isBeamLattice
                                ? `Beam Lattice ${resourceId ?? meshResources.size + 1}`
                                : `Mesh ${resourceId ?? meshResources.size + 1}`;
                        const meshSummary = this.getMeshSummary(current);

                        meshResources.set(resourceId, {
                            resourceId,
                            uniqueResourceId,
                            displayName,
                            name: rawName,
                            positions: geometryInfo.positions,
                            indices: geometryInfo.indices,
                            triangleProperties: geometryInfo.triangleProperties,
                            objectLevelProperty: this.getObjectLevelPropertySafe(current),
                            baseColor: paletteColor,
                            vertexCount: geometryInfo.vertexCount,
                            triangleCount: geometryInfo.triangleCount,
                            meshSummary,
                            uuid: resourceUuid,
                            hasUUID: resourceHasUUID,
                            isBeamLattice,
                            beamLattice: beamLatticeInfo,
                            nodePositions: geometryInfo.nodePositions ?? null,
                        });
                    } else if (current.IsComponentsObject?.()) {
                        if (resourceId !== undefined && componentResources.has(resourceId)) {
                            safeDelete(current);
                            continue;
                        }
                        const componentCount = current.GetComponentCount?.() ?? 0;
                        const components = [];
                        let rawName = null;
                        try {
                            rawName = typeof current.GetName === "function" ? current.GetName() : null;
                        } catch (err) {
                            logCatch("loadFromBuffer.GetName for component object failed", err);
                            rawName = null;
                        }
                        for (let c = 0; c < componentCount; c += 1) {
                            const component = current.GetComponent?.(c);
                            if (!component) continue;
                            try {
                                const targetId = component.GetObjectResourceID?.();
                                const hasTransform = component.HasTransform?.() ? component.HasTransform() : false;
                                const transformStruct = hasTransform ? component.GetTransform?.() : null;
                                const transform43 = hasTransform ? this.readTransform3mf(transformStruct) : null;
                                safeDelete(transformStruct);
                                const componentUuidInfo = this.getUUIDSafe(component);
                                components.push({
                                    index: c,
                                    targetId,
                                    hasTransform: !!hasTransform,
                                    transform4x3: transform43,
                                    uuid: componentUuidInfo.uuid,
                                    hasUUID: componentUuidInfo.hasUUID,
                                });
                            } finally {
                                safeDelete(component);
                            }
                        }
                        const displayName = rawName && rawName.length
                            ? rawName
                            : `Component ${resourceId ?? componentResources.size + 1}`;
                        componentResources.set(resourceId, {
                            resourceId,
                            uniqueResourceId,
                            displayName,
                            name: rawName,
                            components,
                            uuid: resourceUuid,
                            hasUUID: resourceHasUUID,
                        });
                    }
                } finally {
                    safeDelete(current);
                }
            }
            safeDelete(objectIterator);
            objectIterator = null;

            if (!meshResources.size && !componentResources.size) {
                throw new Error("No renderable objects found in 3MF file.");
            }

            const baseMaterialGroups = [];
            const baseGroupIterator = model.GetBaseMaterialGroups?.();
            if (baseGroupIterator) {
                while (baseGroupIterator.MoveNext()) {
                    const baseGroup = baseGroupIterator.GetCurrentBaseMaterialGroup();
                    try {
                        const groupId = baseGroup.GetResourceID?.();
                        const uniqueResourceId = baseGroup.GetUniqueResourceID?.();
                        const uuidInfo = this.getUUIDSafe(baseGroup);
                        const materials = this.readBaseMaterialEntries(baseGroup);
                        const count = baseGroup.GetCount?.() ?? materials.length;
                        baseMaterialGroups.push({
                            groupId,
                            uniqueResourceId,
                            uuid: uuidInfo.uuid,
                            hasUUID: uuidInfo.hasUUID,
                            count,
                            materials,
                        });
                    } finally {
                        safeDelete(baseGroup);
                    }
                }
                safeDelete(baseGroupIterator);
            }

            const colorGroups = [];
            const colorGroupIterator = model.GetColorGroups?.();
            if (colorGroupIterator) {
                while (colorGroupIterator.MoveNext()) {
                    const colorGroup = colorGroupIterator.GetCurrentColorGroup();
                    try {
                        const groupId = colorGroup.GetResourceID?.();
                        const uniqueResourceId = colorGroup.GetUniqueResourceID?.();
                        const uuidInfo = this.getUUIDSafe(colorGroup);
                        const colors = this.readColorGroupEntries(colorGroup);
                        const count = colorGroup.GetCount?.() ?? colors.length;
                        colorGroups.push({
                            groupId,
                            uniqueResourceId,
                            uuid: uuidInfo.uuid,
                            hasUUID: uuidInfo.hasUUID,
                            count,
                            colors,
                        });
                    } finally {
                        safeDelete(colorGroup);
                    }
                }
                safeDelete(colorGroupIterator);
            }

            const texture2Ds = this.readTexture2DEntries(model);
            const texture2DGroups = this.readTexture2DGroupEntries(model);
            const sliceStacks = this.readSliceStackEntries(model);
            const hasTextures = texture2DGroups.length > 0 && texture2Ds.length > 0;

            const lookupMaps = this.buildMaterialLookupMaps(baseMaterialGroups, colorGroups);
            const { textureLookup } = this.buildTextureLookupMaps(texture2DGroups);

            const meshResourcesArray = [];

            meshResources.forEach((resource) => {
                const colorData = this.mapTriangleVertexColors(resource, lookupMaps);
                resource.vertexColors = colorData.vertexColors;
                resource.materialColorStats = colorData.stats;
                resource.usesVertexColors = colorData.stats.trianglesWithColor > 0;

                if (hasTextures) {
                    const textureData = this.mapTriangleTextureCoordinates(resource, textureLookup);
                    resource.textureCoordinates = textureData.textureCoordinates;
                    resource.textureId = textureData.textureId; // Main texture ID if unique
                }

                if (!hasTextures && !resource.usesVertexColors) {
                    // Clean up if we didn't end up using triangle properties? 
                    // Original code deleted it if !hasTextures.
                    // Now we only delete if we really don't need it. 
                    // But let's stick to keeping it if it might be useful for debugging or future features unless memory is huge issue.
                    // Original: if (!hasTextures) { delete resource.triangleProperties; }
                }
                if (!hasTextures && !resource.textureCoordinates) {
                    delete resource.triangleProperties;
                }

                meshResourcesArray.push(resource);
            });

            const componentResourcesArray = Array.from(componentResources.values());

            const unit = this.describeModelUnit(model.GetUnit?.());
            const modelUuidInfo = this.getUUIDSafe(model);

            const specificationInputs = (() => {
                const raw = this.options?.specificationUrls ?? this.options?.specificationUrl;
                if (Array.isArray(raw)) {
                    const list = raw
                        .map((url) => (typeof url === "string" ? url.trim() : ""))
                        .filter(Boolean);
                    if (list.length) return list;
                } else if (typeof raw === "string" && raw.trim().length) {
                    return [raw.trim()];
                }
                return [SPECIFICATION_URL];
            })();

            const specifications = specificationInputs.map((url) => {
                const specData = {
                    url,
                    supported: false,
                    major: null,
                    minor: null,
                    micro: null,
                };
                try {
                    const spec = wrapper.GetSpecificationVersion(url);
                    if (spec && typeof spec === "object") {
                        const supportedValue =
                            spec.IsSupported ??
                            spec.isSupported ??
                            spec.Supported ??
                            spec.supported ??
                            false;
                        specData.supported = !!supportedValue;
                        if (spec.Major !== undefined) specData.major = Number(spec.Major);
                        if (spec.Minor !== undefined) specData.minor = Number(spec.Minor);
                        if (spec.Micro !== undefined) specData.micro = Number(spec.Micro);
                    }
                } catch (err) {
                    logCatch(`loadFromBuffer.GetSpecificationVersion(${url}) failed`, err);
                    specData.supported = false;
                }
                return specData;
            });

            const versionInfo = wrapper.GetLibraryVersion();
            const lib3mfVersion = `${versionInfo.Major}.${versionInfo.Minor}.${versionInfo.Micro}`;

            buildItemIterator = model.GetBuildItems?.();
            const items = [];
            let buildItemCount = 0;

            if (buildItemIterator) {
                while (buildItemIterator.MoveNext()) {
                    const buildItem = buildItemIterator.GetCurrent?.();
                    if (!buildItem) continue;
                    const index = buildItemCount;
                    buildItemCount += 1;

                    const metadataEntries = this.collectBuildItemMetadata(buildItem);
                    const hasTransform = buildItem.HasTransform?.() ? buildItem.HasTransform() : false;
                    const transformStruct = hasTransform ? buildItem.GetTransform?.() : null;
                    const transform43 = hasTransform ? this.readTransform3mf(transformStruct) : null;
                    safeDelete(transformStruct);
                    const buildItemUuidInfo = this.getUUIDSafe(buildItem);
                    const buildItemUuid = buildItemUuidInfo.uuid;

                    let resourceId = null;
                    let type = "unknown";
                    let meshSummary = null;
                    let componentDetails = null;
                    let uniqueResourceId = null;
                    let objectUuid = null;
                    let objectHasUUID = false;

                    const objectResource = buildItem.GetObjectResource?.();
                    try {
                        resourceId = objectResource?.GetResourceID?.();
                        uniqueResourceId = objectResource?.GetUniqueResourceID?.();
                        const objectUuidInfo = this.getUUIDSafe(objectResource);
                        objectUuid = objectUuidInfo.uuid;
                        objectHasUUID = objectUuidInfo.hasUUID;
                        if (resourceId !== undefined && resourceId !== null) {
                            if (meshResources.has(resourceId)) {
                                type = "mesh";
                                const resource = meshResources.get(resourceId);
                                meshSummary = resource?.meshSummary || this.getMeshSummary(objectResource);
                            } else if (componentResources.has(resourceId)) {
                                type = "components";
                                const resource = componentResources.get(resourceId);
                                componentDetails = resource?.components || null;
                            }
                        }

                        if (type === "unknown") {
                            if (objectResource?.IsMeshObject?.()) {
                                type = "mesh";
                                meshSummary = this.getMeshSummary(objectResource);
                            } else if (objectResource?.IsComponentsObject?.()) {
                                type = "components";
                                if (componentResources.has(resourceId)) {
                                    componentDetails = componentResources.get(resourceId).components;
                                }
                            }
                        }
                    } finally {
                        safeDelete(objectResource);
                    }

                    items.push({
                        index,
                        type,
                        resourceId,
                        uniqueResourceId,
                        objectUUID: objectUuid,
                        objectHasUUID,
                        metadata: metadataEntries,
                        transform: transform43,
                        mesh: meshSummary,
                        components: componentDetails,
                        uuid: buildItemUuid,
                        hasUUID: buildItemUuidInfo.hasUUID,
                    });

                    safeDelete(buildItem);
                }
                safeDelete(buildItemIterator);
                buildItemIterator = null;
            }

            const counts = {
                buildItems: buildItemCount,
                meshResources: meshResources.size,
                meshes: meshResourcesArray.length,
                components: items.filter((item) => item.type === "components").length,
                sliceStacks: sliceStacks.length,
            };

            const primarySpecification = specifications[0] ?? null;

            // --- FLATTEN GEOMETRY ---
            // We now flatten the geometry on the worker thread to avoid heavy lifting in the loader.
            // 1. Calculate total size
            const countTriangles = (resourceId, visited = new Set()) => {
                if (meshResources.has(resourceId)) {
                    return meshResources.get(resourceId).triangleCount ?? 0;
                }
                if (componentResources.has(resourceId)) {
                    if (visited.has(resourceId)) return 0; // cycle
                    visited.add(resourceId);
                    const res = componentResources.get(resourceId);
                    let total = 0;
                    if (res && res.components) {
                        for (const comp of res.components) {
                            total += countTriangles(comp.targetId, visited);
                        }
                    }
                    visited.delete(resourceId);
                    return total;
                }
                return 0;
            };

            let totalTriangles = 0;
            items.forEach(item => {
                totalTriangles += countTriangles(item.resourceId);
            });

            const totalVertices = totalTriangles * 3;

            // Allocate buffers
            const flatPosition = new Float32Array(totalVertices * 3);
            const flatColor = new Float32Array(totalVertices * 3);
            const flatUV = new Float32Array(totalVertices * 2);
            const flatResourceId = new Float32Array(totalVertices); // Resource ID per vertex for visibility toggling
            const beamLinePositions = [];
            const beamLineResourceIds = [];
            const beamLineRadii = [];

            // Material/Group tracking
            // We want to group by Texture ID / Material configuration to minimize draw calls in THREE.
            // But flattening implies one big geometry. We can use `geometry.groups`.
            // We need to collect "Draw Tasks" first, then write them to buffer sequentially to keep groups contiguous.

            const drawTasks = []; // { resource, matrix, textureId }

            const collectDrawTasks = (resourceId, matrix, visited = new Set()) => {
                if (meshResources.has(resourceId)) {
                    const resource = meshResources.get(resourceId);
                    // Determine texture ID
                    let textureId = resource.textureId ?? null;
                    if (!textureId && resource.objectLevelProperty?.ok) {
                        // Check if object property points to a texture group
                        const objProp = resource.objectLevelProperty;
                        // textureLookup keys are strings
                        const key = String(objProp.resourceId);
                        if (textureLookup.has(key)) {
                            textureId = textureLookup.get(key).textureId;
                        }
                    }

                    drawTasks.push({
                        resource,
                        matrix,
                        textureId: textureId ?? null
                    });
                    return;
                }
                if (componentResources.has(resourceId)) {
                    if (visited.has(resourceId)) return;
                    visited.add(resourceId);
                    const res = componentResources.get(resourceId);
                    if (res && res.components) {
                        for (const comp of res.components) {
                            const localMat = comp.transform4x3 ? mat4From3mf(comp.transform4x3) : mat4Identity();
                            // THREE: parent * child. 
                            // Here 'matrix' is parent transform (accumulated). 'localMat' is child.
                            // So we want: result = matrix * localMat.
                            // My mat4Multiply(a, b) calculates b * a (standard OpenGL logic? No wait check implementation).
                            // Implementation above: out = b * a. (b transforms a).
                            // If I want parent * child, I should do mat4Multiply(child, parent).
                            // Let's verify: 
                            // v_world = M_parent * v_local
                            // v_local = M_child * v_original
                            // v_world = M_parent * M_child * v_original
                            // So combined = M_parent * M_child.
                            // If mat4Multiply(a, b) computes b * a ...
                            // Then I want mat4Multiply(M_child, M_parent) -> M_parent * M_child.
                            // Correct.
                            collectDrawTasks(comp.targetId, mat4Multiply(localMat, matrix), visited);
                        }
                    }
                    visited.delete(resourceId);
                }
            };

            items.forEach(item => {
                const itemMat = item.transform ? mat4From3mf(item.transform) : mat4Identity();
                collectDrawTasks(item.resourceId, itemMat);
            });

            // Sort tasks by texture ID to form contiguous groups
            drawTasks.sort((a, b) => {
                const ta = a.textureId ?? -1;
                const tb = b.textureId ?? -1;
                if (ta === tb) return 0;
                // Put untextured (-1) first or last? Let's say first.
                // -1 < 5.
                if (ta === -1) return -1;
                if (tb === -1) return 1;
                return ta < tb ? -1 : 1;
            });

            let vertexCursor = 0;
            const groups = [];
            let currentTextureId = undefined;
            let groupStart = 0;
            let groupCount = 0;

            const startGroup = (tid) => {
                if (groupCount > 0) {
                    groups.push({
                        start: groupStart,
                        count: groupCount,
                        materialIndex: 0, // Assigned later by loader based on textureId
                        textureId: currentTextureId
                    });
                }
                currentTextureId = tid;
                groupStart = vertexCursor;
                groupCount = 0;
            };

            // Prefill unused with white/opaque
            flatColor.fill(1.0);

            for (const task of drawTasks) {
                const { resource, matrix, textureId } = task;

                if (textureId !== currentTextureId) {
                    startGroup(textureId);
                }

                // Append geometry
                const { positions: posSrc, indices, vertexColors, textureCoordinates } = resource;
                const triCount = resource.triangleCount;

                // Helper to resolve colors/uvs per triangle if not pre-calculated (some pre-calc done in readMeshGeometry)
                // Actually readMeshGeometry puts everything in vertexColors (Float32Array) and textureCoordinates (Float32Array).
                // They are already expanded to triangles (triCount * 3 vertices).
                // So we can just copy them if they exist!

                // EXCEPT: vertexColors in meshResource might be null if no colors.
                // textureCoordinates might be null if no textures.

                const hasVC = !!vertexColors;
                const hasUV = !!textureCoordinates;
                const fallbackColor = resource.baseColor || { r: 1, g: 1, b: 1 };
                const isBeamLattice = resource.isBeamLattice === true;
                if (isBeamLattice && resource.beamLattice?.beams && resource.nodePositions) {
                    const nodePositions = resource.nodePositions;
                    const getNode = (index) => {
                        const offset = index * 3;
                        return {
                            x: nodePositions[offset],
                            y: nodePositions[offset + 1],
                            z: nodePositions[offset + 2],
                        };
                    };
                    for (const beam of resource.beamLattice.beams) {
                        const p0 = getNode(beam.indices[0]);
                        const p1 = getNode(beam.indices[1]);
                        const tp0 = applyMat4ToPoint(matrix, p0.x, p0.y, p0.z);
                        const tp1 = applyMat4ToPoint(matrix, p1.x, p1.y, p1.z);
                        beamLinePositions.push(
                            tp0.x, tp0.y, tp0.z,
                            tp1.x, tp1.y, tp1.z
                        );
                        const resId = resource.resourceId ?? 0;
                        beamLineResourceIds.push(resId, resId);
                        const avgRadius = (beam.radii[0] + beam.radii[1]) * 0.5;
                        beamLineRadii.push(avgRadius);
                    }
                }

                for (let t = 0; t < triCount; t++) {
                    // Indices in source mesh are for vertices, but vertexColors/textureCoordinates are per-triangle-vertex (flattened).
                    // For beam lattice geometry, positions are already expanded (no indices).
                    // Wait, check readMeshGeometry:
                    // positions: vertexCount * 3 (indexed)
                    // indices: triangleCount * 3
                    // vertexColors: triangleCount * 9 (3 vertices * 3 rgb) -> FLATTENED PER TRIANGLE
                    // textureCoordinates: triangleCount * 6 (3 vertices * 2 uv) -> FLATTENED PER TRIANGLE

                    // So we must iterate triangles, get indices, lookup position, apply matrix, write to flatPosition.
                    // Then just copy/lookup color/uv.

                    let v0, v1, v2;
                    if (isBeamLattice) {
                        // Beam lattice: positions are already expanded, no indices
                        const srcOff = t * 9;
                        v0 = applyMat4ToPoint(matrix, posSrc[srcOff + 0], posSrc[srcOff + 1], posSrc[srcOff + 2]);
                        v1 = applyMat4ToPoint(matrix, posSrc[srcOff + 3], posSrc[srcOff + 4], posSrc[srcOff + 5]);
                        v2 = applyMat4ToPoint(matrix, posSrc[srcOff + 6], posSrc[srcOff + 7], posSrc[srcOff + 8]);
                    } else {
                        const idx0 = indices[t * 3 + 0];
                        const idx1 = indices[t * 3 + 1];
                        const idx2 = indices[t * 3 + 2];
                        v0 = applyMat4ToPoint(matrix, posSrc[idx0 * 3], posSrc[idx0 * 3 + 1], posSrc[idx0 * 3 + 2]);
                        v1 = applyMat4ToPoint(matrix, posSrc[idx1 * 3], posSrc[idx1 * 3 + 1], posSrc[idx1 * 3 + 2]);
                        v2 = applyMat4ToPoint(matrix, posSrc[idx2 * 3], posSrc[idx2 * 3 + 1], posSrc[idx2 * 3 + 2]);
                    }

                    const offset = vertexCursor * 3;
                    flatPosition[offset + 0] = v0.x; flatPosition[offset + 1] = v0.y; flatPosition[offset + 2] = v0.z;
                    flatPosition[offset + 3] = v1.x; flatPosition[offset + 4] = v1.y; flatPosition[offset + 5] = v1.z;
                    flatPosition[offset + 6] = v2.x; flatPosition[offset + 7] = v2.y; flatPosition[offset + 8] = v2.z;

                    // Colors
                    const colOffset = vertexCursor * 3;
                    if (hasVC) {
                        const srcOff = t * 9;
                        for (let k = 0; k < 9; k++) flatColor[colOffset + k] = vertexColors[srcOff + k];
                    } else {
                        // Fallback
                        for (let v = 0; v < 3; v++) {
                            flatColor[colOffset + v * 3 + 0] = fallbackColor.r;
                            flatColor[colOffset + v * 3 + 1] = fallbackColor.g;
                            flatColor[colOffset + v * 3 + 2] = fallbackColor.b;
                        }
                    }

                    // UVs
                    const uvOffset = vertexCursor * 2;
                    if (hasUV) {
                        const srcOff = t * 6;
                        for (let k = 0; k < 6; k++) flatUV[uvOffset + k] = textureCoordinates[srcOff + k];
                    } else {
                        // 0,0
                        for (let k = 0; k < 6; k++) flatUV[uvOffset + k] = 0;
                    }

                    // Resource ID (for visibility toggling)
                    const resId = resource.resourceId ?? 0;
                    flatResourceId[vertexCursor + 0] = resId;
                    flatResourceId[vertexCursor + 1] = resId;
                    flatResourceId[vertexCursor + 2] = resId;

                    vertexCursor += 3;
                    groupCount += 3;
                }
            }
            // Close final group
            startGroup(undefined);

            const geometry = {
                positions: flatPosition,
                colors: flatColor,
                uvs: flatUV,
                resourceIds: flatResourceId,
                groups,
                vertexCount: vertexCursor,
                beamLines: beamLinePositions.length
                    ? {
                        positions: new Float32Array(beamLinePositions),
                        resourceIds: new Float32Array(beamLineResourceIds),
                        radii: new Float32Array(beamLineRadii),
                    }
                    : null,
            };

            console.log(`[lib3mf] Geometry flattened. Triangles: ${totalTriangles}, Vertices: ${vertexCursor}, Groups: ${groups.length}`);

            const output = {
                diagnostics,
                baseMaterialGroups,
                colorGroups,
                texture2Ds,
                texture2DGroups,
                sliceStacks,
                meshResources: meshResourcesArray,
                componentResources: componentResourcesArray,
                items,
                counts,
                unit,
                modelUUID: modelUuidInfo.uuid,
                modelHasUUID: modelUuidInfo.hasUUID,
                lib3mfVersion,
                specifications,
                primarySpecification,
                geometry
            };

            return output;
        } finally {
            this.safeFsUnlink(virtualInput);
            safeDelete(objectIterator);
            safeDelete(buildItemIterator);
            safeDelete(strictReader);
            safeDelete(strictModel);
            safeDelete(reader);
            safeDelete(model);
            safeDelete(wrapper);
        }
    }
}

export async function loadThreeMFModel(libFactory, arrayBuffer, fileName, options = {}) {
    const lib = typeof libFactory === "function" ? await libFactory() : libFactory;
    const engine = new Lib3mfEngine(lib, options);
    return engine.loadFromBuffer(arrayBuffer, fileName, options);
}
