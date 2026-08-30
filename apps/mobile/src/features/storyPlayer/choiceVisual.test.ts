import { describe, expect, it } from "vitest";
import { getChoiceVisual } from "./choiceVisual";

describe("getChoiceVisual", () => {
  it.each([
    ["emotion-happy", "Mutlu", "😊"],
    ["emotion-sad", "Üzgün", "😢"],
    ["emotion-angry", "Kızgın", "😠"],
    ["emotion-scared", "Korkmuş", "😨"],
    ["help-hug", "Sarılalım", "🤗"],
    ["help-new_balloon", "Yeni balon verelim", "🎈"],
    ["help-pet_head", "Başını okşayalım", "🫳🐱"],
    ["help-say_love", "Onu sevdiğimizi söyleyelim", "💬❤️"],
    ["help-give_gift", "Hediye verelim", "🎁"],
  ])("maps %s to a child-readable visual", (id, label, expectedSymbol) => {
    expect(getChoiceVisual(id, label).symbol).toBe(expectedSymbol);
  });

  it("uses a warm generic help visual for unknown legacy choices", () => {
    expect(getChoiceVisual("legacy-option", "Birlikte yardım edelim").symbol).toBe("🤝");
  });
});
