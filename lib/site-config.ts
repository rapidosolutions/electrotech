export const siteConfig = {
  company: "Electro Tech",
  descriptor: "Electrical & Solar Solutions",
  established: "2019",
  phoneDisplay: "+92 3105056394",
  phoneHref: "tel:+923105056394",
  whatsappNumber: "923105056394",
  whatsappHref:
    "https://wa.me/923105056394?text=Hello%20Electro%20Tech%2C%20I%20would%20like%20to%20discuss%20a%20solar%20or%20electrical%20project.",
  email: "info@electrotech.example",
  services: [
    "Solar Energy",
    "Solar Structures",
    "Electrical Works",
    "Security Systems",
    "Other Project Enquiry",
  ],
  projects: [
    { title: "Bilal Pharmacy", location: "Attock" },
    { title: "Haji and Sons Medicine Pharma" },
    { title: "Ahsan Pharmacy", location: "Hazro" },
    { title: "Green Wood School", location: "3 Meela, Attock" },
    { title: "Quaid-e-Azam Model School" },
  ],
  technologies: ["Inverex", "Solis", "Tesla", "Growatt", "Core Tech", "Itel"],
} as const;

export type ServiceName = (typeof siteConfig.services)[number];
