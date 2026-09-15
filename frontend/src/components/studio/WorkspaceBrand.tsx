"use client";

export default function WorkspaceBrand({
  onClick,
  label = "Back to library",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="studio-wordmark" onClick={onClick} aria-label={label}>
      stu<span>3</span>dio
    </button>
  );
}
