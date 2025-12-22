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
                const safeName = String(path).replace(/[^\w.\-]+/g, "_");
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

    getMeshSummary(meshObj) {
        if (!meshObj) {
            return {
                vertexCount: null,
                triangleCount: null,
                hasSlices: false,
                manifoldOriented: undefined,
                uuid: null,
                hasUUID: false,
            };
        }
        const vertexCount = meshObj.GetVertexCount?.() ?? null;
        const triangleCount = meshObj.GetTriangleCount?.() ?? null;
        const hasSlices = meshObj.HasSlices?.(false) ? true : false;
        let manifoldOriented;
        try {
            if (typeof meshObj.IsManifoldAndOriented === "function") {
                manifoldOriented = !!meshObj.IsManifoldAndOriented();
            }
        } catch (err) {
            logCatch("getMeshSummary.IsManifoldAndOriented failed", err);
            manifoldOriented = undefined;
        }
        const uuidInfo = this.getUUIDSafe(meshObj);
        return {
            vertexCount,
            triangleCount,
            hasSlices,
            manifoldOriented,
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
                        const geometryInfo = this.readMeshGeometry(current);
                        if (!geometryInfo) {
                            safeDelete(current);
                            continue;
                        }

                        const paletteColor = { r: 0.223, g: 0.741, b: 0.974, a: 1 };
                        let rawName = null;
                        try {
                            rawName = typeof current.GetName === "function" ? current.GetName() : null;
                        } catch (err) {
                            logCatch("loadFromBuffer.GetName for mesh object failed", err);
                            rawName = null;
                        }
                        const displayName = rawName && rawName.length
                            ? rawName
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
            const hasTextures = texture2DGroups.length > 0 && texture2Ds.length > 0;

            const lookupMaps = this.buildMaterialLookupMaps(baseMaterialGroups, colorGroups);
            const meshResourcesArray = [];

            meshResources.forEach((resource) => {
                const colorData = this.mapTriangleVertexColors(resource, lookupMaps);
                resource.vertexColors = colorData.vertexColors;
                resource.materialColorStats = colorData.stats;
                resource.usesVertexColors = colorData.stats.trianglesWithColor > 0;
                if (!hasTextures) {
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
            };

            const primarySpecification = specifications[0] ?? null;

            const output = {
                diagnostics,
                baseMaterialGroups,
                colorGroups,
                texture2Ds,
                texture2DGroups,
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
