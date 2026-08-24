import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

export const quoteSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(100),
    phone: z
      .string()
      .trim()
      .min(7, "Enter a valid phone or WhatsApp number")
      .max(24)
      .regex(/^[+()\-\s\d]+$/, "Use digits and standard phone symbols only"),
    city: z.string().trim().min(2, "Enter the project location").max(100),
    service: z.enum([
      "Solar Energy",
      "Solar Structures",
      "Electrical Works",
      "Security Systems",
      "Other Project Enquiry",
    ]),
    email: z
      .union([z.literal(""), z.string().trim().email("Enter a valid email").max(160)])
      .optional()
      .transform((value) => value?.toLowerCase() || undefined),
    company: optionalText(120),
    propertyType: z.enum(["Home", "Business", "Institution", "Other"]).optional(),
    systemType: z.enum(["On-Grid", "Hybrid", "Off-Grid", "Not Sure"]).optional(),
    requiredCapacity: optionalText(80),
    monthlyBillRange: z
      .enum([
        "Under PKR 25,000",
        "PKR 25,000–50,000",
        "PKR 50,000–100,000",
        "PKR 100,000+",
        "Prefer not to say",
      ])
      .optional(),
    message: optionalText(1000),
    website: z.string().max(0, "Invalid submission").optional(),
  })
  .superRefine((data, context) => {
    if (data.service === "Solar Energy" && !data.propertyType) {
      context.addIssue({
        code: "custom",
        path: ["propertyType"],
        message: "Choose a property type",
      });
    }
    if (data.service === "Solar Energy" && !data.systemType) {
      context.addIssue({
        code: "custom",
        path: ["systemType"],
        message: "Choose a preferred solar system",
      });
    }
  });

export type QuoteInput = z.input<typeof quoteSchema>;
export type QuoteData = z.output<typeof quoteSchema>;

export function normalizePhone(phone: string) {
  const normalized = phone.replace(/[^+\d]/g, "");
  return normalized.startsWith("00") ? `+${normalized.slice(2)}` : normalized;
}
