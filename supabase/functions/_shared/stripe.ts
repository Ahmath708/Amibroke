export function getStripeSecretKey(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return key;
}

export async function stripeFetch(path: string, options: { method?: string; body?: URLSearchParams } = {}): Promise<any> {
  const key = getStripeSecretKey();
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: options.body,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stripe API error ${response.status}: ${errorText}`);
  }
  return response.json();
}
