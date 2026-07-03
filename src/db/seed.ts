import { loadEnvConfig } from "@next/env";
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
  agentRuns,
  evalResults,
  suggestions,
} from "./schema";

loadEnvConfig(process.cwd());

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
  const { db } = await import("./index");

  // Idempotent: wipe in FK-safe order
  await db.delete(suggestions);
  await db.delete(evalResults);
  await db.delete(agentRuns);
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
  const [meyer, ashford, chen, rao, ortega] = await db
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
      {
        name: "Priya & Anil Rao",
        email: "priya@raofamilyoffice.com",
        bio: "Singapore-based family office. Three-generation trips: Priya, Anil, their twins age 7, and Priya's father. Priya is detail-oriented and kind, Anil cares about privacy and direct flights.",
        createdAt: daysAgo(150),
      },
      {
        name: "Javier & Lucia Ortega",
        email: "lucia.ortega@atelierortega.mx",
        bio: "Mexico City art collectors. They travel for food, private access, and craftsmanship. Lucia sends voice-note style emails with many details; Javier wants numbers and cancellation terms.",
        createdAt: daysAgo(70),
      },
    ])
    .returning();

  // ---------- Trips ----------
  const [meyerPatagonia, ashfordJapan, chenKenya, raoMaldives, ortegaSicily] = await db
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
      {
        clientId: rao.id,
        title: "Rao family — Maldives winter break",
        destination: "Noonu Atoll, Maldives",
        status: "planning",
        startDate: "2026-12-18",
        endDate: "2026-12-27",
        partySize: 5,
        budgetUsd: 120000,
        createdAt: daysAgo(18),
      },
      {
        clientId: ortega.id,
        title: "Ortega — Sicily food & craft",
        destination: "Palermo, Noto & Mount Etna, Sicily",
        status: "inquiry",
        startDate: "2026-10-03",
        endDate: "2026-10-12",
        partySize: 2,
        budgetUsd: 70000,
        createdAt: daysAgo(9),
      },
    ])
    .returning();

  // ---------- Suppliers ----------
  const [
    explora,
    awasi,
    tierra,
    hiiragiya,
    tokyoDmc,
    angama,
    safariArchitects,
    soneva,
    joali,
    sicilianRoads,
    villaSantAndrea,
  ] = await db
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
      {
        name: "Angama Mara",
        type: "lodge",
        location: "Masai Mara, Kenya",
        contactName: "Njeri Wanjiru",
        contactEmail: "reservations@angama.example",
        commissionPct: 10,
        notes: "Strong for short-notice VIPs. Helicopter picnic can be arranged if weather allows.",
      },
      {
        name: "Safari Architects",
        type: "dmc",
        location: "Nairobi, Kenya",
        contactName: "Tom Okello",
        contactEmail: "tom@safariarchitects.example",
        commissionPct: 15,
        notes: "Excellent meet-and-assist and internal air handling. Replies fast but often quotes gross package totals.",
      },
      {
        name: "Soneva Jani",
        type: "hotel",
        location: "Noonu Atoll, Maldives",
        contactName: "Aisha Latheef",
        contactEmail: "reservations@sonevajani.example",
        commissionPct: 10,
        notes: "Best fit for families wanting space and privacy. Taxes and service often written as ++.",
      },
      {
        name: "JOALI Maldives",
        type: "hotel",
        location: "Raa Atoll, Maldives",
        contactName: "Mila Petrovic",
        contactEmail: "sales@joali.example",
        commissionPct: 12,
        notes: "Polished service, strong wellness, more design-forward than barefoot. Seaplane windows can be tight.",
      },
      {
        name: "Sicilian Roads",
        type: "dmc",
        location: "Palermo, Sicily",
        contactName: "Alessandra Greco",
        contactEmail: "alessandra@sicilianroads.example",
        commissionPct: 15,
        notes: "Private access to artisans and family wineries. Cancellation terms vary by villa partner.",
      },
      {
        name: "Villa Sant'Andrea, A Belmond Hotel",
        type: "hotel",
        location: "Taormina Mare, Sicily",
        contactName: "Giulia Romano",
        contactEmail: "reservations@villasantandrea.example",
        commissionPct: 10,
        notes: "Great beach finale after Palermo/Etna. Suites sell out early during October events.",
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

  // 3b. Ashford supplier threads — Japan quote and availability details
  const [hiiragiyaThread] = await db
    .insert(threads)
    .values({
      subject: "Re: Ashford anniversary stay — November",
      counterpartType: "supplier",
      supplierId: hiiragiya.id,
      tripId: ashfordJapan.id,
      lastMessageAt: daysAgo(4, 9),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: hiiragiyaThread.id,
      direction: "outbound",
      fromAddr: DESIGNER,
      toAddr: hiiragiya.contactEmail,
      body: `Dear Keiko,

May I check availability for two adults, 5-9 November 2026? This is a 30th wedding anniversary. They need a shellfish-free kaiseki option for medical reasons.

Warmly,
Elena`,
      sentAt: daysAgo(6, 11),
    },
    {
      threadId: hiiragiyaThread.id,
      direction: "inbound",
      fromAddr: hiiragiya.contactEmail,
      toAddr: DESIGNER,
      body: `Dear Ms. Voss,

Thank you very much. We can offer one Shin room for 5-9 November, 4 nights.

Rate: JPY 242,000 per room per night, including breakfast and kaiseki dinner for two guests.
Tax and service included. Non-commissionable.

We can prepare shellfish-free kaiseki if advised 7 days prior. Please note dashi may contain fish unless a fully vegetarian broth is requested.

We may hold the room until Monday 10:00 Japan time.

Sincerely,
Keiko Nishimura`,
      sentAt: daysAgo(4, 9),
    },
  ]);

  const [tokyoDmcThread] = await db
    .insert(threads)
    .values({
      subject: "Draft programme — Ashford Kyoto/Tokyo",
      counterpartType: "supplier",
      supplierId: tokyoDmc.id,
      tripId: ashfordJapan.id,
      lastMessageAt: daysAgo(2, 18),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: tokyoDmcThread.id,
      direction: "outbound",
      fromAddr: DESIGNER,
      toAddr: tokyoDmc.contactEmail,
      body: `Dear Sota,

Could you price guiding and ground handling for the Ashfords, 5-16 November? Please keep mornings slow and avoid more than one hotel change.

Many thanks,
Elena`,
      sentAt: daysAgo(5, 10),
    },
    {
      threadId: tokyoDmcThread.id,
      direction: "inbound",
      fromAddr: tokyoDmc.contactEmail,
      toAddr: DESIGNER,
      body: `Dear Elena,

For Victoria and George Ashford we suggest:
- Kyoto private guiding 3 half-days
- Anniversary teahouse evening with geiko introduction
- Shinkansen Kyoto to Tokyo, green car
- Tokyo craft and gardens programme 2 days
- All transfers by Alphard

Programme fee: JPY 1,860,000 total for two guests, gross, including guide fees, transfers, teahouse evening, train tickets, and restaurant booking support. Hotels not included.

We are holding Yuki for the Kyoto food/craft days until this Friday. Tea house deposit is non-refundable once confirmed.

Warm regards,
Sota`,
      sentAt: daysAgo(2, 18),
    },
  ]);

  // 4. Chen supplier threads — short-notice Kenya examples
  const [angamaThread] = await db
    .insert(threads)
    .values({
      subject: "Urgent availability — Chen solo traveller",
      counterpartType: "supplier",
      supplierId: angama.id,
      tripId: chenKenya.id,
      lastMessageAt: daysAgo(1, 8),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: angamaThread.id,
      direction: "outbound",
      fromAddr: DESIGNER,
      toAddr: angama.contactEmail,
      body: `Dear Njeri,

Do you have a tent for one guest for 5 or 6 nights during migration season? He is flexible on exact dates but needs a fast decision and seamless arrival from Lagos.

Warmly,
Elena`,
      sentAt: daysAgo(2, 17),
    },
    {
      threadId: angamaThread.id,
      direction: "inbound",
      fromAddr: angama.contactEmail,
      toAddr: DESIGNER,
      body: `Dear Elena,

We can accommodate Mr Chen in a Tented Suite for 6 nights, 22-28 August 2026.

Single occupancy rate: USD 2,450 per night, gross, full board, laundry, drinks, shared game drives, and Angama airstrip transfers included.
Park fees are excluded at USD 200 per person per day and may change without notice.

We can hold for 48 hours only. Ballooning has one seat left on 24 August at USD 560.

Warm regards,
Njeri`,
      sentAt: daysAgo(1, 8),
    },
  ]);

  const [safariThread] = await db
    .insert(threads)
    .values({
      subject: "Chen Kenya logistics",
      counterpartType: "supplier",
      supplierId: safariArchitects.id,
      tripId: chenKenya.id,
      lastMessageAt: daysAgo(1, 13),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: safariThread.id,
      direction: "inbound",
      fromAddr: safariArchitects.contactEmail,
      toAddr: DESIGNER,
      body: `Elena,

We can handle JKIA meet & assist, Wilson transfer, return domestic flights, and visa briefing for Mr Chen.

Package total: USD 3,880 for one guest, gross. Includes meet & assist, private transfers in Nairobi, Wilson-Mara-Wilson flights, AMREF cover, and our 24/7 duty officer. Does not include Kenya eTA fees.

Important: Lagos arrival after 20:30 risks missing same-day Wilson connection, so we recommend Nairobi overnight if he lands late.

Tom`,
      sentAt: daysAgo(1, 13),
    },
  ]);

  // 5. Rao client and supplier threads — multi-generation Maldives
  const [raoThread] = await db
    .insert(threads)
    .values({
      subject: "Maldives — villa layouts and Grandad",
      counterpartType: "client",
      clientId: rao.id,
      tripId: raoMaldives.id,
      lastMessageAt: daysAgo(1, 21),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: raoThread.id,
      direction: "outbound",
      fromAddr: DESIGNER,
      toAddr: rao.email,
      body: `Dear Priya,

I am checking the larger two- and three-bedroom villas now, especially layouts where your father can avoid stairs. I will also confirm seaplane timing around the children's school break arrivals.

Warmly,
Elena`,
      sentAt: daysAgo(2, 12),
    },
    {
      threadId: raoThread.id,
      direction: "inbound",
      fromAddr: rao.email,
      toAddr: DESIGNER,
      body: `Dear Elena,

Thank you. A few details before we choose: Appa can manage a few steps but not a long staircase, and he needs shade close to the pool. The twins are very excited about the slide villas but I do not want anything that feels unsafe.

Anil is asking whether we can arrive by direct seaplane after the Singapore flight or whether we need to overnight in Male.

Also please remind me which property can do Jain vegetarian meals properly, not just pasta and salad.

Warmly,
Priya`,
      sentAt: daysAgo(1, 21),
    },
  ]);

  const [sonevaThread] = await db
    .insert(threads)
    .values({
      subject: "Rao family festive availability",
      counterpartType: "supplier",
      supplierId: soneva.id,
      tripId: raoMaldives.id,
      lastMessageAt: daysAgo(2, 9),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: sonevaThread.id,
      direction: "inbound",
      fromAddr: soneva.contactEmail,
      toAddr: DESIGNER,
      body: `Dear Elena,

For the Rao family, 18-27 December 2026:

2 Bedroom Water Reserve with Slide: USD 6,750++ per villa per night, breakfast included.
3 Bedroom Island Reserve: USD 8,900++ per villa per night, breakfast included, no overwater stairs and easier for grandfather.

++ means 10% service charge and 16% GST. Festive gala dinners are mandatory on 24 and 31 Dec; for their stay only 24 Dec applies at USD 680 per adult / USD 340 per child. Jain vegetarian menus can be arranged with 14 days notice.

Seaplane transfers: USD 1,250 per adult return, USD 625 per child return. Last seaplane departs Male around 16:00, subject to daylight and weather.

We can hold both options for 72 hours.

Warm regards,
Aisha`,
      sentAt: daysAgo(2, 9),
    },
  ]);

  const [joaliThread] = await db
    .insert(threads)
    .values({
      subject: "JOALI festive — Rao family",
      counterpartType: "supplier",
      supplierId: joali.id,
      tripId: raoMaldives.id,
      lastMessageAt: daysAgo(3, 16),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: joaliThread.id,
      direction: "inbound",
      fromAddr: joali.contactEmail,
      toAddr: DESIGNER,
      body: `Dear Elena,

We have one Three Bedroom Ocean Residence available 18-27 December.

Rate is USD 92,500 for the full 9-night stay, gross, including daily breakfast, roundtrip shared seaplane transfers for 5 guests, and festive dinner on 24 Dec.

Please note the residence is overwater with internal stairs. We can add pool shade and a safety gate for children on request, but it may not be ideal for a guest with mobility concerns.

Deposit 50% due within 5 days to confirm. Cancellation becomes non-refundable from 1 October.

Kind regards,
Mila`,
      sentAt: daysAgo(3, 16),
    },
  ]);

  // 6. Ortega client and supplier threads — Sicily food, craft, and cancellation terms
  const [ortegaThread] = await db
    .insert(threads)
    .values({
      subject: "Sicily in October",
      counterpartType: "client",
      clientId: ortega.id,
      tripId: ortegaSicily.id,
      lastMessageAt: daysAgo(2, 8),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: ortegaThread.id,
      direction: "inbound",
      fromAddr: ortega.email,
      toAddr: DESIGNER,
      body: `Elena,

We are dreaming of Sicily but not the obvious version. Palermo palazzi, ceramics, maybe a private kitchen with a grandmother if that is not too staged. Javier wants one Etna winery but not five tastings in a row.

Two important things: Javier is newly gluten free, not celiac, but he gets very uncomfortable. And we need cancellation terms before we emotionally attach to any villa.

Could we keep this to three bases maximum? I know myself, I will want to add everything.

Lucia`,
      sentAt: daysAgo(2, 8),
    },
  ]);

  const [sicilyDmcThread] = await db
    .insert(threads)
    .values({
      subject: "Ortega Sicily — programme and villa",
      counterpartType: "supplier",
      supplierId: sicilianRoads.id,
      tripId: ortegaSicily.id,
      lastMessageAt: daysAgo(1, 17),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: sicilyDmcThread.id,
      direction: "inbound",
      fromAddr: sicilianRoads.contactEmail,
      toAddr: DESIGNER,
      body: `Cara Elena,

For the Ortegas we can arrange Palermo + Noto + Etna with private access:

Programme fee: EUR 18.400 total for two guests, gross. Includes 7 days private driver, 5 specialist guides, Palermo palazzo visit, Monreale after-hours, private ceramics studio in Caltagirone, one Etna winery lunch, and gluten-free restaurant vetting.

Villa near Noto: EUR 2.950 per night, 4 night minimum, net. Deposit 30% due to hold; refundable less EUR 750 admin fee until 60 days prior, then non-refundable.

We can hold the villa until Monday COB Italy. The grandmother cooking experience is possible, but the best host uses wheat flour in the kitchen daily, so not safe for celiac guests.

Un abbraccio,
Alessandra`,
      sentAt: daysAgo(1, 17),
    },
  ]);

  const [belmondThread] = await db
    .insert(threads)
    .values({
      subject: "Taormina beach finale — Ortega",
      counterpartType: "supplier",
      supplierId: villaSantAndrea.id,
      tripId: ortegaSicily.id,
      lastMessageAt: daysAgo(1, 10),
    })
    .returning();

  await db.insert(messages).values([
    {
      threadId: belmondThread.id,
      direction: "inbound",
      fromAddr: villaSantAndrea.contactEmail,
      toAddr: DESIGNER,
      body: `Dear Elena,

For 8-12 October 2026 we can offer:

Junior Suite Sea View: EUR 1,780 per night, gross, breakfast included.
Premium Suite Sea View with Terrace: EUR 2,640 per night, gross, breakfast included.

Rates include VAT, exclude city tax. 10% commission to Meridian.
Cancellation: 14 days prior without penalty; after that one night charged. We can hold both rooms for 4 days.

Warm regards,
Giulia`,
      sentAt: daysAgo(1, 10),
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
    {
      clientId: rao.id,
      tripId: raoMaldives.id,
      body: "Priya wants space and calm over a scene. Confirmed Jain vegetarian for Priya's father; no onion/garlic on some days. Grandfather has mild mobility limitations and should avoid steep stairs. Twins are strong swimmers but Priya worries about overwater decks. Anil wants as few transfers as possible after SIN-MLE.",
      createdAt: daysAgo(10),
    },
    {
      clientId: ortega.id,
      tripId: ortegaSicily.id,
      body: "Lucia loves private access but hates anything theatrical or fake. Javier wants cancellation terms and totals before committing. Gluten-free is important but not celiac-level cross-contamination. They prefer 2-3 bases, no one-night stops.",
      createdAt: daysAgo(7),
    },
  ]);

  // ---------- Intake form ----------
  await db.insert(intakeForms).values([
    {
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
    },
    {
      clientId: rao.id,
      tripId: raoMaldives.id,
      answers: {
        travelers: "2 adults, twins age 7, grandfather age 74",
        rooms: "Prefer 3 bedrooms if possible; grandfather should have a quiet room close to living area",
        priorities: "Privacy, safe swimming, excellent vegetarian food, minimal transfers",
        avoid: "Party atmosphere, long buggy rides for every meal, unsafe-feeling overwater decks",
        budget: "Comfortable up to USD 120k if the layout is right",
      },
      submittedAt: daysAgo(18),
    },
  ]);

  // ---------- Preferences (traceable facts) ----------
  const [meyerCall, chenCall, raoCall, ortegaCall] = [1, 2, 3, 4]; // call note ids in insert order
  await db.insert(clientPreferences).values([
    { clientId: meyer.id, kind: "confirmed", text: "One lodge per trip — no hotel splits", source: `call_note:${meyerCall}`, createdAt: daysAgo(12) },
    { clientId: meyer.id, kind: "confirmed", text: "Daily horseback riding option for the kids", source: `call_note:${meyerCall}`, createdAt: daysAgo(12) },
    { clientId: meyer.id, kind: "confirmed", text: "Sarah: no boats", source: `call_note:${meyerCall}`, createdAt: daysAgo(12) },
    { clientId: meyer.id, kind: "inferred", text: "Prefers concise emails; decisions via Sarah", source: "message:2", createdAt: daysAgo(1) },
    { clientId: ashford.id, kind: "confirmed", text: "George: no shellfish — medical, not preference", source: "message:5", createdAt: daysAgo(5) },
    { clientId: ashford.id, kind: "confirmed", text: "Max two hotels per trip", source: "form:1", createdAt: daysAgo(45) },
    { clientId: chen.id, kind: "confirmed", text: "Phone over email; never fills out forms", source: `call_note:${chenCall}`, createdAt: daysAgo(3) },
    { clientId: rao.id, kind: "confirmed", text: "Jain vegetarian meals must be handled properly, including no onion/garlic on some days", source: `call_note:${raoCall}`, createdAt: daysAgo(10) },
    { clientId: rao.id, kind: "confirmed", text: "Grandfather should avoid steep stairs and long walks between villa and shared spaces", source: `call_note:${raoCall}`, createdAt: daysAgo(10) },
    { clientId: rao.id, kind: "inferred", text: "Priya prefers safety and layout clarity over the most photogenic villa", source: "message:18", createdAt: daysAgo(1) },
    { clientId: ortega.id, kind: "confirmed", text: "Javier needs gluten-free dining support, but cross-contamination is not celiac-level critical", source: `call_note:${ortegaCall}`, createdAt: daysAgo(7) },
    { clientId: ortega.id, kind: "confirmed", text: "Cancellation terms and total costs must be clear before they attach emotionally to a villa", source: `call_note:${ortegaCall}`, createdAt: daysAgo(7) },
    { clientId: ortega.id, kind: "confirmed", text: "Keep Sicily to two or three bases; no one-night stops", source: "message:23", createdAt: daysAgo(2) },
  ]);

  console.log("Seeded: 5 clients, 5 trips, 11 suppliers, 15 threads, call notes, forms, preferences.");
}

seed().then(() => process.exit(0));
