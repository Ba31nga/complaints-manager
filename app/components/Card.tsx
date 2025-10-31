"use client";

import React from "react";

export default function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { children, className = "" } = props;
  return <div className={`card ${className}`}>{children}</div>;
}
