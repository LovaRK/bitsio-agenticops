"use client";

import { motion } from "framer-motion";

export function MotionCard({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <motion.article
      whileHover={{ scale: 1.02, boxShadow: "0 0 24px rgba(173, 198, 255, 0.25)" }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={className}
      title={title}
    >
      {children}
    </motion.article>
  );
}

