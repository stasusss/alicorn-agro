import { buildChatSystemPrompt } from "@/lib/chat/prompt";
import { buildKnowledgeBase } from "@/lib/chat/knowledge";
import { joinKnowledgeSections, parseKnowledgeSections } from "@/lib/chat/knowledge-sections";
import { describe, expect, it } from "vitest";

describe("knowledge sections", () => {
  it("builds a sectioned base from the site and the public academy pages", () => {
    const body = buildKnowledgeBase();
    const sections = parseKnowledgeSections(body);
    expect(sections.map((section) => section.title)).toEqual(
      expect.arrayContaining([
        "Джерела і межі",
        "Компанія",
        "ClimateGuard",
        "Що таке Plant Empowerment",
        "Автори",
        "Книги",
        "Шість балансів",
        "Повітря і CO2",
        "Світло, екрани і RNP",
        "Чого в базі немає",
        "Захист рослин у закритому ґрунті",
        "Біозахист",
        "Ґрунти України",
        "Середня врожайність культур в Україні",
        "Середня врожайність культур за регіонами України",
      ]),
    );
    expect(sections.length).toBeGreaterThan(50);
    expect(body).toContain("https://www.koppert.com/");
    expect(body).toContain("Держстат");
    expect(body).toContain("норми препаратів");
    expect(body).not.toContain("л/га");
    expect(joinKnowledgeSections(sections)).toContain("# Автори");
    expect(body).toContain("ir. P.A.M. Geelen");
    expect(body).toContain("ir. J.O. Voogt");
    expect(body).toContain("ing. P.A. van Weel");
    expect(body).toContain("https://www.plantempowerment.academy/en/");
    expect(body).toContain("Plant Empowerment Digital Growing");
    expect(body).toContain("не є послом");
    expect(body).not.toContain("сторінка 1");

    const prompt = buildChatSystemPrompt(body);
    expect(prompt).toContain("Не давай числових уставок");
    expect(prompt).toContain("Шість балансів");
  });
});
