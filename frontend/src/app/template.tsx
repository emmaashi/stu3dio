"use client";

import { motion } from "framer-motion";

// App Router re-mounts template.tsx on every navigation, so a mount animation
// here gives a smooth cross-route transition. We animate opacity only (no
// resting transform) so that `position: fixed` overlays inside the studio keep
// their viewport-relative containing block.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
      style={{ height: "100%" }}
    >
      {children}
    </motion.div>
  );
}
