import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const FoodEstimate = z.object({
  name: z.string(),
  calories: z.number().int().nonnegative(),
  caloriesLow: z.number().int().nonnegative(),
  caloriesHigh: z.number().int().nonnegative(),
  protein: z.number().int().nonnegative(),
  carbs: z.number().int().nonnegative(),
  fat: z.number().int().nonnegative(),
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
              text: `Estimate the nutrition for the entire visible meal.

Return a short everyday meal name, a single practical calorie estimate, a realistic low-to-high calorie range, and estimated grams of protein, carbohydrates, and fat.

Judge visible portion sizes carefully. Account for likely cooking oil or sauce only when visually reasonable. Do not invent a brand, exact ingredients, or an exact weight that the image cannot establish. If the image is unclear, incomplete, or not food, use low confidence and explain the main uncertainty in assumptions.

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
    return NextResponse.json({
      ...estimate,
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
