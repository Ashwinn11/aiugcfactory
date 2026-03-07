"use client";

import * as Icons from "lucide-react";

export const Icon = ({ name, size = 18, strokeWidth = 2, className, ...props }) => {
  const LucideIcon = Icons[name];
  if (!LucideIcon) return null;
  return <LucideIcon size={size} strokeWidth={strokeWidth} className={className} {...props} />;
};
export default Icon;
