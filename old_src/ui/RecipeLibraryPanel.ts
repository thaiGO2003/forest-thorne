/**
 * RecipeLibraryPanel - Giao diện thư viện công thức kiểu Liên Quân Mobile
 *
 * Layout: Sidebar tabs (trái) | 4 cột Tier (giữa) | Detail panel (phải)
 * Phân loại: Tấn Công / Phòng Thủ / Pháp Thuật
 * Cây công thức: hiển thị ngang từ trái → phải
 *
 * IMPORTANT: All interactive objects are added directly to the scene
 * (NOT inside nested containers) to avoid Phaser hit-test issues.
 */

import { CRAFT_RECIPES, ITEM_BY_ID, RECIPE_BY_ID } from "../data/items.js";
import { UI_FONT, EMOJI_FONT, TIER_COLORS, CATEGORY_COLORS } from "../core/uiTheme.js";
import { renderCraftingGridExt } from "./RecipeLibraryCraftGrid.js";
import { refreshDetail as _refreshDetail } from "./RecipeLibraryDetail.js";
import { t } from "../i18n/index.js";
import {
    safeDestroy,
    safeSetFillStyle,
    safeSetStrokeStyle,
    safeSetVisible,
    safeShiftY
} from "./displayObjectGuards.js";
import { formatRecipeBonusList, getRecipeCategoryShortLabel } from "./recipeLocalization.js";
import type { CraftRecipe, ItemBonus } from "../data/items.js";
import type { Tier, ItemCategory } from "../core/uiTheme.js";

type RecipeCategory = "offense" | "defense" | "magic";

interface RecipeLibraryScene {
    add: {
        rectangle: (
            x: number,
            y: number,
            width: number,
            height: number,
            fillColor: number,
            fillAlpha?: number
        ) => Phaser.GameObjects.Rectangle;
        text: (
            x: number,
            y: number,
            text: string | string[],
            style?: Phaser.Types.GameObjects.Text.TextStyle
        ) => Phaser.GameObjects.Text;
    };
    make: {
        graphics: (config?: Phaser.Types.GameObjects.Graphics.Options) => Phaser.GameObjects.Graphics;
    };
}

interface Panable {
    setDepth: (depth: number) => unknown;
}

interface TierColorInfo {
    border: number;
    bg: number;
    glow: number;
    label: string;
}

interface PanelSidebarButton {
    key: RecipeCategory;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    icon: Phaser.GameObjects.Text;
}

interface CardObject {
    bg: Phaser.GameObjects.Rectangle;
    icon: Phaser.GameObjects.Text;
    name: Phaser.GameObjects.Text;
    stats: Phaser.GameObjects.Text;
    badge: Phaser.GameObjects.Text;
    recipe: CraftRecipe;
    tc: TierColorInfo;
    tier: number;
    baseY: number;
}

type AnyObject = Record<string, unknown>;

interface PanelLike {
    _clearDetail: () => void;
    _detailScrollY: number;
    detailX: number;
    detailW: number;
    x: number;
    y: number;
    h: number;
    selectedRecipeId: string | null;
    activeCategory: string;
    scene: RecipeLibraryScene;
    _addDetail: (node: unknown, depth: number) => unknown;
    _detailMask: unknown;
    _renderEmptyDetail: (dx: number, dw: number, applyMask: (obj: object) => unknown) => void;
    _renderCraftingGrid: (recipe: CraftRecipe, dx: number, startY: number, areaW: number, applyMask: (obj: object) => unknown) => number;
    _detailMaxScroll: number;
}

/* ── Helpers ── */
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

function categorizeRecipe(recipe: CraftRecipe): RecipeCategory {
    const b = (recipe.bonus ?? {}) as ItemBonus;
    const atkScore = (b.atkPct ? 2 : 0) + (b.critPct ? 1.5 : 0) + (b.lifestealPct ? 0.5 : 0);
    const defScore = (b.hpPct ? 1.5 : 0) + (b.defFlat ? 1 : 0) + (b.mdefFlat ? 1 : 0) + (b.shieldStart ? 1 : 0);
    const magScore = (b.matkPct ? 2 : 0) + (b.startingRage ? 0.5 : 0) + (b.healPct ? 1 : 0) + (b.burnOnHit ? 0.5 : 0);
    if (magScore > atkScore && magScore > defScore) return "magic";
    if (defScore > atkScore) return "defense";
    return "offense";
}

const RECIPE_CATEGORY_CACHE = new WeakMap<CraftRecipe, RecipeCategory>();

function getRecipeCategory(recipe: CraftRecipe): RecipeCategory {
    const cached = RECIPE_CATEGORY_CACHE.get(recipe);
    if (cached) return cached;
    const category = categorizeRecipe(recipe);
    RECIPE_CATEGORY_CACHE.set(recipe, category);
    return category;
}

function formatBonus(bonus: ItemBonus | undefined): string[] {
    return formatRecipeBonusList(bonus ?? {});
}

function getIngredientRecipeIds(recipe: CraftRecipe): string[] {
    const requires = recipe.requires || [];
    const ids: string[] = [];
    for (const id of requires) {
        if (id && id.startsWith("eq_")) {
            const recipeId = id.slice(3);
            if (RECIPE_BY_ID[recipeId]) ids.push(recipeId);
        }
    }
    return [...new Set(ids)];
}

function asTierColor(tc: TierColorInfo): TierColorInfo {
    return tc;
}

/* ── Main Class ── */
export class RecipeLibraryPanel {
    scene: RecipeLibraryScene;
    x: number;
    y: number;
    w: number;
    h: number;
    depth: number;
    activeCategory: RecipeCategory;
    selectedRecipeId: string | null;
    columnScrollY: Record<number, number>;
    columnMaxScroll: Record<number, number>;
    colCount!: number;
    colSingleW!: number;
    colGap!: number;
    colTop!: number;
    colH!: number;
    colAreaX!: number;
    colAreaW!: number;
    detailX!: number;
    detailW!: number;
    sidebarW!: number;
    sidebarButtons: PanelSidebarButton[];
    _all: Panable[];
    _cardObjs: Panable[];
    _detailObjs: Panable[];
    _cardMap: Map<string, CardObject>;
    _colMasks: Record<number, Phaser.GameObjects.Graphics>;
    _colX: Record<number, number>;
    _detailMask!: Phaser.GameObjects.Graphics;
    _detailScrollY: number;
    _detailMaxScroll: number;
    _detailGrp: unknown;

    constructor(
        scene: RecipeLibraryScene,
        x: number,
        y: number,
        w: number,
        h: number,
        depth: number = 6010
    ) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.depth = depth;

        this.activeCategory = "offense";
        this.selectedRecipeId = null;
        this.columnScrollY = { 1: 0, 2: 0, 3: 0, 4: 0 };
        this.columnMaxScroll = { 1: 0, 2: 0, 3: 0, 4: 0 };

        // All scene objects managed by this panel
        this._all = [];
        this._cardObjs = [];
        this._detailObjs = [];
        this._cardMap = new Map();

        // Column masks (Graphics used as geometry masks)
        this._colMasks = {};
        this._colX = {};
        this._detailScrollY = 0;
        this._detailMaxScroll = 0;
        this._detailGrp = null;
        this.sidebarButtons = [];

        this.buildLayout();
        this.refresh();
    }

    /* ═══ Helpers ═══ */

    /** Add a scene object, track it, set depth */
    _add(obj: Panable, d: number = 0): Panable {
        obj.setDepth(this.depth + d);
        this._all.push(obj);
        return obj;
    }

    /** Add a card-layer object (cleared on column refresh) */
    _addCard(obj: Panable, d: number = 5): Panable {
        obj.setDepth(this.depth + d);
        this._cardObjs.push(obj);
        this._all.push(obj);
        return obj;
    }

    /** Add a detail-layer object (cleared on detail refresh) */
    _addDetail(obj: Panable, d: number = 3): Panable {
        obj.setDepth(this.depth + d);
        this._detailObjs.push(obj);
        this._all.push(obj);
        return obj;
    }

    _clearCards(): void {
        this._cardObjs.forEach((o) => safeDestroy(o));
        this._cardObjs = [];
        this._cardMap.clear();
    }

    _clearDetail(): void {
        this._detailObjs.forEach((o) => safeDestroy(o));
        this._detailObjs = [];
    }

    /* ═══════════════════ LAYOUT ═══════════════════ */

    buildLayout(): void {
        const sideW = 78;
        const detailW = Math.floor(this.w * 0.33);
        const colAreaW = this.w - sideW - detailW - 2;

        this.sidebarW = sideW;
        this.colAreaX = this.x + sideW + 1;
        this.colAreaW = colAreaW;
        this.detailX = this.x + sideW + colAreaW + 1;
        this.detailW = detailW;

        // Backgrounds
        this._add(this.scene.add.rectangle(
            this.x + sideW / 2, this.y + this.h / 2, sideW, this.h, 0x0c1420, 0.98
        ).setOrigin(0.5).setStrokeStyle(1, 0x1f3550, 0.8) as unknown as Panable, 0);

        this._add(this.scene.add.rectangle(
            this.colAreaX + colAreaW / 2, this.y + this.h / 2, colAreaW, this.h, 0x0e1828, 0.92
        ).setOrigin(0.5) as unknown as Panable, 0);

        const detBg = this._add(this.scene.add.rectangle(
            this.detailX + detailW / 2, this.y + this.h / 2, detailW, this.h, 0x0a1424, 0.96
        ).setOrigin(0.5).setStrokeStyle(1, 0x1f3550, 0.6) as unknown as Panable, 0) as unknown as Phaser.GameObjects.Rectangle;
        detBg.setInteractive();
        detBg.on("wheel", (_p: unknown, _dx: number, dy: number) => this._scrollDetail(dy));

        // Column setup
        this.colCount = 4;
        const gap = 4;
        const singleW = Math.floor((colAreaW - gap * (this.colCount + 1)) / this.colCount);
        this.colSingleW = singleW;
        this.colGap = gap;
        this.colTop = this.y + 30;
        this.colH = this.h - 38;

        // Column headers & masks
        for (let tier = 1; tier <= this.colCount; tier++) {
            const cx = this.colAreaX + gap + (tier - 1) * (singleW + gap);
            this._colX[tier] = cx;
            const tc = asTierColor(TIER_COLORS[tier as Tier] ?? TIER_COLORS[1]);

            this._add(this.scene.add.text(cx + singleW / 2, this.y + 8, `${t("label.tier")} ${tier}`, {
                fontFamily: UI_FONT, fontSize: "13px", color: tc.label, fontStyle: "bold"
            }).setOrigin(0.5, 0) as unknown as Panable, 2);

            // Column scroll background (catches wheel on empty areas)
            const colBg = this._add(this.scene.add.rectangle(
                cx + singleW / 2, this.colTop + this.colH / 2, singleW, this.colH, 0x0e1828, 0.01
            ).setOrigin(0.5) as unknown as Panable, 1) as unknown as Phaser.GameObjects.Rectangle;
            colBg.setInteractive();
            colBg.on("wheel", (_p: unknown, _dx: number, dy: number) => this._scrollCol(tier, dy));

            // Geometry mask
            const mask = this.scene.make.graphics();
            mask.fillStyle(0xffffff);
            mask.fillRect(cx, this.colTop, singleW, this.colH);
            this._colMasks[tier] = mask;
            this._all.push(mask as unknown as Panable);
        }

        // Detail mask
        this._detailMask = this.scene.make.graphics();
        this._detailMask.fillStyle(0xffffff);
        this._detailMask.fillRect(this.detailX, this.y, detailW, this.h);
        this._all.push(this._detailMask as unknown as Panable);

        this._detailScrollY = 0;
        this._detailMaxScroll = 0;

        this.buildSidebar();
    }

    /* ──── SIDEBAR ──── */

    buildSidebar(): void {
        const cats: RecipeCategory[] = ["offense", "defense", "magic"];
        const icons = ["⚔️", "🛡️", "🔮"];
        const labels = [
            getRecipeCategoryShortLabel("offense"),
            getRecipeCategoryShortLabel("defense"),
            getRecipeCategoryShortLabel("magic")
        ];
        const tabH = 72;

        this.sidebarButtons = [];

        cats.forEach((cat, i) => {
            const ty = this.y + 20 + i * (tabH + 6);
            const cx = this.x + this.sidebarW / 2;
            const colors = CATEGORY_COLORS[cat as ItemCategory];

            const bg = this._add(this.scene.add.rectangle(
                cx, ty + tabH / 2, this.sidebarW - 10, tabH, 0x14202e, 0.9
            ).setOrigin(0.5).setStrokeStyle(1, 0x253a52, 0.7) as unknown as Panable, 2) as unknown as Phaser.GameObjects.Rectangle;
            bg.setInteractive({ useHandCursor: true });

            const icon = this._add(this.scene.add.text(cx, ty + 18, icons[i], {
                fontFamily: EMOJI_FONT, fontSize: "22px", color: "#ffffff"
            }).setOrigin(0.5) as unknown as Panable, 3) as unknown as Phaser.GameObjects.Text;

            const label = this._add(this.scene.add.text(cx, ty + 48, labels[i], {
                fontFamily: UI_FONT, fontSize: "10px", color: colors.text,
                align: "center", lineSpacing: 2
            }).setOrigin(0.5) as unknown as Panable, 3) as unknown as Phaser.GameObjects.Text;

            bg.on("pointerdown", () => {
                this.activeCategory = cat;
                this.selectedRecipeId = null;
                Object.keys(this.columnScrollY).forEach((k) => { this.columnScrollY[Number(k)] = 0; });
                this.refresh();
            });
            bg.on("pointerover", () => { if (this.activeCategory !== cat) bg.setAlpha(0.85); });
            bg.on("pointerout", () => bg.setAlpha(1));

            this.sidebarButtons.push({ key: cat, bg, label, icon });
        });
    }

    /* ═══════════════════ REFRESH ═══════════════════ */

    refresh(): void {
        this._refreshSidebarStyles();
        this._refreshColumns();
        this._refreshDetail();
    }

    _refreshSidebarStyles(): void {
        this.sidebarButtons.forEach((btn) => {
            const active = btn.key === this.activeCategory;
            const c = CATEGORY_COLORS[btn.key as ItemCategory];
            safeSetFillStyle(btn.bg, active ? c.main : 0x14202e, active ? 0.35 : 0.9);
            safeSetStrokeStyle(btn.bg, active ? 2 : 1, active ? c.glow : 0x253a52, active ? 0.9 : 0.7);
        });
    }

    /* ──── COLUMNS ──── */

    _refreshColumns(): void {
        this._clearCards();

        for (let t = 1; t <= this.colCount; t++) {
            const cx = this._colX[t];
            const applyMask = (object: object): unknown => {
                const go = object as unknown as {
                    enableFilters?: () => void;
                    filters?: { external?: { addMask?: (m: unknown) => unknown } };
                };
                go.enableFilters?.();
                return go.filters?.external?.addMask?.(this._colMasks[t]);
            };

            const recipes = CRAFT_RECIPES.filter((r) =>
                (r.tier ?? 1) === t && getRecipeCategory(r) === this.activeCategory
            );

            const cardH = 58;
            const gap = 6;
            let cy = 4;

            recipes.forEach((recipe) => {
                const cardY = this.colTop + cy - this.columnScrollY[t];
                const card = this._createCard(recipe, cx, cardY, this.colSingleW, cardH, t, applyMask);
                this._cardMap.set(recipe.id, card);
                cy += cardH + gap;
            });

            this.columnMaxScroll[t] = Math.max(0, cy - this.colH + 10);
            this.columnScrollY[t] = clamp(this.columnScrollY[t], 0, this.columnMaxScroll[t]);
        }

        this._highlightSelected();
    }

    _createCard(
        recipe: CraftRecipe,
        x: number,
        y: number,
        w: number,
        h: number,
        tier: number,
        mask: (obj: object) => unknown
    ): CardObject {
        const tc = asTierColor(TIER_COLORS[recipe.tier as Tier] ?? TIER_COLORS[1]);

        // Card background — DIRECTLY on scene, not in container
        const bg = this._addCard(this.scene.add.rectangle(
            x + w / 2, y + h / 2, w - 4, h - 2, tc.bg, 0.92
        ).setOrigin(0.5).setStrokeStyle(1.5, tc.border, 0.7) as unknown as Panable, 5) as unknown as Phaser.GameObjects.Rectangle;
        bg.setInteractive({ useHandCursor: true });
        mask(bg);

        // Icon
        const icon = this._addCard(this.scene.add.text(x + 8, y + h / 2, recipe.icon, {
            fontFamily: EMOJI_FONT, fontSize: "20px", color: "#ffffff"
        }).setOrigin(0, 0.5) as unknown as Panable, 6) as unknown as Phaser.GameObjects.Text;
        mask(icon);

        // Name
        const nameStr = recipe.name.length > 10 ? recipe.name.slice(0, 9) + "…" : recipe.name;
        const name = this._addCard(this.scene.add.text(x + 36, y + 8, nameStr, {
            fontFamily: UI_FONT, fontSize: "12px", color: "#e9f5ff", fontStyle: "bold"
        }) as unknown as Panable, 6) as unknown as Phaser.GameObjects.Text;
        mask(name);

        // Brief stats
        const bonusParts = formatBonus(recipe.bonus);
        const brief = bonusParts.slice(0, 2).join(" · ");
        const stats = this._addCard(this.scene.add.text(x + 36, y + 28, brief, {
            fontFamily: UI_FONT, fontSize: "9px", color: "#8ab4d4",
            wordWrap: { width: w - 44 }
        }) as unknown as Panable, 6) as unknown as Phaser.GameObjects.Text;
        mask(stats);

        // Tier badge
        const badge = this._addCard(this.scene.add.text(x + w - 12, y + h - 10, `T${recipe.tier}`, {
            fontFamily: UI_FONT, fontSize: "9px", color: tc.label, fontStyle: "bold"
        }).setOrigin(1, 1).setAlpha(0.7) as unknown as Panable, 6) as unknown as Phaser.GameObjects.Text;
        mask(badge);

        // Hover & click
        bg.on("pointerover", () => {
            if (this.selectedRecipeId !== recipe.id) bg.setStrokeStyle(2, tc.border, 1);
        });
        bg.on("pointerout", () => {
            if (this.selectedRecipeId !== recipe.id) bg.setStrokeStyle(1.5, tc.border, 0.7);
        });
        bg.on("pointerdown", () => {
            this.selectedRecipeId = recipe.id;
            this._detailScrollY = 0;
            this._highlightSelected();
            this._refreshDetail();
        });
        bg.on("wheel", (_p: unknown, _dx: number, dy: number) => this._scrollCol(tier, dy));

        return { bg, icon, name, stats, badge, recipe, tc, tier, baseY: y };
    }

    _highlightSelected(): void {
        this._cardMap.forEach((card, id) => {
            if (id === this.selectedRecipeId) {
                safeSetStrokeStyle(card.bg, 2.5, 0xffd580, 1);
            } else {
                safeSetStrokeStyle(card.bg, 1.5, card.tc.border, 0.7);
            }
        });
    }

    _scrollCol(tier: number, deltaY: number): void {
        const old = this.columnScrollY[tier];
        this.columnScrollY[tier] = clamp(old + deltaY * 0.35, 0, this.columnMaxScroll[tier]);
        if (this.columnScrollY[tier] !== old) {
            // Re-position cards for this tier
            this._cardMap.forEach((card) => {
                if (card.tier !== tier) return;
                const scrollDelta = this.columnScrollY[tier] - old;
                safeShiftY(card.bg, scrollDelta);
                safeShiftY(card.icon, scrollDelta);
                safeShiftY(card.name, scrollDelta);
                safeShiftY(card.stats, scrollDelta);
                safeShiftY(card.badge, scrollDelta);
                card.baseY -= scrollDelta;
            });
        }
    }

    /* ──── DETAIL PANEL ──── */

    _scrollDetail(deltaY: number): void {
        const old = this._detailScrollY;
        this._detailScrollY = clamp(old + deltaY * 0.4, 0, this._detailMaxScroll);
        if (this._detailScrollY !== old) {
            const delta = this._detailScrollY - old;
            this._detailObjs.forEach((o) => safeShiftY(o, delta));
        }
    }

    _refreshDetail(): void {
        _refreshDetail(this as unknown as Parameters<typeof _refreshDetail>[0]);
    }

    _renderEmptyDetail(dx: number, dw: number, mask: (obj: object) => unknown): void {
        const cy = this.y + this.h / 2;
        const e1 = this._addDetail(this.scene.add.text(dx + dw / 2, cy - 40, "📜", {
            fontFamily: EMOJI_FONT, fontSize: "48px", color: "#ffffff"
        }).setOrigin(0.5).setAlpha(0.3) as unknown as Panable, 4) as unknown as Phaser.GameObjects.Text;
        mask(e1);

        const e2 = this._addDetail(this.scene.add.text(dx + dw / 2, cy + 20,
            t("library.recipeSelectPrompt"), {
            fontFamily: UI_FONT, fontSize: "14px", color: "#5a7a94",
            align: "center", lineSpacing: 6
        }).setOrigin(0.5) as unknown as Panable, 4) as unknown as Phaser.GameObjects.Text;
        mask(e2);
        this._detailMaxScroll = 0;
    }

    /* ──── CRAFTING GRID ──── */

    _renderCraftingGrid(
        recipe: CraftRecipe,
        dx: number,
        startY: number,
        areaW: number,
        mask: (obj: object) => unknown
    ): number {
        return renderCraftingGridExt(
            this as unknown as Parameters<typeof renderCraftingGridExt>[0],
            recipe,
            dx,
            startY,
            areaW,
            mask as Parameters<typeof renderCraftingGridExt>[5]
        );
    }

    /* ═══════════════════ LIFECYCLE ═══════════════════ */

    setVisible(v: boolean): void {
        const vis = !!v;
        this._all.forEach((o) => safeSetVisible(o, vis));
    }

    destroy(): void {
        this._all.forEach((o) => safeDestroy(o));
        this._all = [];
        this._cardObjs = [];
        this._detailObjs = [];
        this._cardMap.clear();
    }
}
