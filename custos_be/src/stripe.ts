import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim();
export const stripe = key ? new Stripe(key) : null;

export function stripeEnabled(): boolean {
  return Boolean(stripe);
}
