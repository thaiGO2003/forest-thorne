/**
 * RecipeDiagram - Node-based crafting diagram visualization
 *
 * Displays crafting recipes as an interactive node graph showing:
 * - Recipe nodes grouped by category (Offense, Defense, Magic)
 * - Input patterns (ingredient grids)
 * - Output items with stat benefits
 * - Connections between recipe components
 */

import { EMOJI_FONT } from "../core/uiTheme.js";
import { t } from "../i18n/index.js";
import {
  formatRecipeBonusList,
  getRecipeCategoryLabel,
  getRecipeIngredientSuffix
} from "./recipeLocalization.js";
import type { CraftRecipe, ItemBonus } from "../data/items.js";

type RecipeCategory = "offense" | "defense" | "magic";

interface RecipeDiagramScene {
  add: {
    container: (x: number, y: number) => Phaser.GameObjects.Container;
    text: (
      x: number,
      y: number,
      text: string | string[],
      style?: Phaser.Types.GameObjects.Text.TextStyle
    ) => Phaser.GameObjects.Text;
    rectangle: (
      x: number,
      y: number,
      width: number,
      height: number,
      fillColor: number,
      fillAlpha?: number
    ) => Phaser.GameObjects.Rectangle;
    line: (
      x: number,
      y: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      strokeColor: number,
      strokeAlpha?: number
    ) => Phaser.GameObjects.Line;
    zone: (x: number, y: number, width: number, height: number) => Phaser.GameObjects.Zone;
  };
  make?: {
    graphics: (config?: Phaser.Types.GameObjects.Graphics.Options) => Phaser.GameObjects.Graphics;
  };
}

interface DiagramCategory {
  label: string;
  color: number;
  recipes: CraftRecipe[];
}

interface DiagramNode {
  recipe: CraftRecipe;
  container: Phaser.GameObjects.Container;
  x: number;
  y: number;
  bg: Phaser.GameObjects.Rectangle;
  color?: number;
}

interface DiagramConnection {
  line: Phaser.GameObjects.Line;
  source: DiagramNode;
  target: DiagramNode;
}

interface PatternItem {
  icon?: string;
  name?: string;
  kind?: string;
  id?: string;
}

interface RecipeWithPattern extends CraftRecipe {
  _gridSize?: number;
  _pattern?: PatternItem[];
  _category?: RecipeCategory;
}

export class RecipeDiagram {
  scene: RecipeDiagramScene;
  x: number;
  y: number;
  width: number;
  height: number;
  recipes: CraftRecipe[];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  panX: number;
  panY: number;

  container: Phaser.GameObjects.Container;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  selectedNode: DiagramNode | null;
  categories: Record<RecipeCategory, DiagramCategory>;
  calculatedHeight: number;
  interactionZone: Phaser.GameObjects.Zone | null;
  _tooltipText: Phaser.GameObjects.Text | null;
  _isDragging: boolean;
  _lastPointer: { x: number; y: number } | null;

  /**
   * @param scene - The Phaser scene
   * @param x - X position
   * @param y - Y position
   * @param width - Diagram width
   * @param height - Diagram height
   * @param recipes - Array of recipe objects
   */
  constructor(
    scene: RecipeDiagramScene,
    x: number,
    y: number,
    width: number,
    height: number,
    recipes: CraftRecipe[]
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.recipes = recipes;
    this.zoom = 1;
    this.minZoom = 0.6;
    this.maxZoom = 1.8;
    this.panX = 0;
    this.panY = 0;

    this.container = scene.add.container(x, y);
    this.nodes = [];
    this.connections = [];
    this.selectedNode = null;
    this.interactionZone = null;
    this._tooltipText = null;
    this._isDragging = false;
    this._lastPointer = null;
    this.categories = {
      offense: { label: "", color: 0, recipes: [] },
      defense: { label: "", color: 0, recipes: [] },
      magic: { label: "", color: 0, recipes: [] }
    };
    this.calculatedHeight = 0;

    this.categorizeRecipes();
    this.buildDiagram();
    this.enablePanZoom();
  }

  /**
   * Categorize recipes into Offense, Defense, and Magic groups
   */
  categorizeRecipes(): void {
    this.categories = {
      offense: {
        label: getRecipeCategoryLabel("offense"),
        color: 0xff6b6b,
        recipes: this.recipes.filter((r) => {
          const bonus = (r.bonus ?? {}) as ItemBonus;
          return bonus.atk || bonus.atkPct || bonus.critPct;
        })
      },
      defense: {
        label: getRecipeCategoryLabel("defense"),
        color: 0x4ecdc4,
        recipes: this.recipes.filter((r) => {
          const bonus = (r.bonus ?? {}) as ItemBonus;
          return (
            bonus.hp ||
            bonus.hpPct ||
            bonus.def ||
            bonus.defFlat ||
            bonus.mdef ||
            bonus.mdefFlat ||
            bonus.shieldStart ||
            r.id.toLowerCase().includes("armor") ||
            r.id.toLowerCase().includes("crown")
          );
        })
      },
      magic: {
        label: getRecipeCategoryLabel("magic"),
        color: 0x9b59b6,
        recipes: this.recipes.filter((r) => {
          const bonus = (r.bonus ?? {}) as ItemBonus;
          return (
            bonus.matk ||
            bonus.matkPct ||
            r.id.toLowerCase().includes("staff") ||
            r.id.toLowerCase().includes("wand")
          );
        })
      }
    };
  }

  /**
   * Build the node-based diagram
   */
  buildDiagram(): void {
    const categoryKeys = Object.keys(this.categories) as RecipeCategory[];
    const categoryWidth = this.width / categoryKeys.length;
    const headerHeight = 40;
    let maxCatHeight = 0;

    categoryKeys.forEach((catKey, catIndex) => {
      const category = this.categories[catKey];
      const catX = catIndex * categoryWidth;

      // Category header
      const header = this.scene.add.text(
        catX + categoryWidth / 2,
        10,
        category.label,
        {
          fontFamily: "Arial",
          fontSize: "18px",
          color: `#${category.color.toString(16)}`,
          fontStyle: "bold"
        }
      ).setOrigin(0.5, 0);

      this.container.add(header);

      // Create nodes for recipes in this category
      const nodeSpacing = 120;
      const startY = headerHeight + 60;

      category.recipes.forEach((recipe, index) => {
        const nodeX = catX + categoryWidth / 2;
        const nodeY = startY + index * nodeSpacing;

        const node = this.createRecipeNode(recipe, nodeX, nodeY, category.color);
        this.nodes.push(node);
      });

      const catHeight = startY + category.recipes.length * nodeSpacing;
      if (catHeight > maxCatHeight) maxCatHeight = catHeight;
    });

    // Create connections between nodes
    this.createConnections();

    this.calculatedHeight = maxCatHeight + 40;
  }

  /**
   * Create a recipe node
   * @param recipe - Recipe data
   * @param x - Node X position
   * @param y - Node Y position
   * @param color - Category color
   * @returns Node object
   */
  createRecipeNode(
    recipe: CraftRecipe,
    x: number,
    y: number,
    color: number
  ): DiagramNode {
    const nodeWidth = 180;
    const nodeHeight = 120;

    const nodeContainer = this.scene.add.container(x, y);

    // Node background
    const bg = this.scene.add.rectangle(0, 0, nodeWidth, nodeHeight, color, 0.2);
    bg.setStrokeStyle(2, color, 0.8);
    nodeContainer.add(bg);

    // Recipe icon and name
    const title = this.scene.add.text(
      -nodeWidth / 2 + 10,
      -nodeHeight / 2 + 8,
      `${recipe.icon} ${recipe.name}`,
      {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold"
      }
    ).setOrigin(0, 0);
    nodeContainer.add(title);

    // Input pattern (simplified grid)
    const recipeWithPattern = recipe as RecipeWithPattern;
    const gridSize = recipeWithPattern._gridSize ?? 2;
    const slotSize = 14;
    const slotGap = 3;
    const gridStartX = -nodeWidth / 2 + 10;
    const gridStartY = -nodeHeight / 2 + 35;

    for (let i = 0; i < gridSize * gridSize; i++) {
      const col = i % gridSize;
      const row = Math.floor(i / gridSize);
      const slotX = gridStartX + col * (slotSize + slotGap);
      const slotY = gridStartY + row * (slotSize + slotGap);

      const slot = this.scene.add.rectangle(
        slotX + slotSize / 2,
        slotY + slotSize / 2,
        slotSize,
        slotSize,
        0x2c3e50,
        0.8
      );
      slot.setStrokeStyle(1, 0x7f8c8d, 0.5);
      nodeContainer.add(slot);

      const item = recipeWithPattern._pattern?.[i];
      if (item) {
        const icon = this.scene.add.text(
          slotX + slotSize / 2,
          slotY + slotSize / 2 - 2,
          item.icon ?? "",
          {
            fontFamily: EMOJI_FONT,
            fontSize: "10px",
            color: "#ffffff"
          }
        ).setOrigin(0.5);
        nodeContainer.add(icon);

        // Tooltip on hover — show full item name and type
        slot.setInteractive({ useHandCursor: true });
        const tierLabel = ` ${getRecipeIngredientSuffix(item.kind ?? "")}`;
        slot.on("pointerover", () => {
          if (!this._tooltipText) {
            this._tooltipText = this.scene.add.text(0, 0, "", {
              fontFamily: "Arial",
              fontSize: "11px",
              color: "#ffffff",
              backgroundColor: "#2c3e50ee",
              padding: { x: 6, y: 4 }
            }).setDepth(9999);
          }
          this._tooltipText.setText(`${item.icon ?? ""} ${item.name ?? ""}${tierLabel}`);
          this._tooltipText.setVisible(true);
        });
        slot.on("pointermove", (pointer: Phaser.Input.Pointer) => {
          if (this._tooltipText) {
            this._tooltipText.setPosition(pointer.worldX + 12, pointer.worldY - 20);
          }
        });
        slot.on("pointerout", () => {
          if (this._tooltipText) this._tooltipText.setVisible(false);
        });
      }
    }

    // Arrow
    const arrowX = gridStartX + gridSize * (slotSize + slotGap) + 8;
    const arrowY = gridStartY + (gridSize * (slotSize + slotGap)) / 2;
    const arrow = this.scene.add.text(arrowX, arrowY, "→", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5);
    nodeContainer.add(arrow);

    // Output item
    const outX = arrowX + 15;
    const outBg = this.scene.add.rectangle(outX, arrowY, 16, 16, 0x34495e, 0.9);
    outBg.setStrokeStyle(1, color, 0.9);
    nodeContainer.add(outBg);

    const outIcon = this.scene.add.text(outX, arrowY, recipe.icon, {
      fontFamily: EMOJI_FONT,
      fontSize: "12px",
      color: "#ffffff"
    }).setOrigin(0.5);
    nodeContainer.add(outIcon);

    // Stat benefits
    const statText = this.formatStatBenefits(recipe);
    const stats = this.scene.add.text(
      -nodeWidth / 2 + 10,
      nodeHeight / 2 - 20,
      statText,
      {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#ecf0f1",
        wordWrap: { width: nodeWidth - 20 }
      }
    ).setOrigin(0, 0);
    nodeContainer.add(stats);

    // Make node interactive
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => this.onNodeClick(recipe, nodeContainer));

    this.container.add(nodeContainer);

    return {
      recipe,
      container: nodeContainer,
      x,
      y,
      bg,
      color
    };
  }

  /**
   * Format stat benefits for display
   * @param recipe - Recipe data
   * @returns Formatted stat text
   */
  formatStatBenefits(recipe: CraftRecipe): string {
    const stats = ((recipe as unknown as { stats?: ItemBonus }).stats ?? recipe.bonus ?? {}) as ItemBonus;
    const benefits = formatRecipeBonusList(stats);
    return benefits.join(", ") || t("combat.noDescription");
  }

  /**
   * Create connections between recipe nodes
   * Shows which recipes use equipment from other recipes
   */
  createConnections(): void {
    // Find recipes that use equipment as ingredients
    this.nodes.forEach((targetNode) => {
      const recipe = targetNode.recipe as RecipeWithPattern;
      const pattern = recipe._pattern ?? [];

      // Check if any ingredient is an equipment (from another recipe)
      pattern.forEach((ingredient) => {
        if (ingredient && ingredient.kind === "equipment" && ingredient.id) {
          // Find the source node that produces this equipment
          const sourceNode = this.nodes.find(
            (n) => n.recipe.id === ingredient.id!.replace("eq_", "")
          );

          if (sourceNode) {
            this.createConnection(sourceNode, targetNode);
          }
        }
      });
    });
  }

  /**
   * Create a visual connection between two nodes
   * @param sourceNode - Source node
   * @param targetNode - Target node
   */
  createConnection(sourceNode: DiagramNode, targetNode: DiagramNode): void {
    const line = this.scene.add.line(
      0, 0,
      sourceNode.x, sourceNode.y,
      targetNode.x, targetNode.y,
      0x95a5a6,
      0.3
    );
    line.setOrigin(0, 0);
    line.setLineWidth(2);

    // Add to container at the back
    this.container.addAt(line, 0);

    this.connections.push({
      line,
      source: sourceNode,
      target: targetNode
    });
  }

  /**
   * Handle node click - highlight related recipes
   * @param recipe - Clicked recipe
   * @param nodeContainer - Node container
   */
  onNodeClick(recipe: CraftRecipe, nodeContainer: Phaser.GameObjects.Container): void {
    // Reset previous selection
    if (this.selectedNode) {
      const selectedColor = this.selectedNode.color ?? 0xffffff;
      this.selectedNode.bg.setStrokeStyle(2, selectedColor, 0.8);
    }

    // Highlight selected node
    const node = this.nodes.find((n) => n.container === nodeContainer);
    if (node) {
      node.bg.setStrokeStyle(3, 0xffffff, 1.0);
      this.selectedNode = node;

      // Highlight related connections
      this.highlightRelatedRecipes(recipe);
    }
  }

  enablePanZoom(): void {
    const sceneAny = this.scene as unknown as {
      add: { zone?: (x: number, y: number, w: number, h: number) => Phaser.GameObjects.Zone };
    };
    if (!sceneAny.add.zone) return;
    const zone = this.scene.add.zone(
      this.x + this.width / 2,
      this.y + this.height / 2,
      this.width,
      this.height
    );
    zone.setInteractive();
    this.interactionZone = zone;

    this._isDragging = false;
    this._lastPointer = null;

    zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this._isDragging = true;
      this._lastPointer = { x: pointer.x, y: pointer.y };
    });

    zone.on("pointerup", () => {
      this._isDragging = false;
      this._lastPointer = null;
    });

    zone.on("pointerout", () => {
      this._isDragging = false;
      this._lastPointer = null;
    });

    zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this._isDragging || !this._lastPointer) return;
      const dx = pointer.x - this._lastPointer.x;
      const dy = pointer.y - this._lastPointer.y;
      this._lastPointer = { x: pointer.x, y: pointer.y };
      this.pan(dx, dy);
    });

    zone.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => {
      this.handleWheel(dy);
    });
  }

  handleWheel(deltaY: number): void {
    const step = deltaY > 0 ? -0.08 : 0.08;
    this.setZoom(this.zoom + step);
  }

  setZoom(nextZoom: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, nextZoom));
    this.applyTransform();
  }

  pan(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
    this.applyTransform();
  }

  applyTransform(): void {
    this.container.x = this.x + this.panX;
    this.container.y = this.y + this.panY;
    if (typeof this.container.setScale === "function") {
      this.container.setScale(this.zoom);
    } else {
      this.container.scaleX = this.zoom;
      this.container.scaleY = this.zoom;
    }
  }

  /**
   * Highlight recipes and connections related to the selected recipe
   * @param recipe - Selected recipe
   */
  highlightRelatedRecipes(recipe: CraftRecipe): void {
    // Reset all connections
    this.connections.forEach((conn) => {
      conn.line.setStrokeStyle(2, 0x95a5a6, 0.3);
    });

    // Highlight connections involving this recipe
    this.connections.forEach((conn) => {
      if (conn.source.recipe.id === recipe.id || conn.target.recipe.id === recipe.id) {
        conn.line.setStrokeStyle(3, 0xf39c12, 0.8);
      }
    });

    // Highlight nodes that are connected
    const relatedRecipeIds = new Set<string>();
    this.connections.forEach((conn) => {
      if (conn.source.recipe.id === recipe.id) {
        relatedRecipeIds.add(conn.target.recipe.id);
      }
      if (conn.target.recipe.id === recipe.id) {
        relatedRecipeIds.add(conn.source.recipe.id);
      }
    });

    this.nodes.forEach((node) => {
      if (relatedRecipeIds.has(node.recipe.id)) {
        node.bg.setStrokeStyle(2, 0xf39c12, 0.6);
      }
    });
  }

  /**
   * Destroy the diagram and clean up
   */
  destroy(): void {
    this.interactionZone?.destroy();
    this.container.destroy();
    this.nodes = [];
    this.connections = [];
    this.selectedNode = null;
  }
}
