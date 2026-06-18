// Shared icon component for the studio workspace, backed by lucide-react for a
// clean, consistent set. Keeps the `<Icon name=... size=... />` API so all
// existing call sites work unchanged.
import {
  X,
  Play,
  Film,
  Plus,
  Minus,
  Maximize,
  FileText,
  User,
  Clapperboard,
  ArrowUp,
  Sparkles,
  Image as ImageIcon,
  Video,
  Download,
  RefreshCw,
  Paperclip,
  Ratio,
  SlidersHorizontal,
  ArrowLeft,
  Wand2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  Clock,
  File,
  Trash2,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  x: X,
  play: Play,
  film: Film,
  plus: Plus,
  minus: Minus,
  fit: Maximize,
  doc: FileText,
  user: User,
  scene: Clapperboard,
  clapper: Film,
  send: ArrowUp,
  sparkle: Sparkles,
  image: ImageIcon,
  video: Video,
  download: Download,
  refresh: RefreshCw,
  attach: Paperclip,
  ratio: Ratio,
  sliders: SlidersHorizontal,
  back: ArrowLeft,
  wand: Wand2,
  caretRight: ChevronRight,
  caretLeft: ChevronLeft,
  caretDown: ChevronDown,
  check: Check,
  clock: Clock,
  drafts: File,
  trash: Trash2,
  dots: MoreHorizontal,
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const Cmp = ICONS[name] || FileText;
  return <Cmp size={size} strokeWidth={2} />;
}

export const KIND_ICON: Record<string, string> = {
  overview: "doc",
  character: "user",
  scene: "scene",
  clip: "clapper",
  film: "play",
};
