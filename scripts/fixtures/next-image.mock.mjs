import React from "react";

export default function Image({ alt = "", height, src, width, ...props }) {
  return React.createElement("img", {
    ...props,
    alt,
    height,
    src: typeof src === "string" ? src : src?.src,
    width,
  });
}
