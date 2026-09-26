import { describe, expect, it } from "vitest";

import { profileCropGeometry } from "@/lib/profile-crop";

describe("profile image crop", () => {
  it("keeps a square avatar inside a landscape source while dragging and zooming", () => {
    const center = profileCropGeometry(
      { width: 1200, height: 600 },
      { width: 300, height: 300 },
      1,
      { x: 0, y: 0 },
    );
    expect(center.source).toEqual({ x: 300, y: 0, width: 600, height: 600 });
    const moved = profileCropGeometry(
      { width: 1200, height: 600 },
      { width: 300, height: 300 },
      2,
      { x: 9999, y: -9999 },
    );
    expect(moved.source.x).toBe(0);
    expect(moved.source.y + moved.source.height).toBe(600);
  });

  it("exports a three-to-one banner without exceeding the source", () => {
    const crop = profileCropGeometry(
      { width: 600, height: 1200 },
      { width: 480, height: 160 },
      1.5,
      { x: 1000, y: 1000 },
    );
    expect(crop.source.x).toBe(0);
    expect(crop.source.y).toBe(0);
    expect(crop.source.width / crop.source.height).toBe(3);
  });
});
