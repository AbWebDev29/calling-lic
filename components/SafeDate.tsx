"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

export default function SafeDate({ date, className }: { date: string | number | Date, className?: string }) {
  const [formatted, setFormatted] = useState<string>("");

  useEffect(() => {
    setFormatted(format(new Date(date), "dd MMM yyyy, HH:mm"));
  }, [date]);

  return <span className={className}>{formatted}</span>;
}
