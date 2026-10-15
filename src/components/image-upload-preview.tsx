"use client";
import { CroppedImageInput } from "./cropped-image-input";
export function ImageUploadPreview({
  name,
  label,
  currentSrc,
  maxMiB = 5,
}: {
  name: string;
  label: string;
  accept?: string;
  currentSrc?: string;
  alt: string;
  maxMiB?: number;
}) {
  return (
    <CroppedImageInput
      name={name}
      label={label}
      currentSrc={currentSrc}
      maxMiB={maxMiB}
      aspectRatio={3}
      required
    />
  );
}
