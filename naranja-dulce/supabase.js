// ─────────────────────────────────────────────
//  supabase.js  –  Naranja Dulce Gelatería
//  Reemplaza los valores de SUPABASE_URL y
//  SUPABASE_KEY con los de tu proyecto.
// ─────────────────────────────────────────────

const SUPABASE_URL = "https://orthflwimqlmsifvjehw.supabase.co";   // ← reemplaza
const SUPABASE_KEY = "sb_publishable_hWwv-cC2T_K7Nv-omqp4hA_ayOV5MSE";                        // ← reemplaza

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Auth helpers ──────────────────────────────

/** Registra un cliente nuevo y crea su perfil + tarjeta */
export async function signUp({ name, phone, email, password }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  const userId = data.user.id;

  // Crear perfil
  const { error: pe } = await supabase.from("profiles").insert({
    id: userId, name, phone, role: "cliente",
  });
  if (pe) throw pe;

  // Crear tarjeta de fidelidad
  const { error: ce } = await supabase.from("loyalty_cards").insert({
    user_id: userId, stamps: 0, total_redeemed: 0,
  });
  if (ce) throw ce;

  return data.user;
}

/** Login */
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

/** Logout */
export async function signOut() {
  await supabase.auth.signOut();
}

/** Usuario activo */
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

// ── Perfil ────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

// ── Tarjeta de fidelidad ──────────────────────

export async function getCard(userId) {
  const { data, error } = await supabase
    .from("loyalty_cards").select("*").eq("user_id", userId).single();
  if (error) throw error;
  return data;
}

export async function getVisits(cardId) {
  const { data, error } = await supabase
    .from("visits")
    .select("*")
    .eq("card_id", cardId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Canjear recompensa (resta 10 sellos) */
export async function redeemReward(cardId, currentStamps) {
  if (currentStamps < 10) throw new Error("Sellos insuficientes");
  const { error: ue } = await supabase
    .from("loyalty_cards")
    .update({ stamps: currentStamps - 10, total_redeemed: supabase.raw("total_redeemed + 1") })
    .eq("id", cardId);
  if (ue) throw ue;

  const { error: ve } = await supabase.from("visits").insert({
    card_id: cardId, type: "redeem", notes: "Gelato gratis canjeado",
  });
  if (ve) throw ve;
}

// ── Admin ─────────────────────────────────────

/** Lista todos los clientes con su tarjeta */
export async function getAllClients() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, loyalty_cards(id, stamps, total_redeemed, created_at)")
    .eq("role", "cliente")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Añade un sello a un cliente */
export async function addStamp(cardId, currentStamps) {
  const { error: ue } = await supabase
    .from("loyalty_cards")
    .update({ stamps: currentStamps + 1 })
    .eq("id", cardId);
  if (ue) throw ue;

  const { error: ve } = await supabase.from("visits").insert({
    card_id: cardId, type: "earn", notes: "Visita a la tienda",
  });
  if (ve) throw ve;
}

/** Resumen para el dashboard */
export async function getSummary() {
  const { count: totalClients } = await supabase
    .from("profiles").select("*", { count: "exact", head: true }).eq("role", "cliente");

  const today = new Date().toISOString().slice(0, 10);
  const { count: stampsToday } = await supabase
    .from("visits")
    .select("*", { count: "exact", head: true })
    .eq("type", "earn")
    .gte("created_at", today);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const { count: redeemsMonth } = await supabase
    .from("visits")
    .select("*", { count: "exact", head: true })
    .eq("type", "redeem")
    .gte("created_at", thisMonth);

  return { totalClients, stampsToday, redeemsMonth };
}

/** Admin crea un cliente manualmente */
export async function adminCreateClient({ name, phone, email, password }) {
  // Supabase no permite crear usuarios desde el cliente sin Auth Admin API.
  // Esta función usa el flujo normal de signUp y luego el admin puede
  // asignar el perfil correcto.
  return signUp({ name, phone, email, password });
}
