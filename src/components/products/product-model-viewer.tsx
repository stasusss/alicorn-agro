"use client";

import type { HTMLAttributes } from "react";

type ModelViewerProps = HTMLAttributes<HTMLElement> & {
  src: string;
  alt?: string;
  "camera-controls"?: boolean;
  "auto-rotate"?: boolean;
  ar?: boolean;
  "shadow-intensity"?: string;
};

declare module "react" {
  // Custom element types for <model-viewer>
  // eslint-disable-next-line @typescript-eslint/no-namespace -- React JSX augmentation
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerProps;
    }
  }
}

export function ProductModelViewer() {
  return (
    <model-viewer
      className="product-model-viewer"
      src="/3dmodel.glb"
      alt="Інтерактивна 3D-модель системи ClimateGuard"
      camera-controls
      auto-rotate
      ar
      shadow-intensity="1"
    />
  );
}

