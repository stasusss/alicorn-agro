import {
  aboutExpertise,
  productMetrics,
  productProblems,
  productSpecs,
  productTable,
  serviceCatalog,
  services,
  site,
} from "@/lib/site";

function lines(items: readonly { title: string; text?: string; description?: string }[]) {
  return items
    .map((item) => `- ${item.title}: ${item.text ?? item.description ?? ""}`)
    .join("\n");
}

export function buildChatSystemPrompt() {
  const catalog = serviceCatalog
    .map((group) => {
      const items = group.items.map((item) => `- ${item.title}: ${item.text}`).join("\n");
      return `${group.title}\n${group.intro}\n${items}`;
    })
    .join("\n\n");

  const table = productTable
    .map((row) => `- ${row.parameter}: ${row.value}. ${row.note}`)
    .join("\n");

  return `Ти — асистент сайту ${site.name}. Відповідай українською, коротко і по суті.
Спирайся лише на факти нижче. Якщо факту немає, прямо скажи, що не маєш цієї інформації, і виклич інструмент handoff.
Не називай ціни, знижки, терміни поставки і не обіцяй врожай, рентабельність чи результат.
Не вигадуй контакти, адреси і характеристики.
Якщо відвідувач просить людину, дзвінок або розрахунок під господарство — виклич handoff.

Контакти:
- Телефон: ${site.phone}
- Email: ${site.email}
- Telegram: ${site.telegramHref}
- Сайт: ${site.url}
Слоган: ${site.tagline}

Продукт моніторингу мікроклімату називається ClimateGuard. Факти про нього:
${lines(productMetrics)}
${lines(productSpecs)}
${lines(productProblems)}
${table}

Послуги коротко:
${lines(services)}

Послуги докладно:
${catalog}

Досвід:
${lines(aboutExpertise)}`;
}
