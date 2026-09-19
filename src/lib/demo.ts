export type EventFormat = "Doubles" | "Mixed doubles" | "Singles";

export type DemoEvent = {
  id: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  format: EventFormat;
  spotsLeft: number;
  totalSpots: number;
  group: string;
  accent: "lime" | "coral" | "blue";
  attending?: boolean;
};

export const currentUser = {
  name: "Maya Chen",
  initials: "MC",
  rating: "3.8",
  rank: 8,
  rankMovement: 2,
  record: "24 - 11",
  winRate: "68.6%",
};

export const events: DemoEvent[] = [
  {
    id: "sunrise",
    title: "Sunday Sunrise Social",
    dateLabel: "Sat, Sep 21",
    timeLabel: "8:00 - 10:00 AM",
    location: "Northside Courts",
    format: "Doubles",
    spotsLeft: 3,
    totalSpots: 16,
    group: "Northside Wolves",
    accent: "lime",
    attending: true,
  },
  {
    id: "ladder",
    title: "Wednesday Ladder Night",
    dateLabel: "Wed, Sep 25",
    timeLabel: "6:30 - 8:30 PM",
    location: "The Kitchen Yard",
    format: "Mixed doubles",
    spotsLeft: 7,
    totalSpots: 24,
    group: "Northside Wolves",
    accent: "coral",
  },
  {
    id: "beginners",
    title: "New Player Mixer",
    dateLabel: "Thu, Sep 26",
    timeLabel: "7:00 - 9:00 PM",
    location: "Riverside Rec Center",
    format: "Doubles",
    spotsLeft: 9,
    totalSpots: 20,
    group: "Riverside Picklers",
    accent: "blue",
  },
];

export const recentResults = [
  { opponent: "Jordan P. / Eli R.", event: "Tuesday Night Social", score: "11 - 8", result: "W", points: "+18", date: "Sep 17" },
  { opponent: "Tasha L. / Ben K.", event: "Tuesday Night Social", score: "9 - 11", result: "L", points: "-6", date: "Sep 17" },
  { opponent: "Sam W. / Priya D.", event: "Fall Kickoff", score: "11 - 4", result: "W", points: "+24", date: "Sep 14" },
];

export const groups = [
  { name: "Northside Wolves", location: "Portland, OR", members: 86, next: "Sunday Sunrise Social", role: "Organizer", mark: "NW", color: "lime" },
  { name: "Riverside Picklers", location: "Portland, OR", members: 42, next: "New Player Mixer", role: "Member", mark: "RP", color: "blue" },
  { name: "The Kitchen Yard", location: "Beaverton, OR", members: 124, next: "Wednesday Ladder Night", role: "Member", mark: "KY", color: "coral" },
];

export const leaderboard = [
  { rank: 1, name: "Jordan Price", initials: "JP", rating: "4.6", record: "39 - 8", movement: 1 },
  { rank: 2, name: "Priya Desai", initials: "PD", rating: "4.4", record: "34 - 12", movement: -1 },
  { rank: 3, name: "Eli Romero", initials: "ER", rating: "4.2", record: "31 - 15", movement: 2 },
  { rank: 8, name: "Maya Chen", initials: "MC", rating: "3.8", record: "24 - 11", movement: 2 },
];
