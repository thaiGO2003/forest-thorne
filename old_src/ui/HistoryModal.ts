/**
 * HistoryModal.js
 *
 * Combat log / history modal for PlanningScene.
 * Extracted from PlanningScene to reduce file size.
 */

import { UI_FONT, UI_COLORS } from "../core/uiTheme.js";
import { getMinTouchTarget, scaleFontPx, scaleUiSize } from "../core/uiResponsive.js";
import { t } from "../i18n/index.js";
import type { Scene as PhaserScene } from "phaser";
import {
    isDisplayObjectAlive,
    safeDestroy,
    safeSetColor,
    safeSetFillStyle,
    safeSetStrokeStyle,
    safeSetText
} from "./displayObjectGuards.js";

interface HistoryFilterEntry {
    key: string;
    label: string;
    labelKey: string;
}

interface HistoryLogEntry {
    id?: string;
    round?: number;
    category?: string;
    title?: string;
    message?: string;
    summary?: string;
    details?: unknown;
    icon?: string | null;
    tone?: "success" | "warning" | "danger" | "muted" | "info";
    meta?: unknown;
    previewText?: string;
}

interface HistoryFilterButton {
    key: string;
    bg: unknown;
    text: unknown;
}

interface HistoryListViewport {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface HistoryListContainer {
    add: (obj: unknown) => unknown;
    y: number;
    setDepth: (v: number) => void;
    setVisible: (v: boolean) => void;
    enableFilters: () => void;
    filters: { external: { addMask: (g: unknown) => unknown } };
}

interface HistoryModalParts {
    parts: unknown[];
    filterButtons: HistoryFilterButton[];
    listContainer: HistoryListContainer;
    listViewport: HistoryListViewport;
    title: unknown;
    closeBg: unknown;
    closeText: unknown;
}

interface HistoryModalSceneLike extends PhaserScene, Record<string, unknown> {
    historyModalParts?: unknown[];
    historyFilterButtons: HistoryFilterButton[];
    historyFilter: string;
    historyListContainer: HistoryListContainer;
    historyListViewport: HistoryListViewport | null;
    historyModalTitle: unknown;
    historyCloseBg: unknown;
    historyCloseText: unknown;
    historyListItems: unknown[];
    historyMaxScroll: number;
    historyScrollOffset: number;
    logHistory: HistoryLogEntry[];
    setHistoryFilter: (key: string) => void;
    toggleHistoryModal: (force: boolean) => void;
}

const TONE_COLORS: Record<string, string> = {
    success: "#d9ffe3",
    warning: "#ffe8b3",
    danger: "#ffcfd4",
    muted: UI_COLORS.textMuted,
    info: UI_COLORS.textPrimary
};

function resolveFilterLabel(filter: HistoryFilterEntry): string {
    return filter.labelKey ? t(filter.labelKey) : filter.label;
}

function resolveEntryCategory(entry: HistoryLogEntry): string {
    return entry.category ?? "EVENT";
}

function resolveEntryDetails(entry: HistoryLogEntry): string[] {
    const details = entry.details;
    if (!Array.isArray(details)) return [];
    return details
        .flatMap((line) => (Array.isArray(line) ? line : [line]))
        .map((line) => String(line ?? "").trim())
        .filter((line) => line.length > 0);
}

function buildEntryTitleLine(entry: HistoryLogEntry, categoryLabel: string): string {
    const iconPart = entry.icon ? `${entry.icon} ` : "";
    const titleOrMessage = entry.title ?? entry.message ?? "";
    return `[Vòng ${entry.round ?? 1}] [${categoryLabel}] ${iconPart}${titleOrMessage}`;
}

/**
 * Creates the history modal UI elements.
 *
 * @param scene - PlanningScene instance
 * @param historyFilters - HISTORY_FILTERS constant array
 * @returns { parts, filterButtons, listContainer, listViewport, title, closeBg, closeText }
 */
export function buildHistoryModal(
    scene: HistoryModalSceneLike,
    historyFilters: HistoryFilterEntry[]
): HistoryModalParts {
    const w = scene.scale.width;
    const h = scene.scale.height;
    const panelW = Math.min(640, Math.floor(w * 0.8), scaleUiSize(scene, 640, "control"));
    const panelH = Math.min(Math.floor(h * 0.78), 720, scaleUiSize(scene, 720, "control"));
    const cx = Math.floor(w * 0.5);
    const cy = Math.floor(h * 0.5);
    const x0 = cx - panelW * 0.5;
    const y0 = cy - panelH * 0.5;
    const panelPaddingX = Math.max(28, scaleUiSize(scene, 28, "spacing"));
    const titleTopPadding = Math.max(20, scaleUiSize(scene, 20, "spacing"));
    const closeInset = Math.max(36, scaleUiSize(scene, 36, "spacing"));
    const tabTop = y0 + scaleUiSize(scene, 74, "spacing");
    const chipGap = scaleUiSize(scene, 8, "spacing");
    const listOuterGap = Math.max(18, scaleUiSize(scene, 18, "spacing"));
    const listInnerPaddingX = Math.max(18, scaleUiSize(scene, 18, "spacing"));
    const listInnerPaddingY = Math.max(16, scaleUiSize(scene, 16, "spacing"));
    const chipH = Math.max(getMinTouchTarget(scene) - 10, scaleUiSize(scene, 30, "control"));
    const closeSize = Math.max(getMinTouchTarget(scene) - 10, scaleUiSize(scene, 30, "control"));

    const shade = scene.add.rectangle(cx, cy, w, h, 0x020509, 0.68);
    shade.setDepth(5800);
    shade.setVisible(false);
    shade.setInteractive({ useHandCursor: true });
    shade.on("pointerdown", () => scene.toggleHistoryModal(false));

    const panel = scene.add.rectangle(cx, cy, panelW, panelH, 0x0f1a29, 0.97);
    panel.setStrokeStyle(1, UI_COLORS.panelEdge, 0.9);
    panel.setDepth(5801);
    panel.setVisible(false);

    const title = scene.add.text(x0 + panelPaddingX, y0 + titleTopPadding, t("ui.historyTitle"), {
        fontFamily: UI_FONT,
        fontSize: scaleFontPx(scene, 20, "title"),
        color: UI_COLORS.textPrimary,
        fontStyle: "bold"
    });
    title.setDepth(5802);
    title.setVisible(false);

    const closeBg = scene.add.rectangle(x0 + panelW - closeInset, y0 + titleTopPadding + 4, closeSize, closeSize, 0x21364d, 0.96);
    closeBg.setStrokeStyle(1, UI_COLORS.panelEdge, 0.85);
    closeBg.setDepth(5802);
    closeBg.setVisible(false);
    closeBg.setInteractive({ useHandCursor: true });
    closeBg.on("pointerdown", () => scene.toggleHistoryModal(false));

    const closeText = scene.add.text(closeBg.x, closeBg.y, "×", {
        fontFamily: UI_FONT,
        fontSize: scaleFontPx(scene, 20, "title"),
        color: UI_COLORS.textPrimary
    }).setOrigin(0.5);
    closeText.setDepth(5803);
    closeText.setVisible(false);

    // Filter tab chips
    const chipW = Math.floor((panelW - panelPaddingX * 2 - chipGap * (historyFilters.length - 1)) / historyFilters.length);
    const filterButtons = historyFilters.map((filter, idx): HistoryFilterButton => {
        const bx = x0 + panelPaddingX + idx * (chipW + chipGap);
        const bg = scene.add.rectangle(bx + chipW / 2, tabTop + chipH * 0.5, chipW, chipH, 0x1a2d42, 0.94);
        bg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.8);
        bg.setDepth(5802);
        bg.setVisible(false);
        bg.setInteractive({ useHandCursor: true });
        const text = scene.add.text(bx + chipW / 2, tabTop + chipH * 0.5, resolveFilterLabel(filter), {
            fontFamily: UI_FONT,
            fontSize: scaleFontPx(scene, 12, "label"),
            color: UI_COLORS.textSecondary
        }).setOrigin(0.5);
        text.setDepth(5803);
        text.setVisible(false);
        bg.on("pointerdown", () => scene.setHistoryFilter(filter.key));
        return { key: filter.key, bg, text };
    });

    // Scrollable list area
    const listX = x0 + panelPaddingX;
    const listY = tabTop + chipH + scaleUiSize(scene, 4, "spacing") + listOuterGap;
    const listW = panelW - panelPaddingX * 2;
    const listH = panelH - (listY - y0) - panelPaddingX;
    const listViewport: HistoryListViewport = {
        x: listX + listInnerPaddingX,
        y: listY + listInnerPaddingY,
        w: listW - listInnerPaddingX * 2,
        h: listH - listInnerPaddingY * 2
    };

    const listBg = scene.add.rectangle(listX + listW / 2, listY + listH / 2, listW, listH, 0x0d1623, 0.88);
    listBg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.7);
    listBg.setDepth(5801);
    listBg.setVisible(false);

    const listContainer = scene.add.container(listViewport.x, listViewport.y) as unknown as HistoryListContainer;
    listContainer.setDepth(5802);
    listContainer.setVisible(false);

    const maskShape = scene.add.graphics();
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(listViewport.x, listViewport.y, listViewport.w, listViewport.h);
    scene.children.remove(maskShape);
    listContainer.enableFilters();
    listContainer.filters.external.addMask(maskShape);

    const parts = [
        shade,
        panel,
        title,
        closeBg,
        closeText,
        listBg,
        listContainer,
        ...filterButtons.flatMap((x) => [x.bg, x.text]),
        maskShape
    ];

    return { parts, filterButtons, listContainer, listViewport, title, closeBg, closeText };
}

/**
 * Refreshes the history modal content.
 *
 * @param scene - PlanningScene instance
 * @param historyFilters - HISTORY_FILTERS constant
 */
export function refreshHistoryContent(
    scene: HistoryModalSceneLike,
    historyFilters: HistoryFilterEntry[]
): void {
    if (!isDisplayObjectAlive(scene.historyListContainer) || !scene.historyListViewport) return;
    safeSetText(scene.historyModalTitle, t("ui.historyTitle"));

    scene.historyListItems.forEach((item) => safeDestroy(item));
    scene.historyListItems = [];

    scene.historyFilterButtons.forEach((chip) => {
        const active = chip.key === scene.historyFilter;
        const filterDef = historyFilters.find((filter) => filter.key === chip.key);
        safeSetText(chip.text, filterDef?.labelKey ? t(filterDef.labelKey) : filterDef?.label ?? chip.key);
        safeSetFillStyle(chip.bg, active ? 0x2a4766 : 0x1a2d42, active ? 0.98 : 0.94);
        safeSetStrokeStyle(chip.bg, 1, active ? UI_COLORS.panelEdge : UI_COLORS.panelEdgeSoft, active ? 0.95 : 0.8);
        safeSetColor(chip.text, active ? "#ffffff" : UI_COLORS.textSecondary);
    });

    const selected = scene.historyFilter;
    const logs =
        selected === "ALL" ? scene.logHistory : scene.logHistory.filter((entry) => resolveEntryCategory(entry) === selected);
    const sorted = [...logs].reverse();
    const viewport = scene.historyListViewport;
    const width = viewport.w;
    let y = 0;

    if (!sorted.length) {
        const empty = scene.add.text(0, 0, t("history.empty"), {
            fontFamily: UI_FONT,
            fontSize: scaleFontPx(scene, 13, "body"),
            color: UI_COLORS.textMuted,
            wordWrap: { width }
        });
        scene.historyListContainer.add(empty);
        scene.historyListItems.push(empty);
        y = empty.height + 10;
    } else {
        sorted.forEach((entry) => {
            const matchedFilter = historyFilters.find((f) => f.key === resolveEntryCategory(entry));
            const categoryLabel = matchedFilter?.labelKey ? t(matchedFilter.labelKey) : matchedFilter?.label ?? resolveEntryCategory(entry);
            const titleLine = buildEntryTitleLine(entry, categoryLabel);
            const header = scene.add.text(0, y, titleLine, {
                fontFamily: UI_FONT,
                fontSize: scaleFontPx(scene, 13, "body"),
                color: TONE_COLORS[entry.tone ?? "info"] ?? UI_COLORS.textPrimary,
                lineSpacing: scaleUiSize(scene, 4, "spacing"),
                wordWrap: { width }
            });
            scene.historyListContainer.add(header);
            scene.historyListItems.push(header);
            y += header.height + 6;

            const detailLines = resolveEntryDetails(entry);
            if (detailLines.length) {
                const body = scene.add.text(18, y, detailLines.map((line) => `• ${line}`).join("\n"), {
                    fontFamily: UI_FONT,
                    fontSize: scaleFontPx(scene, 12, "body"),
                    color: UI_COLORS.textSecondary,
                    lineSpacing: scaleUiSize(scene, 4, "spacing"),
                    wordWrap: { width: width - 18 }
                });
                scene.historyListContainer.add(body);
                scene.historyListItems.push(body);
                y += body.height + 12;
            } else {
                y += 12;
            }
        });
    }

    scene.historyMaxScroll = Math.max(0, y - viewport.h);
    scene.historyScrollOffset = Math.max(0, Math.min(scene.historyScrollOffset, scene.historyMaxScroll));
    scene.historyListContainer.y = viewport.y - scene.historyScrollOffset;
}
