import { API_BASE_URL } from "./config";
import { getToken, clearToken } from "./auth";

export interface FoodItem {
  id?: number;
  name: string;
  quantity: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface AnalyzeResponse {
  foods: FoodItem[];
  confidence: string;
  total_calories: number;
}

export interface Meal {
  id: number;
  date: string;
  time: string;
  source: "photo" | "manual";
  image_path: string | null;
  notes: string | null;
  foods: FoodItem[];
  total_calories: number;
}

export interface Goals {
  id: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  updated_at: string;
}

export interface DailySummary {
  date: string;
  goals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  consumed: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  remaining: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  meals_count: number;
}

export interface AuthResponse {
  token: string;
  user: { id: number; email: string };
}

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(callback: () => void) {
  onUnauthorized = callback;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
    ...options?.headers,
  };
  const resp = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (resp.status === 401 || resp.status === 403) {
    await clearToken();
    onUnauthorized?.();
    throw new Error("Session expired");
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API error ${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function register(email: string, password: string, inviteCode: string): Promise<AuthResponse> {
  const resp = await fetch(`${API_BASE_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, invite_code: inviteCode }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const resp = await fetch(`${API_BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function analyzePhoto(imageUri: string, hint?: string): Promise<AnalyzeResponse> {
  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "photo.jpg";
  formData.append("file", {
    uri: imageUri,
    name: filename,
    type: "image/jpeg",
  } as any);
  if (hint) {
    formData.append("food_description", hint);
  }

  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    body: formData,
    headers,
  });
  if (resp.status === 401 || resp.status === 403) {
    await clearToken();
    onUnauthorized?.();
    throw new Error("Session expired");
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Analyze error ${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function analyzeText(foodDescription: string): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>("/api/analyze_text", {
    method: "POST",
    body: JSON.stringify({ food_description: foodDescription }),
  });
}

export async function getMeals(date: string): Promise<Meal[]> {
  return request<Meal[]>(`/api/meals?date=${date}`);
}

export async function createMeal(meal: {
  source: "photo" | "manual";
  image_path?: string;
  foods: FoodItem[];
  notes?: string;
}): Promise<Meal> {
  const date = new Date().toISOString().split("T")[0];
  return request<Meal>("/api/meals", {
    method: "POST",
    body: JSON.stringify({ ...meal, date }),
  });
}

export async function deleteMeal(mealId: number): Promise<void> {
  await request(`/api/meals/${mealId}`, { method: "DELETE" });
}

export async function getGoals(): Promise<Goals> {
  return request<Goals>("/api/goals");
}

export async function updateGoals(goals: {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}): Promise<Goals> {
  return request<Goals>("/api/goals", {
    method: "PUT",
    body: JSON.stringify(goals),
  });
}

export async function getDailySummary(date: string): Promise<DailySummary> {
  return request<DailySummary>(`/api/summary?date=${date}`);
}

export interface HistoryEntry {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals_count: number;
}

export async function getHistory(start: string, end: string): Promise<HistoryEntry[]> {
  return request<HistoryEntry[]>(`/api/history?start=${start}&end=${end}`);
}

export interface SavedMeal {
  id: number;
  name: string;
  foods: FoodItem[];
  total_calories: number;
  created_at: string;
}

export async function saveMealForLater(name: string, foods: FoodItem[]): Promise<SavedMeal> {
  return request<SavedMeal>("/api/saved-meals", {
    method: "POST",
    body: JSON.stringify({ name, foods }),
  });
}

export async function getSavedMeals(query?: string): Promise<SavedMeal[]> {
  const params = query ? `?q=${encodeURIComponent(query)}` : "";
  return request<SavedMeal[]>(`/api/saved-meals${params}`);
}

export async function deleteSavedMeal(id: number): Promise<void> {
  await request(`/api/saved-meals/${id}`, { method: "DELETE" });
}
