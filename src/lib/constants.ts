export const formatPrice = (price: number): string => {
  if (!price || isNaN(price)) return "0";
  return price.toLocaleString("ru-RU").replace(/\s/g, " ");
};

export const resolveProductPrices = (uzsPrice: number, rate: number = 12700) => {
  const currentRate = rate > 0 ? rate : 12700;
  const priceUZS = Math.round(uzsPrice || 0);
  const priceUSD = Math.round(priceUZS / currentRate);
  return { priceUZS, priceUSD };
};
