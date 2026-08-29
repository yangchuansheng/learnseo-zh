import React from "react";

export default function Link({ children, href, ...props }) {
  return React.createElement("a", {
    ...props,
    href: typeof href === "string" ? href : href?.pathname,
  }, children);
}
