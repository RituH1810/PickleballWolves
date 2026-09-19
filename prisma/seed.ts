import { PrismaClient, EventFormat, EventStatus, GroupVisibility, Hand, MembershipRole, MembershipStatus, RsvpStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const playerNames = ["Maya Chen", "Jordan Price", "Priya Desai", "Eli Romero", "Tasha Lane", "Ben Kim", "Sam Wilson", "Noah Patel", "Avery Brooks", "Riley Stone", "Casey Morgan", "Jamie Fox", "Drew Hall", "Morgan Lee", "Taylor Reed", "Quinn James", "Alex Rivera", "Chris Park", "Sage Moore", "Robin Cole"];

async function main() {
  await prisma.rSVP.deleteMany();
  await prisma.event.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  const users = await Promise.all(playerNames.map((name, index) => prisma.user.create({
    data: { email: `${name.toLowerCase().replaceAll(" ", ".")}@demo.pickleballwolves.com`, name, role: index === 0 ? UserRole.ORGANIZER : UserRole.PLAYER, skillRating: 3.2 + (index % 8) * 0.2, preferredHand: index % 3 === 0 ? Hand.LEFT : Hand.RIGHT, homeCourt: index % 2 === 0 ? "Northside Courts" : "Riverside Rec Center" },
  })));

  const northside = await prisma.group.create({ data: { name: "Northside Wolves", slug: "northside-wolves", description: "Friendly competition, organized play, and a packed court.", location: "Portland, OR", visibility: GroupVisibility.PUBLIC, createdById: users[0].id } });
  const riverside = await prisma.group.create({ data: { name: "Riverside Picklers", slug: "riverside-picklers", description: "A welcoming home for players finding their rhythm.", location: "Portland, OR", visibility: GroupVisibility.PUBLIC, createdById: users[0].id } });

  for (const user of users) {
    await prisma.membership.create({ data: { groupId: northside.id, userId: user.id, role: user.id === users[0].id ? MembershipRole.ORGANIZER : MembershipRole.MEMBER, status: MembershipStatus.ACTIVE, joinedAt: new Date() } });
  }
  for (const user of users.slice(0, 8)) {
    await prisma.membership.create({ data: { groupId: riverside.id, userId: user.id, role: MembershipRole.MEMBER, status: MembershipStatus.ACTIVE, joinedAt: new Date() } });
  }

  const sunrise = await prisma.event.create({ data: { groupId: northside.id, createdById: users[0].id, title: "Sunday Sunrise Social", description: "A relaxed rotating-partner session for the whole pack.", startsAt: new Date("2026-09-21T08:00:00"), endsAt: new Date("2026-09-21T10:00:00"), location: "Northside Courts", courtCount: 4, playerCap: 16, minSkillRating: 3.0, maxSkillRating: 4.5, format: EventFormat.DOUBLES, status: EventStatus.PUBLISHED } });
  const ladder = await prisma.event.create({ data: { groupId: northside.id, createdById: users[0].id, title: "Wednesday Ladder Night", description: "Climb, defend, and find your next challenge.", startsAt: new Date("2026-09-25T18:30:00"), endsAt: new Date("2026-09-25T20:30:00"), location: "The Kitchen Yard", courtCount: 6, playerCap: 24, minSkillRating: 3.5, maxSkillRating: 5.5, format: EventFormat.MIXED, status: EventStatus.PUBLISHED } });
  const mixer = await prisma.event.create({ data: { groupId: riverside.id, createdById: users[0].id, title: "New Player Mixer", description: "Low-pressure games and quick introductions.", startsAt: new Date("2026-09-26T19:00:00"), endsAt: new Date("2026-09-26T21:00:00"), location: "Riverside Rec Center", courtCount: 5, playerCap: 20, format: EventFormat.DOUBLES, status: EventStatus.PUBLISHED } });

  await prisma.rSVP.createMany({ data: [{ eventId: sunrise.id, userId: users[0].id, status: RsvpStatus.GOING }, { eventId: sunrise.id, userId: users[1].id, status: RsvpStatus.GOING }, { eventId: ladder.id, userId: users[2].id, status: RsvpStatus.GOING }, { eventId: mixer.id, userId: users[3].id, status: RsvpStatus.GOING }] });
  console.log(`Seeded ${users.length} players, 2 groups, and 3 Phase 1 events.`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
