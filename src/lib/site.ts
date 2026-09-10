export const site = {
  name: "Alicorn Agro",
  tagline: "Контролюйте кожен фактор, що впливає на врожай",
  email: "partnership@alicorn-agro.com",
  phone: "+380 934 5280 83",
  phoneHref: "tel:+380934528083",
} as const;

export const navItems = [
  { href: "/", label: "Головна" },
  { href: "/about", label: "Про нас" },
  { href: "/services", label: "Послуги" },
  { href: "/products", label: "Продукція" },
] as const;

export const services = [
  {
    title: "Консультації з агробізнесу",
    description:
      "Планування, масштабування та економічне обґрунтування рішень для поля, саду й теплиці.",
    href: "/services",
  },
  {
    title: "Дослідження ґрунтів",
    description:
      "Точний аналіз ґрунтів і субстратів, карти живлення та контроль ключових показників.",
    href: "/services",
  },
  {
    title: "Розробка сучасних технологій",
    description:
      "Цифрові інструменти, аеромоніторинг і автоматизація мікроклімату закритого ґрунту.",
    href: "/services",
  },
  {
    title: "Постійний зв'язок та підтримка",
    description:
      "Агрономічний супровід, дистанційний моніторинг і технічна підтримка на кожному етапі.",
    href: "/services",
  },
] as const;
