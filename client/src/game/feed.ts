// Harborfall — Phase 7 phone feeds (work item 7): the News app carries
// headlines generated from what the player actually does (missions,
// chases, purchases, weather), and SableSocial carries ambient NPC posts
// that react to the time, the weather and the player's public crimes.
// Both are rolling, persisted feeds — flavour with a memory.
import { G } from "./store";
import { districtAt } from "../world";

export interface FeedItem { title: string; body: string; at: number; }
const listeners = new Set<() => void>();
export function onFeed(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
const emit = () => listeners.forEach((fn) => fn());

function load(key: string): FeedItem[] {
  try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw) as FeedItem[]; } catch { /* fresh */ }
  return [];
}
function save(key: string, items: FeedItem[]) {
  try { localStorage.setItem(key, JSON.stringify(items.slice(0, 20))); } catch { /* ignore */ }
}

export const newsFeed: FeedItem[] = load("harborfall-news");
export const socialFeed: FeedItem[] = load("harborfall-social");
if (newsFeed.length === 0) {
  newsFeed.push({ title: "Harbour Wire — morning edition", body: "Ferry traffic normal, gulls aggressive, Solano Trucking 'unavailable for comment' for the 41st consecutive day.", at: 0 });
}
if (socialFeed.length === 0) {
  socialFeed.push({ title: "@sableferryfan", body: "golden hour over the bay never misses. port sable forever 🌅", at: 0 });
}

export function pushNews(title: string, body: string) {
  newsFeed.unshift({ title, body, at: G.timeS });
  if (newsFeed.length > 20) newsFeed.length = 20;
  save("harborfall-news", newsFeed); emit();
}
export function pushSocial(title: string, body: string) {
  socialFeed.unshift({ title, body, at: G.timeS });
  if (socialFeed.length > 20) socialFeed.length = 20;
  save("harborfall-social", socialFeed); emit();
}

// ------------------------------------------------------------- social
const HANDLES = ["@dockworker_dan", "@sableferryfan", "@coral.kid", "@northgate.nana", "@taxi.tam", "@gullwatcher", "@marina.m", "@yardsforeman", "@ferryfran", "@lighthouse.leo"];
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export function gameHourLabel(): string {
  const h = Math.floor((G.dayTime * 24 + 6) % 24);
  if (h < 5) return "way too late";
  if (h < 9) return "early";
  if (h < 12) return "mid-morning";
  if (h < 15) return "midday";
  if (h < 18) return "afternoon";
  if (h < 21) return "golden hour";
  return "late";
}

/** One ambient NPC post, reactive to time / weather / where the player is. */
export function rollSocialPost() {
  const district = districtAt(G.followPos.x, G.followPos.z);
  const w = G.weather;
  const posts: string[] = [
    `the bay at ${gameHourLabel()} hits different. no filter needed`,
    `traffic on the causeway is crawling again. leave early, neighbours`,
    `someone left a Gullwing running outside Sable Motors and I have never felt poorer`,
    `Harbour Wraps queue is out the door. worth it. always worth it`,
    `the lighthouse keeper swears the light waved at him. sure, leo`,
    `bus driver just waited for a running kid at the stop. port sable still has manners`,
    `rode the Sable Line over the whole city at golden hour. the tram is the best seat in port sable and it costs nothing`,
    `the tram driver waved at me from the guideway. we're basically friends now`,
    `Sable Line was packed at Market Row this morning — the loop is actually FASTER than the causeway traffic`,
    `ferris-side sunsets > everything. fight me`,
    `Northgate car wash line is six deep. rich people dirt is still dirt`,
  ];
  if (w === "Rain" || w === "Storm") posts.push(`this ${w.toLowerCase()} came out of nowhere?? my umbrella gave up at ${district}`, `rain on the harbour roads — drive like your nan's watching`);
  if (w === "Fog") posts.push(`fog so thick the bridge is just a rumour now`, `can't see the water from ${district}. eerie and beautiful`);
  if (w === "Clear") posts.push(`clear skies over ${district} — beach day, no excuses`);
  if (G.nightFactor > 0.6) posts.push(`Club Solace queue already around the block`, `city lights on wet roads. port sable showing off again`);
  pushSocial(pick(HANDLES), pick(posts));
}

/** A bystander post about the player's public crime spree. */
export function socialCrimePost() {
  const district = districtAt(G.followPos.x, G.followPos.z);
  pushSocial(pick(HANDLES), pick([
    `HELICOPTER over ${district}?? what is happening tonight`,
    `sirens everywhere near ${district}. stay safe out there`,
    `just saw a full patrol chase tear past ${district}. this city is a film set now`,
    `whoever the patrol is chasing through ${district} — they can DRIVE`,
  ]));
}
