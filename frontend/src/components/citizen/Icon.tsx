import {
  Home, Siren, HeartHandshake, CloudRain, Waves, Wind, Mountain,
  Droplets, Hospital, Phone, MapPinned, LifeBuoy, Users, Route,
  Shield, ShieldCheck, Bell, MapPin, Menu, X, ChevronRight,
  Search, Megaphone, Heart, Activity, TrendingUp, TrendingDown,
  CheckCircle2, AlertTriangle, AlertCircle, Info, Clock, Navigation,
  Download, Wifi, WifiOff, MessageCircle, UserPlus, FileText, Package,
  Calendar, Map as MapIcon, Eye, Send, PhoneCall, Cross, Stethoscope,
  Ambulance, Building2, Flag, Sparkles, Sunrise, TreePine,
  ArrowRight, ArrowLeft, Plus, Filter, MoreVertical, RefreshCw,
  Check, CheckCheck, Dot, CircleDot, Radio, Zap, HandHeart, Brain,
  Flower2, Hand, Smile, BookOpen, Headphones, MessagesSquare,
  ChevronDown, ChevronUp, ExternalLink, Star, ShieldAlert,
  LocateFixed, Accessibility, Volume2, Languages, Settings, LogOut,
  HelpCircle,
  type LucideProps,
} from "lucide-react";
import { forwardRef } from "react";

type IconMap = Record<string, React.ComponentType<LucideProps>>;

const icons: IconMap = {
  Home, Siren, HeartHandshake, CloudRain, Waves, Wind, Mountain,
  Droplets, Hospital, Phone, MapPinned, LifeBuoy, Users, Route,
  Shield, ShieldCheck, Bell, MapPin, Menu, X, ChevronRight,
  Search, Megaphone, Heart, Activity, TrendingUp, TrendingDown,
  CheckCircle2, AlertTriangle, AlertCircle, Info, Clock, Navigation,
  Download, Wifi, WifiOff, MessageCircle, UserPlus, FileText, Package,
  Calendar, MapIcon, Eye, Send, PhoneCall, Cross, Stethoscope,
  Ambulance, Building2, Flag, Sparkles, Sunrise, TreePine,
  ArrowRight, ArrowLeft, Plus, Filter, MoreVertical, RefreshCw,
  Check, CheckCheck, Dot, CircleDot, Radio, Zap, HandHeart, Brain,
  Flower2, Hand, Smile, BookOpen, Headphones, MessagesSquare,
  ChevronDown, ChevronUp, ExternalLink, Star, ShieldAlert,
  LocateFixed, Accessibility, Volume2, Languages, Settings, LogOut,
};

interface IconProps extends LucideProps {
  name: string;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(({ name, ...props }, ref) => {
  const Cmp = icons[name] ?? HelpCircle;
  return <Cmp ref={ref} {...props} />;
});
Icon.displayName = "Icon";

export function getRiskColor(level: string): { bg: string; text: string; border: string; badge: string; bar: string } {
  switch (level) {
    case "low":
      return { bg: "bg-safe-50", text: "text-safe-700", border: "border-safe-200", badge: "bg-safe-100 text-safe-700", bar: "bg-safe-500" };
    case "moderate":
      return { bg: "bg-warn-50", text: "text-warn-700", border: "border-warn-200", badge: "bg-warn-100 text-warn-700", bar: "bg-warn-500" };
    case "high":
      return { bg: "bg-danger-50", text: "text-danger-700", border: "border-danger-200", badge: "bg-danger-100 text-danger-700", bar: "bg-danger-500" };
    case "critical":
      return { bg: "bg-danger-50", text: "text-danger-700", border: "border-danger-300", badge: "bg-danger-600 text-white", bar: "bg-danger-600" };
    default:
      return { bg: "bg-slate2-50", text: "text-slate2-600", border: "border-slate2-200", badge: "bg-slate2-100 text-slate2-600", bar: "bg-slate2-400" };
  }
}

export function getRiskLabel(level: string): string {
  switch (level) {
    case "low": return "Low";
    case "moderate": return "Moderate";
    case "high": return "High";
    case "critical": return "Critical";
    default: return "Unknown";
  }
}

export function getRiskDot(level: string): string {
  switch (level) {
    case "low": return "bg-safe-500";
    case "moderate": return "bg-warn-500";
    case "high": return "bg-danger-500";
    case "critical": return "bg-danger-600";
    default: return "bg-slate2-400";
  }
}
