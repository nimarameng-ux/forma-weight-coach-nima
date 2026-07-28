import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const FoodEstimate = z.object({
  sourceType: z.enum(["meal", "package", "nutrition_label", "unknown"]),
  name: z.string(),
  servingLabel: z.string(),
  servingsInPackage: z.number().nonnegative(),
  calories: z.number().int().nonnegative(),
  caloriesLow: z.number().int().nonnegative(),
  caloriesHigh: z.number().int().nonnegative(),
  protein: z.number().int().nonnegative(),
  carbs: z.number().int().nonnegative(),
  fat: z.number().int().nonnegative(),
  packageCalories: z.number().int().nonnegative(),
  packageProtein: z.number().int().nonnegative(),
  packageCarbs: z.number().int().nonnegative(),
  packageFat: z.number().int().nonnegative(),
  confidence: z.enum(["low", "medium", "high"]),
  assumptions: z.array(z.string()),
});

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        code: "AI_SETUP_REQUIRED",
        error: "Food-photo analysis has not been activated yet.",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { image?: unknown };
    if (
      typeof body.image !== "string" ||
      !/^data:image\/(?:jpeg|png|webp);base64,/i.test(body.image)
    ) {
      return NextResponse.json({ error: "Please send a valid food photo." }, { status: 400 });
    }
    if (body.image.length > 4_000_000) {
      return NextResponse.json(
        { error: "That photo is too large. Please take another one." },
        { status: 413 },
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.parse({
      model: process.env.OPENAI_FOOD_MODEL || "gpt-5.6-luna",
      store: false,
      reasoning: { effort: "low" },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Analyse this as either a prepared meal, packaged food, or a nutrition label.

First classify sourceType as meal, package, nutrition_label, or unknown.

For a prepared meal:
- Estimate nutrition for the entire visible meal.
- servingLabel should be "visible meal", servingsInPackage should be 1, and package totals should equal the meal totals.

For packaged food or a nutrition label:
- Read the product name, serving size, servings per package, calories, and macros from visible packaging whenever legible.
- The main calories/protein/carbs/fat fields must describe ONE labelled serving.
- packageCalories/packageProtein/packageCarbs/packageFat must describe the WHOLE package.
- servingLabel should be short, such as "4 biscuits (30g)".
- If only the front is visible and nutrition facts are not readable, make a cautious estimate, use low confidence, and say that the nutrition label would improve accuracy.

Return a short everyday name, a practical calorie estimate, a realistic low-to-high calorie range for the default one-serving or visible-meal amount, and grams of protein, carbohydrates, and fat.

Judge portion sizes carefully. Account for likely cooking oil or sauce only when visually reasonable. Do not invent a brand, exact ingredients, or an exact weight that the image cannot establish. If the image is unclear or not food, use low confidence and explain the main uncertainty.

Keep assumptions short and useful. The point estimate must sit between caloriesLow and caloriesHigh. This is general tracking guidance, not a medical measurement.`,
            },
            {
              type: "input_image",
              image_url: body.image,
              detail: "auto",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(FoodEstimate, "food_estimate"),
      },
    });

    if (!response.output_parsed) {
      return NextResponse.json(
        { error: "Forma could not estimate this meal. Please try a clearer photo." },
        { status: 422 },
      );
    }

    const estimate = response.output_parsed;
    const servingsInPackage = Math.max(1, estimate.servingsInPackage || 1);
    const packageCalories = Math.max(
      estimate.calories,
      estimate.packageCalories || estimate.calories * servingsInPackage,
    );
    const packageProtein = Math.max(
      estimate.protein,
      estimate.packageProtein || estimate.protein * servingsInPackage,
    );
    const packageCarbs = Math.max(
      estimate.carbs,
      estimate.packageCarbs || estimate.carbs * servingsInPackage,
    );
    const packageFat = Math.max(
      estimate.fat,
      estimate.packageFat || estimate.fat * servingsInPackage,
    );

    return NextResponse.json({
      ...estimate,
      servingsInPackage,
      packageCalories,
      packageProtein,
      packageCarbs,
      packageFat,
      caloriesLow: Math.min(estimate.caloriesLow, estimate.calories),
      caloriesHigh: Math.max(estimate.caloriesHigh, estimate.calories),
      assumptions: estimate.assumptions.slice(0, 4),
    });
  } catch (error) {
    console.error("Food photo analysis failed", error);
    return NextResponse.json(
      { error: "Forma could not analyse this photo right now. Please try again." },
      { status: 500 },
    );
  }
}
