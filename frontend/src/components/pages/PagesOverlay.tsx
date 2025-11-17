"use client";

import { useSceneStore } from "@/store/useSceneStore";
import Character2Page from "@/components/pages/Character2Page";
import Character3Page from "@/components/pages/Character3Page";
import Character4Page from "@/components/pages/Character4Page";

export default function PagesOverlay({ onClose }: { onClose?: () => void }) {
  const selectedPageId = useSceneStore((s) => s.selectedPageId);

  return (
    <>
      {selectedPageId === "character_2" && <Character2Page onClose={onClose} />}
      {selectedPageId === "character_3" && <Character3Page onClose={onClose} />}
      {selectedPageId === "character_4" && <Character4Page onClose={onClose} />}
    </>
  );
}
