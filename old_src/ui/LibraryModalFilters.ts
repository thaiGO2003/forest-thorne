/**
 * LibraryModalFilters — Search/filter UI cho LibraryModal
 *
 * Extracted từ LibraryModal.js để giữ file chính dưới 500 dòng.
 */

import { t } from "../i18n/index.js";
import { getClassLabel, getTribeLabel } from "../data/unitVisuals.js";
import { CLASS_SYNERGY, TRIBE_SYNERGY } from "../data/synergies.js";

interface FilterContainerLike {
    removeAll: (destroyChildren?: boolean) => void;
    add: (items: unknown[]) => void;
}

interface LibraryButtonLike {
    label: { setFontSize: (v: number) => void };
}

interface LibraryModalLike {
    activeTab: string;
    detailUnitId: string | null;
    filterContainer: FilterContainerLike;
    filterClass: string | null;
    filterTribe: string | null;
    filterTier: number | null;
    searchQuery: string;
    createButton: (
        x: number, y: number, width: number, height: number, label: string, onClick: () => void,
        bgFill: number, stroke: number, parent: FilterContainerLike | null
    ) => LibraryButtonLike;
    refresh: () => void;
}

const WINDOW_PROMPT = (): ((message?: string, defaultValue?: string) => string | null) | null => {
    if (typeof window === "undefined") return null;
    const promptFn = (window as { prompt?: (message?: string, defaultValue?: string) => string | null }).prompt;
    return typeof promptFn === "function" ? promptFn.bind(window) : null;
};

function promptString(message: string, defaultValue: string): string {
    const promptFn = WINDOW_PROMPT();
    if (!promptFn) return defaultValue;
    const input = promptFn(message, defaultValue);
    return input ?? defaultValue;
}

const CLASS_OPTIONS_BASE = "ALL";
const TRIBE_OPTIONS_BASE = "ALL";
const TIER_OPTIONS = [0, 1, 2, 3, 4, 5] as const;

const CLASS_FILTER_FILL = 0x233850;
const CLASS_FILTER_STROKE = 0x5a8ab0;
const SEARCH_FILL = 0x112235;
const SEARCH_STROKE = 0x3a5070;
const RESET_FILL = 0x3b2e2e;
const RESET_STROKE = 0xff5555;
const SEARCH_FONT_SIZE = 13;

const CLASS_FILTER_WIDTH = 140;
const TRIBE_FILTER_WIDTH = 140;
const TIER_FILTER_WIDTH = 120;
const SEARCH_WIDTH = 200;
const RESET_WIDTH = 80;

const FILTER_BUTTON_HEIGHT = 30;
const FILTER_GAP = 14;

/**
 * Xây dựng filter bar (Class / Tribe / Tier / Search / Reset)
 * cho tab "units" khi không xem detail.
 *
 * @param modal - Instance LibraryModal
 */
export function refreshSearchUi(modal: LibraryModalLike): void {
    modal.filterContainer.removeAll(true);
    const showFilter = modal.activeTab === "units" && !modal.detailUnitId;
    if (!showFilter) return;

    let filterX = 0;
    const filterY = 0;
    const btnH = FILTER_BUTTON_HEIGHT;
    const spacing = FILTER_GAP;

    // Filter: Class
    const classW = CLASS_FILTER_WIDTH;
    const classLabel = modal.filterClass ? getClassLabel(modal.filterClass) : t("library.allClasses");
    modal.createButton(filterX + classW / 2, filterY, classW, btnH, classLabel, () => {
        const options = [CLASS_OPTIONS_BASE, ...Object.keys(CLASS_SYNERGY)];
        const currentIdx = options.indexOf(modal.filterClass ?? CLASS_OPTIONS_BASE);
        const nextIdx = (currentIdx + 1) % options.length;
        modal.filterClass = options[nextIdx] === CLASS_OPTIONS_BASE ? null : options[nextIdx];
        modal.refresh();
    }, CLASS_FILTER_FILL, CLASS_FILTER_STROKE, modal.filterContainer);
    filterX += classW + spacing;

    // Filter: Tribe
    const tribeW = TRIBE_FILTER_WIDTH;
    const tribeLabel = modal.filterTribe ? getTribeLabel(modal.filterTribe) : t("library.allTribes");
    modal.createButton(filterX + tribeW / 2, filterY, tribeW, btnH, tribeLabel, () => {
        const options = [TRIBE_OPTIONS_BASE, ...Object.keys(TRIBE_SYNERGY)];
        const currentIdx = options.indexOf(modal.filterTribe ?? TRIBE_OPTIONS_BASE);
        const nextIdx = (currentIdx + 1) % options.length;
        modal.filterTribe = options[nextIdx] === TRIBE_OPTIONS_BASE ? null : options[nextIdx];
        modal.refresh();
    }, CLASS_FILTER_FILL, CLASS_FILTER_STROKE, modal.filterContainer);
    filterX += tribeW + spacing;

    // Filter: Tier
    const tierW = TIER_FILTER_WIDTH;
    const tierLabel = modal.filterTier ? `${t("label.tier")} ${modal.filterTier}` : t("library.allTiers");
    modal.createButton(filterX + tierW / 2, filterY, tierW, btnH, tierLabel, () => {
        const options: readonly number[] = TIER_OPTIONS;
        const currentIdx = options.indexOf(modal.filterTier ?? 0);
        const nextIdx = (currentIdx + 1) % options.length;
        const nextTier = options[nextIdx];
        modal.filterTier = nextTier === 0 ? null : nextTier;
        modal.refresh();
    }, CLASS_FILTER_FILL, CLASS_FILTER_STROKE, modal.filterContainer);
    filterX += tierW + spacing;

    // Search
    const searchW = SEARCH_WIDTH;
    const searchLabel = modal.searchQuery ? `🔍 "${modal.searchQuery}"` : t("ui.searchPlaceholder");
    const searchButton = modal.createButton(filterX + searchW / 2, filterY, searchW, btnH, searchLabel, () => {
        const input = promptString(t("library.searchPrompt"), modal.searchQuery);
        if (input !== null) {
            modal.searchQuery = String(input).trim();
            modal.refresh();
        }
    }, SEARCH_FILL, SEARCH_STROKE, modal.filterContainer);
    searchButton.label.setFontSize(SEARCH_FONT_SIZE);
    filterX += searchW + spacing;

    // Reset
    if (modal.filterClass || modal.filterTribe || modal.filterTier || modal.searchQuery) {
        const resetW = RESET_WIDTH;
        modal.createButton(filterX + resetW / 2, filterY, resetW, btnH, t("ui.resetFilters"), () => {
            modal.filterClass = null;
            modal.filterTribe = null;
            modal.filterTier = null;
            modal.searchQuery = "";
            modal.refresh();
        }, RESET_FILL, RESET_STROKE, modal.filterContainer);
    }
}
