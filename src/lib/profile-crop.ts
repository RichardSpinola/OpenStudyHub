export type CropFrame = { width: number; height: number };
export type CropOffset = { x: number; y: number };

export function profileCropGeometry(
  image: CropFrame,
  frame: CropFrame,
  zoom: number,
  offset: CropOffset,
) {
  const scale =
    Math.max(frame.width / image.width, frame.height / image.height) * zoom;
  const scaledWidth = image.width * scale;
  const scaledHeight = image.height * scale;
  const limitX = (scaledWidth - frame.width) / 2;
  const limitY = (scaledHeight - frame.height) / 2;
  const x = Math.max(-limitX, Math.min(limitX, offset.x));
  const y = Math.max(-limitY, Math.min(limitY, offset.y));

  return {
    imageStyle: {
      width: scaledWidth,
      height: scaledHeight,
      left: (frame.width - scaledWidth) / 2 + x,
      top: (frame.height - scaledHeight) / 2 + y,
    },
    source: {
      x: (limitX - x) / scale,
      y: (limitY - y) / scale,
      width: frame.width / scale,
      height: frame.height / scale,
    },
    offset: { x, y },
  };
}
