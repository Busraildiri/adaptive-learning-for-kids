import { describe, expect, it } from "vitest";
import { getChoiceVisual } from "./choiceVisual";

describe("getChoiceVisual", () => {
  it.each([
    ["emotion-happy", "Mutlu", "emoticon-happy-outline"],
    ["emotion-sad", "Üzgün", "emoticon-sad-outline"],
    ["emotion-angry", "Kızgın", "emoticon-angry-outline"],
    ["emotion-scared", "Korkmuş", "emoticon-frown-outline"],
    ["help-hug", "Sarılalım", "account-heart-outline"],
    ["help-new_balloon", "Yeni balon verelim", "balloon"],
    ["help-pet_head", "Başını okşayalım", "gesture-tap"],
    ["help-say_love", "Onu sevdiğimizi söyleyelim", "head-heart-outline"],
    ["help-give_gift", "Hediye verelim", "gift-outline"],
  ])("maps %s to a child-readable visual", (id, label, expectedIcon) => {
    expect(getChoiceVisual(id, label).icon).toBe(expectedIcon);
  });

  it("uses a warm generic help visual for unknown legacy choices", () => {
    expect(getChoiceVisual("legacy-option", "Birlikte yardım edelim").icon).toBe(
      "hand-heart-outline",
    );
  });
});
