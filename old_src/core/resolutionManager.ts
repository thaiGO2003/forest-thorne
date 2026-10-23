import { RESOLUTION_PRESETS, normalizeResolutionKey, resolveResolution } from "./uiSettings.js";
interface ResolutionScene {
    scale?: {
        resize(width: number, height: number): unknown;
    };
}

interface ResolutionSettings {
    resolutionKey: unknown;
}


export class ResolutionManager {
    static getSupportedResolutions() {
        // On web, even a large logical resolution can still be rendered and scaled down
        // inside the browser viewport. Filtering presets by `window.screen` traps small
        // mobile devices on the adaptive preset and prevents cycling back out of it.
        return [...RESOLUTION_PRESETS];
    }

    static changeResolution(currentKey: unknown, delta = 1) {
        const supported = this.getSupportedResolutions();
        if (supported.length === 0) return resolveResolution(currentKey); // Fallback to current or default

        const normalized = normalizeResolutionKey(currentKey);
        const idx = supported.findIndex(preset => preset.key === normalized);

        // If current is not in supported (e.g. screen changed or loaded from another device)
        if (idx === -1) {
            const fallback = supported.find(preset => preset.dynamic) ?? supported[0];
            return resolveResolution(fallback.key);
        }

        let nextIdx = (idx + delta) % supported.length;
        if (nextIdx < 0) nextIdx += supported.length;

        return resolveResolution(supported[nextIdx].key);
    }

    static getNextResolution(currentKey: unknown) {
        return this.changeResolution(currentKey, 1);
    }

    static applyResolution(
        scene: ResolutionScene | null | undefined,
        newResolutionKey: unknown,
        settingsObject: ResolutionSettings,
        onFailCallback?: (message: string) => void
    ) {
        const oldKey = settingsObject.resolutionKey;
        const resolution = resolveResolution(newResolutionKey);

        try {
            // Attempt to resize
            if (scene && scene.scale) {
                scene.scale.resize(resolution.width, resolution.height);
            }

            // Update settings
            settingsObject.resolutionKey = normalizeResolutionKey(newResolutionKey);

            return resolution;
        } catch (err) {
            console.error("Resolution change failed:", err);
            // Rollback
            settingsObject.resolutionKey = oldKey;

            // Try to restore old scale if it was changed before crash
            try {
                const oldRes = resolveResolution(oldKey);
                if (scene && scene.scale) {
                    scene.scale.resize(oldRes.width, oldRes.height);
                }
            } catch (rollbackErr) {
                console.error("Failed to rollback resolution:", rollbackErr);
            }

            if (typeof onFailCallback === "function") {
                onFailCallback("Không thể thay đổi độ phân giải. Đã khôi phục cài đặt cũ.");
            }
            return resolveResolution(oldKey);
        }
    }
}
