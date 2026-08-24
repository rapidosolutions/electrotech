/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
import type { ImgHTMLAttributes } from "react";

export default function Image(props: ImgHTMLAttributes<HTMLImageElement>) {
  // Test-only replacement for the framework image component.
  const { priority: _priority, ...imageProps } = props as ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean };
  void _priority;
  return <img {...imageProps} />;
}
