import Stripe from "stripe";
import { NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import prismadb from "@/lib/prismadb";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(
    req: Request,
    { params }: { params: { storeId: string } }
  ) {
    const { productIds } = await req.json();
    const storeId = params.storeId;
  
    if (!productIds || productIds.length === 0) {
      return new NextResponse("Product ids are required", { status: 400 });
    }
  
    const products = await prismadb.product.findMany({
      where: {
        id: {
          in: productIds
        }
      }
    });
  
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  
    products.forEach((product) => {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: 'USD',
          product_data: {
            name: product.name,
          },
          unit_amount: product.price.toNumber() * 100
        }
      });
    });
  
    const order = await prismadb.order.create({
      data: {
        storeId: params.storeId,
        isPaid: false,
        orderItems: {
          create: productIds.map((productId: string) => ({
            product: {
              connect: {
                id: productId
              }
            }
          }))
        }
      }
    });
  
    // Customize success and cancel URLs based on the storeId parameter
    const successURL = storeId === 'f6076b93-da16-45c9-a507-6d49e11fa07a'
      ? process.env.FRONTEND_STORE_URL_JACC
      : process.env.FRONTEND_STORE_URL;
  
    const cancelURL = storeId === 'f6076b93-da16-45c9-a507-6d49e11fa07a'
      ? process.env.FRONTEND_STORE_URL_JACC
      : process.env.FRONTEND_STORE_URL;
  
    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: 'payment',
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true,
      },
      success_url: `${successURL}/cart?success=1`,
      cancel_url: `${cancelURL}/cart?canceled=1`,
      metadata: {
        orderId: order.id
      },
    });
  
    return NextResponse.json({ url: session.url },  {
      headers: corsHeaders
    });
  };
  