type DimOverlayProps = {
  onClick?: () => void;
};

/**
 * 開いている要素（selector / dropdown 等）を前面に浮かせるため、
 * 背景全体を薄暗くする全画面オーバーレイ。
 * 表示するかどうかは呼び出し側で制御する。
 */
export function DimOverlay({ onClick }: DimOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/50"
      aria-hidden
      onClick={onClick}
    />
  )
}
