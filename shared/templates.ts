import type { FormatTemplate } from "../plugin/src/types";

export function toPx(value: number, unit: "px" | "mm" | "in", dpi: number): number {
  switch (unit) {
    case "px": return value;
    case "mm": return Math.round((value / 25.4) * dpi);
    case "in": return Math.round(value * dpi);
  }
}

function digital(id: string, name: string, width: number, height: number, subcategory: string, notes?: string): FormatTemplate {
  return { id, name, width, height, category: "Digital", subcategory, unit: "px", dpi: 72, notes };
}

function print(id: string, name: string, width: number, height: number, unit: "mm" | "in", subcategory: string, bleed?: number, notes?: string): FormatTemplate {
  return {
    id, name, width, height, category: "Print", subcategory,
    unit, dpi: 300, bleed: bleed ?? (unit === "mm" ? 3 : 0.125), safeZone: bleed ?? (unit === "mm" ? 5 : 0.25),
    notes,
  };
}

export const ALL_TEMPLATES: FormatTemplate[] = [
  // Digital: Social Media
  digital("instagram-post", "Instagram Post", 1080, 1080, "Social Media"),
  digital("instagram-story", "Instagram Story", 1080, 1920, "Social Media"),
  digital("instagram-reel-cover", "Instagram Reel Cover", 1080, 1920, "Social Media"),
  digital("facebook-post", "Facebook Post", 1200, 630, "Social Media"),
  digital("facebook-ad", "Facebook Ad", 1200, 628, "Social Media"),
  digital("linkedin-post", "LinkedIn Post", 1200, 627, "Social Media"),
  digital("linkedin-banner", "LinkedIn Banner", 1584, 396, "Social Media"),
  digital("x-post", "X/Twitter Post", 1600, 900, "Social Media"),
  digital("tiktok-cover", "TikTok Cover", 1080, 1920, "Social Media"),
  digital("pinterest-pin", "Pinterest Pin", 1000, 1500, "Social Media"),
  digital("youtube-thumbnail", "YouTube Thumbnail", 1280, 720, "Social Media"),

  // Digital: Display Ads
  digital("leaderboard", "Leaderboard", 728, 90, "Display Ads"),
  digital("medium-rectangle", "Medium Rectangle", 300, 250, "Display Ads"),
  digital("wide-skyscraper", "Wide Skyscraper", 160, 600, "Display Ads"),
  digital("half-page", "Half Page", 300, 600, "Display Ads"),
  digital("large-rectangle", "Large Rectangle", 336, 280, "Display Ads"),
  digital("billboard", "Billboard", 970, 250, "Display Ads"),

  // Digital: Video
  digital("video-landscape", "16:9 Landscape", 1920, 1080, "Video"),
  digital("video-portrait", "9:16 Portrait", 1080, 1920, "Video"),
  digital("video-square", "1:1 Square", 1080, 1080, "Video"),
  digital("video-vertical", "4:5 Vertical", 1080, 1350, "Video"),

  // Digital: Email & Web
  digital("email-header", "Email Header", 600, 200, "Email & Web"),
  digital("web-banner", "Web Banner", 1440, 400, "Email & Web"),
  digital("og-image", "OG Image", 1200, 630, "Email & Web"),

  // Print: DIN Standard
  print("din-a3", "A3 Poster", 297, 420, "mm", "DIN Standard"),
  print("din-a4", "A4 Flyer", 210, 297, "mm", "DIN Standard"),
  print("din-a5", "A5 Flyer", 148, 210, "mm", "DIN Standard"),
  print("din-a6", "A6 Postcard", 105, 148, "mm", "DIN Standard"),
  print("din-dl", "DL Envelope", 99, 210, "mm", "DIN Standard"),

  // Print: US Standard
  print("us-letter", "US Letter", 8.5, 11, "in", "US Standard"),
  print("us-legal", "US Legal", 8.5, 14, "in", "US Standard"),
  print("us-tabloid", "US Tabloid", 11, 17, "in", "US Standard"),
  print("us-postcard", "US Postcard", 4, 6, "in", "US Standard"),

  // Print: Posters & Signage
  print("poster-18x24", "18×24in Poster", 18, 24, "in", "Posters & Signage"),
  print("poster-24x36", "24×36in Poster", 24, 36, "in", "Posters & Signage"),
  print("din-a1", "A1 Poster", 594, 841, "mm", "Posters & Signage"),
  print("din-a0", "A0 Poster", 841, 1189, "mm", "Posters & Signage"),
  print("rollup-banner", "Roll-Up Banner", 850, 2000, "mm", "Posters & Signage"),

  // Print: Business
  print("business-card-eu", "Business Card", 85, 55, "mm", "Business"),
  print("business-card-us", "US Business Card", 3.5, 2, "in", "Business"),
  print("letterhead", "Letterhead", 210, 297, "mm", "Business", 0, "No bleed — matches A4"),
  print("compliment-slip", "Compliment Slip", 99, 210, "mm", "Business"),
];

export function getCategories(): string[] {
  return [...new Set(ALL_TEMPLATES.map((t) => t.category))];
}

export function getSubcategories(category: string): string[] {
  return [...new Set(ALL_TEMPLATES.filter((t) => t.category === category).map((t) => t.subcategory))];
}

export function getTemplatesByCategory(category: string): FormatTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplatesBySubcategory(category: string, subcategory: string): FormatTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.category === category && t.subcategory === subcategory);
}

export function getTemplateById(id: string): FormatTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}
