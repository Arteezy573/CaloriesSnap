import { API_BASE_URL } from "./config";

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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API error ${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function analyzePhoto(imageUri: string): Promise<AnalyzeResponse> {
  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "photo.jpg";
  formData.append("file", {
    uri: imageUri,
    name: filename,
    type: "image/jpeg",
  } as any);

  const resp = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    body: formData,
  });
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
  return request<Meal>("/api/meals", {
    method: "POST",
    body: JSON.stringify(meal),
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
