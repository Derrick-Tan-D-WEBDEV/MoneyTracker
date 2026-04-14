import {
  Utensils,
  Car,
  Home,
  Zap,
  Film,
  ShoppingBag,
  HeartPulse,
  GraduationCap,
  User,
  Shield,
  Repeat,
  CircleDot,
  Briefcase,
  Laptop,
  TrendingUp,
  Building2,
  Store,
  PlusCircle,
  Tag,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  home: Home,
  zap: Zap,
  film: Film,
  "shopping-bag": ShoppingBag,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  user: User,
  shield: Shield,
  repeat: Repeat,
  "circle-dot": CircleDot,
  briefcase: Briefcase,
  laptop: Laptop,
  "trending-up": TrendingUp,
  building: Building2,
  store: Store,
  "plus-circle": PlusCircle,
  tag: Tag,
};

export function getCategoryIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Tag;
}
