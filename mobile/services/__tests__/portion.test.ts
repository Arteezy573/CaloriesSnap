import { scaleFoods } from "../portion";
import { FoodItem } from "../api";

function food(overrides: Partial<FoodItem> = {}): FoodItem {
  return { name: "Rice", quantity: "1 cup", calories: 200, protein_g: 4.4, carbs_g: 44.6, fat_g: 0.4, ...overrides };
}

describe("scaleFoods", () => {
  it("returns identical values at fraction 1", () => {
    expect(scaleFoods([food()], 1)[0]).toEqual(food());
  });

  it("halves calories and macros at 0.5", () => {
    const out = scaleFoods([food({ calories: 200, protein_g: 4.4, carbs_g: 44.6, fat_g: 0.4 })], 0.5);
    expect(out[0].calories).toBe(100);
    expect(out[0].protein_g).toBe(2.2);
    expect(out[0].carbs_g).toBe(22.3);
    expect(out[0].fat_g).toBe(0.2);
  });

  it("zeroes everything at 0", () => {
    const out = scaleFoods([food()], 0);
    expect(out[0].calories).toBe(0);
    expect(out[0].protein_g).toBe(0);
    expect(out[0].carbs_g).toBe(0);
    expect(out[0].fat_g).toBe(0);
  });

  it("rounds calories to integer and macros to one decimal", () => {
    const out = scaleFoods([food({ calories: 201, protein_g: 4.44, carbs_g: 44.66, fat_g: 0.44 })], 0.5);
    expect(out[0].calories).toBe(101); // 100.5 -> 101
    expect(out[0].protein_g).toBe(2.2); // 2.22 -> 2.2
    expect(out[0].carbs_g).toBe(22.3); // 22.33 -> 22.3
    expect(out[0].fat_g).toBe(0.2); // 0.22 -> 0.2
  });

  it("preserves name and quantity", () => {
    const out = scaleFoods([food({ name: "Tofu", quantity: "200 g" })], 0.5);
    expect(out[0].name).toBe("Tofu");
    expect(out[0].quantity).toBe("200 g");
  });

  it("does not mutate the input array", () => {
    const input = [food({ calories: 200 })];
    scaleFoods(input, 0.5);
    expect(input[0].calories).toBe(200);
  });

  it("handles an empty array", () => {
    expect(scaleFoods([], 0.5)).toEqual([]);
  });
});
