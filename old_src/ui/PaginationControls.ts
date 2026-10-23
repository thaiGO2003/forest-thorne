interface PaginationButton {
  setVisible: (v: boolean) => void;
  setEnabled: (v: boolean) => void;
  destroy?: () => void;
}

interface SceneWithCreateButton {
  createButton: (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    options?: { variant?: string; fontSize?: number | string; bold?: boolean }
  ) => PaginationButton;
}

export interface PaginationConfig {
  x: number;
  y: number;
  onPrev: () => void;
  onNext: () => void;
  btnW?: number;
  btnH?: number;
  gap?: number;
}

export interface PaginationControls {
  prevBtn: PaginationButton;
  nextBtn: PaginationButton;
  sync: (page: number, maxPage: number) => void;
  destroy: () => void;
}

export function createPaginationButtons(scene: SceneWithCreateButton, config: PaginationConfig): PaginationControls {
  const { x, y, onPrev, onNext, btnW = 30, btnH = 26, gap = 8 } = config;

  const prevBtn = scene.createButton(
    x,
    y,
    btnW,
    btnH,
    "<",
    onPrev,
    { variant: "ghost", fontSize: 14, bold: true }
  );

  const nextBtn = scene.createButton(
    x + btnW + gap,
    y,
    btnW,
    btnH,
    ">",
    onNext,
    { variant: "ghost", fontSize: 14, bold: true }
  );

  return {
    prevBtn,
    nextBtn,
    sync: (page, maxPage) => {
      prevBtn.setVisible(true);
      nextBtn.setVisible(true);
      prevBtn.setEnabled(page > 0);
      nextBtn.setEnabled(page < maxPage);
    },
    destroy: () => {
      prevBtn.destroy?.();
      nextBtn.destroy?.();
    }
  };
}
