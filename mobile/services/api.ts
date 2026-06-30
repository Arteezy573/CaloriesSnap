import { API_BASE_URL } from "./config";
import { getToken, clearToken } from "./auth";
import { localDateString } from "./dates";

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
  image_path?: string | null;
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
  goal_weight_kg: number | null;
  updated_at: string;
}

export interface DailySummary {
  date: string;
  goals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  consumed: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  remaining: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  calories_burned: number;
  exercise_count: number;
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

export async function register(
  email: string,
  password: string,
  inviteCode: string
): Promise<{ email: string; verification_required: boolean }> {
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

export async function verifyEmail(email: string, code: string): Promise<AuthResponse> {
  const resp = await fetch(`${API_BASE_URL}/api/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  const resp = await fetch(`${API_BASE_URL}/api/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const resp = await fetch(`${API_BASE_URL}/api/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<{ message: string }> {
  const resp = await fetch(`${API_BASE_URL}/api/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, new_password: newPassword }),
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
  const date = localDateString();
  return request<Meal>("/api/meals", {
    method: "POST",
    body: JSON.stringify({ ...meal, date }),
  });
}

export async function updateMeal(
  mealId: number,
  payload: { foods: FoodItem[]; notes?: string }
): Promise<Meal> {
  return request<Meal>(`/api/meals/${mealId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
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
  goal_weight_kg?: number;
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

export interface WeightLog {
  id: number;
  date: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
}

export async function logWeight(payload: {
  date: string;
  weight_kg: number;
  note?: string;
}): Promise<WeightLog> {
  return request<WeightLog>("/api/weight", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getWeightLogs(start: string, end: string): Promise<WeightLog[]> {
  return request<WeightLog[]>(`/api/weight?start=${start}&end=${end}`);
}

export async function deleteWeightLog(date: string): Promise<void> {
  await request(`/api/weight/${date}`, { method: "DELETE" });
}

export interface Exercise {
  id: number;
  date: string;
  name: string;
  duration_min: number;
  calories_burned: number;
  created_at: string;
}

export async function logExercise(payload: {
  date: string;
  name: string;
  duration_min: number;
  calories_burned: number;
}): Promise<Exercise> {
  return request<Exercise>("/api/exercises", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getExercises(date: string): Promise<Exercise[]> {
  return request<Exercise[]>(`/api/exercises?date=${date}`);
}

export async function deleteExercise(id: number): Promise<void> {
  await request(`/api/exercises/${id}`, { method: "DELETE" });
}
