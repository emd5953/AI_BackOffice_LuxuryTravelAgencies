import { db } from "./index";
import {
  clients,
  clientPreferences,
  trips,
  suppliers,
  threads,
  messages,
  callNotes,
  intakeForms,
  drafts,
  quotes,
  contextChunks,
} from "./schema";

// Deterministic seed for a fictional agency: Meridian Private Travel.
// Designer persona: Elena Voss <elena@meridianprivate.com>

const DESIGNER = "elena@meridianprivate.com";

function daysAgo(n: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function seed() {
  // Idempotent: wipe in FK-safe order
  await db.delete(contextChunks);
  await db.delete(quotes);
  await db.delete(drafts);
  await db.delete(intakeForms);
  await db.delete(callNotes);
  await db.delete(messages);
  await db.delete(threads);
  await db.delete(clientPreferences);
  await db.delete(trips);
  await db.delete(suppliers);
  await db.delete(clients);

  // ---------- Clients ----------
  const [meyer, ashford, chen] = await db
    .insert(clients)
    .values([
      {
        name: "Daniel & Sarah Meyer",
        email: "dmeyer@meyercapital.com",
        bio: "Repeat clients since 2023 (Morocco, Iceland). Two kids, 9 and 12. Daniel is brief over email; Sarah makes the real decisions. High spend, low patience for back-and-forth.",
        createdAt: daysAgo(400),
      },
      {
        name: "Victoria Ashford",
        email: "victoria.ashford@ashfordlaw.co.uk",
        bio: "Referred by the Meyers. London-based partner at a law firm. 30th wedding anniversary trip is the current priority. Formal in correspondence, expects the same.",
        createdAt: daysAgo(90),
      },
      {
        name: "Robert Chen",
        email: "rchen@vectorpartners.io",
        bio: "SF-based VC. Books late, decides fast, never fills out forms. Will take a phone call over an email chain every time.",
        createdAt: daysAgo(200),
      },
    ])
    .returning();

  // ---------- Trips ----------
  const [meyerPatagonia, ashfordJapan, chenKenya] = await db
    .insert(trips)
    .values([
      {
        clientId: meyer.id,
        title: "Meyer family — Patagonia, March",
        destination: "Patagonia, Chile",
        status: "planning",
        startDate: "2027-03-14",
        endDate: "2027-03-24",
        partySize: 4,
        budgetUsd: 85000,
        createdAt: daysAgo(30),
      },
      {
        clientId: ashford.id,
        title: "Ashford 30th anniversary — Japan",
        destination: "Kyoto & Tokyo, Japan",
        status: "proposal_sent",
        startDate: "2026-11-05",
        endDate: "2026-11-16",
        partySize: 2,
        budgetUsd: 60000,
        createdAt: daysAgo(45),
      },
      {
        clientId: chen.id,
        title: "Chen — Kenya, short notice",
        destination: "Masai Mara, Kenya",
        status: "inquiry",
        partySize: 1,
        budgetUsd: 40000,
        createdAt: daysAgo(3),
      },
    ])
    .returning();

  // ---------- Suppliers ----------
  const [explora, awasi, tierra, hiiragiya, tokyoDmc] = await db
    .insert(suppliers)
    .values([
      {
        name: "Explora Patagonia",
        type: "lodge",
        location: "Torres del Paine, Chile",
        contactName: "Camila Reyes",
        contactEmail: "reservas@explora-patagonia.example",
        commissionPct: 10,
        notes: "All-inclusive. Camila replies within a day. Holds expire after 7 days, strict.",
      },
      {
        name: "Awasi Patagonia",
        type: "lodge",
        location: "Torres del Paine, Chile",
        contactName: "Martín Soler",
        contactEmail: "reservations@awasi.example",
        commissionPct: 12,
        notes: "Private guide + vehicle per villa. Slow over email, faster on WhatsApp. Best rates for 4+ nights.",
      },
      {
        name: "Tierra Patagonia",
        type: "lodge",
        location: "Torres del Paine, Chile",
        contactName: "Francisca Núñez",
        contactEmail: "res@tierrapatagonia.example",
        commissionPct: 10,
        notes: "Family suites connect. Quotes in USD, sometimes CLP — check the currency line.",
      },
      {
        name: "Hiiragiya Ryokan",
        type: "hotel",
        location: "Kyoto, Japan",
        contactName: "Keiko Nishimura",
        contactEmail: "welcome@hiiragiya.example",
        commissionPct: 8,
        notes: "Six generations family-run. Kaiseki dinners can be adapted for dietary needs with 72h notice.",
      },
      {
        name: "Kanpai Journeys (DMC)",
        type: "dmc",
        location: "Tokyo, Japan",
        contactName: "Sota Maruyama",
        contactEmail: "sota@kanpaijourneys.example",
        commissionPct: 15,
        notes: "Ground handling across Japan. Excellent private guides; ask for Yuki for food-focused days.",
      },
    ])
    .returning();

  // ---------- Threads & messages ----------

  // 1. Meyer client thread — unanswered inbound (Phase 1 drafting target)
  const [meyerThread] = await db
    .insert(threads)
    .values({
      subject: "Re: Patagonia in March — a few questions",
      counterpartType: "client",
      clientId: meyer.id,
      tripId: meyerPatagonia.id,
      lastMessageAt: daysAgo(1, 7),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: meyerThread.id,
      direction: "outbound",
      fromAddr: DESIGNER,
      toAddr: meyer.email,
      body: `Dear Daniel and Sarah,

Wonderful news — March is prime season for Torres del Paine. I'm holding three lodge options and will have a comparison for you this week. All three can do connecting or family rooms for the kids.

One question while I work on this: how do you feel about the pace — one base for the full stay, or split between two lodges?

Warmly,
Elena`,
      sentAt: daysAgo(2, 16),
    },
    {
      threadId: meyerThread.id,
      direction: "inbound",
      fromAddr: meyer.email,
      toAddr: DESIGNER,
      body: `Elena,

Sarah says one base, we're done splitting hotels after Iceland. Kids want horses. Also - my mother may join for the first 4 nights, is that a problem for rooms? And remind me what the weather does in late March.

D`,
      sentAt: daysAgo(1, 7),
    },
  ]);

  // 2. Supplier thread — Tierra rate quote, messy format (Phase 2 parsing target)
  const [tierraThread] = await db
    .insert(threads)
    .values({
      subject: "RE: RE: Availability request — Meyer party x4, 14-24 March",
      counterpartType: "supplier",
      supplierId: tierra.id,
      tripId: meyerPatagonia.id,
      lastMessageAt: daysAgo(2, 11),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: tierraThread.id,
      direction: "outbound",
      fromAddr: DESIGNER,
      toAddr: tierra.contactEmail,
      body: `Dear Francisca,

Could you check availability and your best rate for a family of four (children 9 and 12), 14–24 March 2027? Family suite or connecting rooms preferred. All-inclusive programme.

Many thanks,
Elena Voss
Meridian Private Travel`,
      sentAt: daysAgo(4, 9),
    },
    {
      threadId: tierraThread.id,
      direction: "inbound",
      fromAddr: tierra.contactEmail,
      toAddr: DESIGNER,
      body: `Dear Elena, greetings from Patagonia!!

For your dates we have the following;

MARCH 14-24 (10 nts) - Familia Suite (2 adults + 2 children)
Rate: USD 1.890 per night all inclusive programme *children 50% discount applies ages 4-12*
OR standard rooms x2 interconnected USD 1.420/night/room

Please note rates NET, holds valid 5 days only due high season. Transfers from Puerto Natales included, from El Calafate ARS supplement or USD 380 per way.

We wait your confirmation!
Saludos cordiales,
Francisca`,
      sentAt: daysAgo(2, 11),
    },
  ]);

  // 2b. Explora rate quote — clean tone but per-PERSON pricing (Phase 2 trap #2)
  const [exploraThread] = await db
    .insert(threads)
    .values({
      subject: "RE: Availability — Meyer family x4, 14-24 March 2027",
      counterpartType: "supplier",
      supplierId: explora.id,
      tripId: meyerPatagonia.id,
      lastMessageAt: daysAgo(3, 15),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: exploraThread.id,
      direction: "outbound",
      fromAddr: DESIGNER,
      toAddr: explora.contactEmail,
      body: `Dear Camila,

Could you check availability and your best rate for a family of four (children 9 and 12), 14–24 March 2027? Connecting rooms preferred. The children are keen riders, so daily horseback options matter.

Many thanks,
Elena Voss
Meridian Private Travel`,
      sentAt: daysAgo(4, 9),
    },
    {
      threadId: exploraThread.id,
      direction: "inbound",
      fromAddr: explora.contactEmail,
      toAddr: DESIGNER,
      body: `Dear Elena,

Thank you for thinking of Explora for the Meyer family. For 14–24 March 2027 we are pleased to offer:

Two connecting Cordillera rooms
Rate: USD 1,095 per person per night, double occupancy, all-inclusive programme (full board, open bar, two daily guided explorations, transfers from Puerto Natales airport).
Children up to 12 years sharing the programme: 50% of the adult rate.

Our rates are commissionable at 10%. Horseback riding is available every day from our own stables at no supplement — the kids will love it.

We can hold the space for 7 days from today.

Warm regards,
Camila Reyes
Reservations, Explora Patagonia`,
      sentAt: daysAgo(3, 15),
    },
  ]);

  // 2c. Awasi rate quote — informal, European decimals, NET, relative hold date (trap #3)
  const [awasiThread] = await db
    .insert(threads)
    .values({
      subject: "Re: Meyer family March 2027??",
      counterpartType: "supplier",
      supplierId: awasi.id,
      tripId: meyerPatagonia.id,
      lastMessageAt: daysAgo(1, 19),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: awasiThread.id,
      direction: "outbound",
      fromAddr: DESIGNER,
      toAddr: awasi.contactEmail,
      body: `Dear Martín,

Checking availability and rates for a family of four (children 9 and 12), 14–24 March 2027. A villa would suit them well. Daily riding options are important for the children.

Many thanks,
Elena Voss
Meridian Private Travel`,
      sentAt: daysAgo(4, 9),
    },
    {
      threadId: awasiThread.id,
      direction: "inbound",
      fromAddr: awasi.contactEmail,
      toAddr: DESIGNER,
      body: `Hola Elena!!

Good news - we have 1 villa left for those dates. Villa sleeps the family of 4 comfortable (master + second bedroom).

Rate for your dates: US$ 3.290 per night for the villa, includes your private guide + 4x4 for every villa (so riding every day no problem, we arrange with the estancia next door), full board and bar. Minimum 3 nights. And for you: stay 10 pay 9 ;)

Please note these rates are NET, non commissionable.

Only 1 villa left so please advise soon, I can hold till Friday only.

PS - for the grandmother we could add extra bed in the master but honestly villa is comfortable for 4, for 5 is tight. Maybe she takes the second villa if something opens up? Will keep you posted.

Saludos!
Martín`,
      sentAt: daysAgo(1, 19),
    },
  ]);

  // 3. Ashford client thread — anniversary trip, dietary detail buried in email
  const [ashfordThread] = await db
    .insert(threads)
    .values({
      subject: "November itinerary — thoughts",
      counterpartType: "client",
      clientId: ashford.id,
      tripId: ashfordJapan.id,
      lastMessageAt: daysAgo(5, 14),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: ashfordThread.id,
      direction: "inbound",
      fromAddr: ashford.email,
      toAddr: DESIGNER,
      body: `Dear Elena,

The proposal is close. Two notes: George has been told to avoid shellfish entirely now (doctor's orders, not a preference), so the kaiseki evenings will need adjusting. And we would rather not change hotels more than once — the Kyoto/Tokyo split is fine, nothing further.

The teahouse evening you described sounds precisely right for the anniversary itself.

With thanks,
Victoria`,
      sentAt: daysAgo(5, 14),
    },
  ]);

  // ---------- Call notes ----------
  await db.insert(callNotes).values([
    {
      clientId: meyer.id,
      tripId: meyerPatagonia.id,
      body: "Call w/ Sarah 20 min. Confirmed: one lodge only. Kids OBSESSED with horses after ranch summer camp — riding must be daily option. Sarah hates boats (skip any glacier navigation day). Grandmother joining first 4 nights is 80% likely, needs own room, ground floor if possible. Budget flexible upward for the right place. She mentioned they loved guide Hassan in Morocco — 'find us a Hassan.'",
      createdAt: daysAgo(12),
    },
    {
      clientId: chen.id,
      tripId: chenKenya.id,
      body: "Robert called 11pm his time. Wants Mara for the migration window, flying in from a Lagos board meeting. 5-6 nights, best camp available, doesn't care which. Will not fill out the form. Needs visa guidance for Kenya on a US passport. Decide-by: this Friday.",
      createdAt: daysAgo(3),
    },
  ]);

  // ---------- Intake form ----------
  await db.insert(intakeForms).values({
    clientId: ashford.id,
    tripId: ashfordJapan.id,
    answers: {
      occasion: "30th wedding anniversary",
      travelers: "2 adults (Victoria 58, George 61)",
      dates: "First two weeks of November 2026, flexible by 3 days",
      budget: "£40,000–£50,000 excluding flights",
      pace: "Slow mornings. Maximum two hotels for the whole trip.",
      interests: "Gardens, craft (ceramics, textiles), food but nothing 'adventurous', one special evening for the anniversary itself",
      avoid: "Crowds, early starts, more than one internal flight",
      dietary: "George: no shellfish (medical). Victoria: none.",
    },
    submittedAt: daysAgo(45),
  });

  // ---------- Preferences (traceable facts) ----------
  const [meyerCall, chenCall] = [1, 2]; // call note ids in insert order
  await db.insert(clientPreferences).values([
    { clientId: meyer.id, kind: "confirmed", text: "One lodge per trip — no hotel splits", source: `call_note:${meyerCall}`, createdAt: daysAgo(12) },
    { clientId: meyer.id, kind: "confirmed", text: "Daily horseback riding option for the kids", source: `call_note:${meyerCall}`, createdAt: daysAgo(12) },
    { clientId: meyer.id, kind: "confirmed", text: "Sarah: no boats", source: `call_note:${meyerCall}`, createdAt: daysAgo(12) },
    { clientId: meyer.id, kind: "inferred", text: "Prefers concise emails; decisions via Sarah", source: "message:2", createdAt: daysAgo(1) },
    { clientId: ashford.id, kind: "confirmed", text: "George: no shellfish — medical, not preference", source: "message:5", createdAt: daysAgo(5) },
    { clientId: ashford.id, kind: "confirmed", text: "Max two hotels per trip", source: "form:1", createdAt: daysAgo(45) },
    { clientId: chen.id, kind: "confirmed", text: "Phone over email; never fills out forms", source: `call_note:${chenCall}`, createdAt: daysAgo(3) },
  ]);

  console.log("Seeded: 3 clients, 3 trips, 5 suppliers, 5 threads, call notes, form, preferences.");
}

seed().then(() => process.exit(0));
