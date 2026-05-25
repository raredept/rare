-- Additive snapshot for PAC/SEDEX quote data used by Stripe Checkout.
ALTER TABLE "Order" ADD COLUMN "shippingQuoteSnapshot" JSONB;
