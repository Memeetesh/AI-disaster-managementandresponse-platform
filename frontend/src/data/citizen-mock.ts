// Ported from the teammate's "Aasha Setu" UI prototype (bolt.new export).
//
// NONE of this is backed by a real API yet — there is no family-tracking,
// lost-and-found, or authority-alerts table/endpoint in the backend. It's
// kept here, clearly separate from src/lib/*-api.ts (the real API clients),
// so the UI has something to render until those features get built.
//
// The one exception: on the home page, the "Flood" risk card is overridden
// with the citizen's real current risk-zone score from GET /risk-map
// wherever that's available — see app/(citizen)/page.tsx.
import type { RiskCard, FamilyMember, AuthorityMessage, LostFoundItem, QuickAction } from "@/types/citizen-ui";

export const riskCards: RiskCard[] = [
  {
    id: "rainfall",
    icon: "CloudRain",
    title: "Rainfall Prediction",
    level: "moderate",
    probability: 58,
    recommendation: "Stay alert",
    trend: [30, 35, 42, 48, 52, 58, 55],
  },
  {
    id: "flood",
    icon: "Waves",
    title: "Flood Prediction",
    level: "high",
    probability: 72,
    recommendation: "Be prepared",
    trend: [40, 45, 50, 58, 65, 70, 72],
  },
  {
    id: "cyclone",
    icon: "Wind",
    title: "Cyclone Prediction",
    level: "low",
    probability: 12,
    recommendation: "No threat",
    trend: [15, 14, 13, 12, 11, 12, 12],
  },
  {
    id: "landslide",
    icon: "Mountain",
    title: "Landslide Prediction",
    level: "moderate",
    probability: 45,
    recommendation: "Monitor area",
    trend: [20, 25, 30, 35, 40, 43, 45],
  },
];

export const familyMembers: FamilyMember[] = [
  {
    id: "1",
    name: "Asha",
    role: "You",
    status: "safe",
    statusLabel: "Safe",
    lastUpdated: "2 min ago",
    location: "Home — Dehradun",
    contact: "+91 98765 43210",
    avatarColor: "bg-navy-600",
    initials: "A",
  },
  {
    id: "2",
    name: "Rajesh",
    role: "Spouse",
    status: "safe",
    statusLabel: "Safe",
    lastUpdated: "5 min ago",
    location: "Office — Rajpur Rd",
    contact: "+91 98765 43211",
    avatarColor: "bg-safe-600",
    initials: "R",
  },
  {
    id: "3",
    name: "Aarav",
    role: "Son",
    status: "warning",
    statusLabel: "At School",
    lastUpdated: "12 min ago",
    location: "School — Garhi Cantt",
    contact: "+91 98765 43212",
    avatarColor: "bg-warn-500",
    initials: "Aa",
  },
  {
    id: "4",
    name: "Meera",
    role: "Daughter",
    status: "warning",
    statusLabel: "At Home",
    lastUpdated: "3 min ago",
    location: "Home — Dehradun",
    contact: "+91 98765 43213",
    avatarColor: "bg-support-500",
    initials: "M",
  },
  {
    id: "5",
    name: "Dadi",
    role: "Mother",
    status: "danger",
    statusLabel: "Needs Assistance",
    lastUpdated: "1 min ago",
    location: "Home — Dehradun",
    contact: "+91 98765 43214",
    avatarColor: "bg-danger-500",
    initials: "D",
  },
];

export const emergencyQuickActions: QuickAction[] = [
  { id: "hospital", icon: "Hospital", label: "Nearest Hospital", detail: "2.4 km away", color: "text-safe-600 bg-safe-50" },
  { id: "helpline", icon: "Phone", label: "Helpline Number", detail: "112", color: "text-navy-600 bg-navy-50" },
  { id: "offline-map", icon: "MapPinned", label: "Offline Map", detail: "Download / Open Map", color: "text-warn-600 bg-warn-50" },
  { id: "rescue", icon: "LifeBuoy", label: "Nearest Rescue Center", detail: "1.8 km away", color: "text-danger-600 bg-danger-50" },
];

export const authorityMessages: AuthorityMessage[] = [
  {
    id: "1",
    source: "IMD Dehradun",
    sourceType: "government",
    title: "Heavy Rainfall Warning — Red Alert",
    body: "Heavy to very heavy rainfall expected across Dehradun district over the next 48 hours. Residents in low-lying areas near the Bankipur River are advised to move to higher ground. Emergency shelters are open at Garhi Cantt and Rajpur Road.",
    time: "2 hours ago",
    priority: "critical",
    verified: true,
  },
  {
    id: "2",
    source: "Uttarakhand SDMA",
    sourceType: "government",
    title: "Evacuation Advisory — River Bank Areas",
    body: "Voluntary evacuation recommended for areas within 500m of the Bankipur River. Relief camps have been set up at the following locations. Transport will be arranged from 4 PM onwards.",
    time: "4 hours ago",
    priority: "warning",
    verified: true,
  },
  {
    id: "3",
    source: "District Magistrate",
    sourceType: "government",
    title: "School Closures Announced",
    body: "All schools in Dehradun district will remain closed for the next two days due to the weather advisory. Online classes will continue as scheduled.",
    time: "5 hours ago",
    priority: "info",
    verified: true,
  },
  {
    id: "4",
    source: "Red Cross Uttarakhand",
    sourceType: "ngo",
    title: "Relief Supplies Distribution",
    body: "Relief supplies including food, water, and blankets are being distributed at the Garhi Cantt community center. Volunteers are needed for packing and distribution.",
    time: "6 hours ago",
    priority: "info",
    verified: true,
  },
  {
    id: "5",
    source: "NDRF Team 7",
    sourceType: "government",
    title: "Rescue Operations Underway",
    body: "NDRF teams have been deployed to the Doon Valley region. If you require rescue, call 112 or use the SOS feature in this app. Stay on higher ground.",
    time: "8 hours ago",
    priority: "warning",
    verified: true,
  },
];

export const lostFoundItems: LostFoundItem[] = [
  {
    id: "1",
    type: "missing-person",
    name: "Priya Sharma",
    description: "Female, 34 years, wearing a blue saree. Last seen near Rajpur Road market.",
    location: "Rajpur Road, Dehradun",
    status: "active",
    date: "Sep 5, 2026",
    contact: "+91 98765 11111",
  },
  {
    id: "2",
    type: "found-person",
    name: "Elderly Male (Unknown)",
    description: "Approximately 65 years, found near Garhi Cantt bus stop. Safe and receiving care.",
    location: "Garhi Cantt, Dehradun",
    status: "active",
    date: "Sep 5, 2026",
    contact: "+91 98765 22222",
  },
  {
    id: "3",
    type: "belonging",
    name: "Blue School Bag",
    description: 'Found near the river bank. Contains books and a lunch box. Name tag reads "Aarav".',
    location: "Bankipur River Bank",
    status: "active",
    date: "Sep 4, 2026",
    contact: "+91 98765 33333",
  },
  {
    id: "4",
    type: "missing-person",
    name: "Ramesh Verma",
    description: "Male, 45 years, last seen near the Doon Valley bridge. Wearing a white kurta.",
    location: "Doon Valley, Dehradun",
    status: "resolved",
    date: "Sep 3, 2026",
    contact: "+91 98765 44444",
  },
];

export const riverLevelData = {
  current: 1.8,
  normal: 1.2,
  warning: 2.0,
  critical: 2.5,
  unit: "m",
  name: "Bankipur River",
  lastUpdated: "30 min ago",
  history: [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.75, 1.8, 1.8],
};

export const riverCourseData = {
  status: "stable",
  label: "No significant change detected",
  detail: "Course stable",
  lastUpdated: "1 hour ago",
};

export const notifications = [
  { id: "1", title: "IMD Red Alert", body: "Heavy rainfall expected in next 48 hours", time: "2h ago", read: false, priority: "critical" as const },
  { id: "2", title: "Family Check-in", body: 'Dadi marked as "Needs Assistance"', time: "1h ago", read: false, priority: "warning" as const },
  { id: "3", title: "River Level Rising", body: "Bankipur River now at 1.8m (above normal)", time: "30m ago", read: false, priority: "warning" as const },
  { id: "4", title: "School Closure", body: "All schools closed for next 2 days", time: "5h ago", read: true, priority: "info" as const },
];

export const breathingExercises = [
  { id: "1", title: "4-7-8 Breathing", description: "Inhale for 4 seconds, hold for 7, exhale for 8", duration: "5 min" },
  { id: "2", title: "Box Breathing", description: "Equal inhale, hold, exhale, and hold", duration: "4 min" },
  { id: "3", title: "Calm Breath", description: "Slow, deep belly breathing for relaxation", duration: "6 min" },
];

export const groundingExercises = [
  { id: "1", title: "5-4-3-2-1 Grounding", description: "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste" },
  { id: "2", title: "Body Scan", description: "Slowly bring attention to each part of your body from head to toe" },
  { id: "3", title: "Safe Place Visualization", description: "Picture a calm, safe place in vivid detail" },
];
